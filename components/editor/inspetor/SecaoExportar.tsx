'use client'
/** Exportar (recolhida com "+"): PNG/JPG da seleção em 1×–3×, copiar CSS, baixar o vetor ou o arquivo original. */
import { useState } from 'react'
import { tracosVisiveis } from '@/lib/scene/tracos'
import { desfoqueDe, vidroDe } from '@/lib/scene/efeitos'
import { Clipboard, Download, Loader2 } from 'lucide-react'
import { ESCALAS, type FormatoImagem } from '@/lib/exportar/medidas'
import { useExportar } from '../useExportar'
import { SeletorLista } from './controles'
import type { Camada } from '@/lib/scene/schema'
import { gradienteCss, sombraCss } from '@/components/renderer/estilos'
import { pilhaFonte } from '@/lib/design-tokens'
import { caixaCss, decoracaoCss, linhasVisiveis } from '@/lib/scene/tipografia'
import { useToast } from '@/components/ui/toast'
import { Secao } from './controles'
import { useCamadas, type PropsSecao } from './selecao'

const abertas = new Set<string>()

/** CSS equivalente (como o "Copiar como CSS" de ferramentas de design). */
export function cssDaCamada(c: Camada): string {
  const linhas: string[] = [`width: ${Math.round(c.width)}px;`, `height: ${Math.round(c.height)}px;`]
  if (c.rotation) linhas.push(`transform: rotate(${c.rotation}deg);`)
  if (c.opacity < 1) linhas.push(`opacity: ${Math.round(c.opacity * 100) / 100};`)
  if ('radii' in c && c.radii) linhas.push(`border-radius: ${c.radii.map((r) => `${r}px`).join(' ')};`)
  else if ('radius' in c && c.radius) linhas.push(`border-radius: ${c.radius}px;`)
  if (c.type === 'shape') {
    linhas.push(c.gradient ? `background: ${gradienteCss(c.gradient)};` : `background: ${c.fill};`)
    if (c.shape === 'ellipse') linhas.push('border-radius: 50%;')
  }
  // traço de cima (como o Figma no CSS): dentro/centro = border, fora = outline
  const t = tracosVisiveis(c)[0]
  if (t && c.type !== 'text') {
    const estilo = t.style === 'solid' ? 'solid' : t.style
    if (t.sides) linhas.push(`border-style: ${estilo};`, `border-color: ${t.color};`, `border-width: ${t.sides.top}px ${t.sides.right}px ${t.sides.bottom}px ${t.sides.left}px;`)
    else if (t.position === 'outside') linhas.push(`outline: ${t.weight}px ${estilo} ${t.color};`)
    else linhas.push(`border: ${t.weight}px ${estilo} ${t.color};`)
  } else if (t) linhas.push(`-webkit-text-stroke: ${t.weight}px ${t.color};`)
  if (c.type === 'text') {
    linhas.push(`font-family: ${pilhaFonte(c.fontFamily).replace(/var\(--font-geist-sans\)/, 'Geist').replace(/var\(--font-geist-mono\)/, '"Geist Mono"')};`, `font-size: ${c.fontSize}px;`, `font-weight: ${c.fontWeight};`, `line-height: ${c.lineHeight};`)
    if (c.letterSpacing) linhas.push(`letter-spacing: ${c.letterSpacing}px;`)
    if (c.italic) linhas.push('font-style: italic;')
    // decoração, caixa, corte vertical, quebra e recursos da fonte: as mesmas regras do renderizador
    const css = { ...decoracaoCss(c), ...caixaCss(c.transform), ...(c.textWrap && c.textWrap !== 'auto' ? { textWrap: c.textWrap } : {}), ...(c.tabularNums ? { fontVariantNumeric: 'tabular-nums' } : {}), ...(c.ligatures === false ? { fontVariantLigatures: 'none' } : {}) }
    for (const [k, v] of Object.entries(css)) if (v !== undefined) linhas.push(`${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${typeof v === 'number' ? `${v}px` : v};`)
    if (c.leadingTrim === 'cap') linhas.push('text-box: trim-both cap alphabetic;')
    if (c.truncate) { const n = linhasVisiveis(c); if (n) linhas.push('display: -webkit-box;', '-webkit-box-orient: vertical;', `-webkit-line-clamp: ${n};`, 'overflow: hidden;') }
    linhas.push(`text-align: ${c.align};`)
    if (c.gradient) linhas.push(`background: ${gradienteCss(c.gradient)};`, 'background-clip: text;', 'color: transparent;')
    else linhas.push(`color: ${c.color};`)
    if (c.background) linhas.push(`background-color: ${c.background};`)
    if (c.padding) linhas.push(`padding: ${c.padding}px;`)
  }
  const sombra = sombraCss(c.effects)
  if (sombra) linhas.push(`box-shadow: ${sombra};`)
  if (desfoqueDe(c.effects)) linhas.push(`filter: blur(${desfoqueDe(c.effects)}px);`)
  if (vidroDe(c.effects)) linhas.push(`backdrop-filter: blur(${vidroDe(c.effects)}px);`)
  if (c.effects?.blend && c.effects.blend !== 'normal') linhas.push(`mix-blend-mode: ${c.effects.blend};`)
  return `/* ${c.name || c.id} */\n${linhas.join('\n')}`
}

function baixar(nome: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = nome
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function SecaoExportar({ editor, assets = [] }: PropsSecao) {
  const { sel } = useCamadas(editor)
  const { mostrar } = useToast()
  const chave = sel.map((c) => c.id).join(',')
  const [, forcar] = useState(0)
  const [formato, setFormato] = useState<FormatoImagem>('png')
  const [escala, setEscala] = useState(2)
  const exp = useExportar(editor)
  const aberta = abertas.has(chave)
  const l = sel[0]
  if (!l) return null
  const abrir = (v: boolean) => { if (v) abertas.add(chave); else abertas.delete(chave); forcar((n) => n + 1) }
  const asset = 'assetId' in l && l.assetId ? assets.find((a) => a.id === l.assetId) : undefined
  const copiar = async () => {
    try { await navigator.clipboard.writeText(sel.map(cssDaCamada).join('\n\n')); mostrar('CSS copiado.', 'sucesso') } catch { mostrar('Não foi possível copiar.', 'erro') }
  }
  return (
    <Secao titulo="Exportar" vazia={!aberta} aoAdicionar={!aberta ? () => abrir(true) : undefined} rotuloAdicionar="Adicionar exportação" aoRemover={aberta ? () => abrir(false) : undefined} rotuloRemover="Fechar exportação">
      <div className="grid grid-cols-2 gap-2">
        <SeletorLista rotulo="Escala da exportação" valor={String(escala)} aoMudar={(v) => setEscala(Number(v))} opcoes={ESCALAS.map((e) => ({ id: String(e), rotulo: `${e}×` }))} />
        <SeletorLista rotulo="Formato da exportação" valor={formato} aoMudar={(v) => setFormato(v as FormatoImagem)} opcoes={[{ id: 'png', rotulo: 'PNG' }, { id: 'jpg', rotulo: 'JPG' }]} />
      </div>
      <button type="button" disabled={!!exp.ocupado} onClick={() => void exp.exportarSelecao(formato, escala)} className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-superficie2 text-[11px] font-medium hover:bg-hover disabled:opacity-50">
        {exp.ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-texto2" />} Exportar {sel.length === 1 ? (l.name || 'camada') : `${sel.length} camadas`}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void copiar()} className="flex h-8 items-center justify-center gap-2 rounded-md bg-superficie2 text-[11px] hover:bg-hover"><Clipboard className="h-3.5 w-3.5 text-texto2" /> Copiar CSS</button>
        {!sel[1] && l.type === 'svg' && l.markup ? (
          <button type="button" onClick={() => baixar(`${l.name || l.id}.svg`, URL.createObjectURL(new Blob([l.markup ?? ''], { type: 'image/svg+xml' })))} className="flex h-8 items-center justify-center gap-2 rounded-md bg-superficie2 text-[11px] hover:bg-hover"><Download className="h-3.5 w-3.5 text-texto2" /> Baixar SVG</button>
        ) : !sel[1] && asset ? (
          <button type="button" onClick={() => baixar(asset.nome, asset.url)} className="flex h-8 items-center justify-center gap-2 rounded-md bg-superficie2 text-[11px] hover:bg-hover"><Download className="h-3.5 w-3.5 text-texto2" /> Baixar original</button>
        ) : <span />}
      </div>
    </Secao>
  )
}
