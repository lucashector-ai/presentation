'use client'
/** Posição: alinhamento (6 botões + distribuir), X/Y, rotação com girar 90° e espelhar. */
import type { ReactNode } from 'react'
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround, Crosshair, FlipHorizontal2, FlipVertical2, RotateCw } from 'lucide-react'
import type { Alinhamento } from '@/lib/scene/transform'
import { cx } from '@/components/ui'
import { BotaoCampo, CampoNum, Secao, SeletorLista } from './controles'
import { IconeAngulo } from './SeletorCor'
import { comum, useCamadas, type PropsSecao } from './selecao'

/** Ângulo no intervalo (-180, 180], como o Figma mostra. */
export const normalizarAngulo = (r: number) => {
  const n = ((((r + 180) % 360) + 360) % 360) - 180
  return n === -180 ? 180 : Math.round(n * 100) / 100
}

const ALINHAR: [Alinhamento, typeof AlignStartVertical, string][] = [
  ['esquerda', AlignStartVertical, 'Alinhar à esquerda'],
  ['centroH', AlignCenterVertical, 'Centralizar na horizontal'],
  ['direita', AlignEndVertical, 'Alinhar à direita'],
  ['topo', AlignStartHorizontal, 'Alinhar ao topo'],
  ['centroV', AlignCenterHorizontal, 'Centralizar na vertical'],
  ['base', AlignEndHorizontal, 'Alinhar à base'],
]

export function GrupoBotoes({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex h-8 min-w-0 flex-1 items-center rounded-md bg-superficie2 p-[2px]', className)}>{children}</div>
}

export function BotaoGrupo({ rotulo, onClick, children, ativo }: { rotulo: string; onClick: () => void; children: ReactNode; ativo?: boolean }) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} aria-pressed={ativo} onClick={onClick} className={cx('flex h-7 min-w-0 flex-1 items-center justify-center rounded-[5px] transition-colors', ativo ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-texto2 hover:bg-superficie hover:text-texto hover:shadow-[0_1px_2px_rgba(0,0,0,.06)]')}>
      {children}
    </button>
  )
}

/** Vistas 3D prontas (rx, ry em graus). */
const VISTAS_3D = [
  { id: 'plano', nome: 'Plano', rx: 0, ry: 0 },
  { id: 'esquerda', nome: 'Esquerda', rx: 0, ry: -35 },
  { id: 'direita', nome: 'Direita', rx: 0, ry: 35 },
  { id: 'sup-esquerda', nome: 'Superior esquerda', rx: 30, ry: -35 },
  { id: 'sup-direita', nome: 'Superior direita', rx: 30, ry: 35 },
  { id: 'isometrico', nome: 'Isométrico', rx: 45, ry: -30 },
  { id: 'personalizado', nome: 'Personalizado', rx: NaN, ry: NaN },
] as const
const vista3d = (rx: unknown, ry: unknown) => VISTAS_3D.find((v) => v.rx === rx && v.ry === ry)?.id ?? 'personalizado'

export function SecaoPosicao({ editor }: PropsSecao) {
  const { acoes } = editor
  const { sel, ids, multi, set, setFn } = useCamadas(editor)
  const l = sel[0]
  if (!l) return null
  const x = comum(sel, (c) => Math.round(c.x * 100) / 100)
  const y = comum(sel, (c) => Math.round(c.y * 100) / 100)
  const rot = comum(sel, (c) => c.rotation)
  return (
    <Secao titulo="Posição">
      <div className="flex gap-2">
        <GrupoBotoes>
          {ALINHAR.slice(0, 3).map(([m, I, r]) => <BotaoGrupo key={m} rotulo={r} onClick={() => acoes.alinhar(ids, m)}><I className="h-3.5 w-3.5" /></BotaoGrupo>)}
        </GrupoBotoes>
        <GrupoBotoes>
          {ALINHAR.slice(3).map(([m, I, r]) => <BotaoGrupo key={m} rotulo={r} onClick={() => acoes.alinhar(ids, m)}><I className="h-3.5 w-3.5" /></BotaoGrupo>)}
        </GrupoBotoes>
        {multi && (
          <GrupoBotoes className="!flex-[0.4]">
            <BotaoGrupo rotulo="Centralizar a seleção na tela (margens iguais)" onClick={() => acoes.centralizarNaTela(ids)}><Crosshair className="h-3.5 w-3.5" /></BotaoGrupo>
          </GrupoBotoes>
        )}
        {sel.length >= 3 && (
          <GrupoBotoes className="!flex-[0.7]">
            <BotaoGrupo rotulo="Distribuir na horizontal" onClick={() => acoes.distribuir(ids, 'h')}><AlignHorizontalSpaceAround className="h-3.5 w-3.5" /></BotaoGrupo>
            <BotaoGrupo rotulo="Distribuir na vertical" onClick={() => acoes.distribuir(ids, 'v')}><AlignVerticalSpaceAround className="h-3.5 w-3.5" /></BotaoGrupo>
          </GrupoBotoes>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1fr_32px] gap-2">
        <CampoNum prefixo="X" rotulo="Posição X" valor={x} aoMudar={(v) => (multi ? setFn((c) => ({ ...c, x: v })) : set({ x: v }))} aoDelta={(d) => setFn((c) => ({ ...c, x: c.x + d }))} />
        <CampoNum prefixo="Y" rotulo="Posição Y" valor={y} aoMudar={(v) => (multi ? setFn((c) => ({ ...c, y: v })) : set({ y: v }))} aoDelta={(d) => setFn((c) => ({ ...c, y: c.y + d }))} />
      </div>
      <div className="grid grid-cols-[1fr_1fr_32px] gap-2">
        <CampoNum prefixo={<IconeAngulo />} rotulo="Rotação" valor={rot} min={-360} max={360} sufixo="°" casas={1} aoMudar={(v) => set({ rotation: normalizarAngulo(v) })} aoDelta={(d) => setFn((c) => ({ ...c, rotation: normalizarAngulo(c.rotation + d) }))} />
        <div className="flex items-center gap-0.5">
          <BotaoCampo rotulo="Girar 90° à direita" onClick={() => setFn((c) => ({ ...c, rotation: normalizarAngulo(c.rotation + 90) }))}><RotateCw className="h-3.5 w-3.5" /></BotaoCampo>
          <BotaoCampo rotulo="Espelhar na horizontal" ativo={comum(sel, (c) => c.flipX) === true} onClick={() => acoes.inverter(ids, 'x')}><FlipHorizontal2 className="h-3.5 w-3.5" /></BotaoCampo>
          <BotaoCampo rotulo="Espelhar na vertical" ativo={comum(sel, (c) => c.flipY) === true} onClick={() => acoes.inverter(ids, 'y')}><FlipVertical2 className="h-3.5 w-3.5" /></BotaoCampo>
        </div>
      </div>
      {/* 3D: um menu com as vistas (como o plugin Isometric do Figma); os ângulos só aparecem quando há inclinação */}
      <SeletorLista
        rotulo="Vista 3D"
        prefixo={<span className="mono text-[10px] text-texto3">3D</span>}
        valor={vista3d(comum(sel, (c) => c.rotateX ?? 0), comum(sel, (c) => c.rotateY ?? 0))}
        opcoes={VISTAS_3D.map((v) => ({ id: v.id, rotulo: v.nome }))}
        aoMudar={(id) => { const v = VISTAS_3D.find((x) => x.id === id); if (v && v.id !== 'personalizado') set({ rotateX: v.rx || undefined, rotateY: v.ry || undefined, perspective: v.rx || v.ry ? 1200 : undefined }) }}
      />
      {(comum(sel, (c) => c.rotateX ?? 0) !== 0 || comum(sel, (c) => c.rotateY ?? 0) !== 0) && (
        <div className="grid grid-cols-[1fr_1fr_32px] gap-2">
          <CampoNum prefixo="X" rotulo="Inclinação 3D no eixo X" valor={comum(sel, (c) => c.rotateX ?? 0)} min={-180} max={180} sufixo="°" aoMudar={(v) => set({ rotateX: v || undefined })} aoDelta={(d) => setFn((c) => ({ ...c, rotateX: ((c.rotateX ?? 0) + d) || undefined }))} />
          <CampoNum prefixo="Y" rotulo="Inclinação 3D no eixo Y" valor={comum(sel, (c) => c.rotateY ?? 0)} min={-180} max={180} sufixo="°" aoMudar={(v) => set({ rotateY: v || undefined })} aoDelta={(d) => setFn((c) => ({ ...c, rotateY: ((c.rotateY ?? 0) + d) || undefined }))} />
          <CampoNum prefixo="P" rotulo="Perspectiva (distância da câmera)" titulo="Perspectiva" valor={comum(sel, (c) => c.perspective ?? 1200)} min={100} max={5000} aoMudar={(v) => set({ perspective: v })} />
        </div>
      )}
    </Secao>
  )
}
