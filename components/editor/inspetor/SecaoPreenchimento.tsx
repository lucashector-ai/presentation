'use client'
/**
 * Preenchimento (formas, textos e frames). Linha "[amostra] D9D9D9 | 100 % [olho] [−]".
 * O schema guarda um preenchimento por camada: cor (com alfa) + gradiente opcional por cima.
 * Olho = opacidade 0 ↔ volta à anterior; "−" numa forma deixa o preenchimento transparente (seção vazia com "+").
 */
import { useState } from 'react'
import { Eye, EyeOff, Minus } from 'lucide-react'
import type { Camada, CamadaForma, CamadaFrame, CamadaTexto } from '@/lib/scene/schema'
import { alfaDe, comAlfa } from '@/lib/editor/cor'
import { BotaoMini, CampoNum, MISTO, Secao, SeletorLista } from './controles'
import { LinhaPintura } from './CampoCor'
import type { Pintura } from './SeletorCor'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { desligarEstilo, gravarCor, ligarEstilo, type PropCor } from '@/lib/editor/estilosCor'
import { tipoMascara } from '@/lib/scene/mascara'

/** Opacidade anterior de cores escondidas pelo olho (para restaurar), e linhas mantidas visíveis na sessão. */
const alfaAnterior = new Map<string, number>()
const mantidas = new Set<string>()

type ComPreenchimento = CamadaForma | CamadaTexto | CamadaFrame
const corBase = (c: ComPreenchimento) => (c.type === 'shape' ? c.fill : c.type === 'frame' ? (c.fill ?? '#FFFFFF') : c.color)
const pinturaDe = (c: ComPreenchimento): Pintura => (c.gradient ? { tipo: 'gradiente', gradiente: c.gradient } : { tipo: 'solido', cor: corBase(c) })
const propCor = (c: Camada): PropCor => (c.type === 'text' ? 'color' : 'fill')
/** Editar a cor direto solta o estilo ligado (como no Figma); gradiente também. */
const comPintura = (c: Camada, p: Pintura): Camada => {
  if (c.type !== 'shape' && c.type !== 'text' && c.type !== 'frame') return c
  if (p.tipo === 'gradiente') return desligarEstilo({ ...c, gradient: p.gradiente }, propCor(c))
  if (p.tipo === 'solido') return gravarCor({ ...c, gradient: undefined } as Camada, propCor(c), p.cor)
  return c
}
const comCor = (c: Camada, f: (cor: string) => string): Camada => (c.type === 'shape' ? { ...c, fill: f(c.fill) } : c.type === 'frame' ? { ...c, fill: f(c.fill ?? '#FFFFFF') } : c.type === 'text' ? { ...c, color: f(c.color) } : c)

export function SecaoPreenchimento({ editor }: PropsSecao) {
  const { sel, setFn } = useCamadas(editor)
  const [, atualizar] = useState(0)
  const tipo = sel[0]?.type
  if (!sel.length || (tipo !== 'shape' && tipo !== 'text' && tipo !== 'frame') || !sel.every((c) => c.type === tipo)) return null
  if (tipo === 'shape' && sel.some((c) => c.type === 'shape' && (c.shape === 'line' || c.shape === 'arrow' || (c.isMask && tipoMascara(c) === 'outline')))) return null
  const camadas = sel as ComPreenchimento[]
  const chave = camadas.map((c) => `${c.id}:fill`).join(',')
  const pintura = comum(camadas, (c) => pinturaDe(c as ComPreenchimento))
  const forma = tipo === 'shape' || tipo === 'frame'
  const semFill = tipo === 'frame' && camadas.every((c) => c.type === 'frame' && !c.fill && !c.gradient)
  const vazia = semFill || (forma && pintura !== MISTO && pintura.tipo === 'solido' && alfaDe(pintura.cor) === 0 && !mantidas.has(chave))
  const oculta = pintura !== MISTO && pintura.tipo === 'solido' && alfaDe(pintura.cor) === 0

  const alternarOlho = () => {
    if (pintura === MISTO || pintura.tipo !== 'solido') return
    if (oculta) { setFn((c) => comCor(c, (cor) => comAlfa(cor, alfaAnterior.get(c.id) ?? 1))); mantidas.delete(chave) }
    else { camadas.forEach((c) => alfaAnterior.set(c.id, alfaDe(corBase(c)))); mantidas.add(chave); setFn((c) => comCor(c, (cor) => comAlfa(cor, 0))) }
    atualizar((n) => n + 1)
  }
  const remover = () => { mantidas.delete(chave); setFn((c) => (c.type === 'frame' ? ({ ...c, fill: undefined, gradient: undefined } as Camada) : comCor({ ...c, gradient: undefined } as Camada, (cor) => comAlfa(cor, 0)))) }
  const adicionar = () => setFn((c) => comCor(c, (cor) => comAlfa(cor, 1)))

  return (
    <Secao titulo="Preenchimento" vazia={vazia} aoAdicionar={vazia || pintura === MISTO ? (pintura === MISTO ? () => { const p = pinturaDe(camadas[0]!); setFn((c) => comPintura(c, p)) } : adicionar) : undefined} rotuloAdicionar="Adicionar preenchimento">
      {pintura === MISTO ? (
        <p className="text-[12px] text-texto2">Preenchimentos diferentes. Clique em + para usar o mesmo em todos.</p>
      ) : (
        <LinhaPintura
          rotulo={forma ? 'Cor de preenchimento' : 'Cor do texto'}
          valor={pintura}
          tipos={['solido', 'linear', 'radial']}
          aoMudar={(p) => setFn((c) => comPintura(c, p))}
          estiloId={pintura.tipo === 'solido' ? (comum(camadas, (c) => c.colorStyleIds?.[propCor(c)]) as string | undefined) : undefined}
          aoEstilo={(e) => setFn((c) => ligarEstilo(c, propCor(c), e))}
          acoes={
            <>
              {pintura.tipo === 'solido' && <BotaoMini rotulo={oculta ? 'Mostrar preenchimento' : 'Ocultar preenchimento'} onClick={alternarOlho}>{oculta ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</BotaoMini>}
              {forma ? (
                <BotaoMini rotulo="Remover preenchimento" onClick={remover}><Minus className="h-3.5 w-3.5" /></BotaoMini>
              ) : pintura.tipo === 'gradiente' ? (
                <BotaoMini rotulo="Remover gradiente" onClick={() => setFn((c) => ({ ...c, gradient: undefined }) as Camada)}><Minus className="h-3.5 w-3.5" /></BotaoMini>
              ) : null}
            </>
          }
        />
      )}
      {tipo === 'shape' && (
        <SeletorLista
          rotulo="Textura"
          prefixo={<span className="listras block h-3 w-3 rounded-[3px] bg-texto3" />}
          valor={String(comum(camadas, (c) => (c as CamadaForma).pattern))}
          aoMudar={(v) => v !== MISTO && setFn((c) => ({ ...c, pattern: v as CamadaForma['pattern'] }) as Camada)}
          opcoes={[...(comum(camadas, (c) => (c as CamadaForma).pattern) === MISTO ? [{ id: MISTO, rotulo: 'Textura: mista' }] : []), { id: 'none', rotulo: 'Sem textura' }, { id: 'stripes', rotulo: 'Textura: listras (foto)' }, { id: 'dots', rotulo: 'Textura: pontos' }, { id: 'grid', rotulo: 'Textura: grade' }]}
        />
      )}
    </Secao>
  )
}
