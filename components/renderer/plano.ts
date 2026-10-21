/**
 * Plano de animação de uma camada (keyframes, tempos e variáveis CSS), puro — sem React/DOM. Usado pelo
 * renderizador (components/renderer/animacao.tsx, SceneRenderer.tsx) e pelas miniaturas da galeria.
 */
import type { CSSProperties } from 'react'
import type { Animacao, Camada, Loop } from '@/lib/scene/schema'
import { adaptarAnimacao } from '@/lib/scene/motor'
import { curvaCss } from '@/lib/scene/animacoes'
import { cssDaAnimacao, ehSaida, ehTextoAnimado } from '@/lib/scene/parametros'
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

/**
 * Desfoque numa animação separada do movimento. Filtro de desfoque nunca roda na GPU (ele "move pixels"), e no
 * mesmo keyframe ele levava o movimento e a opacidade junto para a thread principal: qualquer tarefa longa
 * congelava a camada (ou cada palavra). Separados — mesma duração, atraso e curva, o mesmo visual —, o movimento
 * fica na GPU e só o desfoque depende da thread principal.
 */
const SEPARAR_DESFOQUE: Record<string, string[]> = {
  'anim-movBlur': ['anim-mov', 'anim-desfoque'],
  'anim-movSaiBlur': ['anim-movSai', 'anim-desfoqueSai'],
  'seg-movBlur': ['seg-mov', 'seg-desfoque'],
}
export const keyframesSeparados = (keyframe: string): string[] => SEPARAR_DESFOQUE[keyframe] ?? [keyframe]

export interface PlanoAnimacao {
  estilo?: CSSProperties
  classe?: string
  /** Entrada de texto dividida: quem anima são as partes do texto, não a camada. */
  texto?: Animacao
  /** Desenhar contorno: os traços do SVG da camada animam (ver <Desenho>). */
  desenho?: boolean
  /**
   * A entrada da camada pode ser solta quando termina (ver `concluida`): o último quadro dela é igual ao estilo
   * parado da camada. Saídas não (terminam escondidas).
   */
  soltavel?: boolean
}

/**
 * Estilo de animação da camada: entrada (ou saída) + loop, já adaptados a movimento reduzido.
 * `desenhavel`: a camada tem traços SVG (formas que não são retângulo/elipse); senão "Desenhar" vira cortina.
 * `aguardar`: entrada por clique/hover — fica parada no 1º quadro até o público agir.
 * `concluida`: a entrada já terminou e sai do estilo (o loop continua no mesmo compasso). Uma animação
 * terminada com `fill-mode: both` mantém a camada composta na GPU para sempre (uma camada por elemento) e
 * todo quadro que repinta qualquer coisa paga por elas no Layerize/Commit.
 */
export function planoAnimacao({ entrada, saida, loop, reduzir, ehTexto, desenhavel = false, aguardar = false, concluida = false }: { entrada?: Animacao; saida?: Animacao; loop?: Loop; reduzir: boolean; ehTexto: boolean; desenhavel?: boolean; aguardar?: boolean; concluida?: boolean }): PlanoAnimacao {
  const nomes: string[] = []
  const duracoes: string[] = []
  const atrasos: string[] = []
  const curvas: string[] = []
  const repeticoes: string[] = []
  const preenchimentos: string[] = []
  let vars: Record<string, string | number> = {}
  let texto: Animacao | undefined
  let desenho = false
  let fimEntrada = 0
  let soltavel = false
  const principal = saida ?? entrada
  if (principal && principal.type !== 'none') {
    let a = adaptarAnimacao(principal, reduzir)
    if (a.type === 'draw' && !desenhavel) a = { ...a, type: 'reveal' }
    if (ehTextoAnimado(a.type) && ehTexto) texto = a
    soltavel = !saida && !ehSaida(a.type)
    const solta = concluida && soltavel
    const css = solta ? { keyframe: '', vars: {} } : cssDaAnimacao(a, ehTexto)
    vars = css.vars
    if (css.keyframe) {
      for (const k of keyframesSeparados(css.keyframe)) {
        nomes.push(k)
        duracoes.push(`${a.duration}ms`)
        atrasos.push(`${a.delay}ms`)
        curvas.push(curvaCss(a))
        repeticoes.push('1')
        preenchimentos.push('both')
      }
    }
    if (a.type === 'draw' && !solta) {
      desenho = true
      vars = { ...vars, '--anim-dur': `${a.duration}ms`, '--anim-atraso': `${a.delay}ms`, '--anim-curva': curvaCss(a) }
    }
    fimEntrada = a.delay + a.duration
  }
  if (loop && !saida && !reduzir) {
    nomes.push(`loop-${loop.type}`)
    duracoes.push(`${loop.duration}ms`)
    atrasos.push(`${fimEntrada}ms`)
    curvas.push(loop.type === 'spin' ? 'linear' : 'ease-in-out')
    repeticoes.push(loop.repeat ? String(loop.repeat) : 'infinite')
    preenchimentos.push('none')
  }
  const estiloVars = vars as CSSProperties
  if (!nomes.length) return { texto, desenho, soltavel, estilo: Object.keys(vars).length ? estiloVars : undefined }
  return {
    texto,
    desenho,
    soltavel,
    classe: [saida ? 'camada-animada camada-saida' : 'camada-animada', desenho ? 'camada-desenho' : ''].filter(Boolean).join(' '),
    estilo: {
      ...estiloVars,
      animationName: nomes.join(', '),
      animationDuration: duracoes.join(', '),
      animationDelay: atrasos.join(', '),
      animationTimingFunction: curvas.join(', '),
      animationIterationCount: repeticoes.join(', '),
      animationFillMode: preenchimentos.join(', '),
      ...(aguardar ? { animationPlayState: 'paused' } : {}),
    },
  }
}
