'use client'
/**
 * Leitura do manual da marca no navegador, sem IA e sem servidor (grátis): PDF (texto digital e OCR das páginas
 * escaneadas, imagens embutidas como candidatas a logo e as amostras de cor), imagens (páginas do manual ou
 * slides antigos: OCR + cores dos pixels), tokens JSON, CSS e o tema de um .pptx. Cada arquivo vira um perfil
 * (lib/marca/*); os perfis são combinados na ordem (o PDF manda). O texto lido fica só na memória da página,
 * para o resumo opcional pela IA (que recebe só os trechos que falam de marca).
 */
import { carregarCatalogo } from '@/lib/fontes/catalogo'
import { coresDoLogo } from '@/lib/ia/marca'
import { atribuirPapeis, perfilDoTexto } from '@/lib/marca/extrair'
import { analisarImagem, notaDeLogo, type ImagemPdf } from '@/lib/marca/pdf'
import { combinarPerfis, PERFIL_VAZIO, PerfilMarcaSchema, type PerfilMarca } from '@/lib/marca/perfil'
import { MAX_BYTES_PPTX, perfilDoPptx } from '@/lib/marca/pptx'
import { MAX_BYTES_TOKENS, perfilDeCss, perfilDeTokens } from '@/lib/marca/tokens'
import { MAX_IMAGENS_MANUAL } from '@/lib/planos'
import type { FaseLeitura } from '../LeituraPdf'

export const ACEITA_MANUAL = '.pdf,.png,.jpg,.jpeg,.webp,.json,.css,.scss,.pptx,application/pdf,image/png,image/jpeg,image/webp,application/json,text/css,application/vnd.openxmlformats-officedocument.presentationml.presentation'

export interface CandidatoLogo { id: string; url: string; blob: Blob; largura: number; altura: number; pagina: number; nota: number; origem: string }

export interface ManualLido {
  perfil: PerfilMarca
  /** Texto do manual (PDF e imagens), para o resumo pela IA. */
  texto: string
  candidatos: CandidatoLogo[]
  /** Avisos para a pessoa (páginas além do limite, arquivo ignorado). */
  avisos: string[]
}

class ErroManual extends Error {
  override name = 'ErroLeitura'
}

type TipoManual = 'pdf' | 'imagem' | 'tokens' | 'css' | 'pptx'
const tipoDe = (f: File): TipoManual | null => {
  const n = f.name.toLowerCase()
  if (n.endsWith('.pdf') || f.type === 'application/pdf') return 'pdf'
  if (/\.(png|jpe?g|webp)$/.test(n) || /^image\/(png|jpeg|webp)$/.test(f.type)) return 'imagem'
  if (n.endsWith('.json') || f.type === 'application/json') return 'tokens'
  if (/\.s?css$/.test(n) || f.type === 'text/css') return 'css'
  if (n.endsWith('.pptx')) return 'pptx'
  return null
}

/** RGBA de qualquer imagem (bitmap do pdf.js ou arquivo), num canvas com o lado maior em `lado` px. */
function canvasDe(fonte: CanvasImageSource & { width: number; height: number }, lado = 1200): HTMLCanvasElement {
  const escala = Math.min(1, lado / Math.max(fonte.width, fonte.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(fonte.width * escala))
  c.height = Math.max(1, Math.round(fonte.height * escala))
  c.getContext('2d')!.drawImage(fonte, 0, 0, c.width, c.height)
  return c
}
const blobDe = (c: HTMLCanvasElement, tipo = 'image/png', q = 0.92) => new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new ErroManual('Não foi possível ler uma imagem do manual.'))), tipo, q))

/** Imagem embutida no PDF → candidata a logo (PNG), com a nota de "parece logo". */
async function candidatoDe(img: ImagemPdf, paginasDeLogo: Set<number>, origem: string): Promise<CandidatoLogo | null> {
  const base = document.createElement('canvas')
  base.width = img.w
  base.height = img.h
  base.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.rgba), img.w, img.h), 0, 0)
  const c = canvasDe(base, 800)
  const dados = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data
  const analise = analisarImagem(dados)
  const nota = notaDeLogo({ pagina: img.pagina, largura: img.largura, altura: img.altura, analise, paginaFalaDeLogo: paginasDeLogo.has(img.pagina) })
  if (nota < 3) return null
  const blob = await blobDe(c)
  return { id: `${origem}-${img.pagina}-${img.largura}x${img.altura}-${Math.random().toString(36).slice(2, 7)}`, url: URL.createObjectURL(blob), blob, largura: img.largura, altura: img.altura, pagina: img.pagina, nota, origem }
}

async function lerPdf(f: File, maxPaginas: number, sinal: AbortSignal, aoProgredir: (f: FaseLeitura) => void, avisos: string[]): Promise<{ perfil: PerfilMarca; texto: string; candidatos: CandidatoLogo[] }> {
  const [pdf, { lerPdfParaMaterial }, cat] = await Promise.all([import('@/lib/pdf/navegador'), import('../LeituraPdf'), carregarCatalogo()])
  const d = await pdf.abrirPdf(f)
  try {
    if (d.paginas > maxPaginas) avisos.push(`O manual tem ${d.paginas} páginas: lemos as primeiras ${maxPaginas} (limite do seu plano).`)
    const lido = await lerPdfParaMaterial(d, { sinal, maxPaginas, aoProgredir: (x) => aoProgredir({ ...x, progresso: x.progresso * 0.8 }) })
    if (lido.aviso) avisos.push(lido.aviso)
    aoProgredir({ fase: 'Procurando o logo e as amostras de cor…', progresso: 0.85 })
    const { imagens, amostras } = await pdf.lerImagensEAmostras(d, { sinal })
    const paginasDeLogo = new Set(lido.porPagina.map((t, i) => (/\blogo|logotipo|assinatura|s[ií]mbolo/i.test(t) ? i + 1 : 0)).filter(Boolean))
    const candidatos = (await Promise.all(imagens.map((i) => candidatoDe(i, paginasDeLogo, f.name).catch(() => null)))).filter((c): c is CandidatoLogo => !!c)
    let perfil = perfilDoTexto(lido.texto, cat, f.name)
    // manual sem códigos de cor no texto: as amostras desenhadas nas páginas (quadrados de cor) entram como paleta
    if (perfil.cores.length < 2 && amostras.length) {
      const extras = amostras.filter((a) => a.vezes >= 1 && !/^#(?:F{6}|0{6})$/.test(a.hex)).slice(0, 6).map((a) => ({ hex: a.hex, papel: null, nome: `amostra na página ${a.paginas[0]}` }))
      perfil = combinarPerfis(perfil, PerfilMarcaSchema.parse({ cores: atribuirPapeis(extras) }))
    }
    return { perfil, texto: lido.texto, candidatos }
  } finally {
    await d.fechar().catch(() => {})
  }
}

/** Imagens do manual (ou slides antigos): OCR no navegador (montadas num PDF só de imagens) + cores dos pixels. */
async function lerImagens(fs: File[], sinal: AbortSignal, aoProgredir: (f: FaseLeitura) => void): Promise<{ perfil: PerfilMarca; texto: string; candidatos: CandidatoLogo[] }> {
  const [pdf, { lerPdfParaMaterial }, { montarPdfDeImagens }, { jsPDF }, cat] = await Promise.all([import('@/lib/pdf/navegador'), import('../LeituraPdf'), import('@/lib/pdf/montar'), import('jspdf'), carregarCatalogo()])
  const paginas: { jpeg: Uint8Array; larguraPt: number; alturaPt: number }[] = []
  const pixels: number[] = []
  const candidatos: CandidatoLogo[] = []
  for (const [k, f] of fs.entries()) {
    aoProgredir({ fase: `Abrindo a imagem ${k + 1} de ${fs.length}…`, progresso: (k / fs.length) * 0.2 })
    const bitmap = await createImageBitmap(f).catch(() => { throw new ErroManual(`Não foi possível abrir ${f.name}.`) })
    const c = canvasDe(bitmap, 2000)
    const dados = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data
    for (let i = 0; i < dados.length; i += 4 * 37) pixels.push(dados[i]!, dados[i + 1]!, dados[i + 2]!, dados[i + 3]!)
    // um PNG com transparência e poucos tons provavelmente é o próprio logo
    const analise = analisarImagem(dados)
    const nota = notaDeLogo({ pagina: 1, largura: bitmap.width, altura: bitmap.height, analise })
    if (analise.transparencia > 0.05 && nota >= 5) candidatos.push({ id: `img-${k}`, url: URL.createObjectURL(f), blob: f, largura: bitmap.width, altura: bitmap.height, pagina: 1, nota, origem: f.name })
    const jpeg = new Uint8Array(await (await blobDe(c, 'image/jpeg', 0.9)).arrayBuffer())
    paginas.push({ jpeg, larguraPt: c.width * 0.75, alturaPt: c.height * 0.75 })
    bitmap.close()
  }
  const d = await pdf.abrirPdf(new Blob([new Uint8Array(montarPdfDeImagens(jsPDF, paginas))], { type: 'application/pdf' }))
  try {
    const lido = await lerPdfParaMaterial(d, { sinal, aoProgredir: (x) => aoProgredir({ ...x, progresso: 0.2 + x.progresso * 0.8 }) })
    let perfil = perfilDoTexto(lido.texto, cat, fs.map((f) => f.name).join(', ').slice(0, 120))
    // sem códigos de cor legíveis: as cores marcantes dos pixels (as neutras de fundo ficam de fora)
    if (perfil.cores.length < 2) {
      const cores = coresDoLogo(pixels, 6).cores.map((hex) => ({ hex, papel: null, nome: 'cor da imagem' }))
      perfil = combinarPerfis(perfil, PerfilMarcaSchema.parse({ cores: atribuirPapeis(cores) }))
    }
    return { perfil, texto: lido.texto, candidatos }
  } finally {
    await d.fechar().catch(() => {})
  }
}

/**
 * Lê todos os arquivos do manual e junta num perfil. `limites`: páginas de PDF e bytes por arquivo do plano.
 * Arquivo de tipo desconhecido ou grande demais entra nos avisos (os outros continuam).
 */
export async function lerManual(arquivos: File[], limites: { paginas: number; bytes: number }, op: { sinal: AbortSignal; aoProgredir: (f: FaseLeitura) => void }): Promise<ManualLido> {
  const avisos: string[] = []
  const imagens: File[] = []
  const partes: { perfil: PerfilMarca; texto: string; candidatos: CandidatoLogo[] }[] = []
  const ordem: Record<TipoManual, number> = { pdf: 0, imagem: 1, tokens: 2, css: 3, pptx: 4 }
  const lista = arquivos.map((f) => ({ f, tipo: tipoDe(f) })).sort((a, b) => (a.tipo ? ordem[a.tipo] : 9) - (b.tipo ? ordem[b.tipo] : 9))
  for (const { f, tipo } of lista) {
    if (op.sinal.aborted) throw new DOMException('Leitura cancelada', 'AbortError')
    if (!tipo) { avisos.push(`${f.name}: formato não lido (envie PDF, PNG/JPG, tokens .json, .css ou .pptx).`); continue }
    if (f.size > limites.bytes) { avisos.push(`${f.name}: arquivo acima do limite do seu plano.`); continue }
    try {
      if (tipo === 'pdf') {
        op.aoProgredir({ fase: `Abrindo ${f.name}…`, progresso: 0 })
        partes.push(await lerPdf(f, limites.paginas, op.sinal, op.aoProgredir, avisos))
      } else if (tipo === 'imagem') {
        if (imagens.length >= MAX_IMAGENS_MANUAL) { avisos.push(`Lemos até ${MAX_IMAGENS_MANUAL} imagens por vez; ${f.name} ficou de fora.`); continue }
        imagens.push(f)
      } else if (tipo === 'tokens' || tipo === 'css') {
        if (f.size > MAX_BYTES_TOKENS) { avisos.push(`${f.name}: arquivo de tokens grande demais.`); continue }
        const cat = await carregarCatalogo()
        const texto = await f.text()
        let json: unknown = null
        if (tipo === 'tokens') {
          try { json = JSON.parse(texto) } catch { avisos.push(`${f.name}: JSON inválido.`); continue }
        }
        partes.push({ perfil: tipo === 'tokens' ? perfilDeTokens(json, cat, f.name) : perfilDeCss(texto, cat, f.name), texto: '', candidatos: [] })
      } else {
        if (f.size > MAX_BYTES_PPTX) { avisos.push(`${f.name}: apresentação grande demais.`); continue }
        const cat = await carregarCatalogo()
        partes.push({ perfil: perfilDoPptx(new Uint8Array(await f.arrayBuffer()), cat, f.name), texto: '', candidatos: [] })
      }
    } catch (e) {
      if (op.sinal.aborted) throw e
      avisos.push(e instanceof Error && e.name === 'ErroLeitura' ? `${f.name}: ${e.message}` : `Não foi possível ler ${f.name}.`)
    }
  }
  if (imagens.length) {
    // as imagens entram depois dos PDFs e antes dos tokens, CSS e .pptx (que não têm texto)
    try {
      const lidas = await lerImagens(imagens, op.sinal, op.aoProgredir)
      const i = partes.findIndex((p) => !p.texto)
      partes.splice(i < 0 ? partes.length : i, 0, lidas)
    } catch (e) {
      if (op.sinal.aborted) throw e
      avisos.push(e instanceof Error && e.name === 'ErroLeitura' ? e.message : 'Não foi possível ler as imagens do manual.')
    }
  }
  const perfil = partes.reduce((acc, p) => combinarPerfis(acc, p.perfil), PERFIL_VAZIO)
  const candidatos = partes.flatMap((p) => p.candidatos).sort((a, b) => b.nota - a.nota).slice(0, 4)
  return { perfil, texto: partes.map((p) => p.texto).filter(Boolean).join('\n\n'), candidatos, avisos }
}

/** Nome da marca no título do manual ("Manual da marca Vela Energia" → Vela Energia). */
export function nomeDaMarca(texto: string): string {
  const m = /[Mm]anual (?:da|de) (?:[Mm]arca|identidade(?: visual)?)[ \t]*(?:[:·—–-][ \t]*)?(?:da |do |de )?([\p{Lu}][\p{L}\d&'’.-]*(?:[ \t]+[\p{Lu}\d][\p{L}\d&'’.-]*){0,3})/u.exec(texto)
  return m?.[1]?.trim().slice(0, 60) ?? ''
}

/** Fontes que vieram do resumo da IA (nome como no manual) casadas com o catálogo do Google (ou a parecida). */
export async function fontesNoCatalogo(p: PerfilMarca): Promise<PerfilMarca> {
  const [cat, { reconhecerFonte }] = await Promise.all([carregarCatalogo(), import('@/lib/marca/fontes')])
  const ajustar = (f: PerfilMarca['fontes']['titulos']) => {
    if (!f || cat.porNome.has(f.familia)) return f
    const r = reconhecerFonte(cat, f.familia, true)
    return r ? { familia: r.familia, original: f.original || r.original, substituta: r.substituta } : null
  }
  return { ...p, fontes: { titulos: ajustar(p.fontes.titulos), textos: ajustar(p.fontes.textos), numeros: ajustar(p.fontes.numeros) } }
}
