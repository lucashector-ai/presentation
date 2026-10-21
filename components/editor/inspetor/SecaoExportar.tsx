'use client'
/** Exportar (recolhida com "+"): PNG/JPG da seleção em 1×–3×, copiar CSS, baixar o vetor ou o arquivo original. */
import { useState } from 'react'
import { Clipboard, Download, Loader2 } from 'lucide-react'
import { ESCALAS, type FormatoImagem } from '@/lib/exportar/medidas'
import { useExportar } from '../useExportar'
import { SeletorLista } from './controles'
import type { Camada } from '@/lib/scene/schema'
import { gradienteCss, sombraCss } from '@/components/renderer/estilos'
import { pilhaFonte } from '@/lib/design-tokens'
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
    if (c.stroke && c.strokeWidth) linhas.push(`border: ${c.strokeWidth}px ${c.dash ? 'dashed' : 'solid'} ${c.stroke};`)
    if (c.shape === 'ellipse') linhas.push('border-radius: 50%;')
  }
  if (c.type === 'text') {
    linhas.push(`font-family: ${pilhaFonte(c.fontFamily).replace(/var\(--font-geist-sans\)/, 'Geist').replace(/var\(--font-geist-mono\)/, '"Geist Mono"')};`, `font-size: ${c.fontSize}px;`, `font-weight: ${c.fontWeight};`, `line-height: ${c.lineHeight};`)
    if (c.letterSpacing) linhas.push(`letter-spacing: ${c.letterSpacing}px;`)
    if (c.italic) linhas.push('font-style: italic;')
    if (c.underline) linhas.push('text-decoration: underline;')
    if (c.transform !== 'none') linhas.push(`text-transform: ${c.transform};`)
    linhas.push(`text-align: ${c.align};`)
    if (c.gradient) linhas.push(`background: ${gradienteCss(c.gradient)};`, 'background-clip: text;', 'color: transparent;')
    else linhas.push(`color: ${c.color};`)
    if (c.background) linhas.push(`background-color: ${c.background};`)
    if (c.padding) linhas.push(`padding: ${c.padding}px;`)
  }
  const sombra = sombraCss(c.effects)
  if (sombra) linhas.push(`box-shadow: ${sombra};`)
  if (c.effects?.blur) linhas.push(`filter: blur(${c.effects.blur}px);`)
  if (c.effects?.backdropBlur) linhas.push(`backdrop-filter: blur(${c.effects.backdropBlur}px);`)
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
      <div className="grid grid-cols-2 gap-1.5">
        <SeletorLista rotulo="Escala da exportação" valor={String(escala)} aoMudar={(v) => setEscala(Number(v))} opcoes={ESCALAS.map((e) => ({ id: String(e), rotulo: `${e}×` }))} />
        <SeletorLista rotulo="Formato da exportação" valor={formato} aoMudar={(v) => setFormato(v as FormatoImagem)} opcoes={[{ id: 'png', rotulo: 'PNG' }, { id: 'jpg', rotulo: 'JPG' }]} />
      </div>
      <button type="button" disabled={!!exp.ocupado} onClick={() => void exp.exportarSelecao(formato, escala)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-superficie2 text-[12px] font-medium hover:bg-hover disabled:opacity-50">
        {exp.ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-texto2" />} Exportar {sel.length === 1 ? (l.name || 'camada') : `${sel.length} camadas`}
      </button>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => void copiar()} className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-superficie2 text-[12px] hover:bg-hover"><Clipboard className="h-3.5 w-3.5 text-texto2" /> Copiar CSS</button>
        {!sel[1] && l.type === 'svg' && l.markup ? (
          <button type="button" onClick={() => baixar(`${l.name || l.id}.svg`, URL.createObjectURL(new Blob([l.markup ?? ''], { type: 'image/svg+xml' })))} className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-superficie2 text-[12px] hover:bg-hover"><Download className="h-3.5 w-3.5 text-texto2" /> Baixar SVG</button>
        ) : !sel[1] && asset ? (
          <button type="button" onClick={() => baixar(asset.nome, asset.url)} className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-superficie2 text-[12px] hover:bg-hover"><Download className="h-3.5 w-3.5 text-texto2" /> Baixar original</button>
        ) : <span />}
      </div>
      <p className="text-[11px] text-texto3">A tela inteira e o PDF da apresentação ficam no menu ⋯ da barra superior.</p>
    </Secao>
  )
}
