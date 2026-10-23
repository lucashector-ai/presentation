'use client'
/**
 * "Manual da marca" no passo da marca: a pessoa envia o manual (PDF, imagens de páginas ou slides antigos) ou o
 * design system (tokens .json, .css, tema de um .pptx); a leitura é feita no navegador, sem IA e grátis
 * (components/app/criar/manual.ts). O que foi reconhecido — cores com papéis, fontes por nível (com aviso quando
 * a fonte não está no Google), candidatos a logo, regras e tom — aparece para revisar e editar antes de aplicar.
 * O resumo pela IA é opcional, com o custo no botão. Aplicado, o perfil vai para a marca (cores, papéis, fontes)
 * e fica salvo no kit; as cores citadas no pedido continuam mandando sobre as do manual.
 */
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, FileUp, Sparkles, Trash2, X } from 'lucide-react'
import { cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { carregarFontes } from '@/components/renderer/fontes'
import { SeletorFonte } from '@/components/fontes/SeletorFonte'
import { dados, mensagemDeErro, useDados } from '@/lib/dados'
import { paletaDoPedido } from '@/lib/ia/analisePedido'
import { RE_HEX } from '@/lib/ia/designSystem'
import { trechoParaIa } from '@/lib/marca/resumo'
import { DENSIDADES_MARCA, NIVEIS_FONTE, NOMES_NIVEL, NOMES_PAPEL, PAPEIS_COR, contarRegras, marcaDoPerfil, perfilTemConteudo, resumoPerfil, type NivelFonte, type PapelCor, type PerfilMarca } from '@/lib/marca/perfil'
import { PLANOS, custoResumoManual, podeGastarCreditos } from '@/lib/planos'
import { pilhaFonte } from '@/lib/design-tokens'
import { useCreditos } from '../Creditos'
import { ProgressoLeitura, type FaseLeitura } from '../LeituraPdf'
import { ACEITA_MANUAL, fontesNoCatalogo, lerManual, nomeDaMarca, type CandidatoLogo } from './manual'
import type { MarcaEscolhida } from './estado'
import { Secao, SeloCusto } from './ui'

const DEMO = dados.capacidades.creditosFicticios
const NOMES_DENSIDADE = { baixa: 'Baixa (pouco texto, muito respiro)', media: 'Média', alta: 'Alta (mais informação por tela)' } as const

interface Rascunho { perfil: PerfilMarca; texto: string; candidatos: CandidatoLogo[]; avisos: string[]; nome: string }

/** Lista de regras editável (remover um item). */
function Regras({ titulo, itens, aoMudar }: { titulo: string; itens: string[]; aoMudar: (l: string[]) => void }) {
  if (!itens.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <div className="rotulo-mono">{titulo}</div>
      <ul className="flex flex-col gap-1" aria-label={titulo}>
        {itens.map((r, k) => (
          <li key={`${k}-${r}`} className="flex items-start gap-2 rounded-[8px] bg-superficie2 px-2.5 py-1.5 text-[13px] leading-snug">
            <span className="min-w-0 flex-1">{r}</span>
            <button type="button" aria-label={`Remover regra: ${r.slice(0, 40)}`} onClick={() => aoMudar(itens.filter((_, j) => j !== k))} className="mt-0.5 text-texto3 hover:text-texto"><X className="h-3 w-3" /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ManualMarca({ marca, aoMudar, prompt, aoUsarLogo }: {
  marca: MarcaEscolhida
  aoMudar: (m: MarcaEscolhida | ((m: MarcaEscolhida) => MarcaEscolhida)) => void
  prompt: string
  /** Envia o candidato escolhido como logo da marca (mesmo caminho do "Enviar logo"). */
  aoUsarLogo: (f: File) => Promise<void>
}) {
  const { mostrar } = useToast()
  const { abrirCompra } = useCreditos()
  const planoId = useDados((e) => e.workspace.planoId)
  const entrada = useRef<HTMLInputElement>(null)
  const abortar = useRef<AbortController | null>(null)
  const [lendo, setLendo] = useState<FaseLeitura | null>(null)
  const [resumindo, setResumindo] = useState(false)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [usandoLogo, setUsandoLogo] = useState<string | null>(null)
  const urls = useRef<string[]>([])
  useEffect(() => () => { abortar.current?.abort(); urls.current.forEach((u) => URL.revokeObjectURL(u)) }, [])
  const fontesDoRascunho = rascunho ? NIVEIS_FONTE.map((n) => rascunho.perfil.fontes[n]?.familia).filter((f): f is string => !!f) : []
  useEffect(() => { if (fontesDoRascunho.length) carregarFontes(fontesDoRascunho) }, [fontesDoRascunho.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const limites = PLANOS[planoId].limites
  const ler = async (lista: File[]) => {
    if (!lista.length) return
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl
    setLendo({ fase: 'Abrindo o manual…', progresso: 0 })
    try {
      const r = await lerManual(lista, { paginas: limites.paginasPdfImportar, bytes: limites.tamanhoArquivoBytes }, { sinal: ctrl.signal, aoProgredir: setLendo })
      if (ctrl.signal.aborted) return
      urls.current.push(...r.candidatos.map((c) => c.url))
      for (const a of r.avisos) mostrar(a)
      if (!perfilTemConteudo(r.perfil) && !r.candidatos.length) return mostrar('Não reconhecemos cores, fontes ou regras neste arquivo. Se for um PDF de imagens, envie as páginas como PNG ou JPG.', 'erro')
      setRascunho({ perfil: r.perfil, texto: r.texto, candidatos: r.candidatos, avisos: r.avisos, nome: nomeDaMarca(r.texto) })
      mostrar(`Manual lido no navegador · grátis: ${resumoPerfil(r.perfil)}${r.candidatos.length ? ` e ${r.candidatos.length === 1 ? '1 candidato' : `${r.candidatos.length} candidatos`} a logo` : ''}.`, 'sucesso')
    } catch (e) {
      if (ctrl.signal.aborted) return
      mostrar(e instanceof Error && e.name === 'ErroLeitura' ? e.message : mensagemDeErro(e, 'Não foi possível ler o manual.'), 'erro')
    } finally {
      if (abortar.current === ctrl) setLendo(null)
    }
  }

  const mudarPerfil = (f: (p: PerfilMarca) => PerfilMarca) => setRascunho((r) => (r ? { ...r, perfil: f(r.perfil) } : r))
  const texto = rascunho ? trechoParaIa(rascunho.texto) : ''
  const custoIa = custoResumoManual(texto.length)

  const resumirComIa = async () => {
    if (!rascunho || texto.length < 40 || resumindo) return
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoIa)
    if (!decisao.ok) return abrirCompra(`O resumo do manual custa ${custoIa} ${custoIa === 1 ? 'crédito' : 'créditos'} e você tem ${dados.estado().creditos.saldo}. Escolha um pacote para continuar.`)
    const ctrl = new AbortController()
    abortar.current?.abort()
    abortar.current = ctrl
    setResumindo(true)
    try {
      const r = await dados.ia.marca({ texto, perfil: rascunho.perfil }, ctrl.signal)
      const cobrado = DEMO ? custoIa : r.creditos
      dados.registrarUsoIa({ custo: cobrado, motivo: 'Resumo do manual da marca com IA', gerador: r.gerador, houveResultado: cobrado > 0 })
      const perfil = await fontesNoCatalogo(r.perfil)
      setRascunho((x) => (x ? { ...x, perfil } : x))
      mostrar(`${r.gerador === 'claude' ? 'Resumo da IA pronto' : 'Resumo simulado (demonstração)'} · ${cobrado} ${cobrado === 1 ? 'crédito' : 'créditos'}. Revise e aplique.`, 'sucesso')
    } catch (e) {
      if (ctrl.signal.aborted) return
      if ((e as { code?: string } | null)?.code === 'limite_do_plano') return abrirCompra(mensagemDeErro(e))
      mostrar(mensagemDeErro(e, 'Não foi possível resumir o manual.'), 'erro')
    } finally {
      setResumindo(false)
    }
  }

  const aplicar = () => {
    if (!rascunho) return
    const p = rascunho.perfil
    const m = marcaDoPerfil(p)
    // o pedido escrito manda: cores com hex no pedido ficam no lugar das do manual
    const pedidoTemCores = !!paletaDoPedido(prompt)?.cores.length
    aoMudar((x) => ({
      ...x,
      perfil: p,
      nome: x.nome.trim() || rascunho.nome,
      ...(!pedidoTemCores && m.cores.length ? { cores: m.cores, aplicarCores: true, papeis: m.papeis } : {}),
      ...(m.fontes ? { fontes: m.fontes } : {}),
    }))
    setRascunho(null)
    mostrar(pedidoTemCores ? 'Manual aplicado. Seu pedido cita cores: elas continuam no lugar das do manual (o pedido tem prioridade).' : 'Manual aplicado à marca: cores, fontes e regras entram nas telas · grátis.', 'sucesso')
  }

  const usarCandidato = async (c: CandidatoLogo) => {
    setUsandoLogo(c.id)
    try { await aoUsarLogo(new File([c.blob], 'logo-do-manual.png', { type: c.blob.type || 'image/png' })) } finally { setUsandoLogo(null) }
  }

  const aplicado = marca.perfil
  const zona = (
    <button
      type="button"
      onClick={() => entrada.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void ler([...e.dataTransfer.files]) }}
      disabled={!!lendo}
      className="flex min-h-16 w-full items-center justify-center gap-2.5 rounded-[12px] border-[1.5px] border-dashed border-bordaHover px-3 py-3 text-center text-[14px] text-texto2 hover:border-tinta hover:text-texto disabled:opacity-60"
    >
      <FileUp className="h-4 w-4 shrink-0" />Enviar o manual da marca · PDF, imagens, tokens .json, .css ou .pptx
    </button>
  )

  return (
    <Secao titulo="Manual da marca" dica="O brand book ou design system da empresa: a IA passa a seguir a identidade. Lido no seu navegador, sem IA." selo={<SeloCusto />} id="titulo-manual">
      <input ref={entrada} type="file" multiple accept={ACEITA_MANUAL} aria-label="Arquivos do manual da marca" className="hidden" onChange={(e) => { void ler([...(e.target.files ?? [])]); e.target.value = '' }} />
      {lendo && <ProgressoLeitura lendo={lendo} />}

      {!rascunho && !lendo && (aplicado ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-sucessoFundo px-3 py-2.5 text-[13px] text-sucessoTexto" data-testid="manual-aplicado">
          <BookOpen className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">Manual aplicado{aplicado.origem.arquivos.length ? ` (${aplicado.origem.arquivos.join(', ')})` : ''}: {resumoPerfil(aplicado)}{aplicado.origem.resumidoPorIa ? ' · resumido pela IA' : ''}.</span>
          <button type="button" onClick={() => setRascunho({ perfil: aplicado, texto: '', candidatos: [], avisos: [], nome: '' })} className="h-8 rounded-full border-[1.5px] border-sucessoTexto px-3 text-[12px] font-medium hover:bg-superficie">Revisar</button>
          <button type="button" onClick={() => entrada.current?.click()} className="h-8 rounded-full border-[1.5px] border-sucessoTexto px-3 text-[12px] font-medium hover:bg-superficie">Trocar</button>
          <button type="button" aria-label="Remover o manual da marca" onClick={() => aoMudar((m) => ({ ...m, perfil: null }))} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-superficie"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ) : zona)}

      {rascunho && (
        <div className="flex flex-col gap-4" aria-label="Revisão do manual da marca" role="region">
          <p className="text-[13px] text-texto2">Reconhecido no manual: <strong className="font-semibold text-texto">{resumoPerfil(rascunho.perfil)}</strong>. Confira, ajuste os papéis e tire o que não serve antes de aplicar.</p>

          {rascunho.perfil.cores.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="rotulo-mono">Cores e papéis</div>
              <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Cores do manual">
                {rascunho.perfil.cores.map((c, k) => (
                  <li key={`${c.hex}-${k}`} className="flex min-w-0 items-center gap-2 rounded-[10px] border border-borda bg-superficie py-1.5 pl-1.5 pr-2">
                    <input type="color" aria-label={`Cor do manual ${k + 1}`} value={RE_HEX.test(c.hex) ? c.hex : '#5965F2'} onChange={(e) => mudarPerfil((p) => ({ ...p, cores: p.cores.map((x, j) => (j === k ? { ...x, hex: e.target.value.toUpperCase() } : x)) }))} className="h-8 w-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0" />
                    <span className="min-w-0 flex-1">
                      <span className="mono block text-[12px] uppercase">{c.hex}</span>
                      <span className="block truncate text-[11px] text-texto3" title={c.nome}>{c.nome || '—'}</span>
                    </span>
                    <select aria-label={`Papel da cor ${c.hex}`} value={c.papel} onChange={(e) => mudarPerfil((p) => ({ ...p, cores: p.cores.map((x, j) => (j === k ? { ...x, papel: e.target.value as PapelCor } : x)) }))} className="rounded-md bg-superficie2 px-1.5 py-1 text-[12px] outline-none">
                      {PAPEIS_COR.map((p) => <option key={p} value={p}>{NOMES_PAPEL[p]}</option>)}
                    </select>
                    <button type="button" aria-label={`Remover a cor ${c.hex}`} onClick={() => mudarPerfil((p) => ({ ...p, cores: p.cores.filter((_, j) => j !== k) }))} className="text-texto3 hover:text-texto"><X className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="rotulo-mono">Tipografia</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {NIVEIS_FONTE.map((n: NivelFonte) => {
                const f = rascunho.perfil.fontes[n]
                return (
                  <div key={n} className="flex min-w-0 flex-col gap-1 text-[12px] text-texto3">
                    <span className="flex items-center justify-between gap-1">{NOMES_NIVEL[n]}{f && <button type="button" aria-label={`Tirar a fonte de ${NOMES_NIVEL[n].toLowerCase()}`} onClick={() => mudarPerfil((p) => ({ ...p, fontes: { ...p.fontes, [n]: null } }))} className="hover:text-texto"><X className="h-3 w-3" /></button>}</span>
                    <SeletorFonte variante="cartao" rotulo={`Fonte do manual: ${NOMES_NIVEL[n].toLowerCase()}`} valor={f?.familia ?? 'Do estilo'} aoMudar={(familia) => mudarPerfil((p) => ({ ...p, fontes: { ...p.fontes, [n]: { familia, original: familia, substituta: false } } }))} />
                    {f?.substituta && <span className="leading-snug text-avisoTexto" data-testid={`aviso-fonte-${n}`}>“{f.original}” não está no Google Fonts: usamos <span style={{ fontFamily: pilhaFonte(f.familia) }}>{f.familia}</span>, a mais parecida.</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {rascunho.candidatos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="rotulo-mono">Logo encontrado no manual</div>
              <div className="flex flex-wrap gap-2">
                {rascunho.candidatos.map((c, k) => (
                  <button key={c.id} type="button" disabled={!!usandoLogo} onClick={() => void usarCandidato(c)} aria-label={`Usar a imagem ${k + 1} do manual como logo`} className="flex items-center gap-2 rounded-[10px] border-[1.5px] border-bordaForte bg-superficie p-1.5 pr-3 text-[12px] hover:border-tinta disabled:opacity-60">
                    <span className="flex h-12 w-24 items-center justify-center rounded-md bg-[repeating-conic-gradient(#F0EFED_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-1"><img src={c.url} alt="" className="max-h-full max-w-full object-contain" /></span>
                    {usandoLogo === c.id ? 'Enviando…' : 'Usar como logo'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Regras titulo="Tom de voz" itens={rascunho.perfil.tom} aoMudar={(tom) => mudarPerfil((p) => ({ ...p, tom }))} />
            {(rascunho.perfil.termos.usar.length > 0 || rascunho.perfil.termos.evitar.length > 0) && (
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="rotulo-mono">Termos</div>
                {rascunho.perfil.termos.usar.length > 0 && <p>Usar: {rascunho.perfil.termos.usar.join(', ')}</p>}
                {rascunho.perfil.termos.evitar.length > 0 && <p>Evitar: <span data-testid="termos-evitar">{rascunho.perfil.termos.evitar.join(', ')}</span></p>}
              </div>
            )}
            <Regras titulo="Faz" itens={rascunho.perfil.faz} aoMudar={(faz) => mudarPerfil((p) => ({ ...p, faz }))} />
            <Regras titulo="Não faz" itens={rascunho.perfil.naoFaz} aoMudar={(naoFaz) => mudarPerfil((p) => ({ ...p, naoFaz }))} />
            <Regras titulo="Logo" itens={[rascunho.perfil.logo.areaProtecao, rascunho.perfil.logo.tamanhoMinimo, ...rascunho.perfil.logo.regras].filter(Boolean)} aoMudar={(l) => mudarPerfil((p) => ({ ...p, logo: { areaProtecao: l.includes(p.logo.areaProtecao) ? p.logo.areaProtecao : '', tamanhoMinimo: l.includes(p.logo.tamanhoMinimo) ? p.logo.tamanhoMinimo : '', regras: p.logo.regras.filter((r) => l.includes(r)) } }))} />
            <Regras titulo="Fotos e imagens" itens={rascunho.perfil.imagens} aoMudar={(imagens) => mudarPerfil((p) => ({ ...p, imagens }))} />
            <Regras titulo="Ícones" itens={rascunho.perfil.icones} aoMudar={(icones) => mudarPerfil((p) => ({ ...p, icones }))} />
            <Regras titulo="Grafismos" itens={rascunho.perfil.grafismos} aoMudar={(grafismos) => mudarPerfil((p) => ({ ...p, grafismos }))} />
          </div>
          <label className="flex flex-wrap items-center gap-2 text-[13px] text-texto2">
            Densidade das telas
            <select aria-label="Densidade do manual" value={rascunho.perfil.densidade ?? ''} onChange={(e) => mudarPerfil((p) => ({ ...p, densidade: (e.target.value || null) as PerfilMarca['densidade'] }))} className="rounded-md bg-superficie2 px-2 py-1.5 text-texto outline-none">
              <option value="">O manual não diz</option>
              {DENSIDADES_MARCA.map((d) => <option key={d} value={d}>{NOMES_DENSIDADE[d]}</option>)}
            </select>
          </label>
          <p className="text-[12px] text-texto3">O que você escrever no pedido tem prioridade sobre o manual quando os dois conflitarem. O texto do manual entra na IA só como referência da marca, nunca como instrução.</p>

          <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-3">
            <button type="button" onClick={aplicar} className="flex h-10 items-center gap-2 rounded-full bg-acao px-4 text-[14px] font-medium text-acaoTexto hover:opacity-90"><Check className="h-4 w-4" />Aplicar à marca</button>
            {rascunho.texto.trim().length >= 40 && (
              <button type="button" onClick={() => void resumirComIa()} disabled={resumindo} className="flex h-10 items-center gap-2 rounded-full border-[1.5px] border-bordaForte bg-superficie px-4 text-[14px] font-medium hover:border-tinta disabled:opacity-60">
                <Sparkles className="h-4 w-4 text-acento" />{resumindo ? 'A IA está lendo o manual…' : <>Resumir com IA · <span className="mono">{custoIa}</span> {custoIa === 1 ? 'crédito' : 'créditos'}</>}
              </button>
            )}
            <button type="button" onClick={() => setRascunho(null)} className={cx('h-10 rounded-full px-3 text-[13px] text-texto3 hover:text-texto')}>Descartar</button>
            <span className="ml-auto text-[12px] text-texto3">{contarRegras(rascunho.perfil)} regras · tudo editável depois</span>
          </div>
        </div>
      )}
    </Secao>
  )
}
