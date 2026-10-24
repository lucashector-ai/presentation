'use client'
/**
 * Preenchimento (formas, textos e frames). Linha "[amostra] D9D9D9 | 100 % [olho] [−]".
 * O schema guarda um preenchimento por camada: cor (com alfa) + gradiente opcional por cima.
 * Olho = opacidade 0 ↔ volta à anterior; "−" numa forma deixa o preenchimento transparente (seção vazia com "+").
 */
import { useState } from 'react'
import { Eye, EyeOff, Grip, Minus } from 'lucide-react'
import type { Camada, CamadaForma, CamadaFrame, CamadaTexto } from '@/lib/scene/schema'
import { alfaDe, comAlfa } from '@/lib/editor/cor'
import { BotaoMini, CampoNum, Menu, MISTO, Secao, SeletorLista } from './controles'
import { LinhaPintura } from './CampoCor'
import type { Pintura } from './SeletorCor'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { desligarEstilo, gravarCor, ligarEstilo, type PropCor } from '@/lib/editor/estilosCor'
import { tipoMascara } from '@/lib/scene/mascara'
import { OPACIDADE_PADRAO_TEXTURA, gradienteCss, padraoCss } from '@/components/renderer/estilos'

/** Opacidade anterior de cores escondidas pelo olho (para restaurar), e linhas mantidas visíveis na sessão. */
const TEXTURAS: { id: CamadaForma['pattern']; rotulo: string }[] = [{ id: 'none', rotulo: 'Sem textura' }, { id: 'stripes', rotulo: 'Listras (foto)' }, { id: 'dots', rotulo: 'Pontos' }, { id: 'grid', rotulo: 'Grade' }]
const alfaAnterior = new Map<string, number>()
const mantidas = new Set<string>()

type ComPreenchimento = CamadaForma | CamadaTexto | CamadaFrame
const corBase = (c: ComPreenchimento) => (c.type === 'shape' ? c.fill : c.type === 'frame' ? (c.fill ?? '#FFFFFF') : c.color)
const pinturaDe = (c: ComPreenchimento): Pintura => (c.type !== 'text' && c.fillImage ? { tipo: 'imagem', assetId: c.fillImage.assetId, encaixe: c.fillImage.fit } : c.gradient ? { tipo: 'gradiente', gradiente: c.gradient } : { tipo: 'solido', cor: corBase(c) })
const propCor = (c: Camada): PropCor => (c.type === 'text' ? 'color' : 'fill')
/**
 * Vetor da caneta com caminhos fechados mas nenhum preenchido (desenhado antes de fechar virar preenchível):
 * escolher uma cor de preenchimento é pedir preenchimento — os caminhos fechados passam a preencher.
 */
const comVetorPreenchivel = (c: Camada): Camada => {
  if (c.type !== 'shape' || !c.vetor) return c
  const { caminhos } = c.vetor
  if (caminhos.some((k) => k.fechado && !k.semPreenchimento) || !caminhos.some((k) => k.fechado)) return c
  return { ...c, vetor: { ...c.vetor, caminhos: caminhos.map((k) => { if (!k.fechado) return k; const { semPreenchimento: _s, ...resto } = k; return resto }) } }
}

/** Editar a cor direto solta o estilo ligado (como no Figma); gradiente também. */
const comPintura = (c0: Camada, p: Pintura): Camada => {
  const c = comVetorPreenchivel(c0)
  if (c.type !== 'shape' && c.type !== 'text' && c.type !== 'frame') return c
  // imagem: só formas e frames (texto não tem preenchimento com imagem); sem imagem escolhida, fica como está
  if (p.tipo === 'imagem') return c.type !== 'text' && p.assetId ? ({ ...c, fillImage: { assetId: p.assetId, fit: p.encaixe ?? 'cover' }, gradient: undefined } as Camada) : c
  const semImagem = (c.type !== 'text' ? { ...c, fillImage: undefined } : c) as Camada
  if (p.tipo === 'gradiente') return desligarEstilo({ ...semImagem, gradient: p.gradiente } as Camada, propCor(c))
  if (p.tipo === 'solido') return gravarCor({ ...semImagem, gradient: undefined } as Camada, propCor(c), p.cor)
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
  const semFill = tipo === 'frame' && camadas.every((c) => c.type === 'frame' && !c.fill && !c.gradient && !c.fillImage)
  const vazia = semFill || (forma && pintura !== MISTO && pintura.tipo === 'solido' && alfaDe(pintura.cor) === 0 && !mantidas.has(chave))
  const oculta = pintura !== MISTO && pintura.tipo === 'solido' && alfaDe(pintura.cor) === 0
  const padraoAtual = tipo === 'shape' ? comum(camadas, (c) => (c as CamadaForma).pattern) : 'none'

  const alternarOlho = () => {
    if (pintura === MISTO || pintura.tipo !== 'solido') return
    if (oculta) { setFn((c) => comCor(c, (cor) => comAlfa(cor, alfaAnterior.get(c.id) ?? 1))); mantidas.delete(chave) }
    else { camadas.forEach((c) => alfaAnterior.set(c.id, alfaDe(corBase(c)))); mantidas.add(chave); setFn((c) => comCor(c, (cor) => comAlfa(cor, 0))) }
    atualizar((n) => n + 1)
  }
  const remover = () => { mantidas.delete(chave); setFn((c) => (c.type === 'frame' ? ({ ...c, fill: undefined, gradient: undefined, fillImage: undefined } as Camada) : comCor({ ...c, gradient: undefined, ...(c.type === 'shape' ? { fillImage: undefined } : {}) } as Camada, (cor) => comAlfa(cor, 0)))) }
  const adicionar = () => setFn((c) => comCor(comVetorPreenchivel(c), (cor) => comAlfa(cor, 1)))

  return (
    <Secao
      titulo="Preenchimento"
      // textura: um ícone no título (como os estilos no Figma); os controles só aparecem com uma textura escolhida
      acao={tipo === 'shape' && !vazia ? (
        <Menu rotulo="Textura" ativo={padraoAtual !== 'none'} itens={TEXTURAS.map((t) => ({ id: t.id, rotulo: t.rotulo, ativo: padraoAtual === t.id, aoClicar: () => setFn((c) => ({ ...c, pattern: t.id }) as Camada) }))}>
          <Grip className="h-3.5 w-3.5" />
        </Menu>
      ) : undefined}
      vazia={vazia} aoAdicionar={vazia || pintura === MISTO ? (pintura === MISTO ? () => { const p = pinturaDe(camadas[0]!); setFn((c) => comPintura(c, p)) } : adicionar) : undefined} rotuloAdicionar="Adicionar preenchimento">
      {pintura === MISTO ? (
        <LinhaPintura rotulo={forma ? 'Cor de preenchimento (mista)' : 'Cor do texto (mista)'} valor={pinturaDe(camadas[0]!)} vazio placeholder="Misto" tipos={forma ? ['solido', 'linear', 'radial', 'imagem'] : ['solido', 'linear', 'radial']} aoMudar={(p) => setFn((c) => comPintura(c, p))} />
      ) : (
        <LinhaPintura
          rotulo={forma ? 'Cor de preenchimento' : 'Cor do texto'}
          valor={pintura}
          tipos={forma ? ['solido', 'linear', 'radial', 'imagem'] : ['solido', 'linear', 'radial']}
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
      {tipo === 'shape' && padraoAtual !== 'none' && (pintura === MISTO || pintura.tipo !== 'imagem') && <Textura camadas={camadas as CamadaForma[]} setFn={setFn} />}
    </Secao>
  )
}

/**
 * Textura (listras, pontos, grade) com prévia sobre a cor da camada e, quando ligada, escala do passo, espessura
 * e opacidade (schema aditivo: `patternScale`, `patternWeight`, `patternOpacity`; ausentes = o padrão antigo).
 */
function Textura({ camadas, setFn }: { camadas: CamadaForma[]; setFn: (f: (c: Camada) => Camada) => void }) {
  const padrao = comum(camadas, (c) => (c as CamadaForma).pattern)
  const primeira = camadas[0]!
  const previa = padrao !== MISTO && padrao !== 'none' ? { ...padraoCss({ ...primeira, pattern: padrao }), backgroundColor: primeira.gradient ? undefined : primeira.fill, ...(primeira.gradient ? { backgroundImage: `${padraoCss({ ...primeira, pattern: padrao }).backgroundImage}, ${gradienteCss(primeira.gradient)}` } : {}) } : undefined
  const pct = (v: number | undefined, base = 1) => Math.round((v ?? base) * 100)
  const escala = comum(camadas, (c) => pct((c as CamadaForma).patternScale))
  const peso = comum(camadas, (c) => pct((c as CamadaForma).patternWeight))
  const opacidade = comum(camadas, (c) => { const f = c as CamadaForma; return pct(f.patternOpacity, OPACIDADE_PADRAO_TEXTURA[f.pattern] ?? 1) })
  const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const set = (patch: Partial<CamadaForma>) => setFn((c) => ({ ...c, ...patch }) as Camada)
  return (
    <>
      <SeletorLista
        rotulo="Textura"
        prefixo={<span className="block h-3.5 w-3.5 rounded-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]" style={previa ? { ...previa, backgroundSize: previa.backgroundSize ? '7px 7px' : undefined } : { background: 'rgb(var(--cor-texto-3) / .35)' }} />}
        valor={String(padrao)}
        aoMudar={(v) => v !== MISTO && set({ pattern: v as CamadaForma['pattern'] })}
        opcoes={[...(padrao === MISTO ? [{ id: MISTO, rotulo: 'Textura: mista' }] : []), ...TEXTURAS.map((t) => ({ id: t.id, rotulo: t.id === 'none' ? 'Sem textura' : `Textura: ${t.rotulo.toLowerCase()}` }))]}
      />
      {previa && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <CampoNum prefixo={<span className="text-[11px]">⤢</span>} rotulo="Escala da textura" titulo="Escala do passo (%)" valor={escala} min={10} max={800} sufixo="%" aoMudar={(v) => set({ patternScale: limitar(v, 10, 800) / 100 })} aoDelta={(d) => setFn((c) => ({ ...c, patternScale: limitar(pct((c as CamadaForma).patternScale) + d, 10, 800) / 100 }) as Camada)} />
            <CampoNum prefixo={<span className="text-[11px]">≡</span>} rotulo="Espessura da textura" titulo="Espessura do traço/ponto (%)" valor={peso} min={10} max={800} sufixo="%" aoMudar={(v) => set({ patternWeight: limitar(v, 10, 800) / 100 })} aoDelta={(d) => setFn((c) => ({ ...c, patternWeight: limitar(pct((c as CamadaForma).patternWeight) + d, 10, 800) / 100 }) as Camada)} />
            <CampoNum prefixo={<span className="text-[11px]">◐</span>} rotulo="Opacidade da textura" titulo="Opacidade da textura (%)" valor={opacidade} min={0} max={100} sufixo="%" aoMudar={(v) => set({ patternOpacity: limitar(v, 0, 100) / 100 })} aoDelta={(d) => setFn((c) => { const f = c as CamadaForma; return { ...c, patternOpacity: limitar(pct(f.patternOpacity, OPACIDADE_PADRAO_TEXTURA[f.pattern] ?? 1) + d, 0, 100) / 100 } as Camada })} />
          </div>
        </>
      )}
    </>
  )
}
