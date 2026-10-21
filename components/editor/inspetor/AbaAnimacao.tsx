'use client'
import { Play } from 'lucide-react'
import type { Animacao, Camada } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { CampoNum, GradeCartoes, Secao, Segmentado } from './controles'
import { CurvaEasing } from './CurvaEasing'

/** Ícone mínimo: um bloco que sugere o movimento (como os cartões do design). */
function IconeAnim({ tipo }: { tipo: Animacao['type'] }) {
  const estilo: Record<string, string> = {
    none: 'opacity-80', fadeIn: 'opacity-40', slideUp: 'translate-y-[-3px]', slideDown: 'translate-y-[3px]', slideLeft: 'translate-x-[-3px]', slideRight: 'translate-x-[3px]', scaleIn: 'scale-75', scaleOut: 'scale-50 opacity-60', blurIn: 'blur-[1.5px]', rotateIn: 'rotate-[18deg]', reveal: 'w-2', fadeOut: 'opacity-20',
  }
  return <span className={`block h-2.5 w-3.5 rounded-[2px] bg-current ${estilo[tipo] ?? ''}`} />
}

export const OPCOES_ENTRADA: { id: Animacao['type']; rotulo: string }[] = [
  { id: 'none', rotulo: 'Nenhuma' }, { id: 'fadeIn', rotulo: 'Fade' }, { id: 'slideUp', rotulo: 'Subir' },
  { id: 'scaleIn', rotulo: 'Escala' }, { id: 'reveal', rotulo: 'Máscara' }, { id: 'blurIn', rotulo: 'Desfoque' },
  { id: 'slideLeft', rotulo: 'Da direita' }, { id: 'slideRight', rotulo: 'Da esquerda' }, { id: 'rotateIn', rotulo: 'Girar' },
]

export const OPCOES_EASING: { id: Animacao['easing']; rotulo: string }[] = [
  { id: 'easeOut', rotulo: 'Ease out' }, { id: 'easeInOut', rotulo: 'In-out' }, { id: 'spring', rotulo: 'Spring' }, { id: 'linear', rotulo: 'Linear' },
]

export function AbaAnimacao({ editor }: { editor: Editor }) {
  const { camadasSelecionadas: sel, acoes } = editor
  const ids = sel.map((l) => l.id)
  const l = sel[0]!
  const a: Animacao = l.enterAnimation ?? { type: 'none', duration: 600, delay: 0, easing: 'easeOut' }
  const setAnim = (patch: Partial<Animacao>) => {
    const nova = { ...a, ...patch }
    acoes.atualizarCamadas(ids, (c: Camada) => {
      const { enterAnimation: _, ...resto } = c
      return (nova.type === 'none' ? resto : { ...resto, enterAnimation: nova }) as Camada
    })
  }
  return (
    <div>
      <Secao titulo="Entrada" acao={a.type !== 'none' ? <button type="button" onClick={acoes.reproduzirPrevia} className="flex items-center gap-1 text-[12px] text-acento hover:underline"><Play className="h-3 w-3" /> Prévia</button> : undefined}>
        <GradeCartoes rotulo="Efeito de entrada" valor={a.type} aoMudar={(type) => { setAnim({ type }); if (type !== 'none') setTimeout(acoes.reproduzirPrevia, 50) }} opcoes={OPCOES_ENTRADA.map((o) => ({ ...o, icone: <IconeAnim tipo={o.id} /> }))} />
        {a.type !== 'none' && (
          <>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <CampoNum prefixo="Atraso" rotulo="Atraso" valor={a.delay} min={0} max={5000} passo={50} sufixo="ms" aoMudar={(delay) => setAnim({ delay })} />
              <CampoNum prefixo="Duração" rotulo="Duração" valor={a.duration} min={100} max={3000} passo={50} sufixo="ms" aoMudar={(duration) => setAnim({ duration })} />
            </div>
            <div className="pt-1 text-[13px] text-texto2">Curva</div>
            <Segmentado rotulo="Curva de animação" valor={a.easing === 'ease' || a.easing === 'easeIn' ? 'easeOut' : a.easing} aoMudar={(easing) => setAnim({ easing })} opcoes={OPCOES_EASING} />
            <CurvaEasing easing={a.easing} duracao={a.duration} chave={`${a.type}-${a.easing}-${a.duration}`} />
          </>
        )}
      </Secao>
      <Secao titulo="Sequência">
        <p className="text-[12px] text-texto2">Para animar vários elementos em cascata, selecione-os e aplique a mesma entrada com atrasos crescentes:</p>
        <button
          type="button"
          disabled={sel.length < 2 || a.type === 'none'}
          onClick={() => acoes.atualizarCamadas(ids, (c) => ({ ...c, enterAnimation: { ...a, delay: a.delay + [...sel].sort((x, y) => x.y - y.y || x.x - y.x).findIndex((s) => s.id === c.id) * 120 } }))}
          className="h-8 w-full rounded-md border border-borda text-[13px] hover:border-[#D4D4D4] disabled:opacity-40"
        >
          Escalonar 120 ms entre {sel.length > 1 ? sel.length : 'os'} elementos
        </button>
      </Secao>
    </div>
  )
}
