'use client'
/**
 * Menu suspenso do Mostra — um só visual para escolher uma opção (no lugar do <select>) e para menus de ações
 * (predefinições, "Mais"): botão gatilho + lista em portal, 8 px de raio, sombra discreta, itens de 32 px, ✓ fino
 * no item escolhido/marcado, separadores finos e títulos de grupo. Mesma cara nos dois temas (tokens).
 *
 * Modos: `opcoes` (padrão; `role=combobox` + `listbox`, ✓ no `valor`) e `acoes` (`aria-haspopup=menu` + `menu`,
 * cada opção tem `aoClicar`; ✓ quando `marcada`). Teclado: abre com clique, ↓/↑, Enter ou Espaço; na lista ↑/↓/
 * Home/End movem, letras procuram, Enter/Espaço escolhem, Esc/Tab/clique fora fecham e o foco volta ao gatilho.
 * Rolar só reposiciona a lista. Fica na janela (abre para cima se faltar espaço).
 *
 * Aparências: `campo` (inspetor, 28 px, fundo superficie2), `grande` (formulários, 40 px com borda), `texto`
 * (só o rótulo com a seta, ex.: "Retângulo ▾") e `icone` (um ícone 24 px que abre o menu, ex.: mesclagem, "Mais").
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

export interface OpcaoMenu {
  id: string
  rotulo: string
  /** Título do grupo (itens com o mesmo grupo ficam juntos, com um título em mono). */
  grupo?: string
  desativada?: boolean
  icone?: ReactNode
  /** Linha menor embaixo do rótulo — só quando ajuda de verdade (ex.: o que vai ser colado). */
  descricao?: string
  /** Modo `acoes`: ação do item. */
  aoClicar?: () => void
  /** Modo `acoes`: item marcado (✓), ex.: um efeito que está ligado. */
  marcada?: boolean
  /** Modo `acoes`: ação destrutiva (vermelho). */
  perigo?: boolean
  /** Linha divisória acima deste item. */
  separador?: boolean
}

export type AparenciaMenu = 'campo' | 'grande' | 'texto' | 'icone'

export interface PropsMenuSuspenso {
  /** Nome acessível (aria-label) do gatilho e da lista. */
  rotulo: string
  valor?: string
  opcoes: OpcaoMenu[]
  aoMudar?: (id: string) => void
  /** `opcoes` (escolher um valor) ou `acoes` (menu de comandos). */
  modo?: 'opcoes' | 'acoes'
  aparencia?: AparenciaMenu
  /** Ícone/letra à esquerda do campo (aparência `campo`). */
  prefixo?: ReactNode
  /** Conteúdo do gatilho nas aparências `icone` e `texto` (padrão: o rótulo da opção atual). */
  children?: ReactNode
  /** Gatilho marcado (aparência `icone`), ex.: mesclagem diferente de Normal. */
  ativo?: boolean
  title?: string
  className?: string
  desativado?: boolean
  /** Largura mínima da lista em px (padrão: a do gatilho nos campos; 160 nos ícones). */
  larguraLista?: number
  /** Texto do gatilho quando o valor não está nas opções. */
  placeholder?: string
}

const ALTURA_MAX = 320

export function MenuSuspenso({ rotulo, valor = '', opcoes, aoMudar, modo = 'opcoes', aparencia = 'campo', prefixo, children, ativo, title, className, desativado, larguraLista, placeholder }: PropsMenuSuspenso) {
  const [aberto, setAberto] = useState(false)
  const [realce, setRealce] = useState(-1)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const gatilho = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const idLista = useId()
  const busca = useRef({ texto: '', em: 0 })
  const acoes = modo === 'acoes'
  const atual = opcoes.find((o) => o.id === valor)
  const indiceAtual = acoes ? opcoes.findIndex((o) => o.marcada) : opcoes.findIndex((o) => o.id === valor)
  const marcada = (o: OpcaoMenu) => (acoes ? !!o.marcada : o.id === valor)
  const comMarcacao = !acoes || opcoes.some((o) => o.marcada !== undefined)

  const fechar = useCallback((focar = true) => {
    setAberto(false)
    if (focar) gatilho.current?.focus({ preventScroll: true })
  }, [])
  const abrir = (indice?: number) => {
    if (desativado) return
    setRealce(indice ?? (indiceAtual >= 0 ? indiceAtual : opcoes.findIndex((o) => !o.desativada)))
    setAberto(true)
  }
  const escolher = (o: OpcaoMenu) => {
    if (o.desativada) return
    fechar()
    if (acoes) o.aoClicar?.()
    else if (o.id !== valor) aoMudar?.(o.id)
  }

  // posição: embaixo do gatilho; para cima se não couber; campos com a largura do gatilho, ícones alinhados à direita
  useLayoutEffect(() => {
    if (!aberto) return
    const el = lista.current
    const g = gatilho.current
    if (!el || !g) return
    const posicionar = () => {
      const a = g.getBoundingClientRect()
      const campo = aparencia === 'campo' || aparencia === 'grande'
      const w = campo ? Math.max(larguraLista ?? 0, a.width, 160) : Math.max(larguraLista ?? 160, el.offsetWidth)
      const h = Math.min(el.scrollHeight + 2, ALTURA_MAX)
      const abaixo = window.innerHeight - a.bottom - 8
      const paraCima = h > abaixo && a.top - 8 > abaixo
      const top = paraCima ? Math.max(8, a.top - 4 - h) : Math.min(a.bottom + 4, window.innerHeight - h - 8)
      let left = aparencia === 'icone' ? a.right - w : a.left
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
      setPos({ left, top, ...(campo ? { width: w } : { minWidth: Math.max(larguraLista ?? 160, 160) }), maxHeight: Math.min(ALTURA_MAX, window.innerHeight - 16) })
    }
    posicionar()
    window.addEventListener('resize', posicionar)
    // rolar (inclusive o rolar-até-o-gatilho que precede um clique) só reposiciona; clicar fora fecha
    document.addEventListener('scroll', posicionar, true)
    return () => { window.removeEventListener('resize', posicionar); document.removeEventListener('scroll', posicionar, true) }
  }, [aberto, aparencia, larguraLista, opcoes.length])

  // clique fora (capturado: popovers que fecham no pointerdown reconhecem a lista por [data-menu-suspenso])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (lista.current?.contains(alvo) || gatilho.current?.contains(alvo)) return
      fechar(false)
    }
    document.addEventListener('pointerdown', fora, true)
    return () => document.removeEventListener('pointerdown', fora, true)
  }, [aberto, fechar])

  // foco na lista (depois de posicionada: escondida ela não aceita foco) e item realçado à vista
  useEffect(() => {
    if (!aberto || !pos) return
    lista.current?.focus({ preventScroll: true })
  }, [aberto, pos])
  useEffect(() => {
    if (!aberto || realce < 0) return
    lista.current?.querySelector<HTMLElement>(`[data-indice="${realce}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [aberto, realce])

  const mover = (de: number, passo: 1 | -1) => {
    let i = de
    for (let k = 0; k < opcoes.length; k++) {
      i = (i + passo + opcoes.length) % opcoes.length
      if (!opcoes[i]!.desativada) return i
    }
    return de
  }
  const procurar = (tecla: string) => {
    const agora = Date.now()
    const b = busca.current
    b.texto = agora - b.em < 700 ? b.texto + tecla : tecla
    b.em = agora
    const t = b.texto.toLowerCase()
    const inicio = realce >= 0 ? realce : -1
    for (let k = 1; k <= opcoes.length; k++) {
      const i = (inicio + k) % opcoes.length
      const o = opcoes[i]!
      if (!o.desativada && o.rotulo.toLowerCase().startsWith(t)) return i
    }
    return -1
  }

  const teclaLista = (e: React.KeyboardEvent) => {
    // nada daqui chega aos atalhos do editor (setas moveriam a camada, Enter abriria a edição do texto…)
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); fechar(); return }
    if (e.key === 'Tab') { fechar(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setRealce((i) => mover(i, 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setRealce((i) => mover(i, -1)); return }
    if (e.key === 'Home') { e.preventDefault(); setRealce(opcoes.findIndex((o) => !o.desativada)); return }
    if (e.key === 'End') { e.preventDefault(); setRealce(opcoes.length - 1 - [...opcoes].reverse().findIndex((o) => !o.desativada)); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = opcoes[realce]; if (o) escolher(o); return }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { const i = procurar(e.key); if (i >= 0) setRealce(i) }
  }

  const teclaGatilho = (e: React.KeyboardEvent) => {
    if (desativado) return
    // aberto com o foco ainda no gatilho: as teclas valem para a lista
    if (aberto) { teclaLista(e); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); abrir() }
    else if (!acoes && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // letra com o menu fechado: pula direto para a opção, como no select do Mac
      const i = procurar(e.key)
      if (i >= 0) { e.preventDefault(); e.stopPropagation(); escolher(opcoes[i]!) }
    }
  }
  const texto = atual?.rotulo ?? placeholder ?? ''
  const classesGatilho: Record<AparenciaMenu, string> = {
    campo: cx('flex h-7 w-full min-w-0 items-center rounded-md bg-superficie2 text-[12px] text-texto ring-inset transition-shadow hover:ring-1 hover:ring-bordaForte focus-visible:!outline-none focus-visible:ring-1 focus-visible:ring-acento', aberto && 'ring-1 ring-acento', !prefixo && 'pl-2'),
    grande: cx('flex h-10 w-full min-w-0 items-center rounded-controle border border-bordaForte bg-superficie pl-3 text-sm text-texto focus-visible:!outline-none focus-visible:border-acento', aberto && 'border-acento'),
    texto: cx('inline-flex h-7 min-w-0 items-center gap-0.5 rounded-[5px] px-1 text-[13px] font-medium text-texto hover:bg-hover focus-visible:!outline-none focus-visible:ring-1 focus-visible:ring-acento', aberto && 'bg-hover'),
    icone: cx('inline-flex h-6 w-6 items-center justify-center rounded-[5px] transition-colors focus-visible:!outline-none focus-visible:ring-1 focus-visible:ring-acento', ativo ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover hover:text-texto', aberto && !ativo && 'bg-hover text-texto'),
  }
  const grupos: { titulo?: string; itens: { o: OpcaoMenu; i: number }[] }[] = []
  opcoes.forEach((o, i) => {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.titulo === o.grupo && !o.separador) ultimo.itens.push({ o, i })
    else grupos.push({ titulo: o.grupo, itens: [{ o, i }] })
  })

  const listaEl = aberto && typeof document !== 'undefined' ? createPortal(
    <div
      ref={lista}
      id={idLista}
      role={acoes ? 'menu' : 'listbox'}
      aria-label={rotulo}
      aria-activedescendant={realce >= 0 ? `${idLista}-${realce}` : undefined}
      tabIndex={-1}
      data-menu-suspenso=""
      onKeyDown={teclaLista}
      onPointerDown={(e) => e.stopPropagation()}
      className={cx('fixed z-[80] overflow-y-auto rounded-[8px] border border-borda bg-superficie p-1 text-texto shadow-[0_8px_24px_-12px_rgba(0,0,0,.28)] outline-none', aparencia === 'grande' ? 'text-[13px]' : 'text-[12px]', aparencia === 'icone' && 'max-w-[280px]')}
      style={{ ...(pos ?? { left: -9999, top: -9999 }), visibility: pos ? undefined : 'hidden' }}
    >
      {grupos.map((g, gi) => (
        <div key={gi} className={gi ? 'mt-1 border-t border-borda pt-1' : undefined}>
          {g.titulo && <div className="rotulo-mono px-2 pb-1 pt-1.5 !text-[10px]">{g.titulo}</div>}
          {g.itens.map(({ o, i }) => (
            <div
              key={o.id}
              id={`${idLista}-${i}`}
              role={acoes ? (o.marcada === undefined ? 'menuitem' : 'menuitemcheckbox') : 'option'}
              aria-selected={acoes ? undefined : o.id === valor}
              aria-checked={acoes && o.marcada !== undefined ? o.marcada : undefined}
              aria-disabled={o.desativada || undefined}
              data-indice={i}
              data-valor={o.id}
              onPointerMove={() => { if (realce !== i && !o.desativada) setRealce(i) }}
              onClick={() => escolher(o)}
              className={cx('flex min-h-8 cursor-default items-center gap-2 rounded-[6px] px-2 text-left', o.descricao ? 'py-1.5' : 'h-8', realce === i && !o.desativada && 'bg-hover', o.desativada && 'opacity-40', o.perigo && 'text-perigo')}
            >
              {comMarcacao && <span className="flex w-3.5 shrink-0 items-center justify-center" aria-hidden>{marcada(o) && <Check className="h-3.5 w-3.5" strokeWidth={1.75} />}</span>}
              {o.icone}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.rotulo}</span>
                {o.descricao && <span className="block truncate text-[11px] leading-snug text-texto3">{o.descricao}</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        role={acoes ? undefined : 'combobox'}
        aria-label={rotulo}
        aria-haspopup={acoes ? 'menu' : 'listbox'}
        aria-expanded={aberto}
        aria-controls={aberto ? idLista : undefined}
        title={title ?? (aparencia === 'icone' || aparencia === 'texto' ? rotulo : undefined)}
        disabled={desativado}
        data-valor={valor}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={teclaGatilho}
        className={cx(classesGatilho[aparencia], 'disabled:cursor-not-allowed disabled:opacity-50', className)}
      >
        {aparencia === 'campo' && prefixo && <span className="pointer-events-none flex h-full w-7 shrink-0 items-center justify-center text-texto3" aria-hidden>{prefixo}</span>}
        {aparencia === 'icone' ? children : (
          <>
            <span className={cx('min-w-0 flex-1 truncate text-left', aparencia === 'texto' && 'flex-none')}>{children ?? texto}</span>
            <ChevronDown className={cx('shrink-0 text-texto3', aparencia === 'grande' ? 'mx-2.5 h-4 w-4' : aparencia === 'texto' ? 'h-3 w-3' : 'mx-2 h-3 w-3')} aria-hidden />
          </>
        )}
      </button>
      {listaEl}
    </>
  )
}
