'use client'
/** Layout: largura e altura com travar proporção (por camada, lembrado na sessão). */
import { useState } from 'react'
import { Link2, MoveHorizontal, Square, Type, Unlink2 } from 'lucide-react'
import { dimensionamentoDoModo, modoTexto, type ModoTexto } from '@/lib/editor/medirTexto'
import type { Camada } from '@/lib/scene/schema'
import { BotaoCampo, CampoNum, Secao, Segmentado } from './controles'
import { comum, useCamadas, type PropsSecao } from './selecao'

const travas = new Map<string, boolean>()
const proporcionalPorPadrao = (c: Camada) => c.type === 'svg' || c.type === 'image' || c.type === 'model3d' || c.type === 'lottie'
const travada = (c: Camada) => travas.get(c.id) ?? proporcionalPorPadrao(c)

export function SecaoLayout({ editor }: PropsSecao) {
  const { sel, set, setFn } = useCamadas(editor)
  const [, atualizar] = useState(0)
  const l = sel[0]
  if (!l) return null
  const trava = sel.every(travada)
  const w = comum(sel, (c) => Math.round(c.width * 100) / 100)
  const h = comum(sel, (c) => Math.round(c.height * 100) / 100)
  const largura = (fn: (c: Camada) => number) => setFn((c) => { const width = Math.max(1, fn(c)); return { ...c, width, height: trava ? Math.max(1, Math.round((width * c.height) / c.width)) : c.height } })
  const altura = (fn: (c: Camada) => number) => setFn((c) => { const height = Math.max(1, fn(c)); return { ...c, height, width: trava ? Math.max(1, Math.round((height * c.width) / c.height)) : c.width } })
  return (
    <Secao titulo="Layout">
      <div className="grid grid-cols-[1fr_1fr_28px] gap-1.5">
        <CampoNum prefixo="W" rotulo="Largura" valor={w} min={1} aoMudar={(v) => largura(() => v)} aoDelta={(d) => largura((c) => c.width + d)} />
        <CampoNum prefixo="H" rotulo="Altura" valor={h} min={1} aoMudar={(v) => altura(() => v)} aoDelta={(d) => altura((c) => c.height + d)} />
        <BotaoCampo rotulo={trava ? 'Destravar proporção' : 'Travar proporção'} ativo={trava} onClick={() => { sel.forEach((c) => travas.set(c.id, !trava)); atualizar((n) => n + 1) }}>
          {trava ? <Link2 className="h-3.5 w-3.5" /> : <Unlink2 className="h-3.5 w-3.5" />}
        </BotaoCampo>
      </div>
      {sel.length === 1 && l.type === 'text' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-texto3">Redimensionar</span>
          <div className="w-[104px]">
            <Segmentado<ModoTexto>
              rotulo="Redimensionar texto"
              valor={modoTexto(l)}
              aoMudar={(m) => set(dimensionamentoDoModo(m))}
              icones
              opcoes={[
                { id: 'larguraAuto', rotulo: 'Auto horizontal (cresce com o texto)', icone: <MoveHorizontal className="h-3.5 w-3.5" /> },
                { id: 'alturaAuto', rotulo: 'Auto vertical (quebra linha)', icone: <Type className="h-3.5 w-3.5" /> },
                { id: 'fixo', rotulo: 'Tamanho fixo', icone: <Square className="h-3 w-3" /> },
              ]}
            />
          </div>
        </div>
      )}
    </Secao>
  )
}
