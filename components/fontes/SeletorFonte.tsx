'use client'
/**
 * Seletor de fonte com o catálogo completo do Google Fonts (+ as fontes locais do app): busca por nome, filtro por
 * categoria, "Fontes do documento" e "Recentes" no topo, cada fonte escrita com ela mesma (só os glifos do nome,
 * lib/fontes/previa.ts) e lista virtualizada (só as linhas visíveis existem no DOM).
 * Usado no inspetor do editor e no kit de marca do Criar com IA.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cx } from '@/components/ui'
import { pilhaFonte } from '@/lib/design-tokens'
import { buscarFontes, carregarCatalogo, catalogoPronto, CATEGORIAS_FONTE, NOMES_CATEGORIA, pesoPadrao, pesosDisponiveis, type Catalogo, type CategoriaFonte, type FonteCatalogo } from '@/lib/fontes/catalogo'
import { apelidoPrevia, lembrarRecente, lerRecentes, pedirPrevia } from '@/lib/fontes/previa'

/** Catálogo carregado sob demanda (null enquanto chega). */
export function useCatalogoFontes(): Catalogo | null {
  const [cat, setCat] = useState<Catalogo | null>(catalogoPronto)
  useEffect(() => {
    if (cat) return
    let vivo = true
    void carregarCatalogo().then((c) => { if (vivo) setCat(c) })
    return () => { vivo = false }
  }, [cat])
  return cat
}

/** Pilha CSS da prévia: o apelido (só os glifos do nome), a própria família (se já carregada) e a reserva. */
export function estiloPrevia(f: Pick<FonteCatalogo, 'familia' | 'origem'>): CSSProperties {
  if (f.origem === 'local') return { fontFamily: pilhaFonte(f.familia) }
  return { fontFamily: `"${apelidoPrevia(f.familia)}", ${pilhaFonte(f.familia)}` }
}

const ALTURA = 30
type Linha = { tipo: 'titulo'; texto: string } | { tipo: 'fonte'; fonte: FonteCatalogo; secao: string }

export interface PropsSeletorFonte {
  valor: string
  aoMudar: (familia: string, fonte: FonteCatalogo | undefined) => void
  /** Famílias já usadas no documento (seção "Fontes do documento"). */
  doDocumento?: readonly string[]
  rotulo?: string
  /** Visual do gatilho: campo do inspetor (padrão) ou cartão maior (Criar com IA). */
  variante?: 'campo' | 'cartao'
  className?: string
}

export function SeletorFonte({ valor, aoMudar, doDocumento = [], rotulo = 'Fonte', variante = 'campo', className }: PropsSeletorFonte) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`${rotulo}: ${valor}`}
        title={`${rotulo}: ${valor}`}
        onClick={() => setAberto((v) => !v)}
        className={cx(
          variante === 'campo'
            ? 'relative flex h-7 w-full min-w-0 items-center rounded-md bg-superficie2 pl-2 pr-7 text-left text-[11px] text-texto ring-inset hover:ring-1 hover:ring-bordaForte focus-visible:outline-none focus-visible:!ring-1 focus-visible:!ring-acento'
            : 'relative flex h-10 w-full min-w-0 items-center rounded-[10px] border-[1.5px] border-bordaForte bg-superficie pl-3 pr-8 text-left text-[15px] text-texto hover:border-tinta',
          aberto && '!ring-1 !ring-acento',
          className,
        )}
      >
        <span className="truncate" style={{ fontFamily: pilhaFonte(valor) }}>{valor}</span>
        <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-texto3" aria-hidden />
      </button>
      {aberto && <PainelFontes valor={valor} doDocumento={doDocumento} ancora={ref.current} rotulo={rotulo} aoFechar={() => { setAberto(false); ref.current?.focus() }} aoEscolher={(f) => { lembrarRecente(f.familia); aoMudar(f.familia, f); setAberto(false); ref.current?.focus() }} />}
    </>
  )
}

function PainelFontes({ valor, doDocumento, ancora, rotulo, aoFechar, aoEscolher }: { valor: string; doDocumento: readonly string[]; ancora: HTMLElement | null; rotulo: string; aoFechar: () => void; aoEscolher: (f: FonteCatalogo) => void }) {
  const cat = useCatalogoFontes()
  const ref = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaFonte | null>(null)
  const [rolagem, setRolagem] = useState(0)
  const [ativa, setAtiva] = useState(-1)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [recentes] = useState(lerRecentes)

  // posição: ao lado do painel em que o gatilho está (inspetor à direita → painel à esquerda dele), sem sair da janela
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const posicionar = () => {
      const a = ancora?.getBoundingClientRect() ?? { left: 200, right: 200, top: 120, bottom: 120 }
      const w = el.offsetWidth
      const h = el.offsetHeight
      const aside = ancora?.closest('aside')?.getBoundingClientRect()
      let left: number
      let top: number
      if (aside && aside.left > w + 16) { left = aside.left - w - 8; top = a.top - 48 }
      else { left = a.left; top = a.bottom + 6; if (top + h > window.innerHeight - 8) top = a.top - h - 6 }
      setPos({ left: Math.max(8, Math.min(window.innerWidth - w - 8, left)), top: Math.max(8, Math.min(window.innerHeight - h - 8, top)) })
    }
    posicionar()
    window.addEventListener('resize', posicionar)
    return () => window.removeEventListener('resize', posicionar)
  }, [ancora])

  const fechar = useRef(aoFechar)
  fechar.current = aoFechar
  useEffect(() => {
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (ref.current?.contains(alvo) || ancora?.contains(alvo)) return
      fechar.current()
    }
    document.addEventListener('pointerdown', fora, true)
    return () => document.removeEventListener('pointerdown', fora, true)
  }, [ancora])

  const linhas = useMemo<Linha[]>(() => {
    if (!cat) return []
    const filtradas = buscarFontes(cat.fontes, busca, categoria)
    if (busca.trim()) return [{ tipo: 'titulo', texto: filtradas.length ? `${filtradas.length} ${filtradas.length === 1 ? 'resultado' : 'resultados'}` : 'Nenhuma fonte com esse nome' }, ...filtradas.map((f) => ({ tipo: 'fonte' as const, fonte: f, secao: 'busca' }))]
    const daCategoria = (f: FonteCatalogo | undefined): f is FonteCatalogo => !!f && (!categoria || f.categoria === categoria)
    const doc = [...new Set(doDocumento)].map((n) => cat.porNome.get(n)).filter(daCategoria)
    const rec = recentes.map((n) => cat.porNome.get(n)).filter(daCategoria).filter((f) => !doc.includes(f))
    const out: Linha[] = []
    if (doc.length) out.push({ tipo: 'titulo', texto: 'Fontes do documento' }, ...doc.map((f) => ({ tipo: 'fonte' as const, fonte: f, secao: 'doc' })))
    if (rec.length) out.push({ tipo: 'titulo', texto: 'Recentes' }, ...rec.map((f) => ({ tipo: 'fonte' as const, fonte: f, secao: 'rec' })))
    out.push({ tipo: 'titulo', texto: `${categoria ? NOMES_CATEGORIA[categoria] : 'Todas as fontes'} · ${filtradas.length.toLocaleString('pt-BR')}` }, ...filtradas.map((f) => ({ tipo: 'fonte' as const, fonte: f, secao: 'todas' })))
    return out
  }, [cat, busca, categoria, doDocumento, recentes])

  // ao abrir (e ao trocar a busca/categoria): a fonte atual em destaque, rolada para a vista
  const indiceAtual = useMemo(() => linhas.findIndex((l) => l.tipo === 'fonte' && l.fonte.familia === valor), [linhas, valor])
  useEffect(() => {
    const primeira = linhas.findIndex((l) => l.tipo === 'fonte')
    const alvo = busca.trim() ? primeira : indiceAtual >= 0 ? indiceAtual : primeira
    setAtiva(alvo)
    const el = lista.current
    if (el && alvo >= 0 && !busca.trim()) { el.scrollTop = Math.max(0, alvo * ALTURA - el.clientHeight / 2 + ALTURA / 2); setRolagem(el.scrollTop) }
    else if (el) { el.scrollTop = 0; setRolagem(0) }
    // só quando a lista muda de conteúdo (não a cada tecla de navegação)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas])

  const alturaVista = 336
  const inicio = Math.max(0, Math.floor(rolagem / ALTURA) - 6)
  const fim = Math.min(linhas.length, Math.ceil((rolagem + alturaVista) / ALTURA) + 6)
  const visiveis = linhas.slice(inicio, fim)

  // prévias só das linhas que estão (quase) na tela
  useEffect(() => {
    for (const l of visiveis) if (l.tipo === 'fonte' && l.fonte.origem === 'google') pedirPrevia(l.fonte.familia, pesoPadrao(l.fonte))
  }, [visiveis])

  const mover = useCallback((delta: number) => {
    setAtiva((i) => {
      let j = i
      for (let n = 0; n < linhas.length; n++) {
        j = Math.max(0, Math.min(linhas.length - 1, j + delta))
        if (linhas[j]?.tipo === 'fonte') break
        if (j === 0 || j === linhas.length - 1) { j = i; break }
      }
      const el = lista.current
      if (el) {
        if (j * ALTURA < el.scrollTop) el.scrollTop = j * ALTURA - ALTURA
        else if ((j + 1) * ALTURA > el.scrollTop + el.clientHeight) el.scrollTop = (j + 1) * ALTURA - el.clientHeight
      }
      return j
    })
  }, [linhas])

  const teclas = (e: KeyboardEvent) => {
    e.stopPropagation() // atalhos do editor não disparam enquanto se digita aqui
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1) }
    else if (e.key === 'PageDown') { e.preventDefault(); mover(10) }
    else if (e.key === 'PageUp') { e.preventDefault(); mover(-10) }
    else if (e.key === 'Enter') { e.preventDefault(); const l = linhas[ativa]; if (l?.tipo === 'fonte') aoEscolher(l.fonte) }
    else if (e.key === 'Escape') { e.preventDefault(); aoFechar() }
  }

  const idOpcao = (i: number) => `fonte-opcao-${i}`
  const conteudo = (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Escolher ${rotulo.toLowerCase()}`}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={teclas}
      className="fixed z-[70] flex w-[300px] flex-col rounded-xl border border-borda bg-superficie text-texto shadow-painel"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      <div className="flex items-center gap-1.5 border-b border-borda px-2.5 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-texto3" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="lista-fontes"
          aria-activedescendant={ativa >= 0 ? idOpcao(ativa) : undefined}
          aria-label="Buscar fonte"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={cat ? `Buscar entre ${cat.fontes.length.toLocaleString('pt-BR')} fontes` : 'Carregando o catálogo…'}
          className="h-7 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-texto3"
        />
        {busca && <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')} className="flex h-6 w-6 items-center justify-center rounded text-texto3 hover:bg-superficie2 hover:text-texto"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <div role="group" aria-label="Categoria" className="flex flex-wrap gap-1 border-b border-borda px-2.5 py-2">
        {[null, ...CATEGORIAS_FONTE].map((c) => (
          <button key={c ?? 'todas'} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)} className={cx('h-6 rounded-full px-2 text-[11px] transition-colors', categoria === c ? 'bg-texto text-superficie' : 'bg-superficie2 text-texto2 hover:text-texto')}>
            {c ? NOMES_CATEGORIA[c] : 'Todas'}
          </button>
        ))}
      </div>
      <div ref={lista} id="lista-fontes" role="listbox" aria-label="Fontes" onScroll={(e) => setRolagem(e.currentTarget.scrollTop)} className="relative overflow-y-auto overscroll-contain" style={{ height: alturaVista }}>
        {!cat && <div className="flex h-full items-center justify-center text-[11px] text-texto3">Carregando o catálogo…</div>}
        <div style={{ height: linhas.length * ALTURA, position: 'relative' }}>
          {visiveis.map((l, k) => {
            const i = inicio + k
            const top = i * ALTURA
            if (l.tipo === 'titulo') return <div key={`t${i}`} role="presentation" className="rotulo-mono absolute inset-x-0 flex items-end px-3 pb-1 text-[10px] text-texto3" style={{ top, height: ALTURA }}>{l.texto}</div>
            const f = l.fonte
            const sel = f.familia === valor
            const estilos = pesosDisponiveis(f.pesos).length + (f.italico ? pesosDisponiveis(f.italico).length : 0)
            return (
              <div
                key={`${l.secao}-${f.familia}`}
                id={idOpcao(i)}
                role="option"
                aria-selected={sel}
                data-familia={f.familia}
                onPointerMove={() => ativa !== i && setAtiva(i)}
                onClick={() => aoEscolher(f)}
                className={cx('absolute inset-x-1 flex cursor-pointer items-center gap-2 rounded-md px-2', i === ativa ? 'bg-superficie2' : '')}
                style={{ top, height: ALTURA }}
              >
                <span className="w-3.5 shrink-0">{sel && <Check className="h-3.5 w-3.5 text-acento" aria-hidden />}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] leading-none" style={{ ...estiloPrevia(f), fontWeight: pesoPadrao(f) }}>{f.familia}</span>
                <span className="shrink-0 text-[10px] text-texto3" title={f.pesos.tipo === 'faixa' ? `Variável: pesos ${f.pesos.min}–${f.pesos.max}${f.italico ? ', com itálico' : ''}` : `${estilos} ${estilos === 1 ? 'estilo' : 'estilos'}`}>
                  {f.origem === 'local' ? 'no app' : f.pesos.tipo === 'faixa' ? 'variável' : estilos === 1 ? '1 estilo' : `${estilos} estilos`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="border-t border-borda px-3 py-1.5 text-[10px] text-texto3">Google Fonts (licenças abertas) · com acentos do português</div>
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(conteudo, document.body)
}
