'use client'
/**
 * Traço (como no Figma): lista de traços com "+" no título; cada linha = [amostra] cor | % [olho] [−].
 * Abaixo, as propriedades valem para todos os traços da camada (como no Figma): posição (dentro, centro,
 * fora), espessura, espessura por lado (caixas) e, em "Mais opções", estilo (contínuo, tracejado com traço e
 * espaço, pontilhado), pontas e junções (linhas, setas e caminhos).
 * Camadas antigas (stroke/strokeWidth/dash) aparecem como um traço; editar grava a lista nova.
 */
import { useState } from 'react'
import { Eye, EyeOff, Minus, Settings2 } from 'lucide-react'
import type { Camada, Traco } from '@/lib/scene/schema'
import { MAX_TRACOS } from '@/lib/scene/schema'
import { TRACO_PADRAO, comTracos, espessuraMax, pontaFim, pontaInicio, tracosDe } from '@/lib/scene/tracos'
import { BotaoCampo, BotaoMini, CampoNum, MISTO, Secao, Segmentado, SeletorLista } from './controles'
import { LinhaPintura } from './CampoCor'
import type { Pintura } from './SeletorCor'
import { IconeEspessura, IconeLados, IconePosicaoTraco, IconeTracejado } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { ligarEstilo } from '@/lib/editor/estilosCor'

const linear = (c: Camada) => c.type === 'shape' && (c.shape === 'line' || c.shape === 'arrow')
const caixa = (c: Camada) => (c.type === 'shape' && c.shape === 'rect') || c.type === 'frame' || c.type === 'image' || c.type === 'video' || c.type === 'embed' || c.type === 'lottie' || c.type === 'model3d' || c.type === 'svg'
const caminho = (c: Camada) => c.type === 'shape' && c.shape !== 'rect' && c.shape !== 'ellipse'
/** Tipos com traço. */
export const aceitaTraco = (c: Camada) => c.type !== 'hotspot'

const PONTAS: { id: NonNullable<Traco['endArrow']>; rotulo: string }[] = [{ id: 'none', rotulo: 'Nenhuma' }, { id: 'arrow', rotulo: 'Seta' }, { id: 'triangle', rotulo: 'Triângulo' }, { id: 'circle', rotulo: 'Círculo' }, { id: 'square', rotulo: 'Quadrado' }, { id: 'bar', rotulo: 'Barra' }]
const POSICOES: { id: Traco['position']; rotulo: string }[] = [{ id: 'inside', rotulo: 'Dentro' }, { id: 'center', rotulo: 'Centro' }, { id: 'outside', rotulo: 'Fora' }]
const LADOS = [['top', 'Superior', '↑'], ['right', 'Direito', '→'], ['bottom', 'Inferior', '↓'], ['left', 'Esquerdo', '←']] as const

const pinturaDe = (t: Traco): Pintura => (t.gradient ? { tipo: 'gradiente', gradiente: t.gradient } : { tipo: 'solido', cor: t.color })

/** Novo traço com a posição padrão do tipo (texto e linhas: centro; demais: dentro, como no Figma). */
function novoTraco(c: Camada): Traco {
  if (linear(c)) return { ...TRACO_PADRAO, weight: 4, position: 'center', cap: 'round', join: 'round' }
  if (c.type === 'text') return { ...TRACO_PADRAO, position: 'outside', weight: 2 }
  return { ...TRACO_PADRAO, position: caminho(c) ? 'center' : 'inside' }
}

export function SecaoTraco({ editor }: PropsSecao) {
  const { sel, setFn } = useCamadas(editor)
  const [mais, setMais] = useState(false)
  const [porLado, setPorLado] = useState(false)
  if (!sel.length || !sel.every(aceitaTraco)) return null
  const lista = comum(sel, (c) => tracosDe(c))
  const misto = lista === MISTO
  const tracos = misto ? tracosDe(sel[0]!) : lista
  const vazia = !misto && tracos.length === 0
  const primeiro = tracos[0]
  const todasCaixas = sel.every(caixa)
  const algumaLinha = sel.some((c) => linear(c) || caminho(c))
  const soLinhas = sel.every(linear)
  const ehTexto = sel.every((c) => c.type === 'text')

  /** Edita a lista de cada camada (as propriedades comuns valem para todos os traços dela). */
  const editar = (f: (ts: Traco[], c: Camada) => Traco[]) => setFn((c) => comTracos(c, f(tracosDe(c), c)))
  const todos = (patch: Partial<Traco> | ((t: Traco) => Partial<Traco>)) => editar((ts) => ts.map((t) => ({ ...t, ...(typeof patch === 'function' ? patch(t) : patch) })))
  const adicionar = () => {
    if (misto) { const base = tracosDe(sel[0]!); setFn((c) => comTracos(c, base.map((t) => ({ ...t })))); return }
    editar((ts, c) => (ts.length >= MAX_TRACOS ? ts : [{ ...(ts[0] ?? novoTraco(c)), color: ts.length ? '#5965F2' : (ts[0] ?? novoTraco(c)).color, gradient: undefined, hidden: undefined }, ...ts]))
  }
  const valor = <T,>(f: (t: Traco) => T) => comum(sel, (c) => { const t = tracosDe(c)[0]; return t ? f(t) : undefined }) as T | typeof MISTO | undefined
  const peso = valor((t) => espessuraMax(t))
  const posicao = valor((t) => t.position)
  const estilo = valor((t) => t.style)
  const temLados = sel.some((c) => tracosDe(c).some((t) => !!t.sides))
  const ladosAbertos = todasCaixas && (porLado || temLados)

  return (
    <Secao titulo="Traço" vazia={vazia} aoAdicionar={tracos.length < MAX_TRACOS ? adicionar : undefined} rotuloAdicionar="Adicionar traço">
      {misto ? (
        <p className="text-[12px] text-texto2">Traços diferentes na seleção. Clique em + para usar os mesmos em todas.</p>
      ) : (
        tracos.map((t, i) => (
          <LinhaPintura
            key={i}
            rotulo={tracos.length > 1 ? `Cor do traço ${i + 1}` : 'Cor do traço'}
            valor={pinturaDe(t)}
            tipos={['solido', 'linear', 'radial']}
            aoMudar={(p) => editar((ts) => ts.map((x, k) => (k !== i ? x : p.tipo === 'gradiente' ? { ...x, gradient: p.gradiente } : p.tipo === 'solido' ? { ...x, color: p.cor, gradient: undefined } : x)))}
            estiloId={i === 0 && !t.gradient ? (comum(sel, (c) => c.colorStyleIds?.stroke) as string | undefined) : undefined}
            aoEstilo={i === 0 ? (e) => setFn((c) => ligarEstilo(comTracos(c, tracosDe(c)), 'stroke', e)) : undefined}
            acoes={
              <>
                <BotaoMini rotulo={t.hidden ? 'Mostrar traço' : 'Ocultar traço'} onClick={() => editar((ts) => ts.map((x, k) => (k === i ? { ...x, hidden: x.hidden ? undefined : true } : x)))}>
                  {t.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </BotaoMini>
                <BotaoMini rotulo="Remover traço" onClick={() => editar((ts) => ts.filter((_, k) => k !== i))}><Minus className="h-3.5 w-3.5" /></BotaoMini>
              </>
            }
          />
        ))
      )}
      {primeiro && !misto && (
        <>
          {soLinhas && (
            // linhas e setas: ponta de início e de fim, como no Figma ("Start point" / "End point")
            <div className="grid grid-cols-2 gap-2">
              <SeletorLista rotulo="Ponta de início" prefixo={<span className="text-[11px]">⇤</span>} valor={String(comum(sel, (c) => pontaInicio(c, tracosDe(c)[0] ?? TRACO_PADRAO)))} aoMudar={(v) => v !== MISTO && todos({ startArrow: v as Traco['startArrow'] })} opcoes={[...(comum(sel, (c) => pontaInicio(c, tracosDe(c)[0] ?? TRACO_PADRAO)) === MISTO ? [{ id: MISTO, rotulo: 'Misto' }] : []), ...PONTAS]} />
              <SeletorLista rotulo="Ponta de fim" prefixo={<span className="text-[11px]">⇥</span>} valor={String(comum(sel, (c) => pontaFim(c, tracosDe(c)[0] ?? TRACO_PADRAO)))} aoMudar={(v) => v !== MISTO && todos({ endArrow: v as Traco['endArrow'] })} opcoes={[...(comum(sel, (c) => pontaFim(c, tracosDe(c)[0] ?? TRACO_PADRAO)) === MISTO ? [{ id: MISTO, rotulo: 'Misto' }] : []), ...PONTAS]} />
            </div>
          )}
          <div className="grid grid-cols-[1fr_1fr_28px_28px] gap-2">
            {soLinhas ? (
              <SeletorLista rotulo="Pontas do traço" prefixo={<span className="text-[11px]">⌐</span>} valor={String(valor((t) => t.cap) ?? 'none')} aoMudar={(cap) => todos({ cap: cap as Traco['cap'] })} opcoes={[{ id: 'none', rotulo: 'Sem ponta' }, { id: 'round', rotulo: 'Redonda' }, { id: 'square', rotulo: 'Quadrada' }]} />
            ) : (
              <SeletorLista
                rotulo="Posição do traço"
                prefixo={posicao && posicao !== MISTO ? <IconePosicaoTraco posicao={posicao} /> : undefined}
                valor={posicao === MISTO || !posicao ? '' : posicao}
                aoMudar={(v) => todos({ position: v as Traco['position'] })}
                opcoes={[...(posicao === MISTO ? [{ id: '', rotulo: 'Misto' }] : []), ...POSICOES.filter((p) => !ehTexto || p.id !== 'inside')]}
              />
            )}
            <CampoNum
              prefixo={<IconeEspessura />}
              rotulo="Espessura do traço"
              valor={peso === undefined ? 0 : peso}
              min={0}
              max={200}
              aoMudar={(w) => todos((t) => ({ weight: w, sides: t.sides ? { top: w, right: w, bottom: w, left: w } : undefined }))}
              aoDelta={(d) => todos((t) => ({ weight: Math.max(0, Math.min(200, t.weight + d)) }))}
            />
            <BotaoCampo rotulo="Espessura por lado" title={todasCaixas ? 'Espessura por lado' : 'Espessura por lado: retângulos, frames e mídia'} disabled={!todasCaixas} ativo={ladosAbertos} onClick={() => {
              if (ladosAbertos) { setPorLado(false); todos((t) => ({ weight: espessuraMax(t), sides: undefined })) } else setPorLado(true)
            }}><IconeLados /></BotaoCampo>
            <BotaoCampo rotulo="Mais opções do traço" ativo={mais} aria-expanded={mais} onClick={() => setMais((v) => !v)}><Settings2 className="h-3.5 w-3.5" /></BotaoCampo>
          </div>
          {ladosAbertos && (
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Espessura por lado">
              {LADOS.map(([lado, nome, seta]) => (
                <CampoNum
                  key={lado}
                  prefixo={seta}
                  rotulo={`Traço ${nome.toLowerCase()}`}
                  titulo={`Espessura do lado ${nome.toLowerCase()}`}
                  valor={valor((t) => (t.sides ? t.sides[lado] : t.weight)) as number ?? 0}
                  min={0}
                  max={200}
                  aoMudar={(v) => todos((t) => { const s = { ...(t.sides ?? { top: t.weight, right: t.weight, bottom: t.weight, left: t.weight }), [lado]: v }; return { sides: s, weight: Math.max(s.top, s.right, s.bottom, s.left) } })}
                />
              ))}
            </div>
          )}
          {mais && (
            <div className="space-y-2 border-l border-bordaForte pl-2">
              <Segmentado<Traco['style']>
                rotulo="Estilo do traço"
                valor={estilo === MISTO || !estilo ? 'solid' : estilo}
                aoMudar={(style) => todos({ style })}
                opcoes={[{ id: 'solid', rotulo: 'Contínuo' }, { id: 'dashed', rotulo: 'Tracejado' }, { id: 'dotted', rotulo: 'Pontilhado' }]}
              />
              {estilo === 'dashed' && (
                <div className="grid grid-cols-2 gap-2">
                  <CampoNum prefixo={<IconeTracejado />} rotulo="Comprimento do traço" titulo="Traço (px)" valor={valor((t) => t.dash) as number} min={0} max={500} aoMudar={(dash) => todos({ dash })} />
                  <CampoNum prefixo="↔" rotulo="Espaço entre traços" titulo="Espaço (px)" valor={valor((t) => t.gap) as number} min={0} max={500} aoMudar={(gap) => todos({ gap })} />
                </div>
              )}
              {estilo === 'dotted' && <CampoNum prefixo="↔" rotulo="Espaço entre pontos" titulo="Espaço entre pontos (px)" valor={valor((t) => t.gap) as number} min={0} max={500} aoMudar={(gap) => todos({ gap })} />}
              {algumaLinha && (
                <div className="grid grid-cols-2 gap-2">
                  {!soLinhas && <SeletorLista rotulo="Pontas do traço" valor={String(valor((t) => t.cap) ?? 'none')} aoMudar={(cap) => todos({ cap: cap as Traco['cap'] })} opcoes={[{ id: 'none', rotulo: 'Ponta: nenhuma' }, { id: 'round', rotulo: 'Ponta: redonda' }, { id: 'square', rotulo: 'Ponta: quadrada' }]} />}
                  <SeletorLista rotulo="Junção do traço" valor={String(valor((t) => t.join) ?? 'miter')} aoMudar={(join) => todos({ join: join as Traco['join'] })} opcoes={[{ id: 'miter', rotulo: 'Junção: quina' }, { id: 'round', rotulo: 'Junção: redonda' }, { id: 'bevel', rotulo: 'Junção: chanfro' }]} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Secao>
  )
}
