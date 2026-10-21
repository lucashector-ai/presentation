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
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { Animacao, Cena, Transicao } from '@/lib/scene/schema'
import { curvaCss, dividirTexto, pontosDaCurva, tempoSegmentos } from '@/lib/scene/animacoes'
import { divisao, keyframeDaParte, parametros } from '@/lib/scene/parametros'
import { agruparLetras, agruparLinhas, analisarNumero, curvaBezier, formatarNumero, keyframesCursor, ordemDasPartes, passosDaOrdem } from '@/lib/scene/texto-animado'
import { keyframesSeparados } from './plano'

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
  if (el.hasAttribute('data-fim') || !el.matches('[data-seg], .seg-marca, .seg-contador, .seg-cursor')) return
  el.setAttribute('data-fim', '')
}

/**
 * Texto dividido: as partes são soltas TODAS JUNTAS, quando a última termina. Soltar uma a uma mudava a
 * árvore de camadas a cada quadro do escalonamento (o navegador refazia o Layerize e o Commit de tudo em
 * quadros seguidos); de uma vez, é uma mudança só, no fim.
 */
function soltarPartesJuntas(e: React.AnimationEvent) {
  const el = e.target as HTMLElement
  if (el.classList.contains('seg-cursor')) return soltarParte(e)
  if (!el.hasAttribute('data-seg') || el.hasAttribute('data-terminou')) return
  el.setAttribute('data-terminou', '')
  const raiz = e.currentTarget as HTMLElement
  if (raiz.querySelector('[data-seg]:not([data-terminou])')) return
  raiz.querySelectorAll('[data-seg]').forEach((p) => p.setAttribute('data-fim', ''))
}

/** Decodificar: quantas letras trocam de caractere sorteado por quadro, no máximo. */
const SORTEIOS_POR_QUADRO = 24
/** Decodificar: duração da animação CSS de cada letra (só marca o início; o sorteio segue o relógio do quadro). */
const MARCA_INICIO_MS = 20

/** animation-* de uma parte com uma ou mais animações (desfoque separado) no mesmo tempo. */
const tempoDasPartes = (nomes: string[], duracao: string, atraso: string, curva: string): CSSProperties => {
  const n = (v: string) => nomes.map(() => v).join(', ')
  return { animationName: nomes.join(', '), animationDuration: n(duracao), animationDelay: n(atraso), animationTimingFunction: n(curva) }
}

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

  // decodificar: sorteia caracteres enquanto a parte está ativa. Quem diz "ativa" são os eventos da animação CSS
  // da própria parte (começa depois do atraso e não corre pausada); por quadro só há escritas, nenhuma leitura.
  useEfeitoLayout(() => {
    const el = ref.current
    if (!embaralhar || !el) return
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
    // letra ativa → quando o sorteio dela termina (relógio do quadro)
    const ativas = new Map<HTMLElement, number>()
    let raf = 0
    let vez = 0
    let quadro = 0
    const tique = (agora: number) => {
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
      raf = ativas.size ? requestAnimationFrame(tique) : 0
    }
    const tocar = () => { if (!raf && ativas.size) raf = requestAnimationFrame(tique) }
    // na montagem, as partes que vão animar já ficam com um caractere sorteado (invisível até a parte aparecer; a
    // miniatura congelada da galeria mostra o sorteio). UMA consulta para o bloco inteiro: getAnimations() por
    // parte recalculava o estilo da página a cada chamada (as animações recém-criadas sujam o estilo de novo).
    const comAnimacao = new Set((el.getAnimations?.({ subtree: true }) ?? []).map((a) => (a.effect as KeyframeEffect | null)?.target))
    el.querySelectorAll<HTMLElement>('[data-scr]').forEach((s) => { if (comAnimacao.has(s) && !s.hasAttribute('data-fim')) sortear(s) })
    const comecou = (e: AnimationEvent) => {
      const s = e.target as HTMLElement
      if (!s.dataset?.scr) return
      if (!s.hasAttribute('data-g')) sortear(s)
      // miniatura congelada da galeria (pausada num instante): o sorteio fica parado, como o resto dela
      if (s.closest('[data-congelada]')) return
      ativas.set(s, e.timeStamp + Number(s.dataset.dur ?? 0))
      tocar()
    }
    const cancelou = (e: AnimationEvent) => { const s = e.target as HTMLElement; if (!s.dataset?.scr) return; ativas.delete(s); limpar(s) }
    el.addEventListener('animationstart', comecou)
    el.addEventListener('animationcancel', cancelou)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('animationstart', comecou)
      el.removeEventListener('animationcancel', cancelou)
    }
  }, [embaralhar, palavras])

  // máquina de escrever: UM cursor que salta de letra em letra. Mede o canto de cada letra antes de pintar (e de
  // novo se a caixa mudar de largura ou a fonte chegar) e gera os keyframes dele.
  const idCursor = `cursor-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
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
  // animações na montagem (miniaturas da galeria) congela o cursor junto com as letras
  const cursor = maquina && posicoes.length ? keyframesCursor(idCursor, cantos ?? posicoes.map(() => ({ x: 0, y: 0 })), posicoes.map((p) => p * passo), passo) : null

  useGradienteContinuo(ref, gradiente, [palavras, kerns, linhas])

  const pintura = pinturaDe(gradiente)
  const estiloParte = (indice: number, posicao = posicoes[indice] ?? indice): CSSProperties => {
    const t = Math.round(animacao.delay + posicao * passo)
    const dp = Math.round(duracaoParte)
    // máquina de escrever: a letra só aparece (o cursor é um elemento só, ver keyframesCursor)
    if (maquina) return { ...pintura, animationName: 'seg-typewriter', animationDuration: `${dp}ms`, animationDelay: `${t}ms`, animationTimingFunction: 'linear', animationFillMode: 'both' }
    // decodificar: a animação CSS só marca o início (a letra aparece); o sorteio dura `data-dur` a partir dele.
    // Uma animação ativa recalcula o estilo da letra a cada quadro, e as letras do decodificar se sobrepõem
    // quase inteiras: com a duração toda, um parágrafo recalculava 300 letras por quadro.
    return { ...pintura, ...(embaralhar ? { ['--scr-cor' as string]: cor } : {}), marginRight: kerns[indice] ? `${kerns[indice]}em` : undefined, ...tempoDasPartes(keyframesSeparados(keyframe), `${embaralhar ? Math.min(dp, MARCA_INICIO_MS) : dp}ms`, `${t}ms`, curva) }
  }
  const parte = (s: { texto: string; indice: number }) => (
    <span key={s.indice} data-seg="" data-scr={embaralhar ? s.texto : undefined} data-dur={embaralhar ? Math.round(duracaoParte) : undefined} className={inline ? `seg-texto-linha${embaralhar ? ' seg-scramble' : ''}` : 'seg-texto'} style={estiloParte(s.indice)}>
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
            <span data-seg="" className="seg-texto" style={estiloParte(i)}>{l || ' '}</span>
          </span>
        ))
  } else if (agrupado) {
    // uma parte por palavra, no tempo da primeira letra dela
    conteudo = palavras.map((p, i) => (
      <Fragment key={i}>
        {p.partes.length > 0 && (
          <span data-seg="" className="seg-texto" style={estiloParte(p.partes[0]!.indice, Math.min(...p.partes.map((s) => posicoes[s.indice] ?? s.indice)))}>
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
      <span ref={ref} aria-hidden onAnimationEnd={soltarPartesJuntas}>
        {conteudo}
        {cursor && (
          <>
            <style>{cursor.css}</style>
            <span className="seg-cursor" style={{ height: cantos?.[0]?.h ?? 0, ['--cursor-cor' as string]: cor, animationName: idCursor, animationDuration: `${cursor.duracao}ms`, animationDelay: `${animacao.delay}ms` }} />
          </>
        )}
      </span>
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
    const comecou = (e: AnimationEvent) => { if (e.target === el) correr(e.timeStamp - e.elapsedTime * 1000) }
    const acabou = (e: AnimationEvent) => { if (e.target !== el) return; cancelAnimationFrame(raf); raf = 0; escrever(1) }
    el.addEventListener('animationstart', comecou)
    el.addEventListener('animationend', acabou)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('animationstart', comecou)
      el.removeEventListener('animationend', acabou)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, duracao, curva])
  useGradienteContinuo(ref, gradiente, [info])
  const pintura = pinturaDe(gradiente)
  const relogio: CSSProperties = { animationName: 'seg-contador', animationDuration: `${animacao.duration}ms`, animationDelay: `${animacao.delay}ms`, animationTimingFunction: 'linear' }
  // prefixo/sufixo: entram no último terço, junto com o número chegando
  const extra: CSSProperties = { display: 'inline-block', animationName: 'seg-mov', animationDuration: `${Math.round(animacao.duration * 0.35)}ms`, animationDelay: `${animacao.delay + Math.round(animacao.duration * 0.55)}ms`, animationTimingFunction: curvaCss({ easing: 'easeOut' }), animationFillMode: 'both', whiteSpace: 'pre', ['--seg-dy' as string]: '.2em' }
  return (
    <>
      <span className="texto-acessivel" data-texto={texto} />
      <span ref={ref} aria-hidden className="seg-contador" style={relogio} onAnimationEnd={soltarParte}>
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
      <span ref={ref} aria-hidden onAnimationEnd={soltarParte}>
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
