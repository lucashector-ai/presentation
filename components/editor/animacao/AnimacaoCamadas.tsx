'use client'
/** Aba Animação com camadas selecionadas: galerias de Entrada, Ênfase (loop) e Saída + controles simples. */
import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Copy, Layers } from 'lucide-react'
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
  camposDaCurva,
  curvaDe,
  duracaoPorVelocidade,
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
import { CampoNum, Interruptor, SeletorLista } from '@/components/editor/inspetor/controles'
import { CurvaEasing } from '@/components/editor/inspetor/CurvaEasing'
import { AbasInternas, BotaoPrevia, CartaoPreset, Chips, GradeCartoesPreset, MiniPrevia, Rotulo, areaAnimacao, useAnimacaoCopiada } from './ui'

type Aba = 'entrada' | 'enfase' | 'saida'
const INTERVALOS = [60, 100, 150, 250] as const
const INTENSIDADES = [
  { id: 'sutil', rotulo: 'Sutil', v: 0.5 },
  { id: 'normal', rotulo: 'Normal', v: 1 },
  { id: 'forte', rotulo: 'Forte', v: 2 },
] as const
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

export function AnimacaoCamadas({ editor }: { editor: Editor }) {
  const { camadasSelecionadas: sel, acoes } = editor
  const [aba, setAba] = useState<Aba>('entrada')
  const [intervalo, setIntervalo] = useState<number>(100)
  const [ordem, setOrdem] = useState<OrdemTela>('topo')
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
  const atrasos = sel.map((c) => c.enterAnimation?.delay ?? 0)
  const emSequencia = multi && new Set(atrasos).size > 1
  const diferentes = multi && sel.some((c) => !igual(c.enterAnimation, l.enterAnimation) || !igual(c.loopAnimation, loop) || !igual(c.exitAnimation, saida)) && !emSequencia

  // ---------- prévia ----------
  const tocar = (opts: { saida?: boolean; loop?: boolean } = {}) =>
    setTimeout(() => {
      const atual = editor.acoes.documentoAtual().scenes.find((s) => s.id === editor.estado.cenaId)?.layers.filter((c) => ids.includes(c.id)) ?? sel
      const sequencia = multi && new Set(atual.map((c) => c.enterAnimation?.delay ?? 0)).size > 1
      let dur = 0
      for (const c of atual) {
        const e = opts.saida ? c.exitAnimation : c.enterAnimation
        const base = e ? (sequencia || opts.saida ? e.delay : 0) + e.duration : 0
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

  // ---------- loop / saída ----------
  const setLoop = (novo: Loop | null) => {
    acoes.atualizarCamadas(ids, (c) => (novo ? ({ ...c, loopAnimation: novo } as Camada) : semCampo(c, 'loopAnimation')))
    if (novo) tocar({ loop: true })
  }
  const setSaida = (nova: Animacao | null) => {
    acoes.atualizarCamadas(ids, (c) => (nova ? ({ ...c, exitAnimation: nova } as Camada) : semCampo(c, 'exitAnimation')))
    if (nova) tocar({ saida: true })
  }

  const curva = curvaAberta ? 'personalizada' : curvaDe(a)
  const resumo = a.type !== 'none' ? `${nomeAnimacao(a.type)} · ${a.duration} ms${a.delay ? ` · após ${a.delay} ms` : ''}` : 'Sem entrada'

  return (
    <div>
      <div className="border-b border-borda px-4 py-4">
        <div className="rotulo-mono mb-1 flex items-center gap-1.5">{multi ? <><Layers className="h-3 w-3" /> {sel.length} camadas</> : 'Camada'}</div>
        <div className="truncate text-[15px] font-medium">{multi ? sel.map(nomeCamada).join(', ') : nomeCamada(l)}</div>
        <div className="mt-0.5 truncate text-[12px] text-texto2">{resumo}{loop ? ` · ${nomeLoop(loop.type)}` : ''}{saida ? ` · sai: ${nomeAnimacao(saida.type)}` : ''}</div>
      </div>

      <section className="border-b border-borda px-4 py-4">
        <AbasInternas
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { id: 'entrada', rotulo: 'Entrada', ativo: a.type !== 'none' },
            { id: 'enfase', rotulo: 'Ênfase', ativo: !!loop },
            { id: 'saida', rotulo: 'Saída', ativo: !!saida },
          ]}
        />

        {aba === 'entrada' && (
          <div className="space-y-2 pt-3">
            <Rotulo acao={a.type !== 'none' ? <BotaoPrevia aoClicar={() => tocar()} /> : undefined}>Como a camada aparece</Rotulo>
            <GradeCartoesPreset rotulo="Efeito de entrada">
              <CartaoPreset rotulo="Nenhuma" selecionado={a.type === 'none'} aoClicar={() => escolherEntrada('none')}>{() => <MiniPrevia tocando={false} cor="#C9C6C0" />}</CartaoPreset>
              {PRESETS_ENTRADA.filter((p) => !p.soTexto).map((p) => (
                <CartaoPreset key={p.id} rotulo={p.rotulo} selecionado={a.type === p.id} aoClicar={() => escolherEntrada(p.id)}>
                  {(t) => <MiniPrevia tipo={p.id} tocando={t} />}
                </CartaoPreset>
              ))}
            </GradeCartoesPreset>
            {todasTexto && (
              <>
                <Rotulo>Para texto</Rotulo>
                <GradeCartoesPreset rotulo="Efeito de entrada para texto">
                  {PRESETS_ENTRADA.filter((p) => p.soTexto).map((p) => (
                    <CartaoPreset key={p.id} duasLinhas rotulo={p.rotulo} selecionado={a.type === p.id} aoClicar={() => escolherEntrada(p.id)}>
                      {(t) => <MiniPrevia tipo={p.id} texto tocando={t} />}
                    </CartaoPreset>
                  ))}
                </GradeCartoesPreset>
              </>
            )}
            {!todasTexto && ehAnimacaoDeTexto(a.type) && <p className="text-[12px] text-texto2">{nomeAnimacao(a.type)} só funciona em texto; nas outras camadas vira fade.</p>}

            {a.type !== 'none' && (
              <div className="space-y-2 pt-1">
                <Rotulo>Velocidade</Rotulo>
                <Chips rotulo="Velocidade" cheio valor={velocidadeDe(a.type, a.duration)} opcoes={VELOCIDADES.map((v) => ({ ...v, titulo: `${duracaoPorVelocidade(a.type, v.id)} ms` }))} aoMudar={(v) => patchEntrada({ duration: duracaoPorVelocidade(a.type, v) })} />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <CampoNum prefixo="Atraso" rotulo="Atraso da entrada" valor={a.delay} min={0} max={5000} passo={50} sufixo="ms" aoMudar={(delay) => (multi && emSequencia ? setEntrada({ ...a, delay }, { restaggerar: true }) : patchEntrada({ delay }))} />
                  <CampoNum prefixo="Duração" rotulo="Duração da entrada" valor={a.duration} min={100} max={3000} passo={50} sufixo="ms" aoMudar={(duration) => patchEntrada({ duration })} />
                </div>
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
              </div>
            )}
          </div>
        )}

        {aba === 'enfase' && (
          <div className="space-y-2 pt-3">
            <Rotulo acao={loop ? <BotaoPrevia aoClicar={() => tocar({ loop: true })} /> : undefined}>Movimento contínuo</Rotulo>
            <GradeCartoesPreset rotulo="Ênfase em loop">
              <CartaoPreset rotulo="Nenhuma" selecionado={!loop} aoClicar={() => setLoop(null)}>{() => <MiniPrevia tocando={false} cor="#C9C6C0" />}</CartaoPreset>
              {PRESETS_LOOP.map((p) => (
                <CartaoPreset key={p.id} duasLinhas rotulo={p.rotulo} selecionado={loop?.type === p.id} aoClicar={() => setLoop({ type: p.id as TipoLoop, duration: p.duracao, intensity: loop?.intensity ?? 1 })}>
                  {(t) => <MiniPrevia loop={p.id} tocando={t} />}
                </CartaoPreset>
              ))}
            </GradeCartoesPreset>
            <p className="text-[12px] leading-snug text-texto3">Começa quando a entrada termina e repete enquanto a tela estiver aberta.</p>
            {loop && (
              <>
                <Rotulo>Intensidade</Rotulo>
                <Chips rotulo="Intensidade" cheio valor={INTENSIDADES.find((i) => i.v === loop.intensity)?.id ?? null} opcoes={[...INTENSIDADES]} aoMudar={(id) => setLoop({ ...loop, intensity: INTENSIDADES.find((i) => i.id === id)!.v })} />
                <Rotulo>Ritmo</Rotulo>
                <Chips
                  rotulo="Ritmo do loop"
                  cheio
                  valor={RITMOS.find((r) => Math.round((PRESETS_LOOP.find((p) => p.id === loop.type)?.duracao ?? 3000) * r.f) === loop.duration)?.id ?? null}
                  opcoes={[...RITMOS]}
                  aoMudar={(id) => setLoop({ ...loop, duration: Math.round((PRESETS_LOOP.find((p) => p.id === loop.type)?.duracao ?? 3000) * RITMOS.find((r) => r.id === id)!.f) })}
                />
              </>
            )}
          </div>
        )}

        {aba === 'saida' && (
          <div className="space-y-2 pt-3">
            <Rotulo acao={saida ? <BotaoPrevia aoClicar={() => tocar({ saida: true })} /> : undefined}>Ao sair da tela</Rotulo>
            <GradeCartoesPreset rotulo="Animação de saída">
              <CartaoPreset rotulo="Nenhuma" selecionado={!saida} aoClicar={() => setSaida(null)}>{() => <MiniPrevia tocando={false} cor="#C9C6C0" />}</CartaoPreset>
              {PRESETS_SAIDA.map((p) => (
                <CartaoPreset key={p.id} rotulo={p.rotulo} selecionado={saida?.type === p.id} aoClicar={() => setSaida({ ...animacaoDoPreset(p.id), delay: saida?.delay ?? 0 })}>
                  {(t) => <MiniPrevia tipo={p.id} saida tocando={t} />}
                </CartaoPreset>
              ))}
            </GradeCartoesPreset>
            <p className="text-[12px] leading-snug text-texto3">Toca antes da transição; a próxima tela entra quando as saídas terminam.</p>
            {saida && (
              <>
                <Rotulo>Velocidade</Rotulo>
                <Chips rotulo="Velocidade da saída" cheio valor={velocidadeDe(saida.type, saida.duration)} opcoes={VELOCIDADES} aoMudar={(v) => setSaida({ ...saida, duration: duracaoPorVelocidade(saida.type, v) })} />
                <CampoNum prefixo="Atraso" rotulo="Atraso da saída" valor={saida.delay} min={0} max={2000} passo={50} sufixo="ms" aoMudar={(delay) => setSaida({ ...saida, delay })} />
              </>
            )}
          </div>
        )}
      </section>

      {multi && (
        <section className="space-y-2 border-b border-borda px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Em sequência</span>
            <Interruptor rotulo="Animar em sequência" ativo={emSequencia} aoMudar={(v) => (a.type === 'none' ? undefined : v ? setEntrada(a, { restaggerar: true }) : patchEntrada({ delay: Math.min(...atrasos) }))} />
          </div>
          <p className="text-[12px] leading-snug text-texto3">{a.type === 'none' ? 'Escolha uma entrada para animar as camadas uma depois da outra.' : 'Uma camada depois da outra, com o intervalo escolhido.'}</p>
          {emSequencia && (
            <>
              <Rotulo>Intervalo</Rotulo>
              <Chips rotulo="Intervalo entre camadas" cheio valor={String(intervalo)} opcoes={INTERVALOS.map((i) => ({ id: String(i), rotulo: `${i} ms` }))} aoMudar={(v) => { setIntervalo(Number(v)); setEntrada(a, { restaggerar: true, intervalo: Number(v) }) }} />
              <SeletorLista rotulo="Ordem da sequência" valor={ordem} aoMudar={(v) => { setOrdem(v as OrdemTela); setEntrada(a, { restaggerar: true, ordem: v as OrdemTela }) }} opcoes={ORDENS_TELA} />
            </>
          )}
          {diferentes && (
            <button type="button" onClick={() => { acoes.atualizarCamadas(ids, (c) => ({ ...semCampo(semCampo(semCampo(c, 'enterAnimation'), 'loopAnimation'), 'exitAnimation'), ...(l.enterAnimation ? { enterAnimation: l.enterAnimation } : {}), ...(loop ? { loopAnimation: loop } : {}), ...(saida ? { exitAnimation: saida } : {}) }) as Camada); tocar() }} className="h-8 w-full rounded-md border border-borda text-[12px] hover:border-bordaForte">
              Aplicar a todas as selecionadas
            </button>
          )}
        </section>
      )}

      <section className="flex gap-2 px-4 py-4">
        <button type="button" onClick={() => areaAnimacao.copiar({ enterAnimation: l.enterAnimation, loopAnimation: loop, exitAnimation: saida })} disabled={!l.enterAnimation && !loop && !saida} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-borda text-[12px] text-texto2 hover:border-bordaForte hover:text-texto disabled:opacity-40">
          <Copy className="h-3.5 w-3.5" /> Copiar animação
        </button>
        <button
          type="button"
          disabled={!copiada}
          onClick={() => {
            const c0 = areaAnimacao.ler()
            if (!c0) return
            acoes.atualizarCamadas(ids, (c) => ({ ...semCampo(semCampo(semCampo(c, 'enterAnimation'), 'loopAnimation'), 'exitAnimation'), ...(c0.enterAnimation ? { enterAnimation: c0.enterAnimation } : {}), ...(c0.loopAnimation ? { loopAnimation: c0.loopAnimation } : {}), ...(c0.exitAnimation ? { exitAnimation: c0.exitAnimation } : {}) }) as Camada)
            tocar({ loop: !!c0.loopAnimation })
          }}
          title={copiada ? `Colar: ${copiada.enterAnimation ? nomeAnimacao(copiada.enterAnimation.type) : 'sem entrada'}` : 'Copie a animação de uma camada primeiro'}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-borda text-[12px] text-texto2 hover:border-bordaForte hover:text-texto disabled:opacity-40"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Colar
        </button>
      </section>
    </div>
  )
}
