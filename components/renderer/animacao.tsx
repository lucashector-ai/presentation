'use client'
/**
 * Animações no renderizador: o MESMO cálculo de estilo vale para o canvas do editor (prévia), o
 * Pré-visualizar e o visualizador público. Keyframes em app/globals.css (bloco "MOSTRA · ANIMAÇÕES").
 *
 * Prévia no editor: o inspetor chama `pedirPrevia(...)`; cada SceneRenderer em modo editor escuta o
 * evento e toca as animações pedidas uma vez, sem sair do modo de edição.
 */
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Animacao, Camada, Cena, Loop, Transicao } from '@/lib/scene/schema'
import { adaptarAnimacao } from '@/lib/scene/motor'
import { curvaCss, dividirTexto, ehAnimacaoDeTexto, modoDivisao, tempoSegmentos } from '@/lib/scene/animacoes'
import { transformCss } from './estilos'

/** Variáveis CSS lidas pelos keyframes. */
export function varsAnimacao(c: Pick<Camada, 'opacity' | 'rotation' | 'flipX' | 'flipY' | 'loopAnimation'>): CSSProperties {
  return {
    ['--op' as string]: c.opacity,
    ['--rot' as string]: `${c.rotation}deg`,
    ['--tf' as string]: transformCss(c) ?? 'translate(0)',
    ['--amp' as string]: c.loopAnimation?.intensity ?? 1,
  }
}

export interface PlanoAnimacao {
  estilo?: CSSProperties
  classe?: string
  /** Entrada de texto dividida: quem anima são as partes do texto, não a camada. */
  texto?: Animacao
}

/** Estilo de animação da camada: entrada (ou saída) + loop, já adaptados a movimento reduzido. */
export function planoAnimacao({ entrada, saida, loop, reduzir, ehTexto }: { entrada?: Animacao; saida?: Animacao; loop?: Loop; reduzir: boolean; ehTexto: boolean }): PlanoAnimacao {
  const nomes: string[] = []
  const duracoes: string[] = []
  const atrasos: string[] = []
  const curvas: string[] = []
  const repeticoes: string[] = []
  const preenchimentos: string[] = []
  let texto: Animacao | undefined
  let fimEntrada = 0
  const principal = saida ?? entrada
  if (principal && principal.type !== 'none') {
    let a = adaptarAnimacao(principal, reduzir)
    if (ehAnimacaoDeTexto(a.type)) {
      if (ehTexto) texto = a
      else a = { ...a, type: 'fadeIn' }
    }
    if (!texto) {
      nomes.push(`anim-${a.type}`)
      duracoes.push(`${a.duration}ms`)
      atrasos.push(`${a.delay}ms`)
      curvas.push(curvaCss(a))
      repeticoes.push('1')
      preenchimentos.push('both')
    }
    fimEntrada = a.delay + a.duration
  }
  if (loop && !saida && !reduzir) {
    nomes.push(`loop-${loop.type}`)
    duracoes.push(`${loop.duration}ms`)
    atrasos.push(`${fimEntrada}ms`)
    curvas.push(loop.type === 'spin' ? 'linear' : 'ease-in-out')
    repeticoes.push('infinite')
    preenchimentos.push('none')
  }
  if (!nomes.length) return { texto }
  return {
    texto,
    classe: saida ? 'camada-animada camada-saida' : 'camada-animada',
    estilo: {
      animationName: nomes.join(', '),
      animationDuration: duracoes.join(', '),
      animationDelay: atrasos.join(', '),
      animationTimingFunction: curvas.join(', '),
      animationIterationCount: repeticoes.join(', '),
      animationFillMode: preenchimentos.join(', '),
    },
  }
}

/** Texto dividido em partes animadas. As partes são aria-hidden; o texto completo fica para leitores de tela. */
export function TextoSegmentado({ texto, animacao, estiloParte }: { texto: string; animacao: Animacao; estiloParte?: CSSProperties }) {
  const modo = modoDivisao(animacao.type) ?? 'palavra'
  const { palavras, total } = useMemo(() => dividirTexto(texto, modo), [texto, modo])
  const { duracaoParte, passo } = tempoSegmentos(animacao.type, total, animacao.duration)
  const maquina = animacao.type === 'typewriter'
  const curva = maquina ? 'linear' : curvaCss(animacao)
  const parte = (s: { texto: string; indice: number }) => (
    <span
      key={s.indice}
      className={maquina ? 'seg-texto-linha' : 'seg-texto'}
      style={{ ...estiloParte, animationName: `seg-${animacao.type}`, animationDuration: `${Math.round(duracaoParte)}ms`, animationDelay: `${Math.round(animacao.delay + s.indice * passo)}ms`, animationTimingFunction: curva }}
    >
      {s.texto}
    </span>
  )
  return (
    <>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{texto}</span>
      <span aria-hidden>
        {palavras.map((p, i) => (
          <Fragment key={i}>
            {modo === 'letra' && !maquina ? <span className="seg-palavra">{p.partes.map(parte)}</span> : p.partes.map(parte)}
            {p.separador}
          </Fragment>
        ))}
      </span>
    </>
  )
}

// ---------- prévia no canvas do editor ----------

export interface PedidoPrevia {
  nonce: number
  /** Camadas a tocar (todas se omitido). */
  ids?: string[]
  /** Ignora o atraso (prévia rápida de uma camada). */
  semAtraso?: boolean
  /** Toca as saídas em vez das entradas. */
  saida?: boolean
  /** Prévia da transição de entrada da tela. */
  transicao?: Transicao
  /** Tela anterior (para a prévia do morph). */
  morphDe?: Cena
  /** performance.now() do pedido (a linha do tempo usa para o cursor). */
  inicio: number
  /** Quanto tempo a prévia fica ativa (ms). 0 = parar. */
  duracao: number
}

const EVENTO = 'mostra:previa-animacao'
let contador = 0

export function pedirPrevia(p: Omit<PedidoPrevia, 'nonce' | 'inicio'>) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<PedidoPrevia>(EVENTO, { detail: { ...p, nonce: ++contador, inicio: performance.now() } }))
}

export function pararPrevia() {
  pedirPrevia({ duracao: 0 })
}

/** Último pedido de prévia ainda ativo (null quando não há prévia tocando). */
export function usePreviaAnimacao(ativo = true): PedidoPrevia | null {
  const [pedido, setPedido] = useState<PedidoPrevia | null>(null)
  useEffect(() => {
    if (!ativo) return
    let t: number | undefined
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<PedidoPrevia>).detail
      window.clearTimeout(t)
      if (!d.duracao) return setPedido(null)
      setPedido(d)
      t = window.setTimeout(() => setPedido(null), d.duracao + 150)
    }
    window.addEventListener(EVENTO, ouvir)
    return () => { window.removeEventListener(EVENTO, ouvir); window.clearTimeout(t) }
  }, [ativo])
  return pedido
}
