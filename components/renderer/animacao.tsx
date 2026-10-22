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
import type { Animacao, Cena, Transicao } from '@/lib/scene/schema'
import { curvaCss, dividirTexto, pontosDaCurva, tempoSegmentos } from '@/lib/scene/animacoes'
import { divisao, keyframeDaParte, parametros, quadrosDasPartes, quadrosNoCiclo } from '@/lib/scene/parametros'
import { agruparLetras, agruparLinhas, analisarNumero, curvaBezier, formatarNumero, ordemDasPartes, quadrosCursor, passosDaOrdem } from '@/lib/scene/texto-animado'

export { keyframesSeparados, planoAnimacao, varsAnimacao, type PlanoAnimacao } from './plano'

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
      // lê tudo antes de escrever: ler offsetLeft depois de uma escrita forçava um layout por parte
      const partes = [...el.querySelectorAll<HTMLElement>('[data-seg]')]
      const pos = partes.map((p) => `${el.offsetLeft - p.offsetLeft}px ${el.offsetTop - p.offsetTop}px`)
      partes.forEach((p, i) => {
        p.style.backgroundSize = `${w}px ${h}px`
        p.style.backgroundPosition = pos[i]!
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

/**
 * Solta a animação de uma parte do texto quando ela termina (`data-fim` → `animation: none` no CSS): o último
 * quadro de toda entrada de texto é o estilo parado da parte. Sem isso, cada letra/palavra terminada com
 * `fill-mode: both` continuava uma camada composta (300 letras = 300 camadas) e todo quadro que repinta
 * pagava por elas. O cursor da máquina de escrever, que termina invisível, some.
 */
export function soltarParte(e: React.AnimationEvent) {
  const el = e.target as HTMLElement
  if (el.hasAttribute('data-fim') || !el.matches('[data-seg], .seg-marca:not(.anim-rolagem), .seg-contador, .seg-cursor, .seg-progresso-anim')) return
  el.setAttribute('data-fim', '')
}

/** A página pede movimento reduzido (rede de segurança no editor; o visualizador já adapta as animações). */
export const movimentoReduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Espera das animações (tela de carregamento, seção do Story fora da janela, câmera do Explorar voando): a classe
 * `.animacoes-em-espera` num ancestral pausa as animações CSS no 1º quadro; as da Web Animations API seguem o
 * mesmo sinal. Chama `aoLiberar` quando o ancestral perde a classe (ou na hora, se não houver espera) e devolve
 * o cancelamento. Um MutationObserver no ancestral, sem nada por quadro.
 */
export function quandoLiberar(el: Element, aoLiberar: () => void): () => void {
  const espera = el.closest('.animacoes-em-espera')
  if (!espera) {
    aoLiberar()
    return () => {}
  }
  const mo = new MutationObserver(() => {
    if (espera.classList.contains('animacoes-em-espera')) return
    mo.disconnect()
    aoLiberar()
  })
  mo.observe(espera, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

/** Quanto antes do início cada parte do texto ganha a sua animação (um pouco mais que um quadro). */
const ANTECEDENCIA_MS = 40

/**
 * Estado de espera das partes (o 1º quadro de cada conjunto de keyframes) como variáveis CSS do bloco: a regra
 * `[data-seg][data-espera]` aplica a todas as partes que ainda não começaram. Desfoque só com opacidade
 * inicial acima de zero (invisível, ele não muda nada e custaria um filtro por parte).
 */
function estadoDeEspera(quadros: Keyframe[][]): CSSProperties {
  const de: Record<string, unknown> = Object.assign({}, ...quadros.map((q) => q[0] ?? {}))
  const v: Record<string, string> = {}
  if (de.opacity !== undefined) v['--seg-de-op'] = String(de.opacity)
  if (de.transform !== undefined) v['--seg-de-tf'] = String(de.transform)
  if (de.visibility !== undefined) v['--seg-de-vis'] = String(de.visibility)
  if (de.filter !== undefined && Number(de.opacity ?? 1) > 0) v['--seg-de-filtro'] = String(de.filter)
  return v as CSSProperties
}

/** Decodificar: quantas letras trocam de caractere sorteado por quadro, no máximo. */
const SORTEIOS_POR_QUADRO = 24
/** Decodificar: duração da marca de início de cada letra (a letra aparece; o sorteio segue o relógio do quadro). */
const MARCA_INICIO_MS = 20

const pinturaDe = (gradiente?: string): CSSProperties | undefined => (gradiente ? { backgroundImage: gradiente, backgroundRepeat: 'no-repeat', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' } : undefined)

/**
 * Relógio do contador e do decodificar. A animação CSS da parte continua sendo o relógio (atraso, pausa da tela
 * de carregamento/Story/Explorar e prévia valem igual), mas ela só é CONSULTADA na montagem: `getAnimations()`,
 * `playState` e `getComputedTiming()` forçam o recálculo de estilo da página quando há algo pendente, e
 * consultá-los a cada quadro (intercalados com escritas no DOM) recalculava o estilo uma vez por letra —
 * ~240 ms por quadro com 300 letras. Depois da montagem, o andamento vem dos eventos `animationstart` /
 * `animationend` e do relógio do quadro (requestAnimationFrame).
 */
const animacaoCss = (el: Element): Animation | null => el.getAnimations?.()[0] ?? null
/** Progresso (0–1, linear no tempo) de uma animação CSS; null = sem animação (movimento reduzido) ou substituída. */
function progressoCss(a: Animation | null): number | null {
  if (!a || a.playState === 'idle') return null
  const p = a.effect?.getComputedTiming().progress
  return typeof p === 'number' ? p : a.playState === 'finished' ? 1 : 0
}

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
export function TextoSegmentado({ texto, animacao, gradiente, cor, caixa, rolagem }: { texto: string; animacao: Animacao; gradiente?: string; cor?: string; caixa?: { width: number; height: number }; rolagem?: string }) {
  if (animacao.type === 'counter') return <TextoContador texto={texto} animacao={animacao} gradiente={gradiente} cor={cor} caixa={caixa} />
  if (animacao.type === 'highlight' || animacao.type === 'underline') return <TextoMarcado texto={texto} animacao={animacao} gradiente={gradiente} cor={cor} rolagem={rolagem} />
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
  const keyframe = keyframeDaParte(animacao, n)

  // letra por letra leve: com muitas letras por quadro, texto longo ou desfoque, as partes viram palavras (ver
  // agruparLetras); o tempo de cada palavra é o da sua primeira letra
  const ajustes = parametros(animacao)
  const agrupado = porLetra && agruparLetras({ total, passo, ordem: ajustes.order, giraOuEscala: ajustes.rotate !== 0 || ajustes.scale !== 1, desfoque: keyframe === 'seg-movBlur' })
  const letraALetra = porLetra && !agrupado

  // kerning (só letra por letra): pares dentro da mesma palavra. Com a fonte já carregada (o visualizador espera
  // as fontes), mede antes de pintar: o 2º render não cai no meio da entrada, com centenas de partes animando.
  useEfeitoLayout(() => {
    const el = ref.current
    if (!letraALetra || !el) return setKerns((k) => (Object.keys(k).length ? {} : k))
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
    if (!document.fonts?.load || document.fonts.check(fonte)) calcular()
    else void document.fonts.load(fonte).then(calcular, calcular)
    return () => { ativo = false }
  }, [letraALetra, palavras])

  // Partes animadas pela Web Animations API (keyframes resolvidos, um conjunto para todas): sem eventos de
  // animação por parte e fora do recálculo das animações CSS. Início escalonado: cada parte só ganha a sua
  // animação ~um quadro antes de começar (com o relógio de todas, `startTime` comum, o tempo é exato) e a perde
  // quando termina (sem preenchimento para a frente: volta ao estilo parado, que é o último quadro). Até lá ela
  // espera no 1º quadro por CSS (`data-espera` + variáveis `--seg-de-*`), sem camada própria. Antes TODAS as
  // partes viravam camadas compostas desde o início (inclusive as que esperavam o atraso) e cada quadro refazia
  // a composição de ~100 camadas; agora só as que estão em movimento. Com "repetir", cada parte anima dentro do
  // ciclo da entrada inteira (a sequência toda repete).
  const quadros = useMemo(() => quadrosDasPartes(animacao, n), [animacao, n])
  const assinatura = JSON.stringify(quadros)
  const repetir = inline ? 1 : Math.max(1, animacao.repeat ?? 1)
  const espera = useMemo(() => estadoDeEspera(quadros), [quadros])
  useEfeitoLayout(() => {
    const el = ref.current
    if (!el || (porLinha && linhas === null)) return
    const partes = [...el.querySelectorAll<HTMLElement>('[data-seg]')]
    if (movimentoReduzido() || typeof el.animate !== 'function') {
      partes.forEach((p) => p.removeAttribute('data-espera'))
      return
    }
    const conjuntos = JSON.parse(assinatura) as Keyframe[][]
    const criar = (p: HTMLElement, inicio?: number): Animation[] => {
      const t = Number(p.dataset.t ?? 0)
      const d = Math.max(1, Number(p.dataset.d ?? 0))
      p.removeAttribute('data-espera')
      return conjuntos.map((q) => {
        const a = repetir > 1
          ? p.animate(quadrosNoCiclo(q, (t - animacao.delay) / animacao.duration, d / animacao.duration, curva), { duration: animacao.duration, delay: animacao.delay, iterations: repetir, easing: 'linear', fill: 'backwards' })
          : p.animate(q, { duration: d, delay: t, easing: curva, fill: 'backwards' })
        if (inicio !== undefined) a.startTime = inicio
        return a
      })
    }
    // miniatura congelada da galeria: todas de uma vez (ela pausa e posiciona todas num instante)
    if (el.closest('[data-congelada]')) {
      const todas = partes.flatMap((p) => criar(p))
      return () => todas.forEach((a) => a.cancel())
    }
    const fila = partes.map((p) => ({ p, t: Number(p.dataset.t ?? 0) })).sort((a, b) => a.t - b.t)
    const vivas: Animation[] = []
    let inicio = 0
    let prox = 0
    let raf = 0
    // máquina de escrever e decodificar: a letra só aparece (sem movimento) — basta tirar a espera no quadro em que
    // ela começa; nenhuma animação por letra (o cursor, uma animação só, segue o mesmo relógio)
    const seca = inline
    const tique = () => {
      const agora = Number(document.timeline.currentTime ?? performance.now())
      if (seca) while (prox < fila.length && inicio + fila[prox]!.t <= agora) fila[prox++]!.p.removeAttribute('data-espera')
      else while (prox < fila.length && inicio + fila[prox]!.t - ANTECEDENCIA_MS <= agora) vivas.push(...criar(fila[prox++]!.p, inicio))
      raf = prox < fila.length ? requestAnimationFrame(tique) : 0
    }
    const parar = quandoLiberar(el, () => {
      inicio = Number(document.timeline.currentTime ?? performance.now())
      tique()
    })
    return () => {
      parar()
      cancelAnimationFrame(raf)
      vivas.forEach((a) => a.cancel())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, linhas, palavras, porLinha, repetir, curva, animacao.delay, animacao.duration, duracaoParte, passo])

  // decodificar: sorteia caracteres enquanto a parte está ativa. A janela de cada parte vem da agenda dela
  // (data-t/data-dur) contada a partir da liberação da tela; por quadro só há escritas, nenhuma leitura.
  useEfeitoLayout(() => {
    const el = ref.current
    if (!embaralhar || !el || movimentoReduzido()) return
    const sortear = (s: HTMLElement) => {
      // sorteia entre caracteres de largura parecida (sem m/w/j/q…): o sorteado fica por cima da letra real
      // e não invade as vizinhas
      const ch = s.dataset.scr ?? 'A'
      const base = /\d/.test(ch) ? '0123456789' : ch === ch.toLowerCase() && ch !== ch.toUpperCase() ? 'aceonsuvxz' : 'ABCDEHKNPRSUVXYZ#*+='
      const glifo = s.lastElementChild as HTMLElement | null
      if (glifo) glifo.textContent = base[Math.floor(Math.random() * base.length)]!
      if (!s.hasAttribute('data-g')) s.setAttribute('data-g', '')
    }
    const limpar = (s: HTMLElement) => { s.removeAttribute('data-g'); const g = s.lastElementChild; if (g) g.textContent = '' }
    // na montagem, as partes já ficam com um caractere sorteado (invisível até a parte aparecer; a miniatura
    // congelada da galeria mostra o sorteio parado)
    const partes = [...el.querySelectorAll<HTMLElement>('[data-scr]')]
    partes.forEach(sortear)
    if (el.closest('[data-congelada]')) return
    // agenda: quando cada letra começa a sortear e por quanto tempo (desde a liberação da tela)
    const janelas = partes.map((p) => ({ p, t: Number(p.dataset.t ?? 0), d: Number(p.dataset.dur ?? 0) })).sort((a, b) => a.t - b.t)
    // letra ativa → quando o sorteio dela termina (relógio do quadro)
    const ativas = new Map<HTMLElement, number>()
    let raf = 0
    let vez = 0
    let quadro = 0
    let inicio = 0
    let prox = 0
    const tique = (agora: number) => {
      while (prox < janelas.length && inicio + janelas[prox]!.t <= agora) {
        const j = janelas[prox++]!
        ativas.set(j.p, inicio + j.t + j.d)
      }
      ativas.forEach((fim, s) => { if (agora >= fim) { ativas.delete(s); limpar(s) } })
      // cada letra troca a cada 3 quadros (~20 por segundo), um terço das letras por quadro (custo igual em todo
      // quadro, sem picos), no máximo SORTEIOS_POR_QUADRO: cada troca refaz o layout da linha, e num parágrafo
      // longo as letras de trás passam a trocar mais devagar em vez de travar a animação inteira
      const lista = [...ativas.keys()]
      // muitas letras ao mesmo tempo (parágrafo): troca em quadros alternados — cada troca refaz o layout do
      // parágrafo inteiro, então o que pesa é quantas vezes por segundo, não quantas letras
      if (lista.length <= SORTEIOS_POR_QUADRO || ++quadro % 2 === 0) {
        const k = Math.min(lista.length, Math.max(1, Math.ceil(lista.length / 3)), SORTEIOS_POR_QUADRO)
        for (let i = 0; i < k; i++) sortear(lista[(vez + i) % lista.length]!)
        vez = lista.length ? (vez + k) % lista.length : 0
      }
      raf = ativas.size || prox < janelas.length ? requestAnimationFrame(tique) : 0
    }
    const parar = quandoLiberar(el, () => {
      inicio = performance.now()
      raf = requestAnimationFrame(tique)
    })
    return () => {
      parar()
      cancelAnimationFrame(raf)
    }
  }, [embaralhar, palavras, passo, duracaoParte, animacao.delay])

  // máquina de escrever: UM cursor que salta de letra em letra. Mede o canto de cada letra antes de pintar (e de
  // novo se a caixa mudar de largura ou a fonte chegar) e gera os keyframes dele.
  const [cantos, setCantos] = useState<{ x: number; y: number; h: number }[] | null>(null)
  useEfeitoLayout(() => {
    const el = ref.current
    if (!maquina || !el) return
    const medir = () => {
      const novos = [...el.querySelectorAll<HTMLElement>('[data-seg]')].map((p) => ({ x: p.offsetLeft + p.offsetWidth, y: p.offsetTop, h: p.offsetHeight }))
      setCantos((atual) => (atual && atual.length === novos.length && atual.every((c, i) => c.x === novos[i]!.x && c.y === novos[i]!.y && c.h === novos[i]!.h) ? atual : novos))
    }
    medir()
    // partes inline não têm caixa própria para o ResizeObserver: observa o bloco do texto
    const bloco = el.parentElement
    const ro = bloco && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    if (bloco) ro?.observe(bloco)
    if (document.fonts?.status === 'loading') void document.fonts.ready.then(medir)
    return () => ro?.disconnect()
  }, [maquina, palavras])
  // o cursor existe desde o 1º render (com a posição medida logo depois, antes de pintar): quem congela as
  // animações na montagem (miniaturas da galeria) congela o cursor junto com as letras. Anima pela Web Animations
  // API, no relógio das letras (mesmo início); um <style> com @keyframes invalidava o estilo da página inteira.
  const cursor = useMemo(() => (maquina && posicoes.length ? quadrosCursor(cantos ?? posicoes.map(() => ({ x: 0, y: 0 })), posicoes.map((p) => p * passo), passo) : null), [maquina, posicoes, cantos, passo])
  const refCursor = useRef<HTMLSpanElement>(null)
  const inicioCursor = useRef<number | null>(null)
  useEfeitoLayout(() => {
    const c = refCursor.current
    if (!c || !cursor || movimentoReduzido() || typeof c.animate !== 'function') return
    const a = c.animate(cursor.quadros, { duration: cursor.duracao, delay: animacao.delay, fill: 'both' })
    let vivo = true
    // termina invisível: sai da página (display: none), sem animação presa
    a.finished.then(() => { if (vivo) c.setAttribute('data-fim', '') }, () => undefined)
    const fim = () => { vivo = false; a.cancel() }
    if (c.closest('[data-congelada]')) return fim
    if (inicioCursor.current !== null) {
      a.startTime = inicioCursor.current
      return fim
    }
    a.pause()
    const parar = quandoLiberar(c, () => {
      inicioCursor.current = Number(document.timeline.currentTime ?? performance.now())
      a.startTime = inicioCursor.current
    })
    return () => { parar(); fim() }
  }, [cursor, animacao.delay])

  useGradienteContinuo(ref, gradiente, [palavras, kerns, linhas])

  const pintura = pinturaDe(gradiente)
  /**
   * Agenda da parte no DOM (data-t: início desde o começo da camada, com o atraso; data-d: duração), lida uma vez
   * pelo efeito que cria as animações. Decodificar: a animação só marca o início (a letra aparece) — com a duração
   * toda, as letras se sobrepõem quase inteiras e um parágrafo recalculava 300 letras por quadro; o sorteio dura
   * `data-dur` a partir dele. Máquina de escrever: a letra só aparece (o cursor é um elemento só).
   */
  const agenda = (posicao: number) => {
    const dp = Math.round(duracaoParte)
    return { 'data-t': Math.round(animacao.delay + posicao * passo), 'data-d': maquina ? dp : embaralhar ? Math.min(dp, MARCA_INICIO_MS) : dp }
  }
  const estiloParte = (indice: number): CSSProperties | undefined => {
    if (maquina) return pintura
    return { ...pintura, ...(embaralhar ? { ['--scr-cor' as string]: cor } : {}), marginRight: kerns[indice] ? `${kerns[indice]}em` : undefined }
  }
  const parte = (s: { texto: string; indice: number }) => (
    <span key={s.indice} data-seg="" data-espera="" {...agenda(posicoes[s.indice] ?? s.indice)} data-scr={embaralhar ? s.texto : undefined} data-dur={embaralhar ? Math.round(duracaoParte) : undefined} className={inline ? `seg-texto-linha${embaralhar ? ' seg-scramble' : ''}` : 'seg-texto'} style={estiloParte(s.indice)}>
      {s.texto}
      {embaralhar && <span className="seg-glifo" />}
    </span>
  )

  let conteudo: ReactNode
  if (porLinha) {
    conteudo = linhas === null
      ? palavras.map((p, i) => <Fragment key={i}>{p.partes.map((s) => <span key={s.indice} data-palavra="">{s.texto}</span>)}{p.separador}</Fragment>)
      : linhas.map((l, i) => (
          <span key={`${i}-${l}`} className={`seg-linha-caixa${mascara ? ' com-mascara' : ''}`}>
            <span data-seg="" data-espera="" {...agenda(posicoes[i] ?? i)} className="seg-texto" style={estiloParte(i)}>{l || ' '}</span>
          </span>
        ))
  } else if (agrupado) {
    // uma parte por palavra, no tempo da primeira letra dela
    conteudo = palavras.map((p, i) => (
      <Fragment key={i}>
        {p.partes.length > 0 && (
          <span data-seg="" data-espera="" {...agenda(Math.min(...p.partes.map((s) => posicoes[s.indice] ?? s.indice)))} className="seg-texto" style={estiloParte(p.partes[0]!.indice)}>
            {p.partes.map((s) => s.texto).join('')}
          </span>
        )}
        {p.separador}
      </Fragment>
    ))
  } else {
    conteudo = palavras.map((p, i) => (
      <Fragment key={i}>
        {letraALetra ? <span className="seg-palavra">{p.partes.map(parte)}</span> : p.partes.map(parte)}
        {p.separador}
      </Fragment>
    ))
  }
  return (
    <>
      <span className="texto-acessivel" data-texto={texto} />
      <span ref={ref} aria-hidden onAnimationEnd={soltarParte} style={espera}>
        {conteudo}
        {cursor && <span ref={refCursor} className="seg-cursor" style={{ height: cantos?.[0]?.h ?? 0, ['--cursor-cor' as string]: cor }} />}
      </span>
    </>
  )
}

/**
 * Contador: o primeiro número do texto conta de 0 até o valor (mantém prefixo, sufixo, casas decimais e o
 * separador de milhar — "R$ 2,4 mi", "1.250", "38%"). Prefixo e sufixo entram juntos no fim (incremento
 * segmentado). A curva da camada vale (com mola, o número passa do valor e volta).
 */
function TextoContador({ texto, animacao, gradiente, cor, caixa }: { texto: string; animacao: Animacao; gradiente?: string; cor?: string; caixa?: { width: number; height: number } }) {
  const info = useMemo(() => analisarNumero(texto), [texto])
  const vezes = Math.max(1, animacao.repeat ?? 1)
  const ref = useRef<HTMLSpanElement>(null)
  const numero = useRef<HTMLSpanElement>(null)
  const curva = curvaCss(animacao)
  const duracao = animacao.duration
  // o número acompanha o relógio (animação CSS do contêiner): começa no `animationstart` (depois do atraso, e só
  // quando a tela deixa de esperar) e segue o tempo do quadro; nenhuma consulta ao estilo por quadro
  useEfeitoLayout(() => {
    const el = ref.current
    const alvo = numero.current
    if (!el || !alvo || !info) return
    const pontos = pontosDaCurva(animacao)
    const semPrefixo = { ...info, prefixo: '', sufixo: '' }
    let raf = 0
    let inicio = 0
    let ultimo = alvo.textContent ?? ''
    const escrever = (p: number) => {
      const texto = formatarNumero(semPrefixo, p >= 1 ? info.valor : info.valor * curvaBezier(p, pontos))
      // só escreve quando o número muda (o mesmo texto ainda invalidaria o layout da linha)
      if (texto !== ultimo) { alvo.textContent = texto; ultimo = texto }
    }
    const tique = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - inicio) / duracao))
      escrever(p)
      raf = p < 1 ? requestAnimationFrame(tique) : 0
    }
    const correr = (desde: number) => { inicio = desde; cancelAnimationFrame(raf); raf = requestAnimationFrame(tique) }
    // estado na montagem (uma leitura): sem animação (movimento reduzido) = valor final; congelada (miniatura da
    // galeria) = o número daquele instante; remontagem no meio da contagem = continua de onde está
    const relogio = animacaoCss(el)
    const p0 = progressoCss(relogio)
    escrever(p0 ?? 1)
    if (p0 !== null && p0 > 0 && p0 < 1 && relogio?.playState === 'running') correr(performance.now() - p0 * duracao)
    const comecou = (e: AnimationEvent) => { if (e.target === el) correr(e.timeStamp - (e.elapsedTime * 1000) % duracao) }
    const acabou = (e: AnimationEvent) => { if (e.target !== el) return; cancelAnimationFrame(raf); raf = 0; escrever(1) }
    el.addEventListener('animationstart', comecou)
    // repetir: cada ciclo do relógio recomeça a contagem
    el.addEventListener('animationiteration', comecou)
    el.addEventListener('animationend', acabou)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('animationstart', comecou)
      el.removeEventListener('animationiteration', comecou)
      el.removeEventListener('animationend', acabou)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, duracao, curva])
  useGradienteContinuo(ref, gradiente, [info])
  const pintura = pinturaDe(gradiente)
  const relogio: CSSProperties = { animationName: 'seg-contador', animationDuration: `${animacao.duration}ms`, animationDelay: `${animacao.delay}ms`, animationTimingFunction: 'linear', animationIterationCount: vezes }
  // prefixo/sufixo: entram no último terço, junto com o número chegando
  const extra: CSSProperties = { display: 'inline-block', animationName: 'seg-mov', animationDuration: `${Math.round(animacao.duration * 0.35)}ms`, animationDelay: `${animacao.delay + Math.round(animacao.duration * 0.55)}ms`, animationTimingFunction: curvaCss({ easing: 'easeOut' }), animationFillMode: 'both', whiteSpace: 'pre', ['--seg-dy' as string]: '.2em' }
  return (
    <>
      <span className="texto-acessivel" data-texto={texto} />
      {animacao.progress && info && caixa && <IndicadorProgresso animacao={animacao} info={info} cor={cor} caixa={caixa} vezes={vezes} />}
      <span ref={ref} aria-hidden className="seg-contador" style={relogio} onAnimationEnd={soltarParte}>
        {info ? (
          <>
            {info.prefixo && <span data-seg="" style={{ ...extra, ...pintura }}>{info.prefixo}</span>}
            <span ref={numero} data-seg="" style={{ ...pintura, animationName: 'seg-aparece', animationDuration: `${Math.max(1, Math.round(animacao.duration * 0.12))}ms`, animationDelay: `${animacao.delay}ms`, animationTimingFunction: 'linear', animationFillMode: 'both' }}>{formatarNumero({ ...info, prefixo: '', sufixo: '' }, 0)}</span>
            {info.sufixo && <span data-seg="" style={{ ...extra, ...pintura }}>{info.sufixo}</span>}
          </>
        ) : <span data-seg="" style={pintura}>{texto}</span>}
      </span>
    </>
  )
}

/**
 * Indicador do contador: círculo em volta do número (traço que se desenha) ou barra embaixo (escala em x, na GPU),
 * no MESMO tempo, atraso e curva do número — os dois chegam juntos. O valor cheio é `progressMax` (padrão: 100
 * quando o texto tem "%", senão o próprio número). Fica dentro da caixa da camada, atrás do texto.
 */
function IndicadorProgresso({ animacao, info, cor, caixa, vezes }: { animacao: Animacao; info: NonNullable<ReturnType<typeof analisarNumero>>; cor?: string; caixa: { width: number; height: number }; vezes: number }) {
  const max = animacao.progressMax ?? (/%/.test(info.sufixo + info.prefixo) ? 100 : info.valor || 1)
  const fracao = Math.max(0, Math.min(1, info.valor / max))
  const corInd = animacao.progressColor ?? cor ?? 'currentColor'
  const tempo: CSSProperties = { animationDuration: `${animacao.duration}ms`, animationDelay: `${animacao.delay}ms`, animationTimingFunction: curvaCss(animacao), animationIterationCount: vezes }
  if (animacao.progress === 'bar') {
    const esp = animacao.progressWidth ?? Math.max(4, Math.round(caixa.height * 0.06))
    return (
      <span aria-hidden className="seg-progresso" style={{ top: 'auto', height: esp }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: esp, background: corInd, opacity: 0.16 }} />
        <span className="seg-progresso-anim" onAnimationEnd={soltarParte} style={{ position: 'absolute', inset: 0, borderRadius: esp, background: corInd, transformOrigin: 'left center', transform: `scaleX(${fracao})`, animationName: 'seg-barra', ['--barra-ate' as string]: fracao, ...tempo }} />
      </span>
    )
  }
  const lado = Math.min(caixa.width, caixa.height)
  const esp = animacao.progressWidth ?? Math.max(3, Math.round(lado * 0.05))
  const r = Math.max(1, lado / 2 - esp / 2)
  const volta = 2 * Math.PI * r
  const fim = volta * (1 - fracao)
  return (
    <svg aria-hidden className="seg-progresso" width={caixa.width} height={caixa.height} viewBox={`0 0 ${caixa.width} ${caixa.height}`}>
      <circle cx={caixa.width / 2} cy={caixa.height / 2} r={r} fill="none" stroke={corInd} strokeOpacity={0.16} strokeWidth={esp} />
      <circle className="seg-progresso-anim" onAnimationEnd={soltarParte} cx={caixa.width / 2} cy={caixa.height / 2} r={r} fill="none" stroke={corInd} strokeWidth={esp} strokeLinecap="round" strokeDasharray={`${volta} ${volta}`} strokeDashoffset={fim} transform={`rotate(-90 ${caixa.width / 2} ${caixa.height / 2})`} style={{ animationName: 'seg-anel', ['--anel-de' as string]: volta, ['--anel-ate' as string]: fim, ...tempo }} />
    </svg>
  )
}

/** Destaque (marca-texto) e sublinhado desenhado: o marcador corre por trás das palavras escolhidas. */
function TextoMarcado({ texto, animacao, gradiente, cor, rolagem }: { texto: string; animacao: Animacao; gradiente?: string; cor?: string; rolagem?: string }) {
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
    animationDuration: rolagem ? 'auto' : `${animacao.duration}ms`,
    animationDelay: rolagem ? '0ms' : `${animacao.delay}ms`,
    animationTimingFunction: curvaCss(animacao),
    animationIterationCount: rolagem ? 1 : Math.max(1, animacao.repeat ?? 1),
    // "ao rolar" (Story): o marcador acompanha a rolagem
    ...(rolagem ? ({ animationTimeline: 'view()', animationRange: rolagem } as CSSProperties) : {}),
  }
  return (
    <>
      <span className="texto-acessivel" data-texto={texto} />
      <span ref={ref} aria-hidden onAnimationEnd={soltarParte}>
        {antes}
        <span className={rolagem ? 'seg-marca anim-rolagem' : 'seg-marca'} style={marca} onAnimationEnd={rolagem ? (e) => e.stopPropagation() : undefined}>{dentro}</span>
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
  /** Toca os efeitos interativos (parallax, tilt, luz) com um ponteiro simulado. */
  interativo?: boolean
  /** performance.now() do pedido (a linha do tempo usa para o cursor). */
  inicio: number
  /** Quanto tempo a prévia fica ativa (ms). 0 = parar. */
  duracao: number
}

const EVENTO = 'mostra:previa-animacao'
let contador = 0

let fimMarca: number | undefined
/**
 * Marca a área do canvas enquanto uma prévia toca (`[data-previa-tocando]`): o CSS esconde as sobreposições
 * (seleção, alças, guias). Escrita direta no DOM, sem re-renderizar o editor; no elemento da área (e não no
 * <html>), para a troca recalcular só os filhos dela.
 */
function marcarPrevia(ms: number) {
  const area = document.querySelector('[data-testid="canvas-area"]')
  window.clearTimeout(fimMarca)
  if (!area) return
  if (!ms) return void area.removeAttribute('data-previa-tocando')
  area.setAttribute('data-previa-tocando', '')
  fimMarca = window.setTimeout(() => area.removeAttribute('data-previa-tocando'), ms + 150)
}

export function pedirPrevia(p: Omit<PedidoPrevia, 'nonce' | 'inicio'>) {
  if (typeof window === 'undefined') return
  marcarPrevia(p.duracao)
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
