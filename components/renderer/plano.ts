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
   * parado da camada. Saídas não (terminam escondidas) nem entradas que acompanham a rolagem (voltam ao rolar).
   */
  soltavel?: boolean
  /** Entrada que acompanha a rolagem (Story): o trecho da passagem pela janela (`animation-range`). */
  rolagem?: string
}

/** Trecho padrão da entrada "ao rolar": começa quando a camada aparece embaixo e termina antes do meio da janela. */
export const TRECHO_ROLAGEM_PADRAO: [number, number] = [0, 40]

/**
 * Entrada "ao rolar" em efeitos de texto por partes: o bloco inteiro acompanha a rolagem como um fade com
 * movimento (cada parte numa linha do tempo própria multiplicaria o custo). Destaque e sublinhado seguem a
 * rolagem com o próprio marcador; o contador conta no tempo, quando aparece.
 */
function entradaDeRolagem(a: Animacao): Animacao {
  if (!ehTextoAnimado(a.type) || a.type === 'highlight' || a.type === 'underline' || a.type === 'counter') return a
  return { type: 'slideUp', duration: a.duration, delay: 0, easing: a.easing, bezier: a.bezier, distance: 24, trigger: 'scroll', scrollRange: a.scrollRange }
}

/**
 * Estilo de animação da camada: entrada (ou saída) + loop, já adaptados a movimento reduzido.
 * `desenhavel`: a camada tem traços SVG (formas que não são retângulo/elipse); senão "Desenhar" vira cortina.
 * `aguardar`: entrada por clique/hover — fica parada no 1º quadro até o público agir.
 * `concluida`: a entrada já terminou e sai do estilo (o loop continua no mesmo compasso). Uma animação
 * terminada com `fill-mode: both` mantém a camada composta na GPU para sempre (uma camada por elemento) e
 * todo quadro que repinta qualquer coisa paga por elas no Layerize/Commit.
 */
export function planoAnimacao({ entrada, saida, loop, reduzir, ehTexto, desenhavel = false, aguardar = false, concluida = false, rolagem = false }: { entrada?: Animacao; saida?: Animacao; loop?: Loop; reduzir: boolean; ehTexto: boolean; desenhavel?: boolean; aguardar?: boolean; concluida?: boolean; rolagem?: boolean }): PlanoAnimacao {
  const nomes: string[] = []
  const duracoes: string[] = []
  const atrasos: string[] = []
  const curvas: string[] = []
  const repeticoes: string[] = []
  const preenchimentos: string[] = []
  const linhasDoTempo: string[] = []
  const trechos: string[] = []
  let vars: Record<string, string | number> = {}
  let texto: Animacao | undefined
  let desenho = false
  let fimEntrada = 0
  let soltavel = false
  let trecho: string | undefined
  const principal = saida ?? entrada
  if (principal && principal.type !== 'none') {
    let a = adaptarAnimacao(principal, reduzir)
    if (a.type === 'draw' && !desenhavel) a = { ...a, type: 'reveal' }
    // "ao rolar" só acompanha a rolagem no Story (com suporte a scroll-driven animations); no resto, toca ao entrar
    const porRolagem = !saida && rolagem && a.trigger === 'scroll'
    if (porRolagem) {
      a = entradaDeRolagem(a)
      const [ini, fim] = a.scrollRange ?? TRECHO_ROLAGEM_PADRAO
      trecho = `cover ${Math.min(ini, fim)}% cover ${Math.max(ini, fim, Math.min(ini, fim) + 1)}%`
    }
    if (ehTextoAnimado(a.type) && ehTexto) texto = a
    soltavel = !saida && !ehSaida(a.type) && !porRolagem
    const solta = concluida && soltavel
    const css = solta ? { keyframe: '', vars: {} } : cssDaAnimacao(a, ehTexto)
    vars = css.vars
    const vezes = Math.max(1, a.repeat ?? 1)
    if (css.keyframe) {
      for (const k of keyframesSeparados(css.keyframe)) {
        nomes.push(k)
        // na rolagem a duração é o trecho inteiro (auto) e não há atraso nem repetição
        duracoes.push(porRolagem ? 'auto' : `${a.duration}ms`)
        atrasos.push(porRolagem ? '0ms' : `${a.delay}ms`)
        curvas.push(curvaCss(a))
        repeticoes.push(porRolagem ? '1' : String(vezes))
        preenchimentos.push('both')
        linhasDoTempo.push(porRolagem ? 'view()' : 'auto')
        trechos.push(porRolagem && trecho ? trecho : 'normal')
      }
    }
    if (a.type === 'draw' && !solta) {
      desenho = true
      vars = { ...vars, '--anim-dur': `${a.duration}ms`, '--anim-atraso': `${a.delay}ms`, '--anim-curva': curvaCss(a), '--anim-rep': vezes }
    }
    fimEntrada = a.delay + a.duration * vezes
  }
  if (loop && !saida && !reduzir) {
    nomes.push(`loop-${loop.type}`)
    duracoes.push(`${loop.duration}ms`)
    atrasos.push(`${fimEntrada}ms`)
    curvas.push(loop.type === 'spin' ? 'linear' : 'ease-in-out')
    repeticoes.push(loop.repeat ? String(loop.repeat) : 'infinite')
    preenchimentos.push('none')
    linhasDoTempo.push('auto')
    trechos.push('normal')
  }
  const estiloVars = vars as CSSProperties
  const rolagemTexto = texto && trecho ? trecho : undefined
  if (!nomes.length) return { texto, desenho, soltavel, rolagem: rolagemTexto, estilo: Object.keys(vars).length ? estiloVars : undefined }
  const comRolagem = linhasDoTempo.includes('view()')
  return {
    texto,
    desenho,
    soltavel,
    rolagem: rolagemTexto,
    classe: [saida ? 'camada-animada camada-saida' : 'camada-animada', desenho ? 'camada-desenho' : '', comRolagem ? 'anim-rolagem' : ''].filter(Boolean).join(' '),
    estilo: {
      ...estiloVars,
      animationName: nomes.join(', '),
      animationDuration: duracoes.join(', '),
      animationDelay: atrasos.join(', '),
      animationTimingFunction: curvas.join(', '),
      animationIterationCount: repeticoes.join(', '),
      animationFillMode: preenchimentos.join(', '),
      ...(comRolagem ? ({ animationTimeline: linhasDoTempo.join(', '), animationRange: trechos.join(', ') } as CSSProperties) : {}),
      ...(aguardar ? { animationPlayState: 'paused' } : {}),
    },
  }
}
