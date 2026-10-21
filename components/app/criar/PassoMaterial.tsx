'use client'
/**
 * Passo "Material" (opcional): texto ou documento que já existe (PDF, .docx, texto; lido no navegador, de graça;
 * páginas escaneadas a IA lê, com custo), fotos próprias (entram nos espaços de imagem, sem IA), números-chave, o
 * que não pode faltar e o que evitar (entram no roteiro de uma vez, para não gerar de novo).
 */
import { useEffect, useRef, useState } from 'react'
import { FileText, ImagePlus, Sparkles, Upload, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { dados, mensagemDeErro } from '@/lib/dados'
import { MATERIAL_CREDITOS, PLANOS, custoLeituraPdf, custoRoteiro, podeGastarCreditos, type PlanoId } from '@/lib/planos'
import { juntarPaginas, listaDePaginas, paginasParaIa, resumoMaterial, type MaterialLido } from '@/lib/pdf/material'
import type { DocumentoPdf } from '@/lib/pdf/navegador'
import { sanitizarSvgNavegador } from '@/lib/editor/importar'
import { useCreditos } from '../Creditos'
import { linhasDeNumeros, type MaterialEscolhido, type Origem } from './estado'
import { Secao, Segmento, SeloCusto } from './ui'

const NOMES_ORIGEM: Record<Origem, string> = { zero: 'Não tenho', texto: 'Colar texto', arquivo: 'Importar arquivo' }
const ORIGENS: readonly Origem[] = ['zero', 'texto', 'arquivo']
const EXTENSOES_TEXTO = '.pdf,.docx,.txt,.md,.markdown,.html,.htm,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const MAX_TEXTO = 60000
const MAX_BYTES_DOCX = 40 * 1024 * 1024
export const MAX_FOTOS = 12
const DEMO = dados.capacidades.creditosFicticios

async function lerArquivoTexto(f: File): Promise<string> {
  const bruto = await f.text()
  if (/\.html?$/i.test(f.name) || f.type === 'text/html') {
    const doc = new DOMParser().parseFromString(bruto, 'text/html')
    doc.querySelectorAll('script,style,noscript').forEach((n) => n.remove())
    return (doc.body?.innerText || doc.body?.textContent || '').trim()
  }
  return bruto.trim()
}

export function PassoMaterial({ material, aoMudar, telas, planoId, aoLer }: {
  material: MaterialEscolhido
  aoMudar: (m: MaterialEscolhido | ((m: MaterialEscolhido) => MaterialEscolhido)) => void
  telas: number
  planoId: PlanoId
  /** Avisa o pai que a leitura começou/terminou (bloqueia gerar no meio). */
  aoLer: (lendo: boolean) => void
}) {
  const { mostrar } = useToast()
  const { abrirCompra } = useCreditos()
  const [lendo, setLendo] = useState<{ fase: string; progresso: number } | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [enviandoFotos, setEnviandoFotos] = useState(0)
  const pdfAberto = useRef<DocumentoPdf | null>(null)
  const textoPaginas = useRef<string[]>([])
  const abortarLeitura = useRef<AbortController | null>(null)
  const entradaArquivo = useRef<HTMLInputElement>(null)
  const entradaFotos = useRef<HTMLInputElement>(null)
  useEffect(() => aoLer(!!lendo), [lendo, aoLer])
  useEffect(() => () => { abortarLeitura.current?.abort(); void pdfAberto.current?.fechar() }, [])

  const usarTexto = (texto: string, m: MaterialLido, arquivo: string | null) => {
    const cortado = texto.length > MAX_TEXTO
    aoMudar((x) => ({ ...x, origem: 'arquivo', arquivo, conteudo: texto.slice(0, MAX_TEXTO), lido: { ...m, caracteres: Math.min(texto.length, MAX_TEXTO), cortado } }))
  }

  const importar = async (f: File | undefined) => {
    if (!f) return
    if (/\.(docm|doc|pptx?|key|fig|pages|odt|rtf)$/i.test(f.name)) return mostrar('Este formato ainda não é lido. Salve como PDF ou .docx (ou cole o texto em "Colar texto").', 'erro')
    abortarLeitura.current?.abort()
    const ctrl = new AbortController()
    abortarLeitura.current = ctrl
    await pdfAberto.current?.fechar().catch(() => {})
    pdfAberto.current = null
    textoPaginas.current = []
    aoMudar((x) => ({ ...x, lido: null, arquivo: f.name }))
    const base = { arquivo: f.name, paginas: 0, titulos: 0, itensLista: 0, tabelas: 0, semTexto: [], lidasPelaIa: [], emBranco: [], cortado: false }
    try {
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        setLendo({ fase: 'Abrindo o PDF…', progresso: 0 })
        const pdf = await import('@/lib/pdf/navegador')
        const d = await pdf.abrirPdf(f)
        if (ctrl.signal.aborted) return void d.fechar()
        pdfAberto.current = d
        const r = await pdf.lerTextoPdf(d, { sinal: ctrl.signal, aoProgredir: (n, total) => setLendo({ fase: `Lendo a página ${n} de ${total}…`, progresso: n / total }) })
        textoPaginas.current = r.porPagina
        usarTexto(r.texto, { ...base, tipo: 'pdf', paginas: r.paginas, caracteres: r.caracteres, titulos: r.titulos, itensLista: r.itensLista, tabelas: r.tabelas, semTexto: r.paginasSemTexto }, f.name)
        if (!r.texto.trim()) mostrar('Este PDF não tem texto para ler no navegador (parece escaneado). A IA pode ler as páginas.')
      } else if (/\.docx$/i.test(f.name)) {
        if (f.size > MAX_BYTES_DOCX) throw Object.assign(new Error('O .docx é grande demais para ler no navegador.'), { name: 'ErroLeitura' })
        setLendo({ fase: 'Lendo o .docx…', progresso: 0.5 })
        const { textoDoDocx } = await import('@/lib/importar/docx')
        const r = textoDoDocx(new Uint8Array(await f.arrayBuffer()))
        if (!r.texto) return mostrar('O documento está vazio.', 'erro')
        usarTexto(r.texto, { ...base, tipo: 'docx', caracteres: r.caracteres, titulos: r.titulos, itensLista: r.itensLista, tabelas: r.tabelas }, f.name)
      } else {
        const texto = await lerArquivoTexto(f)
        if (!texto) return mostrar('O arquivo está vazio.', 'erro')
        usarTexto(texto, { ...base, tipo: 'texto', caracteres: texto.length }, f.name)
      }
    } catch (e) {
      if (ctrl.signal.aborted) return
      aoMudar((x) => ({ ...x, arquivo: null }))
      mostrar(e instanceof Error && e.name === 'ErroLeitura' ? e.message : `Não foi possível ler ${f.name}.`, 'erro')
    } finally {
      if (abortarLeitura.current === ctrl) setLendo(null)
    }
  }

  const lido = material.lido
  const limiteIaPdf = PLANOS[planoId].limites.paginasPdfIa
  const paraIa = lido ? paginasParaIa(lido.semTexto, limiteIaPdf) : []
  const custoDaLeitura = custoLeituraPdf(paraIa.length)

  const lerComIa = async () => {
    const d = pdfAberto.current
    if (!d || !lido || !paraIa.length) return
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoDaLeitura)
    if (!decisao.ok) return abrirCompra(`A leitura custa ${custoDaLeitura} créditos e você tem ${dados.estado().creditos.saldo}. Escolha um pacote para continuar.`)
    const ctrl = new AbortController()
    abortarLeitura.current?.abort()
    abortarLeitura.current = ctrl
    try {
      setLendo({ fase: 'Preparando as páginas para a IA…', progresso: 0 })
      const pdf = await import('@/lib/pdf/navegador')
      const montado = await pdf.montarPdfParaIa(d, paraIa, (n, total) => setLendo({ fase: `Preparando a página ${n} de ${total}…`, progresso: (n / total) * 0.3 }))
      if (ctrl.signal.aborted) return
      const emBranco = [...lido.emBranco, ...montado.emBranco]
      if (!montado.paginas.length) {
        aoMudar((x) => ({ ...x, lido: { ...lido, semTexto: lido.semTexto.filter((n) => !paraIa.includes(n)), emBranco } }))
        return mostrar('As páginas sem texto estão em branco; nada para ler.')
      }
      setLendo({ fase: `A IA está lendo ${montado.paginas.length} ${montado.paginas.length === 1 ? 'página' : 'páginas'}…`, progresso: 0.35 })
      const r = await dados.ia.pdf(montado.bytes, montado.paginas, ctrl.signal)
      const cobrado = DEMO ? custoLeituraPdf(montado.paginas.length) : r.creditos
      dados.registrarUsoIa({ custo: cobrado, motivo: `Leitura de PDF com IA · ${montado.paginas.length} ${montado.paginas.length === 1 ? 'página' : 'páginas'}`, gerador: 'claude', houveResultado: cobrado > 0 })
      const paginas = [...textoPaginas.current]
      for (const p of r.paginas) paginas[p.pagina - 1] = p.texto
      textoPaginas.current = paginas
      const { texto } = juntarPaginas(paginas, Number.MAX_SAFE_INTEGER)
      const lidas = [...lido.lidasPelaIa, ...r.paginas.map((p) => p.pagina)].sort((a, b) => a - b)
      usarTexto(texto, { ...lido, semTexto: lido.semTexto.filter((n) => !paraIa.includes(n)), lidasPelaIa: lidas, emBranco }, material.arquivo)
      mostrar(`A IA leu ${r.paginas.length} ${r.paginas.length === 1 ? 'página' : 'páginas'} · ${r.caracteres.toLocaleString('pt-BR')} caracteres · ${cobrado} créditos.`)
    } catch (e) {
      if (ctrl.signal.aborted) return
      if ((e as { code?: string } | null)?.code === 'limite_do_plano') return abrirCompra(mensagemDeErro(e))
      mostrar(mensagemDeErro(e, 'A IA não conseguiu ler as páginas. Nenhum crédito foi cobrado.'), 'erro')
    } finally {
      if (abortarLeitura.current === ctrl) setLendo(null)
    }
  }

  const enviarFotos = async (lista: FileList | null) => {
    const arquivos = [...(lista ?? [])].filter((f) => /^image\/(png|jpeg|webp|gif)$/.test(f.type)).slice(0, MAX_FOTOS - material.fotos.length)
    if (!arquivos.length) return mostrar(material.fotos.length >= MAX_FOTOS ? `Até ${MAX_FOTOS} fotos por apresentação.` : 'Envie fotos em PNG, JPG, WebP ou GIF.', 'erro')
    setEnviandoFotos(arquivos.length)
    for (const f of arquivos) {
      try {
        const a = await dados.enviarArquivo(f, () => undefined, { sanitizarSvg: sanitizarSvgNavegador })
        const legenda = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 60)
        aoMudar((x) => ({ ...x, fotos: [...x.fotos, { assetId: a.id, url: a.url, nome: f.name, legenda }].slice(0, MAX_FOTOS) }))
      } catch (e) {
        mostrar(`${f.name}: ${mensagemDeErro(e, 'não foi possível enviar.')}`, 'erro')
      } finally {
        setEnviandoFotos((n) => Math.max(0, n - 1))
      }
    }
  }

  const extraMaterial = material.origem === 'zero' ? 0 : material.conteudo.length
  const creditosMaterial = custoRoteiro(telas, extraMaterial) - custoRoteiro(telas)
  const numeros = linhasDeNumeros(material.numeros)

  return (
    <div className="flex flex-col gap-4">
      <Secao titulo="Texto ou documento que já existe" dica="Briefing, roteiro, relatório, PDF ou .docx: a IA organiza em telas sem perder os fatos. Ler no navegador é grátis." selo={<SeloCusto creditos={creditosMaterial}>{creditosMaterial ? `+${creditosMaterial} no roteiro` : 'grátis'}</SeloCusto>} id="titulo-texto">
        <div className="self-start"><Segmento rotulo="Origem do conteúdo" opcoes={ORIGENS} valor={material.origem} aoMudar={(o) => aoMudar((x) => ({ ...x, origem: o }))} nomes={(o) => NOMES_ORIGEM[o]} /></div>
        {material.origem !== 'zero' && (
          <div
            className={`overflow-hidden rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white ${arrastando ? 'ring-4 ring-acento/40' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); void importar(e.dataTransfer.files[0]) }}
          >
            {material.origem === 'arquivo' && (
              <div className="border-b border-borda px-4 py-3 text-[14px]">
                <div className="flex items-center gap-3">
                  {material.arquivo ? <><FileText className="h-4 w-4 shrink-0 text-acento" /><span className="truncate font-medium">{material.arquivo}</span></> : <span className="text-texto3">Nenhum arquivo ainda · PDF, .docx, .txt, .md ou .html</span>}
                  <button type="button" onClick={() => entradaArquivo.current?.click()} disabled={!!lendo} className="ml-auto flex shrink-0 items-center gap-2 rounded-full border-[1.5px] border-bordaForte px-3 py-1.5 text-[13px] font-medium hover:border-grafite disabled:opacity-50"><Upload className="h-3.5 w-3.5" />{material.arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}</button>
                  <input ref={entradaArquivo} type="file" accept={EXTENSOES_TEXTO} aria-label="Arquivo de material" className="hidden" onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = '' }} />
                </div>
                {lendo && (
                  <div className="mt-2.5 flex items-center gap-3 text-[13px] text-texto3" role="status" aria-live="polite">
                    <span aria-hidden className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#E7E5E4] border-t-violeta" />
                    <span className="shrink-0">{lendo.fase}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-sm bg-[#EDECEA]"><span className="block h-1 bg-violeta transition-[width]" style={{ width: `${Math.round(lendo.progresso * 100)}%` }} /></span>
                  </div>
                )}
                {lido && !lendo && (
                  <div className="mt-2.5 flex flex-col gap-2 text-[13px]" data-testid="resumo-material">
                    <div className="text-texto2" aria-live="polite">
                      <span className="font-medium text-texto">Lido:</span> {resumoMaterial(lido)}
                      {lido.lidasPelaIa.length > 0 && <> · {lido.lidasPelaIa.length === 1 ? 'página' : 'páginas'} {listaDePaginas(lido.lidasPelaIa)} {lido.lidasPelaIa.length === 1 ? 'lida' : 'lidas'} pela IA</>}
                      {lido.cortado && <> · usamos os primeiros {MAX_TEXTO.toLocaleString('pt-BR')} caracteres</>}
                    </div>
                    {lido.semTexto.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-[#FFF7E8] px-3 py-2.5 text-[#6B4E16]">
                        <span className="min-w-0 flex-1">
                          {lido.semTexto.length === lido.paginas ? 'Nenhuma página tem texto para ler no navegador' : `${lido.semTexto.length} ${lido.semTexto.length === 1 ? 'página não tem' : 'páginas não têm'} texto (${lido.semTexto.length === 1 ? 'página' : 'páginas'} ${listaDePaginas(lido.semTexto)})`}: parece escaneado ou só imagem. A IA pode ler a imagem {lido.semTexto.length === 1 ? 'dela' : 'delas'}{paraIa.length < lido.semTexto.length ? ` (até ${limiteIaPdf} por vez no plano ${PLANOS[planoId].nome})` : ''}. O PDF não fica guardado.
                        </span>
                        {pdfAberto.current && (
                          <button type="button" onClick={() => void lerComIa()} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-grafite bg-white px-3 text-[13px] font-medium text-texto hover:bg-[#F5F5F4]">
                            <Sparkles className="h-3.5 w-3.5 text-acento" />Ler {paraIa.length} {paraIa.length === 1 ? 'página' : 'páginas'} com a IA · <span className="mono">{custoDaLeitura}</span> créditos
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <label htmlFor="criar-material" className="sr-only">Texto de base</label>
            <textarea
              id="criar-material"
              value={material.conteudo}
              onChange={(e) => aoMudar((x) => ({ ...x, conteudo: e.target.value.slice(0, MAX_TEXTO) }))}
              rows={7}
              placeholder={material.origem === 'texto' ? 'Cole aqui seu briefing, roteiro, relatório ou anotações. A IA organiza em telas.' : 'Arraste um PDF, um .docx ou um arquivo de texto: o texto lido aparece aqui para você revisar.'}
              className="w-full resize-y bg-transparent px-4 py-3 text-[15px] leading-normal outline-none placeholder:text-[#A3A3A3]"
            />
          </div>
        )}
        {extraMaterial > 0 && <p className="text-[12px] text-texto3">Este material soma <span className="mono text-texto">{creditosMaterial}</span> {creditosMaterial === 1 ? 'crédito' : 'créditos'} ao roteiro (1 a cada {MATERIAL_CREDITOS.caracteres.toLocaleString('pt-BR')} caracteres), já no total.</p>}
      </Secao>

      <Secao titulo="Fotos próprias" dica={`Produto, equipe, obra, portfólio: entram nos espaços de imagem das telas, na ordem. Até ${MAX_FOTOS}.`} selo={<SeloCusto />} id="titulo-fotos">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {material.fotos.map((f, k) => (
            <div key={f.assetId} className="flex flex-col gap-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-[#F0EFED]">
                <img src={f.url} alt={f.legenda || f.nome} className="h-full w-full object-cover" />
                <button type="button" aria-label={`Remover foto ${k + 1}`} onClick={() => aoMudar((x) => ({ ...x, fotos: x.fotos.filter((_, j) => j !== k) }))} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
              </div>
              <input aria-label={`Legenda da foto ${k + 1}`} value={f.legenda} maxLength={120} onChange={(e) => aoMudar((x) => ({ ...x, fotos: x.fotos.map((y, j) => (j === k ? { ...y, legenda: e.target.value } : y)) }))} placeholder="Legenda (opcional)" className="rounded-md bg-[#F5F5F4] px-2 py-1 text-[12px] outline-none" />
            </div>
          ))}
          {material.fotos.length < MAX_FOTOS && (
            <button type="button" onClick={() => entradaFotos.current?.click()} disabled={enviandoFotos > 0} className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#D6D4D0] text-[13px] text-texto2 hover:border-grafite hover:text-texto disabled:opacity-60">
              {enviandoFotos > 0 ? <><span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#E7E5E4] border-t-violeta" />Enviando {enviandoFotos}…</> : <><ImagePlus className="h-5 w-5" />Adicionar fotos</>}
            </button>
          )}
        </div>
        <input ref={entradaFotos} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Fotos próprias" className="hidden" onChange={(e) => { void enviarFotos(e.target.files); e.target.value = '' }} />
      </Secao>

      <div className="grid gap-4 md:grid-cols-2">
        <Secao titulo="Números-chave" dica="Um por linha, valor e legenda. Viram métricas ou gráfico com estes valores exatos." selo={<SeloCusto>{numeros.length ? `${numeros.length} no roteiro` : 'grátis'}</SeloCusto>} id="titulo-numeros">
          <textarea aria-label="Números-chave" value={material.numeros} onChange={(e) => aoMudar((x) => ({ ...x, numeros: e.target.value.slice(0, 1500) }))} rows={4} placeholder={'38% | mais passageiros no pico\nR$ 1,2 mi | de receita em 2026\n6 semanas | até o lançamento'} className="mono w-full resize-y rounded-[10px] bg-[#FAFAF9] px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-[#B5B5B5]" />
        </Secao>
        <div className="flex flex-col gap-4">
          <Secao titulo="O que não pode faltar" selo={<SeloCusto />} id="titulo-obrigatorio">
            <textarea aria-label="O que não pode faltar" value={material.obrigatorio} onChange={(e) => aoMudar((x) => ({ ...x, obrigatorio: e.target.value.slice(0, 1500) }))} rows={2} placeholder="Ex.: prazo de 6 semanas; suporte de 3 meses; case da Atlas" className="w-full resize-y rounded-[10px] bg-[#FAFAF9] px-3 py-2 text-[14px] outline-none placeholder:text-[#B5B5B5]" />
          </Secao>
          <Secao titulo="O que evitar" selo={<SeloCusto />} id="titulo-evitar">
            <textarea aria-label="O que evitar" value={material.evitar} onChange={(e) => aoMudar((x) => ({ ...x, evitar: e.target.value.slice(0, 800) }))} rows={2} placeholder="Ex.: não citar preço; sem jargão técnico" className="w-full resize-y rounded-[10px] bg-[#FAFAF9] px-3 py-2 text-[14px] outline-none placeholder:text-[#B5B5B5]" />
          </Secao>
        </div>
      </div>
      <p className="text-[12px] text-texto3">Tudo aqui entra no roteiro de uma vez: assim você não precisa gerar outro roteiro depois só para incluir um número ou uma foto.</p>
    </div>
  )
}
