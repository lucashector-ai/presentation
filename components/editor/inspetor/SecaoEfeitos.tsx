'use client'
/**
 * Efeitos (como no Figma): lista empilhada com "+" — sombras projetadas e internas (várias), sombra realista
 * (camadas suaves geradas a partir de uma fonte de luz, como o plugin Beautiful Shadows), desfoque da camada
 * e desfoque do fundo. Cada linha: [ajustes] [tipo ▾] [valor] [olho] [−]; os ajustes abrem logo abaixo.
 */
import { useRef, useState, type JSX } from 'react'
import { Eye, EyeOff, Minus } from 'lucide-react'
import type { Camada, Efeitos, Sombra, SombraRealista } from '@/lib/scene/schema'
import { MAX_SOMBRAS } from '@/lib/scene/schema'
import { EFEITOS_BASE, comSombras, sombrasDe } from '@/lib/scene/efeitos'
import { PREDEFINICOES_REALISTA, REALISTA_PADRAO, comSombraRealista, gerarSombrasRealistas } from '@/lib/scene/sombrasRealistas'
import { boxShadowCss } from '@/lib/scene/efeitos'
import { cx } from '@/components/ui'
import { BotaoMini, CampoCor, CampoNum, Secao, SeletorLista } from './controles'
import { IconeAjustes, IconeDesfoque, IconeLuz, IconeSombra, IconeSombraInterna, IconeSombraRealista, IconeVidro } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { useInspetor } from './contexto'
import { MISTO } from './campos'

/** Predefinições da sombra (a primeira é a padrão do Figma: Y 4, desfoque 4, 25%). */
export const SOMBRAS: Record<string, Sombra | undefined> = {
  padrao: { x: 0, y: 4, blur: 4, spread: 0, color: '#00000040' },
  suave: { x: 0, y: 8, blur: 24, spread: -8, color: '#0000002E' },
  media: { x: 0, y: 20, blur: 50, spread: -16, color: '#00000059' },
  forte: { x: 0, y: 32, blur: 80, spread: -12, color: '#00000080' },
  carimbo: { x: 12, y: 12, blur: 0, spread: 0, color: '#171717FF' },
}
const NOMES_SOMBRA: Record<string, string> = { padrao: 'Padrão', suave: 'Suave', media: 'Média', forte: 'Forte', carimbo: 'Carimbo', personalizada: 'Personalizada' }

function nomeSombra(s: Sombra): string {
  const achada = Object.entries(SOMBRAS).find(([, v]) => v && v.x === s.x && v.y === s.y && v.blur === s.blur && v.spread === s.spread && v.color.toUpperCase() === s.color.toUpperCase())
  return achada?.[0] ?? 'personalizada'
}

type TipoEfeito = 'projetada' | 'interna' | 'realista' | 'desfoque' | 'vidro'
const NOMES: Record<TipoEfeito, string> = { projetada: 'Sombra projetada', interna: 'Sombra interna', realista: 'Sombra realista', desfoque: 'Desfoque da camada', vidro: 'Desfoque do fundo' }
const ICONES: Record<TipoEfeito, () => JSX.Element> = { projetada: IconeSombra, interna: IconeSombraInterna, realista: IconeSombraRealista, desfoque: IconeDesfoque, vidro: IconeVidro }

/** Linha do painel: uma sombra da lista (pelo índice), o grupo da sombra realista ou um desfoque. */
type Linha = { tipo: 'projetada' | 'interna'; indice: number; s: Sombra } | { tipo: 'realista' } | { tipo: 'desfoque' } | { tipo: 'vidro' }

function linhasDe(e: Efeitos | undefined): Linha[] {
  const r: Linha[] = []
  let realista = false
  sombrasDe(e).forEach((s, indice) => {
    if (s.realistic) { if (!realista) { realista = true; r.push({ tipo: 'realista' }) } return }
    r.push({ tipo: s.inner ? 'interna' : 'projetada', indice, s })
  })
  if (realista === false && e?.realistic) r.push({ tipo: 'realista' })
  if (e && (e.blur > 0 || e.blurHidden)) r.push({ tipo: 'desfoque' })
  if (e && (e.backdropBlur > 0 || e.backdropBlurHidden)) r.push({ tipo: 'vidro' })
  return r
}

const chaveLinha = (l: Linha) => (l.tipo === 'projetada' || l.tipo === 'interna' ? `s${l.indice}` : l.tipo)
const ef0 = (e: Efeitos | undefined): Efeitos => ({ ...EFEITOS_BASE, ...e })

/** Troca a sombra `i` da lista. */
const naSombra = (e: Efeitos | undefined, i: number, f: (s: Sombra) => Sombra | null): Efeitos => {
  const lista = sombrasDe(e)
  const nova = lista.flatMap((s, k) => (k === i ? (f(s) ? [f(s)!] : []) : [s]))
  return comSombras(e, nova)
}

export function SecaoEfeitos({ editor }: PropsSecao) {
  const { sel, setFn } = useCamadas(editor)
  const [aberto, setAberto] = useState<string | null>(null)
  const l = sel[0]
  if (!l || sel.every((c) => c.type === 'hotspot')) return null
  const misto = comum(sel, (c) => c.effects ?? null) === MISTO
  const e = l.effects
  const linhas = linhasDe(e)
  const texto = sel.every((c) => c.type === 'text')
  const ef = (fn: (e: Efeitos | undefined, c: Camada) => Efeitos) => setFn((c) => ({ ...c, effects: fn(c.effects, c) }))
  const temDesfoque = linhas.some((x) => x.tipo === 'desfoque')
  const temVidro = linhas.some((x) => x.tipo === 'vidro')
  const temRealista = linhas.some((x) => x.tipo === 'realista')
  const cheio = sombrasDe(e).length >= MAX_SOMBRAS

  const adicionar = () => {
    if (misto) { const copia = structuredClone(e); setFn((c) => ({ ...c, effects: copia })); return }
    if (cheio) return
    // como no Figma: "+" acrescenta uma sombra projetada padrão no topo
    ef((x) => comSombras(x, [{ ...SOMBRAS.padrao! }, ...sombrasDe(x)]))
    setAberto('s0')
  }
  /** Muda o tipo de uma linha (mantém a posição quando dá). */
  const trocar = (linha: Linha, para: TipoEfeito) => {
    if (linha.tipo === para) return
    ef((x) => {
      let n = ef0(x)
      // remove a linha de origem
      if (linha.tipo === 'projetada' || linha.tipo === 'interna') {
        if (para === 'projetada' || para === 'interna') return naSombra(n, linha.indice, (s) => ({ ...s, inner: para === 'interna' ? true : undefined }))
        n = naSombra(n, linha.indice, () => null)
      } else if (linha.tipo === 'realista') n = comSombraRealista(n, undefined)
      else if (linha.tipo === 'desfoque') n = { ...n, blur: 0, blurHidden: undefined }
      else n = { ...n, backdropBlur: 0, backdropBlurHidden: undefined }
      // aplica o destino
      if (para === 'projetada' || para === 'interna') return comSombras(n, [{ ...SOMBRAS.padrao!, ...(para === 'interna' ? { inner: true } : {}) }, ...sombrasDe(n)])
      if (para === 'realista') return comSombraRealista(n, n.realistic ?? REALISTA_PADRAO)
      if (para === 'desfoque') return { ...n, blur: n.blur || 8 }
      return { ...n, backdropBlur: n.backdropBlur || 16 }
    })
    setAberto(para === 'realista' ? 'realista' : para === 'projetada' || para === 'interna' ? (linha.tipo === 'projetada' || linha.tipo === 'interna' ? chaveLinha(linha) : 's0') : null)
  }
  const remover = (linha: Linha) => {
    ef((x) => {
      if (linha.tipo === 'projetada' || linha.tipo === 'interna') return naSombra(x, linha.indice, () => null)
      if (linha.tipo === 'realista') return comSombraRealista(x, undefined)
      if (linha.tipo === 'desfoque') return { ...ef0(x), blur: 0, blurHidden: undefined }
      return { ...ef0(x), backdropBlur: 0, backdropBlurHidden: undefined }
    })
    if (aberto === chaveLinha(linha)) setAberto(null)
  }
  const oculto = (linha: Linha) => (linha.tipo === 'projetada' || linha.tipo === 'interna' ? !!linha.s.hidden : linha.tipo === 'realista' ? !!e?.realistic?.hidden : linha.tipo === 'desfoque' ? !!e?.blurHidden : !!e?.backdropBlurHidden)
  const alternarOlho = (linha: Linha) => ef((x) => {
    if (linha.tipo === 'projetada' || linha.tipo === 'interna') return naSombra(x, linha.indice, (s) => ({ ...s, hidden: s.hidden ? undefined : true }))
    if (linha.tipo === 'realista') { const a = x?.realistic ?? REALISTA_PADRAO; return comSombraRealista(x, { ...a, hidden: a.hidden ? undefined : true }) }
    if (linha.tipo === 'desfoque') return { ...ef0(x), blurHidden: x?.blurHidden ? undefined : true }
    return { ...ef0(x), backdropBlurHidden: x?.backdropBlurHidden ? undefined : true }
  })

  return (
    <Secao
      titulo="Efeitos"
      vazia={!linhas.length}
      aoAdicionar={!cheio || misto ? adicionar : undefined}
      rotuloAdicionar="Adicionar efeito"
      acao={!misto && !temRealista ? (
        <BotaoMini rotulo="Sombra realista (luz e elevação)" onClick={() => { ef((x) => comSombraRealista(x, REALISTA_PADRAO)); setAberto('realista') }}><IconeSombraRealista /></BotaoMini>
      ) : undefined}
    >
      {misto && <p className="text-[11px] text-texto2">Efeitos diferentes na seleção. Clique em + para usar os da primeira camada em todas.</p>}
      {!misto && linhas.map((linha) => {
        const k = chaveLinha(linha)
        const Icone = ICONES[linha.tipo]
        const ajustavel = linha.tipo !== 'desfoque' && linha.tipo !== 'vidro'
        const opcoes = (Object.keys(NOMES) as TipoEfeito[])
          .filter((t) => t === linha.tipo || ((t !== 'realista' || !temRealista) && (t !== 'desfoque' || !temDesfoque) && (t !== 'vidro' || !temVidro) && (t !== 'interna' || !texto)))
          .map((t) => ({ id: t, rotulo: NOMES[t] }))
        return (
          <div key={k} className="space-y-1.5">
            <div className="flex items-center gap-1">
              {ajustavel ? (
                <BotaoMini rotulo={`Ajustes: ${NOMES[linha.tipo].toLowerCase()}`} ativo={aberto === k} aria-expanded={aberto === k} className="h-7 w-7" onClick={() => setAberto(aberto === k ? null : k)}><IconeAjustes /></BotaoMini>
              ) : <span className="flex h-7 w-7 shrink-0 items-center justify-center text-texto3"><Icone /></span>}
              <div className="min-w-0 flex-1"><SeletorLista rotulo={`Tipo do efeito: ${NOMES[linha.tipo]}`} valor={linha.tipo} aoMudar={(v) => trocar(linha, v as TipoEfeito)} opcoes={opcoes} /></div>
              {linha.tipo === 'desfoque' && <CampoNum prefixo={<IconeDesfoque />} rotulo="Desfoque da camada" valor={e?.blur ?? 0} min={0} max={100} className="w-[60px] !flex-none" aoMudar={(blur) => ef((x) => ({ ...ef0(x), blur }))} />}
              {linha.tipo === 'vidro' && <CampoNum prefixo={<IconeVidro />} rotulo="Desfoque do fundo" valor={e?.backdropBlur ?? 0} min={0} max={100} className="w-[60px] !flex-none" aoMudar={(backdropBlur) => ef((x) => ({ ...ef0(x), backdropBlur }))} />}
              <BotaoMini rotulo={oculto(linha) ? `Mostrar ${NOMES[linha.tipo].toLowerCase()}` : `Ocultar ${NOMES[linha.tipo].toLowerCase()}`} onClick={() => alternarOlho(linha)}>{oculto(linha) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</BotaoMini>
              <BotaoMini rotulo={`Remover ${NOMES[linha.tipo].toLowerCase()}`} onClick={() => remover(linha)}><Minus className="h-3.5 w-3.5" /></BotaoMini>
            </div>
            {aberto === k && (linha.tipo === 'projetada' || linha.tipo === 'interna') && <DetalhesSombra sombra={linha.s} texto={texto} aoMudar={(f) => ef((x) => naSombra(x, linha.indice, f))} />}
            {aberto === k && linha.tipo === 'realista' && <DetalhesRealista ajustes={e?.realistic ?? REALISTA_PADRAO} aoMudar={(a) => ef((x) => comSombraRealista(x, a))} />}
          </div>
        )
      })}
    </Secao>
  )
}

function DetalhesSombra({ sombra, texto, aoMudar }: { sombra: Sombra; texto: boolean; aoMudar: (f: (s: Sombra) => Sombra) => void }) {
  const nome = nomeSombra(sombra)
  return (
    <div className="space-y-1.5 rounded-lg border border-borda p-2">
      <SeletorLista rotulo="Predefinição da sombra" valor={nome} aoMudar={(v) => { const p = SOMBRAS[v]; if (p) aoMudar((s) => ({ ...p, inner: s.inner })) }} opcoes={Object.keys(NOMES_SOMBRA).filter((k) => k !== 'personalizada' || nome === 'personalizada').map((k) => ({ id: k, rotulo: NOMES_SOMBRA[k]! }))} />
      <div className="grid grid-cols-2 gap-1.5">
        <CampoNum prefixo="X" rotulo="Sombra X" valor={sombra.x} min={-200} max={200} aoMudar={(x) => aoMudar((s) => ({ ...s, x }))} />
        <CampoNum prefixo="Y" rotulo="Sombra Y" valor={sombra.y} min={-200} max={200} aoMudar={(y) => aoMudar((s) => ({ ...s, y }))} />
        <CampoNum prefixo={<IconeDesfoque />} rotulo="Desfoque da sombra" valor={sombra.blur} min={0} max={300} aoMudar={(blur) => aoMudar((s) => ({ ...s, blur }))} />
        <CampoNum prefixo={<IconeSombra />} rotulo="Expansão da sombra" titulo={texto ? 'Expansão: não vale para texto' : 'Expansão da sombra'} desativado={texto} valor={sombra.spread} min={-100} max={100} aoMudar={(spread) => aoMudar((s) => ({ ...s, spread }))} />
      </div>
      <CampoCor rotulo="Cor da sombra" valor={sombra.color} aoMudar={(color) => color && aoMudar((s) => ({ ...s, color }))} />
    </div>
  )
}

/**
 * Sombra realista: arraste a luz (o sol) em volta da camada — a sombra cai do lado oposto e fica mais longa
 * quanto mais baixa a luz. Elevação, intensidade, suavidade, camadas e cor ajustam o resultado.
 */
function DetalhesRealista({ ajustes: a, aoMudar }: { ajustes: SombraRealista; aoMudar: (a: SombraRealista) => void }) {
  const { gesto } = useInspetor()
  const pad = useRef<HTMLDivElement>(null)
  const set = (p: Partial<SombraRealista>) => aoMudar({ ...a, ...p })
  const luzDoPonteiro = (ev: { clientX: number; clientY: number }) => {
    const r = pad.current?.getBoundingClientRect()
    if (!r) return
    const x = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1))
    const y = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1))
    set({ light: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 } })
  }
  const arrastar = (ev: React.PointerEvent) => {
    if (ev.button !== 0) return
    ev.preventDefault()
    gesto?.iniciar()
    luzDoPonteiro(ev)
    const mover = (e: PointerEvent) => luzDoPonteiro(e)
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); gesto?.terminar() }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  const teclado = (ev: React.KeyboardEvent) => {
    const p = ev.shiftKey ? 0.2 : 0.05
    const d = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[ev.key]
    if (!d) return
    ev.preventDefault()
    set({ light: { x: Math.max(-1, Math.min(1, Math.round((a.light.x + d[0]!) * 100) / 100)), y: Math.max(-1, Math.min(1, Math.round((a.light.y + d[1]!) * 100) / 100)) } })
  }
  // prévia: a camada em miniatura com as sombras geradas (escala 1/3)
  const previa = boxShadowCss(gerarSombrasRealistas({ ...a, elevation: a.elevation / 3 }))
  const predef = PREDEFINICOES_REALISTA.find((p) => Object.entries(p.ajustes).every(([k, v]) => a[k as keyof SombraRealista] === v))?.id ?? ''
  return (
    <div className="space-y-2 rounded-lg border border-borda p-2">
      <div className="flex gap-2.5">
        <div
          ref={pad}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(((Math.atan2(a.light.y, a.light.x) * 180) / Math.PI + 360) % 360)}
          aria-label="Posição da luz (arraste ou use as setas)"
          aria-valuetext={`Luz ${a.light.y < -0.2 ? 'acima' : a.light.y > 0.2 ? 'abaixo' : 'no meio'}, ${a.light.x < -0.2 ? 'à esquerda' : a.light.x > 0.2 ? 'à direita' : 'ao centro'}`}
          onPointerDown={arrastar}
          onKeyDown={teclado}
          className="relative h-[96px] w-[96px] shrink-0 cursor-crosshair touch-none overflow-hidden rounded-md bg-superficie2 outline-none ring-inset focus-visible:ring-1 focus-visible:ring-acento"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-[6px] bg-white" style={{ boxShadow: previa }} />
          <span className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#F2C14E] text-[#7A4B00] shadow-[0_0_0_3px_rgba(242,193,78,.3)]" style={{ left: `${((a.light.x + 1) / 2) * 100}%`, top: `${((a.light.y + 1) / 2) * 100}%` }} aria-hidden>
            <IconeLuz />
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <CampoNum prefixo="↥" rotulo="Elevação" titulo="Elevação: quanto a camada flutua (px)" valor={a.elevation} min={0} max={200} aoMudar={(elevation) => set({ elevation })} />
          <CampoNum prefixo={<IconeSombra />} rotulo="Intensidade" titulo="Intensidade da sombra" valor={Math.round(a.intensity * 100)} min={0} max={100} sufixo="%" aoMudar={(v) => set({ intensity: v / 100 })} />
          <CampoNum prefixo={<IconeDesfoque />} rotulo="Suavidade" titulo="Suavidade (desfoque das camadas)" valor={Math.round(a.softness * 100)} min={0} max={100} sufixo="%" aoMudar={(v) => set({ softness: v / 100 })} />
        </div>
      </div>
      <div role="radiogroup" aria-label="Elevação pronta" className="flex h-7 rounded-md bg-superficie2 p-[2px]">
        {PREDEFINICOES_REALISTA.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={predef === p.id} onClick={() => set(p.ajustes)} className={cx('h-6 min-w-0 flex-1 rounded-[5px] text-[11px] transition-colors', predef === p.id ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_.5px_rgba(0,0,0,.06)]' : 'text-texto2 hover:text-texto')}>{p.rotulo}</button>
        ))}
      </div>
      <div className="grid grid-cols-[72px_1fr] gap-1.5">
        <CampoNum prefixo="≡" rotulo="Camadas de sombra" titulo="Camadas de sombra (1–10)" valor={a.layers} min={1} max={10} aoMudar={(layers) => set({ layers: Math.round(layers) })} />
        <CampoCor rotulo="Cor da sombra realista" valor={a.color} aoMudar={(color) => color && set({ color: color.slice(0, 7) })} />
      </div>
    </div>
  )
}
