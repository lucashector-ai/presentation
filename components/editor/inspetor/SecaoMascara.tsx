'use client'
/**
 * Máscara (como no Figma): na camada-máscara, o tipo (Alfa · Contorno · Luminância), ligar/desligar e remover;
 * numa camada recortada, qual máscara a recorta (clique seleciona a máscara) e remover.
 */
import { Eye, EyeOff } from 'lucide-react'
import { TIPOS_MASCARA, type TipoMascara } from '@/lib/scene/schema'
import { NOMES_TIPO_MASCARA, ehMascara, tipoMascara } from '@/lib/scene/mascara'
import { BotaoMini, Linha, MISTO, Secao, Segmentado } from './controles'
import { IconeMascara } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'

const DICA: Record<TipoMascara, string> = {
  alpha: 'Usa a transparência da máscara.',
  outline: 'Usa só a silhueta, opaca.',
  luminance: 'Claro mostra, escuro esconde.',
}

export function SecaoMascara({ editor }: PropsSecao) {
  const { sel, ids, set } = useCamadas(editor)
  const camadas = editor.cena?.layers ?? []
  if (!sel.length) return null
  const remover = () => editor.acoes.alternarMascara(ids)
  if (sel.every(ehMascara)) {
    const tipo = comum(sel, (c) => tipoMascara(c))
    const desligada = sel.every((c) => c.hidden)
    const recortadas = camadas.filter((c) => c.maskId && ids.includes(c.maskId)).length
    return (
      <Secao
        titulo="Máscara"
        aoRemover={remover}
        rotuloRemover="Remover máscara"
        acao={<BotaoMini rotulo={desligada ? 'Ligar máscara' : 'Desligar máscara'} onClick={() => set({ hidden: !desligada })}>{desligada ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</BotaoMini>}
      >
        <Segmentado<TipoMascara> rotulo="Tipo de máscara" valor={tipo === MISTO ? MISTO : tipo} opcoes={TIPOS_MASCARA.map((t) => ({ id: t, rotulo: NOMES_TIPO_MASCARA[t] }))} aoMudar={(t) => set({ maskType: t })} />
        <p className="text-[11px] text-texto3">
          {tipo === MISTO ? 'Tipos diferentes na seleção.' : DICA[tipo]} {desligada ? 'Desligada: as camadas aparecem inteiras.' : `Recorta ${recortadas} ${recortadas === 1 ? 'camada' : 'camadas'}.`}
        </p>
      </Secao>
    )
  }
  const mascaraId = comum(sel, (c) => c.maskId ?? '')
  if (mascaraId === MISTO || !mascaraId) return null
  const m = camadas.find((c) => c.id === mascaraId)
  if (!ehMascara(m)) return null
  const nome = m.name || (m.type === 'text' ? m.text.slice(0, 24) || 'Texto' : m.type === 'image' ? 'Imagem' : m.type === 'svg' ? 'Vetor' : 'Forma')
  return (
    <Secao titulo="Máscara" aoRemover={remover} rotuloRemover="Remover máscara">
      <Linha rotulo="Recortada por">
        <button type="button" onClick={() => editor.acoes.selecionarExato([m.id])} title="Selecionar a máscara" className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-superficie2 px-2 text-left text-[11px] text-texto hover:ring-1 hover:ring-inset hover:ring-bordaForte">
          <span className="flex shrink-0 text-acento"><IconeMascara /></span>
          <span className="min-w-0 flex-1 truncate">{nome}</span>
          <span className="rotulo-mono shrink-0 !text-[9px]">{NOMES_TIPO_MASCARA[tipoMascara(m)]}</span>
        </button>
      </Linha>
    </Secao>
  )
}
