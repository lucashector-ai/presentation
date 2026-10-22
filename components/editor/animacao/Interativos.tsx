'use client'
/**
 * Aba "Interativo" da animação de camada: parallax (profundidade), tilt 3D e luz/lanterna que seguem o mouse.
 * Um clique liga o efeito com o padrão bonito; Intensidade resolve o resto; Ajustes finos ficam recolhidos.
 * Prévia: os cartões tocam o efeito real (o mesmo invólucro do visualizador) com um ponteiro simulado; o botão
 * Prévia faz o mesmo no canvas.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Camada, EfeitosInterativos } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { INTENSIDADES_INTERATIVAS, PARALLAX_PADRAO, TILT_PADRAO, luzDe, tiltDe, type TipoInterativo } from '@/lib/scene/reativos'
import { pedirPrevia } from '@/components/renderer/animacao'
import { CamadaReativa, DURACAO_SIMULACAO_MS } from '@/components/renderer/reativos'
import { usePreferencias } from '@/components/renderer/useTamanho'
import { Deslizante, SeletorLista } from '@/components/editor/inspetor/controles'
import { cx } from '@/components/ui'
import { BotaoPrevia, CartaoPreset, Chips, GradeCartoesPreset, Rotulo, useCiclo } from './ui'

type Cartao = 'parallax' | 'tilt' | 'luz' | 'lanterna'
const CARTOES: { id: Cartao; rotulo: string; dica: string }[] = [
  { id: 'parallax', rotulo: 'Parallax', dica: 'Camadas em profundidades diferentes andam em velocidades diferentes' },
  { id: 'tilt', rotulo: 'Tilt 3D', dica: 'Inclina em 3D ao passar o mouse' },
  { id: 'luz', rotulo: 'Luz', dica: 'Um brilho segue o mouse' },
  { id: 'lanterna', rotulo: 'Lanterna', dica: 'Escurece em volta do mouse' },
]

/** Sugestão do que ligar pelo conteúdo da camada. */
export function sugestaoInterativa(c: Camada): Cartao[] {
  if (c.type === 'image' || c.type === 'video' || c.type === 'frame') return ['tilt', 'luz', 'parallax']
  if (c.type === 'shape') return c.width * c.height > 300_000 ? ['parallax', 'luz'] : ['tilt', 'parallax']
  if (c.type === 'text') return ['parallax']
  return ['parallax', 'tilt']
}

const ativoNo = (e: EfeitosInterativos | undefined, k: Cartao) =>
  k === 'parallax' ? !!e?.parallax?.depth : k === 'tilt' ? !!e?.tilt : k === 'luz' ? e?.spotlight?.mode === 'light' : e?.spotlight?.mode === 'dark'

export function AbaInterativa({ editor, sel }: { editor: Editor; sel: Camada[] }) {
  const { acoes } = editor
  const l = sel[0]
  if (!l) return null
  const ids = sel.map((c) => c.id)
  const e = l.interactiveEffects
  const mudar = (fn: (atual: EfeitosInterativos) => EfeitosInterativos, tocar = true) => {
    acoes.atualizarCamadas(ids, (c) => {
      const novo = limpar(fn({ ...c.interactiveEffects }))
      const { interactiveEffects: _x, ...sem } = c
      return (novo ? { ...sem, interactiveEffects: novo } : sem) as Camada
    })
    if (tocar) previa()
  }
  const previa = () => window.setTimeout(() => pedirPrevia({ ids, interativo: true, duracao: DURACAO_SIMULACAO_MS + 150 }), 30)
  const alternar = (k: Cartao) => mudar((a) => {
    if (k === 'parallax') return { ...a, parallax: a.parallax?.depth ? undefined : { ...PARALLAX_PADRAO } }
    if (k === 'tilt') return { ...a, tilt: a.tilt ? undefined : { angle: TILT_PADRAO.angle } }
    const modo = k === 'luz' ? 'light' : 'dark'
    return { ...a, spotlight: a.spotlight?.mode === modo ? undefined : { mode: modo } }
  }, !ativoNo(e, k))
  const algum = !!e && (!!e.parallax?.depth || !!e.tilt || !!e.spotlight)

  return (
    <div className="space-y-2 pt-3">
      <Rotulo acao={algum ? <BotaoPrevia aoClicar={previa} /> : undefined}>Reage ao mouse e à rolagem</Rotulo>
      <GradeCartoesPreset rotulo="Efeitos interativos">
        {CARTOES.map((k) => (
          <CartaoPreset key={k.id} rotulo={k.rotulo} titulo={k.dica} selecionado={ativoNo(e, k.id)} aoClicar={() => alternar(k.id)}>
            {(t) => <MiniInterativo tipo={k.id} tocando={t} />}
          </CartaoPreset>
        ))}
      </GradeCartoesPreset>
      {!algum && (
        <p className="text-[12px] leading-snug text-texto3">
          Sugestão para esta camada: {sugestaoInterativa(l).map((k) => CARTOES.find((x) => x.id === k)!.rotulo).join(', ')}. Liga e desliga com um clique; dá para combinar.
        </p>
      )}

      {e?.parallax?.depth ? <AjustesParallax p={e.parallax} aoMudar={(p) => mudar((a) => ({ ...a, parallax: p }), false)} aoPrevia={previa} /> : null}
      {e?.tilt ? <AjustesTilt t={e.tilt} aoMudar={(t) => mudar((a) => ({ ...a, tilt: t }), false)} aoPrevia={previa} /> : null}
      {e?.spotlight ? <AjustesLuz l={e.spotlight} aoMudar={(s) => mudar((a) => ({ ...a, spotlight: s }), false)} aoPrevia={previa} /> : null}

      {algum && <p className="text-[11px] leading-snug text-texto3">Slides e Explorar: seguem o mouse (o parallax também acompanha a transição e o voo da câmera). Story: o parallax acompanha a rolagem. No toque, tilt e luz ficam desligados; com movimento reduzido, nada se mexe.</p>}
    </div>
  )
}

/** Remove efeitos vazios (o documento só guarda o que está ligado). */
function limpar(e: EfeitosInterativos): EfeitosInterativos | undefined {
  const r: EfeitosInterativos = {}
  if (e.parallax?.depth) r.parallax = e.parallax
  if (e.tilt) r.tilt = e.tilt
  if (e.spotlight) r.spotlight = e.spotlight
  return Object.keys(r).length ? r : undefined
}

/** Ajustes finos recolhidos, com o atalho "Padrão". */
function Finos({ children, resumo, aoPadrao }: { children: ReactNode; resumo?: string; aoPadrao?: () => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="rounded-lg border border-borda">
      <div className="flex h-8 items-center gap-1 pl-1 pr-2">
        <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="flex h-full min-w-0 flex-1 items-center gap-1 rounded-md px-1 text-left text-[12px] font-medium text-texto hover:bg-hover">
          <ChevronRight className={cx('h-3.5 w-3.5 shrink-0 text-texto3 transition-transform', aberto && 'rotate-90')} />
          Ajustes finos
          {!aberto && resumo && <span className="ml-1 truncate font-normal text-texto3">{resumo}</span>}
        </button>
        {aoPadrao && <button type="button" onClick={aoPadrao} className="shrink-0 text-[11px] text-texto2 hover:text-texto">Padrão</button>}
      </div>
      {aberto && <div className="space-y-2 border-t border-borda px-2.5 pb-2.5 pt-2">{children}</div>}
    </div>
  )
}

/** Prévia 300 ms depois do último ajuste (arrastar o deslizador não toca a cada passo). */
function useDepois(aoPrevia: () => void) {
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  return () => { window.clearTimeout(t.current); t.current = window.setTimeout(aoPrevia, 300) }
}

function Titulo({ children }: { children: ReactNode }) {
  return <div className="pt-2 text-[12px] font-medium text-texto">{children}</div>
}

function AjustesParallax({ p, aoMudar, aoPrevia }: { p: NonNullable<EfeitosInterativos['parallax']>; aoMudar: (p: NonNullable<EfeitosInterativos['parallax']>) => void; aoPrevia: () => void }) {
  const depois = useDepois(aoPrevia)
  const sinal = p.depth < 0 ? -1 : 1
  const mag = Math.abs(p.depth)
  const set = (patch: Partial<typeof p>) => { aoMudar({ ...p, ...patch }); depois() }
  return (
    <div className="space-y-2 border-t border-borda pt-2">
      <Titulo>Parallax</Titulo>
      <Rotulo>Profundidade</Rotulo>
      <Chips rotulo="Profundidade" cheio valor={sinal > 0 ? 'perto' : 'longe'} opcoes={[{ id: 'perto', rotulo: 'Mais perto', titulo: 'Anda mais que o resto' }, { id: 'longe', rotulo: 'Mais longe', titulo: 'Anda menos, como o fundo' }]} aoMudar={(v) => set({ depth: (v === 'perto' ? 1 : -1) * mag })} />
      <Rotulo>Intensidade</Rotulo>
      <Chips rotulo="Intensidade do parallax" cheio valor={INTENSIDADES_INTERATIVAS.find((i) => i.parallax === mag)?.id ?? null} opcoes={INTENSIDADES_INTERATIVAS.map((i) => ({ id: i.id, rotulo: i.rotulo }))} aoMudar={(id) => set({ depth: sinal * INTENSIDADES_INTERATIVAS.find((i) => i.id === id)!.parallax })} />
      <Finos resumo={`${p.depth > 0 ? '+' : ''}${p.depth}`} aoPadrao={() => set({ depth: PARALLAX_PADRAO.depth, axis: undefined })}>
        <Rotulo>Profundidade (− fundo · + frente)</Rotulo>
        <Deslizante rotulo="Profundidade do parallax" valor={p.depth} min={-100} max={100} passo={5} aoMudar={(v) => set({ depth: v === 0 ? (sinal * 5) : v })} formatar={(v) => `${v > 0 ? '+' : ''}${v}`} />
        <Rotulo>Com o mouse, anda em</Rotulo>
        <SeletorLista rotulo="Eixos do parallax com o mouse" valor={p.axis ?? 'both'} aoMudar={(v) => set({ axis: v === 'both' ? undefined : (v as 'x' | 'y') })} opcoes={[{ id: 'both', rotulo: 'Todas as direções' }, { id: 'x', rotulo: 'Só na horizontal' }, { id: 'y', rotulo: 'Só na vertical' }]} />
      </Finos>
    </div>
  )
}

function AjustesTilt({ t, aoMudar, aoPrevia }: { t: NonNullable<EfeitosInterativos['tilt']>; aoMudar: (t: NonNullable<EfeitosInterativos['tilt']>) => void; aoPrevia: () => void }) {
  const depois = useDepois(aoPrevia)
  const d = tiltDe(t)
  const set = (patch: Partial<typeof t>) => { aoMudar({ ...t, ...patch }); depois() }
  return (
    <div className="space-y-2 border-t border-borda pt-2">
      <Titulo>Tilt 3D</Titulo>
      <Rotulo>Intensidade</Rotulo>
      <Chips rotulo="Intensidade do tilt" cheio valor={INTENSIDADES_INTERATIVAS.find((i) => i.tilt === t.angle)?.id ?? null} opcoes={INTENSIDADES_INTERATIVAS.map((i) => ({ id: i.id, rotulo: i.rotulo, titulo: `${i.tilt}°` }))} aoMudar={(id) => set({ angle: INTENSIDADES_INTERATIVAS.find((i) => i.id === id)!.tilt })} />
      <Finos resumo={`${d.angle}° · ${Math.round((d.scale - 1) * 100)}%`} aoPadrao={() => aoMudar({ angle: TILT_PADRAO.angle })}>
        <Rotulo>Inclinação máxima</Rotulo>
        <Deslizante rotulo="Inclinação máxima em graus" valor={d.angle} min={1} max={30} passo={1} aoMudar={(v) => set({ angle: v })} formatar={(v) => `${v}°`} />
        <Rotulo>Cresce ao passar o mouse</Rotulo>
        <Deslizante rotulo="Quanto cresce em porcentagem" valor={Math.round((d.scale - 1) * 100)} min={0} max={10} passo={1} aoMudar={(v) => set({ scale: 1 + v / 100 })} formatar={(v) => `${v}%`} />
        <Rotulo>Perspectiva</Rotulo>
        <Deslizante rotulo="Perspectiva em px (menor = 3D mais forte)" valor={d.perspective} min={300} max={3000} passo={50} aoMudar={(v) => set({ perspective: v })} formatar={(v) => `${v}px`} />
        <Rotulo>Suavidade</Rotulo>
        <Deslizante rotulo="Suavidade do movimento" valor={Math.round(d.smooth * 100)} min={0} max={100} passo={5} aoMudar={(v) => set({ smooth: v / 100 })} formatar={(v) => `${v}%`} />
      </Finos>
    </div>
  )
}

function AjustesLuz({ l, aoMudar, aoPrevia }: { l: NonNullable<EfeitosInterativos['spotlight']>; aoMudar: (l: NonNullable<EfeitosInterativos['spotlight']>) => void; aoPrevia: () => void }) {
  const depois = useDepois(aoPrevia)
  const d = luzDe(l)
  const set = (patch: Partial<typeof l>) => { aoMudar({ ...l, ...patch }); depois() }
  const lanterna = l.mode === 'dark'
  return (
    <div className="space-y-2 border-t border-borda pt-2">
      <Titulo>{lanterna ? 'Lanterna' : 'Luz'}</Titulo>
      <Rotulo>Intensidade</Rotulo>
      <Chips rotulo="Intensidade da luz" cheio valor={INTENSIDADES_INTERATIVAS.find((i) => i.luz === d.intensity)?.id ?? null} opcoes={INTENSIDADES_INTERATIVAS.map((i) => ({ id: i.id, rotulo: i.rotulo }))} aoMudar={(id) => set({ intensity: INTENSIDADES_INTERATIVAS.find((i) => i.id === id)!.luz })} />
      {!lanterna && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[12px] text-texto2">Cor da luz</span>
          <input type="color" aria-label="Cor da luz" value={d.color.slice(0, 7)} onChange={(ev) => set({ color: ev.target.value })} className="h-7 w-10 cursor-pointer rounded border border-borda bg-transparent" />
        </div>
      )}
      <Finos resumo={`${d.size}%`} aoPadrao={() => aoMudar({ mode: l.mode })}>
        <Rotulo>Tamanho</Rotulo>
        <Deslizante rotulo="Tamanho da luz em porcentagem da camada" valor={d.size} min={10} max={150} passo={5} aoMudar={(v) => set({ size: v })} formatar={(v) => `${v}%`} />
        <Rotulo>Força</Rotulo>
        <Deslizante rotulo="Força da luz" valor={Math.round(d.intensity * 100)} min={5} max={100} passo={5} aoMudar={(v) => set({ intensity: v / 100 })} formatar={(v) => `${v}%`} />
      </Finos>
    </div>
  )
}

// ---------- miniaturas dos cartões (o mesmo invólucro do visualizador, com ponteiro simulado) ----------

const ESCALA = 0.25

/** Pose do cartão parado: o ponteiro num canto, para cada cartão mostrar o "jeito" do efeito. */
const POSE: [number, number] = [0.78, 0.3]

function Caixa({ x, y, w, h, efeitos, simular, fundo, raio = 0, children }: { x: number; y: number; w: number; h: number; efeitos: EfeitosInterativos; simular?: number; fundo: string; raio?: number; children?: ReactNode }) {
  return (
    <span style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
      <CamadaReativa efeitos={efeitos} modo="editor" reduzir={false} semHover={false} largura={w} altura={h} raio={raio} simular={simular} pose={simular ? undefined : POSE}>
        <span style={{ position: 'absolute', inset: 0, background: fundo, borderRadius: raio, overflow: 'hidden' }}>{children}</span>
      </CamadaReativa>
    </span>
  )
}

export function MiniInterativo({ tipo, tocando }: { tipo: TipoInterativo | Cartao; tocando: boolean }) {
  const { reduzirMovimento } = usePreferencias()
  const ativo = tocando && !reduzirMovimento
  const ciclo = useCiclo(ativo, DURACAO_SIMULACAO_MS + 400)
  const simular = ativo ? ciclo : undefined
  let cena: ReactNode
  if (tipo === 'parallax') {
    cena = (
      <>
        <Caixa x={-20} y={-20} w={328} h={200} efeitos={{ parallax: { depth: -60 } }} simular={simular} fundo="#E3E5FB" />
        <Caixa x={40} y={58} w={150} h={70} efeitos={{ parallax: { depth: 20 } }} simular={simular} fundo="#9AA1F7" raio={10} />
        <Caixa x={178} y={30} w={72} h={72} efeitos={{ parallax: { depth: 100 } }} simular={simular} fundo="#5965F2" raio={36} />
      </>
    )
  } else if (tipo === 'tilt') {
    cena = <Caixa x={64} y={30} w={160} h={100} efeitos={{ tilt: { angle: 16, scale: 1.05 } }} simular={simular} fundo="linear-gradient(135deg, #7C84F5, #5965F2)" raio={14} />
  } else {
    const lanterna = tipo === 'lanterna' || tipo === 'spotlight'
    cena = (
      <Caixa x={54} y={24} w={180} h={112} efeitos={{ spotlight: { mode: lanterna ? 'dark' : 'light', intensity: lanterna ? 0.85 : 0.8, size: lanterna ? 40 : 55 } }} simular={simular} fundo={lanterna ? 'linear-gradient(135deg, #F2C14E, #E4572E)' : '#2B2D52'} raio={14}>
        <span style={{ position: 'absolute', left: 18, top: 20, width: 90, height: 12, borderRadius: 6, background: lanterna ? '#fff8' : '#ffffff55' }} />
        <span style={{ position: 'absolute', left: 18, top: 42, width: 130, height: 10, borderRadius: 5, background: lanterna ? '#fff6' : '#ffffff33' }} />
      </Caixa>
    )
  }
  return (
    <span aria-hidden className="absolute left-1/2 top-1/2" style={{ width: 288, height: 160, marginLeft: -144, marginTop: -80, transform: `scale(${ESCALA})` }}>
      {cena}
    </span>
  )
}

