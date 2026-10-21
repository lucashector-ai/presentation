'use client'
/**
 * Sobreposições de precisão do canvas (estilo Figma):
 * guias de alinhamento (vermelho), vãos iguais (rosa, com o valor), medidas em px (vermelho, Alt)
 * e a linha azul de inserção do auto layout. Tudo em coordenadas da cena, convertido para a tela.
 */
import type { Guia, Medida } from '@/lib/editor/guias'
import type { Retangulo } from '@/lib/scene/transform'

const VERMELHO = 'rgb(var(--cor-guia))'
const ROSA = '#E83FD1'

export interface Sobreposicao {
  guias: Guia[]
  espacos: Medida[]
  medidas: Medida[]
}
export const SEM_SOBREPOSICAO: Sobreposicao = { guias: [], espacos: [], medidas: [] }

type ParaTela = (r: Retangulo) => Retangulo

export function GuiasCanvas({ s, paraTela }: { s: Sobreposicao; paraTela: ParaTela }) {
  return (
    <>
      {s.guias.map((gu, i) => {
        const a = paraTela(gu.eixo === 'v' ? { x: gu.pos, y: gu.de, width: 0, height: gu.ate - gu.de } : { x: gu.de, y: gu.pos, width: gu.ate - gu.de, height: 0 })
        return (
          <div key={`g${i}`} data-guia={gu.eixo} data-rotulo={gu.rotulo} className="pointer-events-none absolute z-30" style={gu.eixo === 'v' ? { left: Math.round(a.x), top: a.y, width: 1, height: Math.max(1, a.height), background: VERMELHO } : { left: a.x, top: Math.round(a.y), height: 1, width: Math.max(1, a.width), background: VERMELHO }}>
            {/* frações da tela: etiqueta na ponta da guia (1/2, 1/3…) */}
            {gu.rotulo && (
              <span className="mono absolute whitespace-nowrap rounded-[3px] px-1 py-[2px] text-[10px] font-medium leading-none text-white" style={{ background: VERMELHO, ...(gu.eixo === 'v' ? { top: 6, left: 0, transform: 'translateX(-50%)' } : { left: 6, top: 0, transform: 'translateY(-50%)' }) }}>
                {gu.rotulo}
              </span>
            )}
          </div>
        )
      })}
      {s.espacos.map((m, i) => <Segmento key={`e${i}`} m={m} paraTela={paraTela} cor={ROSA} tipo="espaco" />)}
      {s.medidas.map((m, i) => <Segmento key={`m${i}`} m={m} paraTela={paraTela} cor={VERMELHO} tipo="medida" />)}
    </>
  )
}

/** Segmento com marcas nas pontas e etiqueta com o valor em px. */
function Segmento({ m, paraTela, cor, tipo }: { m: Medida; paraTela: ParaTela; cor: string; tipo: 'espaco' | 'medida' }) {
  const h = m.eixo === 'h'
  const a = paraTela(h ? { x: m.de, y: m.pos, width: m.ate - m.de, height: 0 } : { x: m.pos, y: m.de, width: 0, height: m.ate - m.de })
  const comp = h ? a.width : a.height
  if (comp < 1) return null
  const tick = 7
  return (
    <div className="pointer-events-none absolute z-30" data-medida={tipo} data-valor={m.valor} style={h ? { left: a.x, top: Math.round(a.y), width: a.width, height: 1 } : { left: Math.round(a.x), top: a.y, width: 1, height: a.height }}>
      <div className="absolute inset-0" style={{ background: tipo === 'espaco' ? `repeating-linear-gradient(${h ? 90 : 0}deg, ${cor} 0 3px, transparent 3px 5px)` : cor }} />
      {[0, 1].map((k) => (
        <div key={k} className="absolute" style={h ? { left: k ? a.width - 1 : 0, top: -tick / 2, width: 1, height: tick, background: cor } : { top: k ? a.height - 1 : 0, left: -tick / 2, height: 1, width: tick, background: cor }} />
      ))}
      <span
        className="mono absolute whitespace-nowrap rounded-[3px] px-1 py-[2px] text-[10px] font-medium leading-none text-white"
        style={{ background: cor, ...(h ? { left: a.width / 2, top: 4, transform: 'translateX(-50%)' } : { top: a.height / 2, left: 5, transform: 'translateY(-50%)' }) }}
      >
        {m.valor}
      </span>
    </div>
  )
}

/** Grade de layout (colunas): faixas translúcidas como a "Layout grid" de colunas do Figma. */
export function ColunasCanvas({ colunas, paraTela }: { colunas: Retangulo[]; paraTela: ParaTela }) {
  return (
    <>
      {colunas.map((c, i) => {
        const a = paraTela(c)
        return <div key={i} data-testid="coluna-layout" aria-hidden className="pointer-events-none absolute z-[2]" style={{ left: a.x, top: a.y, width: a.width, height: a.height, background: 'rgb(var(--cor-guia) / .07)', boxShadow: 'inset 1px 0 rgb(var(--cor-guia) / .18), inset -1px 0 rgb(var(--cor-guia) / .18)' }} />
      })}
    </>
  )
}

/** Prévia da região de "Preencher" (tracejado no acento) enquanto o cursor está sobre uma opção. */
export function PreviaRegiao({ r, paraTela }: { r: Retangulo; paraTela: ParaTela }) {
  const a = paraTela(r)
  return <div data-testid="previa-preencher" className="pointer-events-none absolute z-30 rounded-[2px] border-[1.5px] border-dashed border-acento bg-acento/10" style={{ left: a.x, top: a.y, width: a.width, height: a.height }} />
}

/** Linha azul onde o item vai entrar no auto layout. */
export function LinhaInsercao({ linha, paraTela }: { linha: { eixo: 'v' | 'h'; pos: number; de: number; ate: number }; paraTela: ParaTela }) {
  const a = paraTela(linha.eixo === 'v' ? { x: linha.pos, y: linha.de, width: 0, height: linha.ate - linha.de } : { x: linha.de, y: linha.pos, width: linha.ate - linha.de, height: 0 })
  return (
    <div data-testid="linha-insercao" className="pointer-events-none absolute z-30 rounded-full bg-acento" style={linha.eixo === 'v' ? { left: a.x - 1, top: a.y, width: 2, height: Math.max(8, a.height) } : { left: a.x, top: a.y - 1, height: 2, width: Math.max(8, a.width) }} />
  )
}
