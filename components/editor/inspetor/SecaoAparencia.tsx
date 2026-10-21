'use client'
/** Aparência: visibilidade e mesclagem no título; opacidade e raio dos cantos. */
import { Eye, EyeOff } from 'lucide-react'
import type { Camada } from '@/lib/scene/schema'
import { MODOS_MESCLAGEM } from '@/lib/scene/schema'
import { cx } from '@/components/ui'
import { BotaoCampo, BotaoMini, CampoNum, MISTO, Rotulo, Secao } from './controles'
import { IconeCantos, IconeMesclagem, IconeOpacidade, IconeRaio } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'

export const NOMES_MESCLAGEM: Record<(typeof MODOS_MESCLAGEM)[number], string> = { normal: 'Normal', multiply: 'Multiplicar', screen: 'Tela', overlay: 'Sobrepor', darken: 'Escurecer', lighten: 'Clarear', 'color-dodge': 'Subexpor cor', difference: 'Diferença', luminosity: 'Luminosidade' }

const efeitosBase = { blur: 0, backdropBlur: 0, blend: 'normal' as const }

export function SecaoAparencia({ editor }: PropsSecao) {
  const { sel, set, setFn } = useCamadas(editor)
  if (!sel.length || sel.every((c) => c.type === 'hotspot')) return null
  const oculto = comum(sel, (c) => c.hidden)
  const blend = comum(sel, (c) => c.effects?.blend ?? 'normal')
  const opacidade = comum(sel, (c) => Math.round(c.opacity * 100))
  const comRaio = sel.every((c) => 'radius' in c)
  const raio = comum(sel, (c) => (c as Camada & { radius?: number }).radius ?? 0)
  return (
    <Secao
      titulo="Aparência"
      acao={
        <>
          <BotaoMini rotulo={oculto === true ? 'Mostrar' : 'Ocultar'} ativo={oculto === true} onClick={() => set({ hidden: oculto !== true })}>
            {oculto === true ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </BotaoMini>
          <span className={cx('relative inline-flex h-6 w-6 items-center justify-center rounded-[5px] focus-within:ring-1 focus-within:ring-acento', blend !== 'normal' ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover hover:text-texto')} title={`Mesclagem: ${blend === MISTO ? 'mista' : NOMES_MESCLAGEM[blend]}`}>
            <IconeMesclagem />
            <select
              aria-label="Modo de mesclagem"
              value={blend === MISTO ? '' : blend}
              onChange={(e) => setFn((c) => ({ ...c, effects: { ...efeitosBase, ...c.effects, blend: e.target.value as (typeof MODOS_MESCLAGEM)[number] } }))}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {blend === MISTO && <option value="">Misto</option>}
              {MODOS_MESCLAGEM.map((m) => <option key={m} value={m}>{NOMES_MESCLAGEM[m]}</option>)}
            </select>
          </span>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_1fr_32px] items-end gap-2">
        <div className="min-w-0">
          <Rotulo>Opacidade</Rotulo>
          <CampoNum prefixo={<IconeOpacidade />} rotulo="Opacidade" valor={opacidade} min={0} max={100} sufixo="%" aoMudar={(v) => set({ opacity: v / 100 })} aoDelta={(d) => setFn((c) => ({ ...c, opacity: Math.max(0, Math.min(1, c.opacity + d / 100)) }))} />
        </div>
        {comRaio ? (
          <>
            <div className="min-w-0">
              <Rotulo>Raio dos cantos</Rotulo>
              <CampoNum prefixo={<IconeRaio />} rotulo="Raio dos cantos" valor={raio} min={0} max={999} aoMudar={(radius) => set({ radius } as Partial<Camada>)} aoDelta={(d) => setFn((c) => ({ ...c, radius: Math.max(0, ((c as Camada & { radius: number }).radius ?? 0) + d) } as Camada))} />
            </div>
            <BotaoCampo rotulo="Cantos independentes" title="Cantos independentes — em breve" disabled><IconeCantos /></BotaoCampo>
          </>
        ) : <span />}
      </div>
    </Secao>
  )
}
