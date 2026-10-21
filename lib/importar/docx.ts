/**
 * Texto de um .docx (Word) → texto estruturado (o mesmo Markdown leve da leitura de PDF), sem servidor e sem IA:
 * o .docx é um ZIP; lemos só `word/document.xml` (e `word/styles.xml`, para reconhecer os títulos em qualquer
 * idioma) com o fflate. Títulos, listas e tabelas viram `#`, `-` e `| … |`; texto apagado em revisão (w:del)
 * fica de fora. Nada do arquivo é executado (macros não existem em .docx; .docm é recusado pela extensão).
 */
import { strFromU8, unzipSync } from 'fflate'

/** Teto do XML descompactado (proteção contra "zip bomb"). */
export const MAX_XML_DOCX = 30 * 1024 * 1024

/** Erro com mensagem pronta para o usuário. */
export class ErroDocx extends Error {
  override name = 'ErroLeitura'
}

export interface ResultadoDocx { texto: string; caracteres: number; titulos: number; itensLista: number; tabelas: number }

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
    }
    return ENTIDADES[e.toLowerCase()] ?? m
  })
const atributo = (attrs: string, nome: string) => new RegExp(`\\b${nome}="([^"]*)"`).exec(attrs)?.[1]

/** styleId → nível de título (1–3), a partir do nome do estilo ("heading 1", "Title") em styles.xml. */
function niveisDeTitulo(styles: string | null): Map<string, 1 | 2 | 3> {
  const mapa = new Map<string, 1 | 2 | 3>()
  const re = /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g
  for (let m = re.exec(styles ?? ''); m; m = re.exec(styles ?? '')) {
    const id = atributo(m[1]!, 'w:styleId')
    const nome = (/<w:name\b[^>]*w:val="([^"]*)"/.exec(m[2]!)?.[1] ?? '').toLowerCase()
    const nivel = nome === 'title' ? 1 : /^heading (\d)$/.exec(nome)?.[1]
    if (id && nivel) mapa.set(id, Math.min(3, Number(nivel)) as 1 | 2 | 3)
  }
  return mapa
}

/** Nível pelo próprio styleId quando não há styles.xml (Heading1, Ttulo1, Titulo2…). */
const nivelPeloId = (id: string): 1 | 2 | 3 | undefined => {
  if (/^(title|t[ií]?tulo)$/i.test(id)) return 1
  const n = /^(?:heading|t[ií]?tulo|titre|berschrift|encabezado)(\d)$/i.exec(id)?.[1]
  return n ? (Math.min(3, Number(n)) as 1 | 2 | 3) : undefined
}

export function textoDoDocx(bytes: Uint8Array): ResultadoDocx {
  let arquivos: Record<string, Uint8Array>
  try {
    arquivos = unzipSync(bytes, { filter: (f) => (f.name === 'word/document.xml' || f.name === 'word/styles.xml') && f.originalSize <= MAX_XML_DOCX })
  } catch {
    throw new ErroDocx('Este arquivo não é um .docx válido.')
  }
  const doc = arquivos['word/document.xml']
  if (!doc) throw new ErroDocx('Não encontramos o texto deste .docx (ou ele é grande demais).')
  if (doc.byteLength > MAX_XML_DOCX) throw new ErroDocx('O documento é grande demais para ler no navegador.')
  const styles = arquivos['word/styles.xml']
  const niveis = niveisDeTitulo(styles ? strFromU8(styles) : null)
  const xml = strFromU8(doc)

  const blocos: string[] = []
  let titulos = 0
  let itensLista = 0
  let tabelas = 0
  // estado do parágrafo atual
  let par = ''
  let nivel: 1 | 2 | 3 | undefined
  let lista = false
  let emTexto = false
  let apagado = 0
  // tabelas (aninhadas viram texto da célula de fora)
  let profTabela = 0
  let linhas: string[][] = []
  let celula: string[] = []
  const fecharParagrafo = () => {
    const t = par.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim()
    if (t) {
      if (profTabela > 0) celula.push(t.replace(/\n/g, ' '))
      else if (nivel) { blocos.push(`${'#'.repeat(nivel)} ${t.replace(/\n/g, ' ')}`); titulos++ }
      else if (lista) { blocos.push(`- ${t.replace(/\n/g, ' ')}`); itensLista++ }
      else blocos.push(t)
    }
    par = ''; nivel = undefined; lista = false
  }
  const re = /<(\/?)(w:(?:p|tbl|tr|tc|t|tab|br|cr|pStyle|numPr|del|noBreakHyphen))(?=[\s/>])([^>]*?)(\/?)>|([^<]+)/g
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const [, fecha, tag, attrs = '', vazio, texto] = m
    if (texto !== undefined) { if (emTexto && !apagado) par += decodificar(texto); continue }
    const abre = !fecha
    switch (tag) {
      case 'w:p': if (fecha) fecharParagrafo(); else if (!vazio) { par = ''; nivel = undefined; lista = false } break
      case 'w:t': emTexto = abre && !vazio; break
      case 'w:tab': if (abre && !apagado) par += '\t'; break
      case 'w:br': case 'w:cr': if (abre && !apagado) par += '\n'; break
      case 'w:noBreakHyphen': if (abre && !apagado) par += '-'; break
      case 'w:del': if (!vazio) apagado += abre ? 1 : -1; break
      case 'w:pStyle': { const id = atributo(attrs, 'w:val'); if (id) nivel = niveis.get(id) ?? nivelPeloId(id); break }
      case 'w:numPr': if (abre) lista = true; break
      case 'w:tbl':
        if (abre && !vazio) { if (++profTabela === 1) linhas = [] }
        else if (fecha && --profTabela === 0) {
          const larg = Math.max(0, ...linhas.map((l) => l.length))
          if (larg >= 1 && linhas.length) {
            const norm = linhas.map((l) => [...l, ...Array(larg - l.length).fill('')].map((c: string) => c.replace(/\|/g, '/')))
            blocos.push([`| ${norm[0]!.join(' | ')} |`, `|${norm[0]!.map(() => ' --- ').join('|')}|`, ...norm.slice(1).map((l) => `| ${l.join(' | ')} |`)].join('\n'))
            tabelas++
          }
        }
        break
      case 'w:tr': if (profTabela === 1) { if (abre && !vazio) linhas.push([]) } break
      case 'w:tc':
        if (profTabela === 1) {
          if (abre && !vazio) celula = []
          else if (fecha) linhas[linhas.length - 1]?.push(celula.join(' '))
        }
        break
    }
  }
  fecharParagrafo()
  // itens de lista seguidos ficam juntos (sem linha em branco entre eles)
  const texto = blocos.reduce((s, b, i) => (i === 0 ? b : s + (b.startsWith('- ') && blocos[i - 1]!.startsWith('- ') ? '\n' : '\n\n') + b), '')
  return { texto, caracteres: texto.length, titulos, itensLista, tabelas }
}
