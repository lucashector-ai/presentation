'use client'
/**
 * Animações no renderizador: o MESMO cálculo de estilo vale para o canvas do editor (prévia), o
 * Pré-visualizar, o /apresentar e o link público. Keyframes em app/globals.css (bloco "MOSTRA · ANIMAÇÕES");
 * parâmetros (distância, direção, escala, origem…) viram variáveis CSS em lib/scene/parametros.ts.
 *
 * Contador e Decodificar são desenhados em JS, mas o RELÓGIO é uma animação CSS da própria parte: pausa
 * (tela de carregamento, Story fora da janela), atraso e prévia no editor valem igual para eles.
 *
 * Prévia no editor: o inspetor chama `pedirPrevia(...)`; cada SceneRenderer em modo editor escuta o
 * evento e toca as animações pedidas uma vez, sem sair do modo de edição.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { Animacao, Camada, Cena, Loop, Transicao } from '@/lib/scene/schema'
import { adaptarAnimacao } from '@/lib/scene/motor'
import { curvaCss, dividirTexto, pontosDaCurva, tempoSegmentos } from '@/lib/scene/animacoes'
import { cssDaAnimacao, divisao, ehTextoAnimado, keyframeDaParte, parametros } from '@/lib/scene/parametros'
import { agruparLinhas, analisarNumero, curvaBezier, formatarNumero, ordemDasPartes, passosDaOrdem } from '@/lib/scene/texto-animado'
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
  /** Desenhar contorno: os traços do SVG da camada animam (ver <Desenho>). */
  desenho?: boolean
}

/**
 * Estilo de animação da camada: entrada (ou saída) + loop, já adaptados a movimento reduzido.
 * `desenhavel`: a camada tem traços SVG (formas que não são retângulo/elipse); senão "Desenhar" vira cortina.
 * `aguardar`: entrada por clique/hover — fica parada no 1º quadro até o público agir.
 */
export function planoAnimacao({ entrada, saida, loop, reduzir, ehTexto, desenhavel = false, aguardar = false }: { entrada?: Animacao; saida?: Animacao; loop?: Loop; reduzir: boolean; ehTexto: boolean; desenhavel?: boolean; aguardar?: boolean }): PlanoAnimacao {
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
  const principal = saida ?? entrada
  if (principal && principal.type !== 'none') {
    let a = adaptarAnimacao(principal, reduzir)
    if (a.type === 'draw' && !desenhavel) a = { ...a, type: 'reveal' }
    if (ehTextoAnimado(a.type) && ehTexto) texto = a
    const css = cssDaAnimacao(a, ehTexto)
    vars = css.vars
    if (css.keyframe) {
      nomes.push(css.keyframe)
      duracoes.push(`${a.duration}ms`)
      atrasos.push(`${a.delay}ms`)
      curvas.push(curvaCss(a))
      repeticoes.push('1')
      preenchimentos.push('both')
    }
    if (a.type === 'draw') {
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
  if (!nomes.length) return { texto, desenho, estilo: Object.keys(vars).length ? estiloVars : undefined }
  return {
    texto,
    desenho,
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

// ---------- desenhar contorno ----------

/** Envolve o conteúdo de uma forma: com `ativo`, mede cada traço do SVG e expõe o comprimento em --len. */
export function Desenho({ ativo, style, children }: { ativo: boolean; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEfeitoLayout(() => {
    const el = ref.current
    if (!ativo || !el) return
    el.querySelectorAll<SVGGeometryElement>('path, line, polyline, polygon, rect, circle, ellipse').forEach((g) => {
      try { g.style.setProperty('--len', String(Math.ceil(g.getTotalLength()) + 1)) } catch { /* sem geometria */ }
    })
  }, [ativo])
  return <div ref={ref} style={style}>{children}</div>
}

// ---------- texto ----------

/** Kerning entre dois grafemas (em "em"), medido no canvas com a fonte da camada. Cache por fonte + par. */
const cacheKerning = new Map<string, number>()
/** useLayoutEffect sem aviso no servidor (o renderizador também roda no SSR). */
const useEfeitoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect
let ctxMedida: CanvasRenderingContext2D | null | undefined
function kerning(fonte: string, a: string, b: string): number {
  const chave = `${fonte}|${a}|${b}`
  const salvo = cacheKerning.get(chave)
  if (salvo !== undefined) return salvo
  if (ctxMedida === undefined) ctxMedida = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!ctxMedida) return 0
  ctxMedida.font = fonte
  const k = (ctxMedida.measureText(a + b).width - ctxMedida.measureText(a).width - ctxMedida.measureText(b).width) / 100
  const v = Math.abs(k) < 0.002 ? 0 : Math.round(k * 1000) / 1000
  cacheKerning.set(chave, v)
  return v
}

/** Gradiente contínuo: cada [data-seg] pinta o gradiente do bloco inteiro, deslocado para a sua posição. */
function useGradienteContinuo(ref: RefObject<HTMLElement | null>, gradiente: string | undefined, deps: unknown[]) {
  useEfeitoLayout(() => {
    const el = ref.current
    if (!gradiente || !el) return
    const medir = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      el.querySelectorAll<HTMLElement>('[data-seg]').forEach((p) => {
        p.style.backgroundSize = `${w}px ${h}px`
        p.style.backgroundPosition = `${el.offsetLeft - p.offsetLeft}px ${el.offsetTop - p.offsetTop}px`
      })
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    void document.fonts?.ready.then(medir)
    return () => ro?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradiente, ...deps])
}

const pinturaDe = (gradiente?: string): CSSProperties | undefined => (gradiente ? { backgroundImage: gradiente, backgroundRepeat: 'no-repeat', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' } : undefined)

/** Progresso (0–1, linear no tempo) da 1ª animação CSS de um elemento; null = sem animação (movimento reduzido). */
function progressoCss(el: Element): number | null {
  const a = el.getAnimations?.()[0]
  if (!a) return null
  const p = a.effect?.getComputedTiming().progress
  return typeof p === 'number' ? p : 0
}
/** A animação do elemento está pausada (tela de carregamento, Story fora da janela, miniatura congelada)? */
const pausada = (el: Element) => el.getAnimations?.()[0]?.playState === 'paused'

/**
 * Texto animado (camadas de texto). Divide em linhas, palavras ou letras e anima cada parte, ou desenha
 * contador / destaque / sublinhado.
 * - Acessibilidade e copiar/colar: as partes visíveis são aria-hidden (o leitor de tela não soletra); o texto
 *   completo para o leitor vem de um conteúdo gerado (::before), que não entra na seleção nem no innerText —
 *   copiar o texto dá exatamente o que se vê, sem duplicar.
 * - Gradiente: cada parte pinta o MESMO gradiente do bloco inteiro, deslocado para a sua posição.
 * - Letra por letra: cada letra é inline-block (para mover), o que perde o kerning da fonte; ele é medido no
 *   canvas e devolvido como margem, então o espaçamento fica igual ao do texto parado.
 * - Linha por linha: mede onde o navegador quebrou as linhas (antes de pintar) e anima cada linha renderizada.
 */
export function TextoSegmentado({ texto, animacao, gradiente, cor }: { texto: string; animacao: Animacao; gradiente?: string; cor?: string }) {
  if (animacao.type === 'counter') return <TextoContador texto={texto} animacao={animacao} gradiente={gradiente} />
  if (animacao.type === 'highlight' || animacao.type === 'underline') return <TextoMarcado texto={texto} animacao={animacao} gradiente={gradiente} cor={cor} />
  // a chave refaz a medição das linhas quando o texto ou a divisão mudam
  return <TextoDividido key={`${divisao(animacao)}|${texto}`} texto={texto} animacao={animacao} gradiente={gradiente} cor={cor} />
}

function TextoDividido({ texto, animacao, gradiente, cor }: { texto: string; animacao: Animacao; gradiente?: string; cor?: string }) {
  const unidade = divisao(animacao) ?? 'word'
  const porLinha = unidade === 'line'
  const { palavras, total } = useMemo(() => dividirTexto(texto, unidade === 'letter' ? 'letra' : 'palavra'), [texto, unidade])
  const ref = useRef<HTMLSpanElement>(null)
  const [linhas, setLinhas] = useState<string[] | null>(null)
  const [kerns, setKerns] = useState<Record<number, number>>({})
  const maquina = animacao.type === 'typewriter'
  const embaralhar = animacao.type === 'scramble'
  const inline = maquina || embaralhar
  const porLetra = unidade === 'letter' && !inline
  const mascara = animacao.type === 'lines'

  // linhas renderizadas: mede o topo de cada palavra antes de pintar e reagrupa; refaz se a largura mudar
  useEfeitoLayout(() => {
    if (!porLinha) return
    const el = ref.current
    if (!el) return
    if (linhas === null) {
      const spans = [...el.querySelectorAll<HTMLElement>('[data-palavra]')]
      const grupos = agruparLinhas(spans.map((s) => s.offsetTop))
      const todas = palavras.filter((p) => p.partes.length)
      const res: string[] = []
      for (const g of grupos) {
        res.push(g.map((i, k) => (todas[i]?.partes[0]?.texto ?? '') + (k < g.length - 1 ? (todas[i]?.separador ?? ' ') : '')).join(''))
        // linhas em branco ("\n\n") viram linhas vazias
        const sep = todas[g[g.length - 1]!]?.separador ?? ''
        for (let n = (sep.match(/\n/g)?.length ?? 0) - 1; n > 0; n--) res.push('')
      }
      setLinhas(res)
      return
    }
    let largura = el.offsetWidth
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (Math.abs(el.offsetWidth - largura) > 1) { largura = el.offsetWidth; setLinhas(null) } }) : null
    ro?.observe(el)
    if (document.fonts?.status === 'loading') void document.fonts.ready.then(() => setLinhas(null))
    return () => ro?.disconnect()
  }, [porLinha, linhas, palavras])

  const n = porLinha ? (linhas?.length ?? 0) : total
  const posicoes = useMemo(() => ordemDasPartes(n, parametros(animacao).order, texto), [n, animacao, texto])
  const { duracaoParte, passo } = tempoSegmentos(animacao.type, passosDaOrdem(posicoes), animacao.duration, animacao.stagger)
  const curva = inline ? 'linear' : curvaCss(animacao)
  const keyframe = keyframeDaParte(animacao)
  const ultima = posicoes.length ? posicoes.indexOf(Math.max(...posicoes)) : -1

  // kerning (só letra por letra): pares dentro da mesma palavra, com a fonte já carregada
  useEffect(() => {
    const el = ref.current
    if (!porLetra || !el) return setKerns({})
    let ativo = true
    const cs = getComputedStyle(el)
    const fonte = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`
    const caixa = (t: string) => (cs.textTransform === 'uppercase' ? t.toLocaleUpperCase('pt-BR') : cs.textTransform === 'lowercase' ? t.toLocaleLowerCase('pt-BR') : t)
    const calcular = () => {
      if (!ativo) return
      const k: Record<number, number> = {}
      for (const p of palavras) for (let i = 0; i < p.partes.length - 1; i++) {
        const v = kerning(fonte, caixa(p.partes[i]!.texto), caixa(p.partes[i + 1]!.texto))
        if (v) k[p.partes[i]!.indice] = v
      }
      setKerns(k)
    }
    if (document.fonts?.load) void document.fonts.load(fonte).then(calcular, calcular)
    else calcular()
    return () => { ativo = false }
  }, [porLetra, palavras])

  // decodificar: sorteia caracteres enquanto a parte está ativa (relógio = animação CSS da própria parte)
  useEffect(() => {
    const el = ref.current
    if (!embaralhar || !el) return
    const spans = [...el.querySelectorAll<HTMLElement>('[data-scr]')]
    let raf = 0
    let espera = 0
    let quadro = 0
    const sorteio = (ch: string) => {
      const base = /\d/.test(ch) ? '0123456789' : ch === ch.toLowerCase() && ch !== ch.toUpperCase() ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=?'
      return base[Math.floor(Math.random() * base.length)]!
    }
    const quadroScr = () => {
      quadro++
      let pendentes = 0
      let algumaAtiva = false
      for (const s of spans) {
        const p = progressoCss(s)
        if (p === null || p >= 1) { if (s.hasAttribute('data-g')) s.removeAttribute('data-g'); continue }
        pendentes++
        if (p > 0 && !pausada(s)) {
          algumaAtiva = true
          if (quadro % 3 === 0 || !s.hasAttribute('data-g')) s.setAttribute('data-g', sorteio(s.dataset.scr ?? 'A'))
        } else if (!s.hasAttribute('data-g')) s.setAttribute('data-g', sorteio(s.dataset.scr ?? 'A'))
      }
      if (!pendentes) return
      // tudo esperando (pausado/atraso): checa de vez em quando em vez de a cada quadro
      if (algumaAtiva) raf = requestAnimationFrame(quadroScr)
      else espera = window.setTimeout(() => { raf = requestAnimationFrame(quadroScr) }, 100)
    }
    raf = requestAnimationFrame(quadroScr)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(espera) }
  }, [embaralhar, palavras, animacao])

  useGradienteContinuo(ref, gradiente, [palavras, kerns, linhas])

  const pintura = pinturaDe(gradiente)
  const estiloParte = (indice: number): CSSProperties => {
    const t = Math.round(animacao.delay + (posicoes[indice] ?? indice) * passo)
    const dp = Math.round(duracaoParte)
    if (maquina) {
      // cursor: aparece na letra atual e pisca algumas vezes na última
      const fim = indice === ultima
      return {
        ...pintura,
        ['--cursor-cor' as string]: cor,
        animationName: `seg-typewriter, seg-cursor${fim ? ', seg-cursor-piscar' : ''}`,
        animationDuration: `${dp}ms, ${Math.max(16, Math.round(passo))}ms${fim ? ', 1000ms' : ''}`,
        animationDelay: `${t}ms, ${t}ms${fim ? `, ${t + Math.round(passo)}ms` : ''}`,
        animationTimingFunction: `linear, linear${fim ? ', linear' : ''}`,
        animationIterationCount: `1, 1${fim ? ', 4' : ''}`,
        animationFillMode: `both, none${fim ? ', none' : ''}`,
      }
    }
    return { ...pintura, ...(embaralhar ? { ['--scr-cor' as string]: cor } : {}), marginRight: kerns[indice] ? `${kerns[indice]}em` : undefined, animationName: keyframe, animationDuration: `${dp}ms`, animationDelay: `${t}ms`, animationTimingFunction: curva }
  }
  const parte = (s: { texto: string; indice: number }) => (
    <span key={s.indice} data-seg="" data-scr={embaralhar ? s.texto : undefined} className={inline ? `seg-texto-linha${embaralhar ? ' seg-scramble' : ''}` : 'seg-texto'} style={estiloParte(s.indice)}>
      {s.texto}
    </span>
  )

  let conteudo: ReactNode
  if (porLinha) {
    conteudo = linhas === null
      ? palavras.map((p, i) => <Fragment key={i}>{p.partes.map((s) => <span key={s.indice} data-palavra="">{s.texto}</span>)}{p.separador}</Fragment>)
      : linhas.map((l, i) => (
          <span key={`${i}-${l}`} className={`seg-linha-caixa${mascara ? ' com-mascara' : ''}`}>
            <span data-seg="" className="seg-texto" style={estiloParte(i)}>{l || ' '}</span>
          </span>
        ))
  } else {
    conteudo = palavras.map((p, i) => (
      <Fragment key={i}>
        {porLetra ? <span className="seg-palavra">{p.partes.map(parte)}</span> : p.partes.map(parte)}
        {p.separador}
      </Fragment>
    ))
  }
  return (
    <>
      <span className="texto-acessivel" data-texto={texto} />
      <span ref={ref} aria-hidden>{conteudo}</span>
    </>
  )
}

/**
 * Contador: o primeiro número do texto conta de 0 até o valor (mantém prefixo, sufixo, casas decimais e o
 * separador de milhar — "R$ 2,4 mi", "1.250", "38%"). Prefixo e sufixo entram juntos no fim (incremento
 * segmentado). A curva da camada vale (com mola, o número passa do valor e volta).
 */
function TextoContador({ texto, animacao, gradiente }: { texto: string; animacao: Animacao; gradiente?: string }) {
  const info = useMemo(() => analisarNumero(texto), [texto])
  const ref = useRef<HTMLSpanElement>(null)
  const numero = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    const alvo = numero.current
    if (!el || !alvo || !info) return
    const pontos = pontosDaCurva(animacao)
    const semPrefixo = { ...info, prefixo: '', sufixo: '' }
    let raf = 0
    let espera = 0
    const passo = () => {
      const p = progressoCss(el)
      if (p === null || p >= 1) { alvo.textContent = formatarNumero(semPrefixo, info.valor); return }
      alvo.textContent = formatarNumero(semPrefixo, info.valor * curvaBezier(p, pontos))
      if (p > 0 && !pausada(el)) raf = requestAnimationFrame(passo)
      else espera = window.setTimeout(() => { raf = requestAnimationFrame(passo) }, 100)
    }
    raf = requestAnimationFrame(passo)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(espera) }
  }, [info, animacao])
  useGradienteContinuo(ref, gradiente, [info])
  const pintura = pinturaDe(gradiente)
  const relogio: CSSProperties = { animationName: 'seg-contador', animationDuration: `${animacao.duration}ms`, animationDelay: `${animacao.delay}ms`, animationTimingFunction: 'linear' }
  // prefixo/sufixo: entram no último terço, junto com o número chegando
  const extra: CSSProperties = { display: 'inline-block', animationName: 'seg-mov', animationDuration: `${Math.round(animacao.duration * 0.35)}ms`, animationDelay: `${animacao.delay + Math.round(animacao.duration * 0.55)}ms`, animationTimingFunction: curvaCss({ easing: 'easeOut' }), animationFillMode: 'both', whiteSpace: 'pre', ['--seg-dy' as string]: '.2em' }
  return (
    <>
      <span className="texto-acessivel" data-texto={texto} />
      <span ref={ref} aria-hidden className="seg-contador" style={relogio}>
        {info ? (
          <>
            {info.prefixo && <span data-seg="" style={{ ...extra, ...pintura }}>{info.prefixo}</span>}
            <span ref={numero} data-seg="" style={pintura}>{formatarNumero({ ...info, prefixo: '', sufixo: '' }, 0)}</span>
            {info.sufixo && <span data-seg="" style={{ ...extra, ...pintura }}>{info.sufixo}</span>}
          </>
        ) : <span data-seg="" style={pintura}>{texto}</span>}
      </span>
    </>
  )
}

/** Destaque (marca-texto) e sublinhado desenhado: o marcador corre por trás das palavras escolhidas. */
function TextoMarcado({ texto, animacao, gradiente, cor }: { texto: string; animacao: Animacao; gradiente?: string; cor?: string }) {
  const { palavras, total } = useMemo(() => dividirTexto(texto, 'palavra'), [texto])
  const ref = useRef<HTMLSpanElement>(null)
  useGradienteContinuo(ref, gradiente, [palavras])
  const [a0, a1] = animacao.range ?? [0, Math.max(0, total - 1)]
  const ini = Math.min(a0, a1, Math.max(0, total - 1))
  const fim = Math.min(Math.max(a0, a1), Math.max(0, total - 1))
  const destaque = animacao.type === 'highlight'
  const marcaCor = animacao.color ?? (destaque ? '#FFD60A8C' : cor ?? 'currentColor')
  const pintura = pinturaDe(gradiente)
  const antes: ReactNode[] = []
  const dentro: ReactNode[] = []
  const depois: ReactNode[] = []
  palavras.forEach((p, i) => {
    const s = p.partes[0]
    const sep = <Fragment key={`s${i}`}>{p.separador}</Fragment>
    if (!s) return void antes.push(sep) // espaço antes da primeira palavra
    const alvo = s.indice < ini ? antes : s.indice > fim ? depois : dentro
    alvo.push(<span key={i} data-seg="" style={pintura}>{s.texto}</span>)
    // o espaço depois da última palavra marcada fica fora da marca
    ;(s.indice >= ini && s.indice < fim ? dentro : s.indice < ini ? antes : depois).push(sep)
  })
  const marca: CSSProperties = {
    ['--marca-cor' as string]: marcaCor,
    ['--marca-h' as string]: destaque ? '.42em' : '.07em',
    ['--marca-y' as string]: destaque ? '86%' : '94%',
    animationName: 'seg-marca',
    animationDuration: `${animacao.duration}ms`,
    animationDelay: `${animacao.delay}ms`,
    animationTimingFunction: curvaCss(animacao),
  }
  return (
    <>
      <span className="texto-acessivel" data-texto={texto} />
      <span ref={ref} aria-hidden>
        {antes}
        <span className="seg-marca" style={marca}>{dentro}</span>
        {depois}
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
