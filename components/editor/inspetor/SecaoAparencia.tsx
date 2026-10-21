'use client'
/** Aparência: visibilidade e mesclagem no título; opacidade e raio dos cantos. */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { Camada } from '@/lib/scene/schema'
import { MODOS_MESCLAGEM } from '@/lib/scene/schema'
import { cx } from '@/components/ui'
import { BotaoCampo, BotaoMini, CampoNum, MISTO, Rotulo, Secao } from './controles'
import { IconeCantos, IconeMesclagem, IconeOpacidade, IconeRaio } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { NOMES_CANTOS, aceitaCantos, comCanto, comRaio as raioUnicoEm, raioUnico, raiosDe } from '@/lib/editor/raios'

/** Seleções com os 4 cantos abertos nesta sessão. */
const cantosAbertos = new Set<string>()

function IconeCanto({ indice }: { indice: number }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden style={{ transform: `rotate(${indice * 90}deg)` }}>
      <path d="M2.5 10.5V6.5a4 4 0 0 1 4-4h4" />
    </svg>
  )
}

export const NOMES_MESCLAGEM: Record<(typeof MODOS_MESCLAGEM)[number], string> = { normal: 'Normal', multiply: 'Multiplicar', screen: 'Tela', overlay: 'Sobrepor', darken: 'Escurecer', lighten: 'Clarear', 'color-dodge': 'Subexpor cor', difference: 'Diferença', luminosity: 'Luminosidade' }

const efeitosBase = { blur: 0, backdropBlur: 0, blend: 'normal' as const }

export function SecaoAparencia({ editor }: PropsSecao) {
  const { sel, set, setFn } = useCamadas(editor)
  const [, forcar] = useState(0)
  if (!sel.length || sel.every((c) => c.type === 'hotspot')) return null
  const chave = sel.map((c) => c.id).join(',')
  const oculto = comum(sel, (c) => c.hidden)
  const blend = comum(sel, (c) => c.effects?.blend ?? 'normal')
  const opacidade = comum(sel, (c) => Math.round(c.opacity * 100))
  const comRaio = sel.every((c) => 'radius' in c)
  const raioComum = comum(sel, (c) => raioUnico(c))
  const raio = raioComum === null ? MISTO : raioComum
  const podeCantos = comRaio && sel.every(aceitaCantos)
  const independentes = podeCantos && (cantosAbertos.has(chave) || sel.some((c) => 'radii' in c && !!c.radii))
  const alternarCantos = () => {
    if (independentes) {
      cantosAbertos.delete(chave)
      // fechar com cantos diferentes volta ao raio único (o maior), como no Figma ao digitar um valor só
      if (sel.some((c) => raioUnico(c) === null)) setFn((c) => raioUnicoEm(c, Math.max(...raiosDe(c))))
    } else cantosAbertos.add(chave)
    forcar((n) => n + 1)
  }
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
              <CampoNum prefixo={<IconeRaio />} rotulo="Raio dos cantos" valor={raio} min={0} max={999} aoMudar={(r) => setFn((c) => raioUnicoEm(c, r))} aoDelta={(d) => setFn((c) => raioUnicoEm(c, (raioUnico(c) ?? Math.max(...raiosDe(c))) + d))} />
            </div>
            <BotaoCampo rotulo="Cantos independentes" ativo={independentes} title={podeCantos ? 'Cantos independentes' : 'Cantos independentes: formas, frames e imagens'} disabled={!podeCantos} onClick={alternarCantos}><IconeCantos /></BotaoCampo>
          </>
        ) : <span />}
      </div>
      {independentes && (
        <div className="mt-2 grid grid-cols-[1fr_1fr_32px] gap-2" role="group" aria-label="Cantos independentes">
          {NOMES_CANTOS.map((nome, i) => {
            const v = comum(sel, (c) => raiosDe(c)[i]!)
            return (
              <div key={nome} className={i % 2 === 0 ? 'col-start-1 min-w-0' : 'col-start-2 min-w-0'}>
                <CampoNum prefixo={<IconeCanto indice={i} />} rotulo={nome} titulo={nome} valor={v} min={0} max={999} aoMudar={(r) => setFn((c) => comCanto(c, i, r))} aoDelta={(d) => setFn((c) => comCanto(c, i, raiosDe(c)[i]! + d))} />
              </div>
            )
          })}
        </div>
      )}
    </Secao>
  )
}
