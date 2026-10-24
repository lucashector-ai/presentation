'use client'
/**
 * Transição de entrada da tela (compartilhada pela aba Animação com e sem seleção): cartões com prévia,
 * duração em três passos e, em "Avançado", a duração exata e a curva. A prévia toca no canvas.
 */
import { useState } from 'react'
import type { Cena, Transicao } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { pedirPrevia } from '@/components/renderer/animacao'
import { Deslizante } from '@/components/editor/inspetor/controles'
import { CartaoPreset, Chips, GradeCartoesPreset, MiniTransicao, Rotulo } from './ui'

export const TRANSICOES: { id: Transicao['type']; rotulo: string }[] = [
  { id: 'none', rotulo: 'Nenhuma' },
  { id: 'fade', rotulo: 'Fade' },
  { id: 'slide', rotulo: 'Deslizar' },
  { id: 'scale', rotulo: 'Zoom' },
  { id: 'morph', rotulo: 'Morph' },
  { id: 'push', rotulo: 'Empurrar' },
]
const DURACOES = [
  { id: 'rapida', rotulo: 'Rápida', ms: 300 },
  { id: 'normal', rotulo: 'Normal', ms: 500 },
  { id: 'lenta', rotulo: 'Lenta', ms: 900 },
] as const
const CURVAS: { id: Transicao['easing']; rotulo: string }[] = [
  { id: 'easeInOut', rotulo: 'Suave' },
  { id: 'easeOut', rotulo: 'Rápida' },
  { id: 'spring', rotulo: 'Elástica' },
  { id: 'linear', rotulo: 'Linear' },
]
const PADRAO: Transicao = { type: 'fade', duration: 500, easing: 'easeInOut' }

export const transicaoDa = (cena: Cena): Transicao => cena.transition ?? PADRAO
export const nomeTransicao = (t: Transicao['type']) => TRANSICOES.find((x) => x.id === t)?.rotulo ?? t
/** Resumo de uma linha ("Fade · 500 ms"). */
export const resumoTransicao = (cena: Cena) => { const t = transicaoDa(cena); return t.type === 'none' ? 'Nenhuma' : `${nomeTransicao(t.type)} · ${t.duration} ms` }

/** Toca a transição no canvas (morph precisa da tela anterior). */
export function previaTransicao(editor: Editor, t = editor.cena ? transicaoDa(editor.cena) : PADRAO) {
  if (t.type === 'none') return
  const anterior = editor.estado.documento.scenes[editor.indiceCena - 1]
  pedirPrevia({ transicao: t, morphDe: anterior, duracao: t.duration + 100 })
}

export function TransicaoTela({ editor }: { editor: Editor }) {
  const { cena, acoes } = editor
  const [avancado, setAvancado] = useState(false)
  if (!cena) return null
  const tr = transicaoDa(cena)
  const anterior = editor.estado.documento.scenes[editor.indiceCena - 1]
  const duracaoChip = DURACOES.find((d) => d.ms === tr.duration)?.id ?? null
  const setTr = (patch: Partial<Transicao>, tocar = true) => {
    const nova = { ...tr, ...patch }
    acoes.atualizarCena({ transition: nova })
    if (tocar) setTimeout(() => previaTransicao(editor, nova), 30)
  }
  return (
    <>
      <GradeCartoesPreset rotulo="Transição de entrada da tela">
        {TRANSICOES.map((t) => (
          <CartaoPreset key={t.id} rotulo={t.rotulo} selecionado={tr.type === t.id} aoClicar={() => setTr({ type: t.id })}>
            {(tocando) => <MiniTransicao tipo={t.id} tocando={tocando} duracao={Math.max(400, tr.duration)} />}
          </CartaoPreset>
        ))}
      </GradeCartoesPreset>
      {tr.type === 'morph' && (
        <p className="rounded-md bg-acentoSuave px-2.5 py-2 text-[12px] leading-snug text-acento">
          Camadas com o <strong className="font-medium">mesmo nome</strong> nas duas telas se transformam de uma para a outra.
          {!anterior && ' Nesta primeira tela, o morph acontece ao chegar por um link.'}
        </p>
      )}
      {tr.type !== 'none' && (
        <>
          <Rotulo acao={<button type="button" onClick={() => setAvancado((v) => !v)} className="text-[12px] text-texto2 hover:text-texto" aria-expanded={avancado}>{avancado ? 'Menos' : 'Avançado'}</button>}>Duração</Rotulo>
          <Chips rotulo="Duração da transição" cheio valor={duracaoChip} opcoes={DURACOES.map((d) => ({ id: d.id, rotulo: d.rotulo, titulo: `${d.ms} ms` }))} aoMudar={(id) => setTr({ duration: DURACOES.find((d) => d.id === id)!.ms })} />
          {avancado && (
            <div className="space-y-2 pt-1">
              <Deslizante rotulo="Duração da transição em milissegundos" valor={tr.duration} min={100} max={2000} passo={50} aoMudar={(duration) => setTr({ duration }, false)} formatar={(v) => `${v}ms`} />
              <Chips rotulo="Curva da transição" valor={tr.easing} opcoes={CURVAS} aoMudar={(easing) => setTr({ easing })} />
            </div>
          )}
        </>
      )}
    </>
  )
}
