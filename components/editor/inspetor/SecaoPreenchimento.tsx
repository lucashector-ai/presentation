'use client'
/**
 * Preenchimento e Traço (formas e textos). Linha "[amostra] D9D9D9 | 100 % [olho] [−]".
 * O schema guarda um preenchimento por camada: cor (com alfa) + gradiente opcional por cima.
 * Olho = opacidade 0 ↔ volta à anterior; "−" numa forma deixa o preenchimento transparente (seção vazia com "+").
 */
import { useState } from 'react'
import { Eye, EyeOff, Minus } from 'lucide-react'
import type { Camada, CamadaForma, CamadaTexto } from '@/lib/scene/schema'
import { alfaDe, comAlfa } from '@/lib/editor/cor'
import { BotaoMini, CampoNum, MISTO, Secao, SeletorLista } from './controles'
import { LinhaPintura } from './CampoCor'
import type { Pintura } from './SeletorCor'
import { IconeEspessura, IconeTracejado } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { desligarEstilo, gravarCor, ligarEstilo, type PropCor } from '@/lib/editor/estilosCor'

/** Opacidade anterior de cores escondidas pelo olho (para restaurar), e linhas mantidas visíveis na sessão. */
const alfaAnterior = new Map<string, number>()
const mantidas = new Set<string>()

type ComPreenchimento = CamadaForma | CamadaTexto
const corBase = (c: ComPreenchimento) => (c.type === 'shape' ? c.fill : c.color)
const pinturaDe = (c: ComPreenchimento): Pintura => (c.gradient ? { tipo: 'gradiente', gradiente: c.gradient } : { tipo: 'solido', cor: corBase(c) })
const propCor = (c: Camada): PropCor => (c.type === 'shape' ? 'fill' : 'color')
/** Editar a cor direto solta o estilo ligado (como no Figma); gradiente também. */
const comPintura = (c: Camada, p: Pintura): Camada => {
  if (c.type !== 'shape' && c.type !== 'text') return c
  if (p.tipo === 'gradiente') return desligarEstilo({ ...c, gradient: p.gradiente }, propCor(c))
  if (p.tipo === 'solido') return gravarCor({ ...c, gradient: undefined } as Camada, propCor(c), p.cor)
  return c
}
const comCor = (c: Camada, f: (cor: string) => string): Camada => (c.type === 'shape' ? { ...c, fill: f(c.fill) } : c.type === 'text' ? { ...c, color: f(c.color) } : c)

export function SecaoPreenchimento({ editor }: PropsSecao) {
  const { sel, setFn } = useCamadas(editor)
  const [, atualizar] = useState(0)
  const tipo = sel[0]?.type
  if (!sel.length || (tipo !== 'shape' && tipo !== 'text') || !sel.every((c) => c.type === tipo)) return null
  const camadas = sel as ComPreenchimento[]
  const chave = camadas.map((c) => `${c.id}:fill`).join(',')
  const pintura = comum(camadas, (c) => pinturaDe(c as ComPreenchimento))
  const forma = tipo === 'shape'
  const vazia = forma && pintura !== MISTO && pintura.tipo === 'solido' && alfaDe(pintura.cor) === 0 && !mantidas.has(chave)
  const oculta = pintura !== MISTO && pintura.tipo === 'solido' && alfaDe(pintura.cor) === 0

  const alternarOlho = () => {
    if (pintura === MISTO || pintura.tipo !== 'solido') return
    if (oculta) { setFn((c) => comCor(c, (cor) => comAlfa(cor, alfaAnterior.get(c.id) ?? 1))); mantidas.delete(chave) }
    else { camadas.forEach((c) => alfaAnterior.set(c.id, alfaDe(corBase(c)))); mantidas.add(chave); setFn((c) => comCor(c, (cor) => comAlfa(cor, 0))) }
    atualizar((n) => n + 1)
  }
  const remover = () => { mantidas.delete(chave); setFn((c) => comCor({ ...c, gradient: undefined } as Camada, (cor) => comAlfa(cor, 0))) }
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
      {forma && (
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

export function SecaoTraco({ editor }: PropsSecao) {
  const { sel, setFn } = useCamadas(editor)
  const [, atualizar] = useState(0)
  if (!sel.length || !sel.every((c) => c.type === 'shape')) return null
  const formas = sel as CamadaForma[]
  const chave = formas.map((c) => `${c.id}:stroke`).join(',')
  const cor = comum(formas, (c) => (c as CamadaForma).stroke)
  const vazia = cor === undefined
  const espessura = comum(formas, (c) => (c as CamadaForma).strokeWidth)
  const traco = comum(formas, (c) => (c as CamadaForma).dash)
  const oculta = typeof cor === 'string' && alfaDe(cor) === 0
  const s = (f: (c: CamadaForma) => Partial<CamadaForma>) => setFn((c) => ({ ...c, ...f(c as CamadaForma) }) as Camada)
  return (
    <Secao
      titulo="Traço"
      vazia={vazia}
      aoAdicionar={vazia ? () => s((c) => ({ stroke: '#171717', strokeWidth: c.strokeWidth || 2 })) : undefined}
      rotuloAdicionar="Adicionar traço"
    >
      {cor === MISTO ? (
        <p className="text-[12px] text-texto2">Traços diferentes na seleção.</p>
      ) : cor ? (
        <LinhaPintura
          rotulo="Cor do contorno"
          valor={{ tipo: 'solido', cor }}
          aoMudar={(p) => p.tipo === 'solido' && setFn((c) => gravarCor(c, 'stroke', p.cor))}
          estiloId={comum(formas, (c) => c.colorStyleIds?.stroke) as string | undefined}
          aoEstilo={(e) => setFn((c) => ligarEstilo(c, 'stroke', e))}
          acoes={
            <>
              <BotaoMini rotulo={oculta ? 'Mostrar traço' : 'Ocultar traço'} onClick={() => {
                if (oculta) { s((c) => ({ stroke: comAlfa(c.stroke ?? '#171717', alfaAnterior.get(`${c.id}:s`) ?? 1) })); mantidas.delete(chave) }
                else { formas.forEach((c) => alfaAnterior.set(`${c.id}:s`, alfaDe(c.stroke ?? '#171717'))); mantidas.add(chave); s((c) => ({ stroke: comAlfa(c.stroke ?? '#171717', 0) })) }
                atualizar((n) => n + 1)
              }}>{oculta ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</BotaoMini>
              <BotaoMini rotulo="Remover traço" onClick={() => s(() => ({ stroke: undefined, strokeWidth: 0, dash: 0 }))}><Minus className="h-3.5 w-3.5" /></BotaoMini>
            </>
          }
        />
      ) : null}
      <div className="grid grid-cols-[1fr_1fr_56px] gap-2">
        <CampoNum prefixo={<IconeEspessura />} rotulo="Espessura do contorno" valor={espessura} min={0} max={100} aoMudar={(strokeWidth) => s(() => ({ strokeWidth }))} aoDelta={(d) => s((c) => ({ strokeWidth: Math.max(0, Math.min(100, c.strokeWidth + d)) }))} />
        <CampoNum prefixo={<IconeTracejado />} rotulo="Tracejado" titulo="Tracejado (0 = contínuo)" valor={traco} min={0} max={100} aoMudar={(dash) => s(() => ({ dash }))} aoDelta={(d) => s((c) => ({ dash: Math.max(0, Math.min(100, c.dash + d)) }))} />
      </div>
    </Secao>
  )
}
