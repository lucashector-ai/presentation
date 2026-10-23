'use client'
/**
 * IA dentro da apresentação (editor): Reescrever o texto de uma tela, Refazer uma tela e Gerar imagem (em breve).
 * Botão "✦ IA" no cabeçalho do editor + painel compacto. Também abre pelo menu de contexto do canvas e pela
 * seção IA do inspetor de texto (`abrirIA`). O resultado sempre aparece antes/depois e só entra no documento
 * em "Aplicar" — um passo de desfazer. Custos de `CUSTO_CREDITOS` (lib/planos.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ImageIcon, Languages, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react'
import type { Editor } from '@/lib/editor/useEditor'
import type { CamadaTexto, Cena } from '@/lib/scene/schema'
import { medirTexto } from '@/lib/editor/medirTexto'
import { dados, ehErroDados, mensagemDeErro, useDados } from '@/lib/dados'
import { CUSTO_CREDITOS } from '@/lib/planos'
import { textoTelas } from '@/lib/telasIa'
import { ACOES_TEXTO, IDIOMAS, NOMES_IDIOMA, ROTULOS_ACAO, type AcaoTexto, type Idioma } from '@/lib/ia/texto'
import { aplicarTela, mapearTela, quantidadeDeItens, textosDaTela, textosParaReescrever, type ConteudoTela, type MapaTela } from '@/lib/ia/tela'
import type { TipoTela } from '@/lib/ia/roteiro'
import { NOMES_TIPO_TELA } from '@/lib/ia/designSystem'
import { useCreditos } from '@/components/app/Creditos'
import { Botao, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

/** Demo: o saldo fictício é debitado mesmo com o gerador local, para o ciclo de créditos ficar visível. */
const DEMO = dados.capacidades.creditosFicticios
const fmt = (n: number) => n.toLocaleString('pt-BR')

export type AbaIA = 'texto' | 'tela' | 'imagem'
const EVENTO = 'mostra:ia'

/** Abre o painel de IA do editor (de qualquer lugar: menu de contexto, inspetor). */
export function abrirIA(aba: AbaIA = 'texto') {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { aba } }))
}

const NOMES_TIPO: Record<TipoTela, string> = NOMES_TIPO_TELA
const DICA_ACAO: Record<AcaoTexto, string> = { curto: 'Corta palavras e orações', impactante: 'Direto, sem rodeios', formal: 'Tom profissional', simples: 'Palavras do dia a dia', corrigir: 'Ortografia e pontuação', traduzir: 'Inglês, espanhol ou português' }
const SUGESTOES = ['Deixe mais direto', 'Foque em números', 'Tom mais formal', 'Mais simples']

interface Mudanca { id: string; papel: string; antes: string; depois: string; naoCabe: boolean }
type Resultado =
  | { tipo: 'texto'; cenaId: string; titulo: string; mudancas: Mudanca[]; gerador: 'claude' | 'local'; aviso?: string; custo: number }
  | { tipo: 'tela'; cenaId: string; titulo: string; mudancas: Mudanca[]; gerador: 'claude' | 'local'; aviso?: string; custo: number; mapa: MapaTela; novo: ConteudoTela; notas: { antes: string; depois: string } | null }

/** O texto novo ainda cabe na caixa? Compara com o original medido do mesmo jeito (o renderizador usa os mesmos estilos). */
function naoCabe(l: CamadaTexto, texto: string, cena: Cena): boolean {
  try {
    const antes = medirTexto(l).height
    const depois = medirTexto({ ...l, text: texto }).height
    if (l.sizingH === 'hug') return l.y + depois > cena.size.height && depois > antes
    return depois > Math.max(l.height, antes) + 1
  } catch {
    return false
  }
}

/** Botão ✦ IA do cabeçalho; monta o painel. */
export function BotaoIA({ editor, nomeProjeto }: { editor: Editor; nomeProjeto: string }) {
  const [aba, setAba] = useState<AbaIA | null>(null)
  useEffect(() => {
    const abrir = (e: Event) => setAba((e as CustomEvent<{ aba?: AbaIA }>).detail?.aba ?? 'texto')
    window.addEventListener(EVENTO, abrir)
    return () => window.removeEventListener(EVENTO, abrir)
  }, [])
  return (
    <>
      <Botao tamanho="sm" variante="fantasma" className={cx('hidden md:inline-flex', aba && 'bg-hover')} aria-expanded={!!aba} aria-haspopup="dialog" title="IA nesta tela: reescrever texto, refazer tela" icone={<Sparkles className="h-4 w-4 text-acento" />} onClick={() => setAba((a) => (a ? null : 'texto'))}>
        IA
      </Botao>
      {aba && <PainelIA editor={editor} nomeProjeto={nomeProjeto} aba={aba} aoMudarAba={setAba} aoFechar={() => setAba(null)} />}
    </>
  )
}

export function PainelIA({ editor, nomeProjeto, aba, aoMudarAba, aoFechar }: { editor: Editor; nomeProjeto: string; aba: AbaIA; aoMudarAba: (a: AbaIA) => void; aoFechar: () => void }) {
  const { cena, acoes, estado, camadasSelecionadas, indiceCena } = editor
  const ref = useRef<HTMLDivElement>(null)
  const saldo = useDados((e) => e.creditos.saldo)
  const { abrirCompra } = useCreditos()
  const { mostrar } = useToast()
  const [carregando, setCarregando] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [traduzir, setTraduzir] = useState(false)
  const [instrucao, setInstrucao] = useState('')
  const abortar = useRef<AbortController | null>(null)

  const selecaoTexto = camadasSelecionadas.filter((l): l is CamadaTexto => l.type === 'text' && !!l.text.trim())
  // com texto selecionado, o padrão é reescrever a seleção; sem seleção, a tela inteira
  const temSelecao = selecaoTexto.length > 0
  const [escopo, setEscopo] = useState<'selecao' | 'tela'>(temSelecao ? 'selecao' : 'tela')
  useEffect(() => { setEscopo(temSelecao ? 'selecao' : 'tela') }, [temSelecao])
  const usarSelecao = escopo === 'selecao' && selecaoTexto.length > 0
  const alvoTexto = useMemo(() => (cena ? textosParaReescrever(cena, usarSelecao ? selecaoTexto.map((l) => l.id) : undefined) : []), [cena, usarSelecao, selecaoTexto])
  const total = estado.documento.scenes.length
  const mapeada = useMemo(() => (cena ? mapearTela(cena, indiceCena, total) : null), [cena, indiceCena, total])
  const numeroTela = String(indiceCena + 1).padStart(2, '0')

  // trocar de tela descarta a prévia (o resultado é daquela tela)
  useEffect(() => { setResultado(null); setTraduzir(false) }, [cena?.id])
  useEffect(() => () => abortar.current?.abort(), [])
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar
  useEffect(() => {
    // Esc fecha o painel (se um modal estiver aberto por cima, ele fecha primeiro)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) fechar.current() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])
  // foco na primeira ação ao abrir ou trocar de aba
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role="tabpanel"] [data-foco]')?.focus({ preventScroll: true }) }, [aba])

  /** Confere o saldo antes de chamar a IA; sem saldo, abre a compra com o motivo. */
  const temSaldo = useCallback((custo: number, acao: string) => {
    const s = dados.estado().creditos.saldo
    if (s >= custo) return true
    abrirCompra(`${acao} custa ${custo} créditos e você tem ${fmt(s)}. Escolha um pacote para continuar.`)
    return false
  }, [abrirCompra])

  const mudancasDe = (c: Cena, novos: Map<string, string>, papeis: Map<string, string>): Mudanca[] =>
    c.layers.flatMap((l) => (l.type === 'text' && novos.has(l.id) && novos.get(l.id) !== l.text ? [{ id: l.id, papel: papeis.get(l.id) ?? 'Texto', antes: l.text, depois: novos.get(l.id)!, naoCabe: naoCabe(l, novos.get(l.id)!, c) }] : []))

  const erro = (e: unknown, ctrl: AbortController) => {
    if (ctrl.signal.aborted) return
    if (ehErroDados(e, 'limite_do_plano')) return abrirCompra(e.message)
    mostrar(mensagemDeErro(e, 'A IA não respondeu. Tente de novo.'), 'erro')
  }

  const reescrever = async (acao: AcaoTexto, idioma?: Idioma) => {
    if (!cena || !alvoTexto.length || carregando) return
    const custo = CUSTO_CREDITOS.reescrever
    if (!temSaldo(custo, 'Reescrever o texto')) return
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl
    const chave = idioma ? `traduzir-${idioma}` : acao
    setCarregando(chave)
    const c = cena
    try {
      const r = await dados.ia.texto({ acao, idioma, textos: alvoTexto.slice(0, 40).map((t) => ({ ...t, texto: t.texto.slice(0, 5000) })), contexto: { apresentacao: nomeProjeto.slice(0, 200), tela: c.title.slice(0, 200) } }, ctrl.signal)
      const papeis = new Map(alvoTexto.map((t) => [t.id, ({ titulo: 'Título', texto: 'Texto', item: 'Item', rotulo: 'Rótulo' } as const)[t.papel]]))
      const mudancas = mudancasDe(c, new Map(r.textos.map((t) => [t.id, t.texto])), papeis)
      // no modo demonstração o débito acontece aqui (créditos fictícios); no backend real a rota debita quando o Claude escreve
      dados.registrarUsoIa({ custo, motivo: `Reescrever texto com IA · tela ${numeroTela}`, gerador: r.gerador, houveResultado: mudancas.length > 0 })
      if (!mudancas.length) {
        mostrar(r.gerador === 'local' ? 'O exemplo local não achou o que mudar neste texto. Tente outra ação.' : 'O texto já estava bom: nada mudou.', 'info')
        return
      }
      setResultado({ tipo: 'texto', cenaId: c.id, titulo: idioma ? `Traduzir para ${NOMES_IDIOMA[idioma].toLowerCase()}` : ROTULOS_ACAO[acao], mudancas, gerador: r.gerador, aviso: r.aviso, custo: r.gerador === 'claude' || DEMO ? custo : 0 })
    } catch (e) {
      erro(e, ctrl)
    } finally {
      if (abortar.current === ctrl) setCarregando(null)
    }
  }

  const refazer = async () => {
    if (!cena || !mapeada || carregando) return
    const custo = CUSTO_CREDITOS.refazerTela
    if (!temSaldo(custo, 'Refazer a tela')) return
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl
    setCarregando('tela')
    const c = cena
    const { mapa, atual } = mapeada
    try {
      const r = await dados.ia.tela({
        tipo: mapa.tipo,
        atual: { titulo: atual.titulo.slice(0, 600), texto: atual.texto.slice(0, 2000), itens: atual.itens.slice(0, 12).map((i) => i.slice(0, 600)), notas: atual.notas.slice(0, 4000) },
        quantidadeItens: Math.min(12, quantidadeDeItens(mapa, atual)),
        temTexto: !!mapa.texto,
        instrucao: instrucao.slice(0, 400),
        contexto: { apresentacao: nomeProjeto.slice(0, 200), telas: estado.documento.scenes.slice(0, 100).map((s, i) => (s.title || `Tela ${i + 1}`).slice(0, 160)), indice: Math.min(99, indiceCena) },
      }, ctrl.signal)
      const papeis = new Map<string, string>()
      if (mapa.titulo) papeis.set(mapa.titulo, 'Título')
      if (mapa.texto) papeis.set(mapa.texto, mapa.tipo === 'citacao' ? 'Autor' : 'Texto')
      if (mapa.rotulo) papeis.set(mapa.rotulo, 'Rótulo')
      mapa.itens.forEach((it, k) => { papeis.set(it.id, `Item ${k + 1}`); if (it.valor) papeis.set(it.valor, `Número ${k + 1}`) })
      mapa.colunas?.forEach((id, k) => papeis.set(id, k ? 'Coluna direita' : 'Coluna esquerda'))
      const mudancas = mudancasDe(c, textosDaTela(c, mapa, r.tela), papeis)
      const notas = r.tela.notas && r.tela.notas !== c.notes ? { antes: c.notes, depois: r.tela.notas } : null
      dados.registrarUsoIa({ custo, motivo: `Refazer tela com IA · tela ${numeroTela}`, gerador: r.gerador, houveResultado: mudancas.length > 0 || !!notas })
      if (!mudancas.length && !notas) {
        mostrar(r.gerador === 'local' ? 'O exemplo local não achou o que mudar nesta tela. Escreva uma instrução ou conecte a IA.' : 'Nada mudou nesta tela. Tente outra instrução.', 'info')
        return
      }
      setResultado({ tipo: 'tela', cenaId: c.id, titulo: `Refazer tela ${numeroTela}`, mudancas, gerador: r.gerador, aviso: r.aviso, custo: r.gerador === 'claude' || DEMO ? custo : 0, mapa, novo: r.tela, notas })
    } catch (e) {
      erro(e, ctrl)
    } finally {
      if (abortar.current === ctrl) setCarregando(null)
    }
  }

  const aplicar = () => {
    if (!resultado || !cena) return
    if (cena.id !== resultado.cenaId) { setResultado(null); return mostrar('A tela mudou. Gere de novo nesta tela.', 'info') }
    const ids = resultado.mudancas.map((m) => m.id)
    if (resultado.tipo === 'texto') {
      const novos = new Map(resultado.mudancas.map((m) => [m.id, m.depois]))
      acoes.atualizarCamadas(ids, (l) => (l.type === 'text' && novos.has(l.id) ? { ...l, text: novos.get(l.id)! } : l))
    } else {
      const nova = aplicarTela(cena, resultado.mapa, resultado.novo)
      acoes.atualizarCena({ title: nova.title, notes: nova.notes, layers: nova.layers })
    }
    if (ids.length) acoes.selecionarExato(ids)
    const cabe = resultado.mudancas.some((m) => m.naoCabe)
    setResultado(null)
    // o foco sai do painel: Ctrl+Z logo em seguida desfaz no documento
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    mostrar(cabe ? 'Aplicado. Algum texto passou da caixa: ajuste o tamanho ou a fonte.' : 'Aplicado. Ctrl+Z desfaz.', cabe ? 'info' : 'sucesso', { rotulo: 'Desfazer', aoClicar: () => acoes.desfazer() })
  }

  const custoBotao = (n: number) => <span className="mono text-[10px] font-normal text-texto3">{n} créditos</span>

  return (
    <div ref={ref} role="dialog" aria-label="IA nesta tela" className="fixed right-[300px] top-[60px] z-40 flex max-h-[calc(100dvh-120px)] w-[360px] flex-col overflow-hidden rounded-xl border border-borda bg-superficie text-[13px] shadow-painel">
      <div className="flex items-center gap-2 border-b border-borda px-3.5 py-2.5">
        <Sparkles className="h-4 w-4 text-acento" />
        <span className="font-medium">IA nesta tela</span>
        <span className="mono text-[11px] text-texto3">Tela {numeroTela}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => abrirCompra()} title={`${textoTelas(saldo)} · comprar créditos`} className="mono rounded-full border border-borda px-2 py-0.5 text-[11px] text-texto2 hover:border-bordaForte hover:text-texto">{fmt(saldo)} {saldo === 1 ? 'crédito' : 'créditos'}</button>
        <button type="button" aria-label="Fechar IA" onClick={aoFechar} className="rounded p-1 text-texto2 hover:bg-hover hover:text-texto"><X className="h-3.5 w-3.5" /></button>
      </div>

      {resultado ? (
        <PreviaResultado resultado={resultado} aoAplicar={aplicar} aoDescartar={() => setResultado(null)} />
      ) : (
        <>
          <div role="tablist" aria-label="Ações de IA" className="flex gap-1 border-b border-borda px-2 py-1.5">
            {([['texto', 'Reescrever'], ['tela', 'Refazer tela'], ['imagem', 'Imagem']] as const).map(([id, rotulo]) => (
              <button key={id} role="tab" type="button" aria-selected={aba === id} onClick={() => aoMudarAba(id)} className={cx('flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[12px]', aba === id ? 'bg-hover font-medium text-texto' : 'text-texto2 hover:text-texto')}>
                {rotulo}{id === 'imagem' && <span className="mono rounded-full bg-hover px-1 text-[8px] uppercase text-texto3">breve</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel" aria-label={{ texto: 'Reescrever texto', tela: 'Refazer tela', imagem: 'Gerar imagem' }[aba]} className="min-h-0 overflow-y-auto p-3.5">
            {aba === 'texto' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-[12px] text-texto2">
                  <span>{alvoTexto.length ? `${usarSelecao ? 'Seleção' : 'Toda a tela'} · ${alvoTexto.length} ${alvoTexto.length === 1 ? 'texto' : 'textos'}` : 'Nenhum texto nesta tela'}</span>
                  {selecaoTexto.length > 0 && (
                    <span role="radiogroup" aria-label="O que reescrever" className="flex rounded-md bg-superficie2 p-0.5">
                      {(['selecao', 'tela'] as const).map((e) => <button key={e} type="button" role="radio" aria-checked={escopo === e} onClick={() => setEscopo(e)} className={cx('rounded px-2 py-0.5 text-[11px]', escopo === e ? 'bg-superficie font-medium text-texto shadow-sm' : 'text-texto2')}>{e === 'selecao' ? 'Seleção' : 'Tela inteira'}</button>)}
                    </span>
                  )}
                </div>
                {traduzir ? (
                  <div className="space-y-2">
                    <button type="button" onClick={() => setTraduzir(false)} className="flex items-center gap-1 text-[12px] text-texto2 hover:text-texto"><ChevronLeft className="h-3.5 w-3.5" /> Traduzir para</button>
                    <div className="grid grid-cols-3 gap-1.5">
                      {IDIOMAS.map((i, k) => (
                        <BotaoAcao key={i} foco={k === 0} rotulo={NOMES_IDIOMA[i]} custo={custoBotao(CUSTO_CREDITOS.reescrever)} carregando={carregando === `traduzir-${i}`} desativado={!!carregando || !alvoTexto.length} aoClicar={() => void reescrever('traduzir', i)} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {ACOES_TEXTO.map((a, k) => (
                      <BotaoAcao key={a} foco={k === 0} rotulo={ROTULOS_ACAO[a]} dica={DICA_ACAO[a]} icone={a === 'traduzir' ? <Languages className="h-3.5 w-3.5" /> : undefined} custo={custoBotao(CUSTO_CREDITOS.reescrever)} carregando={carregando === a} desativado={!!carregando || !alvoTexto.length} aoClicar={() => (a === 'traduzir' ? setTraduzir(true) : void reescrever(a))} />
                    ))}
                  </div>
                )}
                <p className="text-[11px] leading-relaxed text-texto3">Mantém fonte, cor e tamanho das caixas. Você vê antes/depois e decide se aplica.</p>
              </div>
            )}

            {aba === 'tela' && (
              <div className="space-y-3">
                {mapeada ? (
                  <>
                    <div className="rounded-lg bg-superficie2 px-3 py-2.5">
                      <div className="font-medium">{cena?.title || `Tela ${numeroTela}`}</div>
                      <div className="mt-0.5 text-[12px] text-texto2">{NOMES_TIPO[mapeada.mapa.tipo]} · {resumoMapa(mapeada.mapa, mapeada.atual)}</div>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-texto2">Instrução (opcional)</span>
                      <textarea data-foco value={instrucao} maxLength={400} rows={2} onChange={(e) => setInstrucao(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void refazer() }} placeholder="Ex.: deixe mais direto, foque em números" className="block w-full resize-none rounded-md bg-superficie2 px-2.5 py-2 text-[13px] leading-snug outline-none ring-inset hover:ring-1 hover:ring-bordaForte focus:!ring-1 focus:!ring-acento" />
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGESTOES.map((s) => <button key={s} type="button" onClick={() => setInstrucao(s)} className="rounded-full border border-borda px-2.5 py-1 text-[11px] text-texto2 hover:border-bordaForte hover:text-texto">{s}</button>)}
                    </div>
                    <Botao className="w-full" carregando={carregando === 'tela'} disabled={!!carregando} onClick={() => void refazer()} icone={<Sparkles className="h-4 w-4" />}>
                      Refazer tela <span className="font-normal opacity-70">· {CUSTO_CREDITOS.refazerTela} créditos</span>
                    </Botao>
                    <p className="text-[11px] leading-relaxed text-texto3">Reescreve título, texto, itens e notas{total > 1 ? ` sabendo das outras ${total - 1} ${total - 1 === 1 ? 'tela' : 'telas'}` : ''}. Layout, estilos e animações ficam como estão.</p>
                  </>
                ) : (
                  <p className="rounded-lg bg-superficie2 px-3 py-3 text-texto2">Esta tela não tem textos para refazer. Adicione um título (tecla T) ou use “Gerar imagem” quando chegar.</p>
                )}
              </div>
            )}

            {aba === 'imagem' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-dashed border-bordaForte px-3 py-3">
                  <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-texto3" />
                  <div>
                    <div className="font-medium">Gerar imagem para uma tela</div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-texto2">Foto, textura ou ilustração no estilo da apresentação. Em breve. Por enquanto, arraste suas imagens para o canvas ou cole do Figma.</p>
                  </div>
                </div>
                <Botao className="w-full" variante="secundario" disabled>Em breve <span className="font-normal opacity-70">· {CUSTO_CREDITOS.imagem} créditos</span></Botao>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function resumoMapa(m: MapaTela, atual: ConteudoTela): string {
  const partes: string[] = []
  if (m.titulo || m.rotulo) partes.push('título')
  if (m.texto) partes.push(m.tipo === 'citacao' ? 'autor' : 'texto')
  const n = quantidadeDeItens(m, atual)
  if (n) partes.push(`${n} ${n === 1 ? 'item' : 'itens'}`)
  partes.push('notas')
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : partes[0]!
}

function BotaoAcao({ rotulo, dica, custo, icone, carregando, desativado, aoClicar, foco }: { rotulo: string; dica?: string; custo: React.ReactNode; icone?: React.ReactNode; carregando?: boolean; desativado?: boolean; aoClicar: () => void; foco?: boolean }) {
  return (
    <button type="button" data-foco={foco || undefined} title={dica} disabled={desativado} onClick={aoClicar} className="flex min-h-[48px] flex-col items-start justify-center gap-0.5 rounded-lg border border-borda px-2.5 py-1.5 text-left font-medium transition-colors hover:border-bordaForte hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50">
      <span className="flex items-center gap-1.5">{carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin text-acento" /> : icone}{rotulo}</span>
      {custo}
    </button>
  )
}

function PreviaResultado({ resultado, aoAplicar, aoDescartar }: { resultado: Resultado; aoAplicar: () => void; aoDescartar: () => void }) {
  const naoCabem = resultado.mudancas.filter((m) => m.naoCabe).length
  return (
    <>
      <div className="min-h-0 space-y-3 overflow-y-auto p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{resultado.titulo}</span>
          {resultado.gerador === 'local'
            ? <span className="mono rounded-full bg-aviso/20 px-1.5 py-0.5 text-[9px] uppercase text-texto">exemplo local</span>
            : <span className="mono rounded-full bg-acentoSuave px-1.5 py-0.5 text-[9px] uppercase text-acento">escrito pela IA</span>}
          <span className="mono ml-auto text-[10px] text-texto3">{resultado.custo ? `${resultado.custo} créditos usados` : 'sem cobrança'}</span>
        </div>
        {resultado.aviso && <p className="rounded-md bg-aviso/10 px-2.5 py-2 text-[12px] leading-relaxed text-texto">{resultado.aviso}</p>}
        <ul className="space-y-2.5" aria-label="Antes e depois">
          {resultado.mudancas.map((m) => (
            <li key={m.id} className="rounded-lg border border-borda p-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className="rotulo-mono !text-[10px]">{m.papel}</span>
                {m.naoCabe && <span className="flex items-center gap-1 text-[11px] text-avisoTexto"><TriangleAlert className="h-3 w-3" /> não cabe na caixa</span>}
              </div>
              <p className="whitespace-pre-line text-[12px] leading-snug text-texto3 line-through decoration-texto3/40">{m.antes}</p>
              <p className="mt-1 flex gap-1.5 whitespace-pre-line text-[13px] leading-snug text-texto"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-acento" /><span>{m.depois}</span></p>
            </li>
          ))}
          {resultado.tipo === 'tela' && resultado.notas && (
            <li className="rounded-lg border border-borda p-2.5">
              <div className="rotulo-mono mb-1 !text-[10px]">Notas do apresentador</div>
              {resultado.notas.antes && <p className="whitespace-pre-line text-[12px] leading-snug text-texto3 line-through decoration-texto3/40">{resultado.notas.antes}</p>}
              <p className="mt-1 flex gap-1.5 whitespace-pre-line text-[13px] leading-snug"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-acento" /><span>{resultado.notas.depois}</span></p>
            </li>
          )}
        </ul>
        {naoCabem > 0 && <p className="text-[11px] leading-relaxed text-texto2">{naoCabem === 1 ? '1 texto fica' : `${naoCabem} textos ficam`} maior que a caixa. Dá para aplicar e ajustar o tamanho depois.</p>}
      </div>
      <div className="flex gap-2 border-t border-borda px-3.5 py-2.5">
        <Botao tamanho="sm" variante="secundario" className="flex-1" onClick={aoDescartar}>Descartar</Botao>
        <Botao tamanho="sm" className="flex-1" data-foco onClick={aoAplicar} autoFocus>Aplicar</Botao>
      </div>
    </>
  )
}
