'use client'
/** Aparência: visibilidade e mesclagem no título; opacidade e raio dos cantos. */
import { useState } from 'react'
import { Eye, EyeOff, Link2, Link2Off } from 'lucide-react'
import type { Camada } from '@/lib/scene/schema'
import { MODOS_MESCLAGEM } from '@/lib/scene/schema'
import { MenuSuspenso } from '@/components/ui/MenuSuspenso'
import { BotaoCampo, BotaoMini, CampoNum, MISTO, Rotulo, Secao } from './controles'
import { IconeCantos, IconeMesclagem, IconeOpacidade, IconeRaio, IconeSuavizacao } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { NOMES_CANTOS, aceitaCantos, aceitaSuavizacao, comCanto, comRaio as raioUnicoEm, raioUnico, raiosDe } from '@/lib/editor/raios'

/** Seleções com os 4 cantos abertos nesta sessão, e as com o cadeado (cantos iguais) fechado. */
const cantosAbertos = new Set<string>()
const cantosTravados = new Set<string>()

function IconeCanto({ indice }: { indice: number }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden style={{ transform: `rotate(${indice * 90}deg)` }}>
      <path d="M2.5 10.5V6.5a4 4 0 0 1 4-4h4" />
    </svg>
  )
}

export const NOMES_MESCLAGEM: Record<(typeof MODOS_MESCLAGEM)[number], string> = {
  normal: 'Normal', darken: 'Escurecer', multiply: 'Multiplicar', 'color-burn': 'Superexpor cor', lighten: 'Clarear', screen: 'Tela', 'color-dodge': 'Subexpor cor',
  overlay: 'Sobrepor', 'soft-light': 'Luz suave', 'hard-light': 'Luz forte', difference: 'Diferença', exclusion: 'Exclusão', hue: 'Matiz', saturation: 'Saturação', color: 'Cor', luminosity: 'Luminosidade',
}
/** Ordem e grupos do menu (como no Figma: escurecer, clarear, contraste, diferença, componentes). */
const GRUPOS_MESCLAGEM: (typeof MODOS_MESCLAGEM)[number][][] = [['normal'], ['darken', 'multiply', 'color-burn'], ['lighten', 'screen', 'color-dodge'], ['overlay', 'soft-light', 'hard-light'], ['difference', 'exclusion'], ['hue', 'saturation', 'color', 'luminosity']]

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
  const travados = cantosTravados.has(chave)
  const podeSuavizar = comRaio && sel.every(aceitaSuavizacao)
  const suavizacao = comum(sel, (c) => Math.round((c.cornerSmoothing ?? 0) * 100))
  const mudarCanto = (c: Camada, i: number, r: number) => (travados ? raioUnicoEm(c, r) : comCanto(c, i, r))
  const alternarTrava = () => {
    if (travados) cantosTravados.delete(chave)
    else { cantosTravados.add(chave); if (sel.some((c) => raioUnico(c) === null)) setFn((c) => raioUnicoEm(c, Math.max(...raiosDe(c)))) }
    forcar((n) => n + 1)
  }
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
          <MenuSuspenso
            aparencia="icone"
            rotulo="Modo de mesclagem"
            title={`Mesclagem: ${blend === MISTO ? 'mista' : NOMES_MESCLAGEM[blend]}`}
            ativo={blend !== 'normal'}
            valor={blend === MISTO ? '' : blend}
            aoMudar={(v) => v && setFn((c) => ({ ...c, effects: { ...efeitosBase, ...c.effects, blend: v as (typeof MODOS_MESCLAGEM)[number] } }))}
            opcoes={[
              ...(blend === MISTO ? [{ id: '', rotulo: 'Misto' }] : []),
              ...GRUPOS_MESCLAGEM.flatMap((g, i) => g.map((m) => ({ id: m, rotulo: NOMES_MESCLAGEM[m], grupo: i === 0 ? undefined : ['Escurecer', 'Clarear', 'Contraste', 'Inversão', 'Componente'][i - 1] }))),
            ]}
          >
            <IconeMesclagem />
          </MenuSuspenso>
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
            // ordem visual como no Figma: superiores na 1ª linha, inferiores na 2ª (esq. | dir.)
            const col = i === 0 || i === 3 ? 'col-start-1' : 'col-start-2'
            const lin = i < 2 ? 'row-start-1' : 'row-start-2'
            return (
              <div key={nome} className={`${col} ${lin} min-w-0`}>
                <CampoNum prefixo={<IconeCanto indice={i} />} rotulo={nome} titulo={nome} valor={v} min={0} max={999} aoMudar={(r) => setFn((c) => mudarCanto(c, i, r))} aoDelta={(d) => setFn((c) => mudarCanto(c, i, raiosDe(c)[i]! + d))} />
              </div>
            )
          })}
          <BotaoCampo rotulo={travados ? 'Cantos iguais (cadeado fechado): editar um canto muda os quatro' : 'Travar cantos iguais'} ativo={travados} className="col-start-3 row-start-1 row-span-2 self-center" onClick={alternarTrava}>
            {travados ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
          </BotaoCampo>
        </div>
      )}
      {podeSuavizar && (independentes || (suavizacao !== 0)) && (
        <div className="mt-2 grid grid-cols-[1fr_1fr_32px] items-end gap-2">
          <div className="min-w-0">
            <Rotulo>Suavizar cantos</Rotulo>
            <CampoNum prefixo={<IconeSuavizacao />} rotulo="Suavização dos cantos" titulo="Suavização dos cantos (squircle, 60% = iOS)" valor={suavizacao} min={0} max={100} sufixo="%" aoMudar={(v) => set({ cornerSmoothing: v ? v / 100 : undefined })} aoDelta={(d) => setFn((c) => ({ ...c, cornerSmoothing: Math.max(0, Math.min(1, (c.cornerSmoothing ?? 0) + d / 100)) || undefined }))} />
          </div>
          <BotaoMini rotulo="Suavização iOS (60%)" className="mb-0.5 h-7 w-auto justify-self-start px-2.5 text-[11px]" ativo={suavizacao === 60} onClick={() => set({ cornerSmoothing: 0.6 })}>iOS</BotaoMini>
        </div>
      )}
    </Secao>
  )
}
