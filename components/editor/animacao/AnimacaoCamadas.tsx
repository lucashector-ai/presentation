'use client'
/**
 * Aba Animação com camadas selecionadas: seções recolhíveis Entrada · Ênfase (loop) · Saída · Interativo ·
 * Transição da tela, cada uma com um resumo de uma linha quando fechada; galerias com prévia ao passar o mouse;
 * o essencial à vista e "Ajustes finos" recolhidos. Menu "Mais": copiar/colar animação, aplicar a todas as
 * camadas da tela, remover. Toda mudança toca no canvas na hora.
 */
import { useEffect, useRef, useState } from 'react'
import { Hourglass, Layers, MoreHorizontal, Timer } from 'lucide-react'
import type { Animacao, Camada, Loop } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import {
  CURVAS,
  ORDENS_TELA,
  PRESETS_ENTRADA,
  PRESETS_LOOP,
  PRESETS_SAIDA,
  VELOCIDADES,
  animacaoDoPreset,
  animavel,
  camposDaCurva,
  curvaDe,
  duracaoPorVelocidade,
  duracaoTotal,
  ehAnimacaoDeTexto,
  escalonar,
  nomeAnimacao,
  nomeCamada,
  nomeLoop,
  pontosDaCurva,
  velocidadeDe,
  type OrdemTela,
  type TipoAnimacao,
  type TipoLoop,
} from '@/lib/scene/animacoes'
import { pedirPrevia } from '@/components/renderer/animacao'
import { CampoNum, Deslizante, Interruptor, Menu, Secao, Segmentado, SeletorLista } from '@/components/editor/inspetor/controles'
import { CurvaEasing } from '@/components/editor/inspetor/CurvaEasing'
import { ICONE_TIPO } from '@/components/editor/inspetor/selecao'
import { BotaoPrevia, CartaoPreset, Chips, GradeCartoesPreset, MiniPrevia, Rotulo, areaAnimacao, useAnimacaoCopiada } from './ui'
import { Galeria, PainelAjustes, sugestoesPara } from './Ajustes'
import { AbaInterativa, resumoInterativo } from './Interativos'
import { TransicaoTela, previaTransicao, resumoTransicao } from './Transicao'
import { temInterativo } from '@/lib/scene/reativos'

const INTERVALOS = [60, 100, 150, 250] as const
const INTENSIDADES = [
  { id: 'sutil', rotulo: 'Fraca', v: 0.5 },
  { id: 'normal', rotulo: 'Média', v: 1 },
  { id: 'forte', rotulo: 'Forte', v: 2 },
] as const
/** Amplitude do loop em unidades reais (intensidade 1 = valor base do keyframe). */
const AMPLITUDE: Partial<Record<TipoLoop, { base: number; unidade: string; rotulo: string }>> = {
  float: { base: 14, unidade: 'px', rotulo: 'Altura' },
  drift: { base: 12, unidade: 'px', rotulo: 'Amplitude' },
  pulse: { base: 5, unidade: '%', rotulo: 'Quanto cresce' },
  wiggle: { base: 3, unidade: '°', rotulo: 'Ângulo' },
  shake: { base: 4, unidade: 'px', rotulo: 'Amplitude' },
  glow: { base: 14, unidade: 'px', rotulo: 'Raio do brilho' },
}
const REPETICOES = [{ id: 'inf', rotulo: 'Sempre' }, { id: '1', rotulo: '1×' }, { id: '2', rotulo: '2×' }, { id: '3', rotulo: '3×' }, { id: 'fora', rotulo: 'Até sair', titulo: 'Repete até a camada sair da tela (no Story, ao rolar para longe)' }]
/** Repetir a entrada (máquina de escrever e decodificar tocam uma vez: o cursor e o sorteio não repetem). */
const REPETICOES_ENTRADA = [{ id: '1', rotulo: '1×' }, { id: '2', rotulo: '2×' }, { id: '3', rotulo: '3×' }, { id: '5', rotulo: '5×' }]

/** Aplica um ajuste e remove campos (voltar ao padrão). */
function comAjuste(a: Animacao, patch: Partial<Animacao>, remover: (keyof Animacao)[] = []): Animacao {
  const r = { ...a, ...patch } as Record<string, unknown>
  for (const k of remover) delete r[k]
  return r as Animacao
}
const RITMOS = [
  { id: 'lenta', rotulo: 'Lenta', f: 1.5 },
  { id: 'normal', rotulo: 'Normal', f: 1 },
  { id: 'rapida', rotulo: 'Rápida', f: 0.6 },
] as const

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const semCampo = <K extends 'enterAnimation' | 'loopAnimation' | 'exitAnimation'>(c: Camada, k: K): Camada => {
  const copia = { ...c } as Record<string, unknown>
  delete copia[k]
  return copia as Camada
}
const semAnimacoes = (c: Camada) => semCampo(semCampo(semCampo(c, 'enterAnimation'), 'loopAnimation'), 'exitAnimation')
/** Copia entrada/loop/saída de `de` para a camada `c` (mantém o atraso que `c` já tinha, para não desfazer sequências). */
const comAnimacoesDe = (c: Camada, de: { enterAnimation?: Animacao; loopAnimation?: Loop; exitAnimation?: Animacao }, manterAtraso = false): Camada => ({
  ...semAnimacoes(c),
  ...(de.enterAnimation ? { enterAnimation: manterAtraso && c.enterAnimation ? { ...de.enterAnimation, delay: c.enterAnimation.delay } : de.enterAnimation } : {}),
  ...(de.loopAnimation ? { loopAnimation: de.loopAnimation } : {}),
  ...(de.exitAnimation ? { exitAnimation: de.exitAnimation } : {}),
}) as Camada

/** Atraso e duração com o rótulo em cima (o prefixo do campo numérico só cabe um ícone/letra). */
function CamposTempo({ atraso, duracao, rotulo, maxAtraso, aoAtraso, aoDuracao }: { atraso: number; duracao: number; rotulo: string; maxAtraso: number; aoAtraso: (v: number) => void; aoDuracao: (v: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Rotulo>Atraso</Rotulo>
        <CampoNum prefixo={<Hourglass className="h-3 w-3" />} rotulo={`Atraso ${rotulo}`} valor={atraso} min={0} max={maxAtraso} passo={50} sufixo="ms" aoMudar={aoAtraso} />
      </div>
      <div className="space-y-1">
        <Rotulo>Duração</Rotulo>
        <CampoNum prefixo={<Timer className="h-3 w-3" />} rotulo={`Duração ${rotulo}`} valor={duracao} min={100} max={3000} passo={50} sufixo="ms" aoMudar={aoDuracao} />
      </div>
    </div>
  )
}

export function AnimacaoCamadas({ editor }: { editor: Editor }) {
  const { camadasSelecionadas: sel, acoes } = editor
  const [intervalo, setIntervalo] = useState<number>(100)
  const [ordem, setOrdem] = useState<OrdemTela>('leitura')
  const [curvaAberta, setCurvaAberta] = useState(false)
  const chaveSel = sel.map((c) => c.id).join(',')
  useEffect(() => setCurvaAberta(false), [chaveSel])
  const copiada = useAnimacaoCopiada()
  // gesto de arrastar a curva = uma entrada no histórico
  const antesCurva = useRef(acoes.documentoAtual())
  const l = sel[0]
  if (!l) return null
  const ids = sel.map((c) => c.id)
  const multi = sel.length > 1
  const todasTexto = sel.every((c) => c.type === 'text')
  const a: Animacao = l.enterAnimation ?? { type: 'none', duration: 600, delay: 0, easing: 'easeOut' }
  const loop = l.loopAnimation
  const saida = l.exitAnimation
  const temAlguma = a.type !== 'none' || !!loop || !!saida
  const atrasos = sel.map((c) => c.enterAnimation?.delay ?? 0)
  const emSequencia = multi && new Set(atrasos).size > 1
  const diferentes = multi && sel.some((c) => !igual(c.enterAnimation, l.enterAnimation) || !igual(c.loopAnimation, loop) || !igual(c.exitAnimation, saida)) && !emSequencia
  const camadasDaTela = editor.cena?.layers ?? []
  const outrasDaTela = camadasDaTela.filter((c) => animavel(c) && !ids.includes(c.id))

  // ---------- prévia ----------
  const tocar = (opts: { saida?: boolean; loop?: boolean } = {}) =>
    setTimeout(() => {
      const atual = editor.acoes.documentoAtual().scenes.find((s) => s.id === editor.estado.cenaId)?.layers.filter((c) => ids.includes(c.id)) ?? sel
      const sequencia = multi && new Set(atual.map((c) => c.enterAnimation?.delay ?? 0)).size > 1
      let dur = 0
      for (const c of atual) {
        const e = opts.saida ? c.exitAnimation : c.enterAnimation
        const base = e ? (sequencia || opts.saida ? e.delay : 0) + duracaoTotal(e) : 0
        dur = Math.max(dur, base + (opts.loop && c.loopAnimation ? Math.min(c.loopAnimation.duration * 2, 5000) : 0))
      }
      if (dur > 0) pedirPrevia({ ids, semAtraso: !sequencia && !opts.saida, saida: opts.saida, duracao: dur + 150 })
    }, 30)

  // ---------- entrada ----------
  const setEntrada = (nova: Animacao | null, opts: { restaggerar?: boolean; intervalo?: number; ordem?: OrdemTela } = {}) => {
    const mapa = nova && multi && opts.restaggerar ? escalonar(sel, Math.min(...atrasos), opts.intervalo ?? intervalo, opts.ordem ?? ordem) : null
    acoes.atualizarCamadas(ids, (c) => {
      if (!nova || nova.type === 'none') return semCampo(c, 'enterAnimation')
      const delay = mapa?.get(c.id) ?? (emSequencia ? (c.enterAnimation?.delay ?? nova.delay) : nova.delay)
      return { ...c, enterAnimation: { ...nova, delay } } as Camada
    })
    if (nova && nova.type !== 'none') tocar()
  }
  const patchEntrada = (p: Partial<Animacao>) => {
    // em sequência, mudar velocidade/curva preserva os atrasos individuais
    acoes.atualizarCamadas(ids, (c) => (c.enterAnimation ? ({ ...c, enterAnimation: { ...c.enterAnimation, ...p } } as Camada) : c))
    tocar()
  }
  const escolherEntrada = (tipo: TipoAnimacao) => setEntrada(tipo === 'none' ? null : animacaoDoPreset(tipo, a))
  const ajustarEntrada = (patch: Partial<Animacao>, remover?: (keyof Animacao)[]) =>
    acoes.atualizarCamadas(ids, (c) => (c.enterAnimation ? ({ ...c, enterAnimation: comAjuste(c.enterAnimation, patch, remover) } as Camada) : c))

  // ---------- loop / saída ----------
  const setLoop = (novo: Loop | null) => {
    acoes.atualizarCamadas(ids, (c) => (novo ? ({ ...c, loopAnimation: novo } as Camada) : semCampo(c, 'loopAnimation')))
    if (novo) tocar({ loop: true })
  }
  const setSaida = (nova: Animacao | null) => {
    acoes.atualizarCamadas(ids, (c) => (nova ? ({ ...c, exitAnimation: nova } as Camada) : semCampo(c, 'exitAnimation')))
    if (nova) tocar({ saida: true })
  }

  // ---------- "Mais" ----------
  const animacoes = { enterAnimation: l.enterAnimation, loopAnimation: loop, exitAnimation: saida }
  const colar = () => {
    const c0 = areaAnimacao.ler()
    if (!c0) return
    acoes.atualizarCamadas(ids, (c) => comAnimacoesDe(c, c0))
    tocar({ loop: !!c0.loopAnimation })
  }
  const aplicarNaTela = () => {
    acoes.atualizarCamadas(outrasDaTela.map((c) => c.id), (c) => comAnimacoesDe(c, animacoes, true))
    setTimeout(() => pedirPrevia({ ids: camadasDaTela.filter(animavel).map((c) => c.id), duracao: Math.max(...camadasDaTela.map((c) => (c.enterAnimation ? c.enterAnimation.delay + duracaoTotal(c.enterAnimation) : 0)), a.type !== 'none' ? a.delay + duracaoTotal(a) : 0) + 300 }), 40)
  }
  const mais = (
    <Menu
      rotulo="Mais ações da animação"
      itens={[
        { id: 'copiar', rotulo: 'Copiar animação', desativado: !temAlguma, aoClicar: () => areaAnimacao.copiar(animacoes) },
        { id: 'colar', rotulo: 'Colar animação', descricao: copiada ? [copiada.enterAnimation ? nomeAnimacao(copiada.enterAnimation.type) : null, copiada.loopAnimation ? nomeLoop(copiada.loopAnimation.type) : null, copiada.exitAnimation ? `sai: ${nomeAnimacao(copiada.exitAnimation.type)}` : null].filter(Boolean).join(' · ') : undefined, desativado: !copiada, aoClicar: colar },
        { id: 'tela', rotulo: 'Aplicar a todas as camadas da tela', desativado: !temAlguma || !outrasDaTela.length, aoClicar: aplicarNaTela },
        ...(diferentes ? [{ id: 'selecionadas', rotulo: 'Aplicar a todas as selecionadas', aoClicar: () => { acoes.atualizarCamadas(ids, (c) => comAnimacoesDe(c, animacoes)); tocar() } }] : []),
        { id: 'remover', rotulo: multi ? 'Remover animações das selecionadas' : 'Remover animações desta camada', separador: true, perigo: true, desativado: !temAlguma && !temInterativo(l), aoClicar: () => acoes.atualizarCamadas(ids, (c) => { const { interactiveEffects: _x, ...sem } = semAnimacoes(c); return sem as Camada }) },
      ]}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </Menu>
  )

  const curva = curvaAberta ? 'personalizada' : curvaDe(a)
  const resumoEntrada = a.type !== 'none' ? `${nomeAnimacao(a.type)} · ${a.duration} ms${a.delay ? ` · após ${a.delay} ms` : ''}` : 'Nenhuma'
  const resumoLoop = loop ? `${nomeLoop(loop.type)}${loop.repeat ? ` · ${loop.repeat}×` : loop.until === 'offscreen' ? ' · até sair' : ''}` : 'Nenhuma'
  const resumoSaida = saida ? `${nomeAnimacao(saida.type)} · ${saida.duration} ms` : 'Nenhuma'
  const Icone = sel.every((c) => c.type === l.type) ? ICONE_TIPO[l.type] : Layers

  return (
    <div className="pb-6">
      <div className="border-b border-borda px-3 pb-2 pt-2.5">
        <div className="flex h-8 items-center gap-1.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] bg-acentoSuave text-acento"><Icone className="h-3.5 w-3.5" strokeWidth={1.75} /></span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{multi ? `${sel.length} camadas` : nomeCamada(l)}</span>
          {temAlguma && <BotaoPrevia aoClicar={() => tocar({ loop: !!loop })} />}
          {mais}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-texto3">{multi ? sel.map(nomeCamada).join(', ') : temAlguma ? [a.type !== 'none' ? resumoEntrada : null, loop ? nomeLoop(loop.type) : null, saida ? `sai: ${nomeAnimacao(saida.type)}` : null].filter(Boolean).join(' · ') : 'Sem animação'}</p>
      </div>

      {/* a Prévia da entrada é a do cabeçalho (uma só à vista); Ênfase e Saída têm a própria */}
      <Secao key={`${chaveSel}-entrada`} titulo="Entrada" chave="anim.entrada" resumo={resumoEntrada}>
        <Galeria
          key={chaveSel}
          presets={PRESETS_ENTRADA}
          atual={a.type !== 'none' ? a : undefined}
          textoPermitido={todasTexto}
          sugestoes={multi ? [] : sugestoesPara(l)}
          aoEscolher={(p) => setEntrada(animacaoDoPreset(p.id, a, p))}
          rotulo="Efeito de entrada"
          extra={<CartaoPreset rotulo="Nenhuma" selecionado={a.type === 'none'} aoClicar={() => escolherEntrada('none')}>{() => <MiniPrevia tocando={false} cor="#C9C6C0" />}</CartaoPreset>}
        />
        {!todasTexto && ehAnimacaoDeTexto(a.type) && <p className="text-[11px] text-texto2">{nomeAnimacao(a.type)} só funciona em texto; nas outras camadas vira fade.</p>}

        {a.type !== 'none' && (
          <div className="space-y-2 pt-1">
            <Rotulo>Velocidade</Rotulo>
            <Chips rotulo="Velocidade" cheio valor={velocidadeDe(a.type, a.duration)} opcoes={VELOCIDADES.map((v) => ({ ...v, titulo: `${duracaoPorVelocidade(a.type, v.id)} ms` }))} aoMudar={(v) => patchEntrada({ duration: duracaoPorVelocidade(a.type, v) })} />
            <PainelAjustes
              key={chaveSel}
              anim={a}
              camada={l}
              camadasDaTela={camadasDaTela}
              aoMudar={ajustarEntrada}
              aoPrevia={() => tocar()}
              resumoTempo={`${a.delay ? `após ${a.delay} ms · ` : ''}${CURVAS.find((c) => c.id === curva)?.rotulo ?? ''}${(a.repeat ?? 1) > 1 ? ` · ${a.repeat}×` : ''}`}
              tempo={
                <>
                  <CamposTempo
                    atraso={a.delay}
                    duracao={a.duration}
                    rotulo="da entrada"
                    maxAtraso={5000}
                    aoAtraso={(delay) => (multi && emSequencia ? setEntrada({ ...a, delay }, { restaggerar: true }) : patchEntrada({ delay }))}
                    aoDuracao={(duration) => patchEntrada({ duration })}
                  />
                  <Rotulo>Curva</Rotulo>
                  <Chips
                    rotulo="Curva"
                    valor={curva}
                    opcoes={CURVAS.map((c) => ({ id: c.id, rotulo: c.rotulo }))}
                    aoMudar={(c) => { setCurvaAberta(c === 'personalizada'); if (c === 'personalizada') { if (!a.bezier) patchEntrada({ bezier: pontosDaCurva(a) }) } else patchEntrada(camposDaCurva(c)) }}
                  />
                  {curva === 'personalizada' && (
                    <CurvaEasing
                      easing={a.easing}
                      bezier={a.bezier}
                      duracao={a.duration}
                      chave={`${a.type}-${a.duration}-${(a.bezier ?? []).join(',')}`}
                      aoInicio={() => { antesCurva.current = acoes.documentoAtual() }}
                      aoMudar={(bezier) => acoes.atualizarCamadas(ids, (c) => (c.enterAnimation ? ({ ...c, enterAnimation: { ...c.enterAnimation, bezier } } as Camada) : c), false)}
                      aoFim={() => { acoes.registrarHistorico(antesCurva.current); tocar() }}
                    />
                  )}
                  {a.type !== 'typewriter' && a.type !== 'scramble' && a.trigger !== 'scroll' && (
                    <>
                      <Rotulo>Repetir</Rotulo>
                      <Chips rotulo="Repetições da entrada" cheio valor={REPETICOES_ENTRADA.some((r) => r.id === String(a.repeat ?? 1)) ? String(a.repeat ?? 1) : null} opcoes={REPETICOES_ENTRADA} aoMudar={(id) => { const n = Number(id); acoes.atualizarCamadas(ids, (c) => (c.enterAnimation ? ({ ...c, enterAnimation: comAjuste(c.enterAnimation, n > 1 ? { repeat: n } : {}, n > 1 ? [] : ['repeat']) } as Camada) : c)); tocar() }} />
                    </>
                  )}
                </>
              }
            />
          </div>
        )}
      </Secao>

      <Secao key={`${chaveSel}-enfase`} titulo="Ênfase" chave="anim.enfase" aberta={!!loop} resumo={resumoLoop} acao={loop ? <BotaoPrevia aoClicar={() => tocar({ loop: true })} /> : undefined}>
        <GradeCartoesPreset rotulo="Ênfase em loop">
          <CartaoPreset rotulo="Nenhuma" selecionado={!loop} aoClicar={() => setLoop(null)}>{() => <MiniPrevia tocando={false} cor="#C9C6C0" />}</CartaoPreset>
          {PRESETS_LOOP.map((p) => (
            <CartaoPreset key={p.id} duasLinhas rotulo={p.rotulo} selecionado={loop?.type === p.id} aoClicar={() => setLoop({ type: p.id as TipoLoop, duration: p.duracao, intensity: loop?.intensity ?? 1, ...(loop?.repeat ? { repeat: loop.repeat } : {}) })}>
              {(t) => <MiniPrevia loop={p.id} tocando={t} />}
            </CartaoPreset>
          ))}
        </GradeCartoesPreset>
        {loop && (
          <>
            {AMPLITUDE[loop.type] ? (
              <>
                <Rotulo>{AMPLITUDE[loop.type]!.rotulo}</Rotulo>
                <Chips rotulo="Intensidade" cheio valor={INTENSIDADES.find((i) => i.v === loop.intensity)?.id ?? null} opcoes={[...INTENSIDADES]} aoMudar={(id) => setLoop({ ...loop, intensity: INTENSIDADES.find((i) => i.id === id)!.v })} />
                <Deslizante rotulo={`${AMPLITUDE[loop.type]!.rotulo} do loop`} valor={Math.round(AMPLITUDE[loop.type]!.base * loop.intensity * 10) / 10} min={Math.round(AMPLITUDE[loop.type]!.base * 0.25 * 10) / 10} max={AMPLITUDE[loop.type]!.base * 3} passo={AMPLITUDE[loop.type]!.base >= 10 ? 1 : 0.5} aoMudar={(v) => acoes.atualizarCamadas(ids, (c) => (c.loopAnimation ? ({ ...c, loopAnimation: { ...c.loopAnimation, intensity: Math.max(0.25, Math.min(3, v / AMPLITUDE[loop.type]!.base)) } } as Camada) : c))} formatar={(v) => `${v}${AMPLITUDE[loop.type]!.unidade}`} />
              </>
            ) : null}
            <Rotulo>Ritmo</Rotulo>
            <Chips
              rotulo="Ritmo do loop"
              cheio
              valor={RITMOS.find((r) => Math.round((PRESETS_LOOP.find((p) => p.id === loop.type)?.duracao ?? 3000) * r.f) === loop.duration)?.id ?? null}
              opcoes={[...RITMOS]}
              aoMudar={(id) => setLoop({ ...loop, duration: Math.round((PRESETS_LOOP.find((p) => p.id === loop.type)?.duracao ?? 3000) * RITMOS.find((r) => r.id === id)!.f) })}
            />
            <Rotulo>Repetir</Rotulo>
            <Chips rotulo="Repetições do loop" cheio valor={loop.until === 'offscreen' ? 'fora' : loop.repeat ? (REPETICOES.some((r) => r.id === String(loop.repeat)) ? String(loop.repeat) : null) : 'inf'} opcoes={REPETICOES} aoMudar={(id) => { const { repeat: _r, until: _u, ...sem } = loop; setLoop(id === 'inf' ? sem : id === 'fora' ? { ...sem, until: 'offscreen' } : { ...sem, repeat: Number(id) }) }} />
          </>
        )}
      </Secao>

      <Secao key={`${chaveSel}-saida`} titulo="Saída" chave="anim.saida" aberta={!!saida} resumo={resumoSaida} acao={saida ? <BotaoPrevia aoClicar={() => tocar({ saida: true })} /> : undefined}>
        <Galeria
          key={chaveSel}
          presets={PRESETS_SAIDA}
          atual={saida}
          textoPermitido={false}
          saida
          aoEscolher={(p) => setSaida({ ...animacaoDoPreset(p.id, undefined, p), delay: saida?.delay ?? 0 })}
          rotulo="Animação de saída"
          extra={<CartaoPreset rotulo="Nenhuma" selecionado={!saida} aoClicar={() => setSaida(null)}>{() => <MiniPrevia tocando={false} cor="#C9C6C0" />}</CartaoPreset>}
        />
        {saida && (
          <>
            <Rotulo>Velocidade</Rotulo>
            <Chips rotulo="Velocidade da saída" cheio valor={velocidadeDe(saida.type, saida.duration)} opcoes={VELOCIDADES} aoMudar={(v) => setSaida({ ...saida, duration: duracaoPorVelocidade(saida.type, v) })} />
            <PainelAjustes
              key={chaveSel}
              anim={saida}
              camada={l}
              camadasDaTela={camadasDaTela}
              saida
              aoMudar={(patch, remover) => acoes.atualizarCamadas(ids, (c) => (c.exitAnimation ? ({ ...c, exitAnimation: comAjuste(c.exitAnimation, patch, remover) } as Camada) : c))}
              aoPrevia={() => tocar({ saida: true })}
              resumoTempo={saida.delay ? `após ${saida.delay} ms` : undefined}
              tempo={<CamposTempo atraso={saida.delay} duracao={saida.duration} rotulo="da saída" maxAtraso={2000} aoAtraso={(delay) => setSaida({ ...saida, delay })} aoDuracao={(duration) => setSaida({ ...saida, duration })} />}
            />
          </>
        )}
      </Secao>

      <Secao key={`${chaveSel}-interativo`} titulo="Interativo" chave="anim.interativo" aberta={temInterativo(l)} resumo={resumoInterativo(l)}>
        <AbaInterativa editor={editor} sel={sel} />
      </Secao>

      {multi && (
        <Secao key={`${chaveSel}-sequencia`} titulo="Em sequência" chave="anim.sequencia" resumo={emSequencia ? `a cada ${intervalo} ms` : 'Juntas'} acao={<Interruptor rotulo="Animar em sequência" ativo={emSequencia} aoMudar={(v) => (a.type === 'none' ? undefined : v ? setEntrada(a, { restaggerar: true }) : patchEntrada({ delay: Math.min(...atrasos) }))} />}>
          {a.type === 'none' && <p className="text-[11px] text-texto3">Escolha uma entrada primeiro.</p>}
          {emSequencia && (
            <>
              <Rotulo>Intervalo</Rotulo>
              <Segmentado rotulo="Intervalo entre camadas" valor={String(intervalo)} opcoes={INTERVALOS.map((i) => ({ id: String(i), rotulo: `${i} ms` }))} aoMudar={(v) => { setIntervalo(Number(v)); setEntrada(a, { restaggerar: true, intervalo: Number(v) }) }} />
              <SeletorLista rotulo="Ordem da sequência" valor={ordem} aoMudar={(v) => { setOrdem(v as OrdemTela); setEntrada(a, { restaggerar: true, ordem: v as OrdemTela }) }} opcoes={ORDENS_TELA} />
            </>
          )}
        </Secao>
      )}

      {editor.cena && (
        <Secao titulo="Transição da tela" chave="anim.transicao" aberta={false} resumo={resumoTransicao(editor.cena)} acao={transicaoAtiva(editor) ? <BotaoPrevia aoClicar={() => previaTransicao(editor)} /> : undefined}>
          <TransicaoTela editor={editor} />
        </Secao>
      )}
    </div>
  )
}

const transicaoAtiva = (editor: Editor) => (editor.cena?.transition?.type ?? 'fade') !== 'none'
