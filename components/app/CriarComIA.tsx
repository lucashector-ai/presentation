'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { abrirApresentacao } from '@/components/viewer/retorno'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, FileText, Palette, Plus, RotateCcw, Sparkles, Upload, X } from 'lucide-react'
import { cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { SceneRenderer } from '@/components/renderer/SceneRenderer'
import { carregarFontes, useFontesDoDocumento } from '@/components/renderer/fontes'
import { dados, mensagemDeErro, useDados } from '@/lib/dados'
import { desenharTelas } from '@/lib/ia/clienteDesign'
import { chaveDesenho, MAX_TELAS_POR_PEDIDO_DESIGN } from '@/lib/ia/design'
import { COMPONENTES, NOMES_TIPO_TELA, RE_HEX, TEMAS, resolverTema, type TemaEscolhido, type TemaId, type TemaVisual } from '@/lib/ia/designSystem'
import { desenharLocal } from '@/lib/ia/desenhoLocal'
import type { TelaDesenhada } from '@/lib/ia/montagem'
import { FORMATOS_IA, ORIGENS, QUANTIDADES_TELAS, tipoEfetivo } from '@/lib/ia/pedido'
import { ESTILOS, TIPOS_TELA, montarDocumento, type Densidade, type Estilo, type OpcaoImagens, type Roteiro, type TelaRoteiro, type TipoTela } from '@/lib/ia/roteiro'
import { NOMES_TOM, TIPOS, TIPOS_APRESENTACAO, TONS, type TipoPedido, type Tom } from '@/lib/ia/tiposApresentacao'
import { MATERIAL_CREDITOS, PLANOS, custoApresentacao, custoDesenho, custoLeituraPdf, custoRoteiro, podeGastarCreditos, podeGerarTelas, textoApresentacoes } from '@/lib/planos'
import { aposLeituraIa, juntarPaginas, listaDePaginas, paginasParaIa, resumoMaterial, type MaterialLido } from '@/lib/pdf/material'
import type { DocumentoPdf } from '@/lib/pdf/navegador'
import { AvisoPaginasPdf, lerPdfParaMaterial, ProgressoLeitura, type FaseLeitura } from './LeituraPdf'
import { useCreditos } from './Creditos'
import type { Cena, DocumentoProjeto } from '@/lib/scene/schema'

type Formato = (typeof FORMATOS_IA)[number]
type Origem = (typeof ORIGENS)[number]

const NOMES_ORIGEM: Record<Origem, string> = { zero: 'Gerar do zero', texto: 'Colar texto', arquivo: 'Importar arquivo' }
const NOMES_FORMATO: Record<Formato, string> = { slides: 'Slides', story: 'Story', explorar: 'Explorar' }
const NOMES_ESTILO: Record<Estilo, string> = { editorial: 'Editorial', ousado: 'Ousado', minimal: 'Minimal' }
const NOMES_TIPO_CURTO: Record<TipoPedido, string> = {
  auto: 'Automático', pitch: 'Pitch', proposta: 'Proposta', projeto: 'Projeto', relatorio: 'Relatório', aula: 'Aula', portfolio: 'Portfólio',
  lancamento: 'Lançamento', case: 'Case', evento: 'Evento', institucional: 'Institucional', identidade: 'Identidade visual', geral: 'Outro',
}
const PLACEHOLDER: Record<Origem, string> = {
  zero: 'Ex.: Proposta de identidade visual para uma marca de cerâmica artesanal, com conceito, paleta, tipografia e aplicações…',
  texto: 'Cole aqui seu briefing, roteiro, relatório ou anotações. A IA organiza em telas.',
  arquivo: 'Arraste um PDF, um .docx ou um arquivo de texto (.txt, .md, .html) — o texto lido aparece aqui para você revisar.',
}
const EXEMPLOS: { texto: string; tipo: TipoPedido; cor: string; raio: string }[] = [
  { texto: 'Pitch da Aurora, startup de energia solar por assinatura para pequenos comércios, buscando rodada seed.', tipo: 'pitch', cor: '#D7F25C', raio: '0' },
  { texto: 'Proposta de rebrand para uma cafeteria de bairro em São Paulo, com conceito, entregas, cronograma e investimento.', tipo: 'proposta', cor: '#B4532A', raio: '50%' },
  { texto: 'Relatório do 3º trimestre do time de vendas: resultados, metas, o que funcionou e prioridades.', tipo: 'relatorio', cor: '#2F6BFF', raio: '6px' },
  { texto: 'Aula de introdução à fotossíntese para o 7º ano, com conceitos, passo a passo e exercícios.', tipo: 'aula', cor: '#E07A00', raio: '999px 999px 0 0' },
  { texto: 'Lançamento do app Rota, que organiza entregas de pequenos negócios, com recursos e planos.', tipo: 'lancamento', cor: '#7C8CFF', raio: '50%' },
  { texto: 'Festival de música independente em Belo Horizonte buscando patrocinadores para a 5ª edição.', tipo: 'evento', cor: '#E4572E', raio: '0' },
]
const FORMAS = ['50%', '6px', '0', '999px 999px 0 0']
const CORES_CARTAO = ['#E4572E', '#5965F2', '#F2C14E', '#1F3B4D', '#D7F25C', '#B4532A']
const EXTENSOES_TEXTO = '.pdf,.docx,.txt,.md,.markdown,.html,.htm,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_TEXTO = 60000
/** .docx maior que isto não é lido no navegador (o texto de um documento normal tem poucos MB). */
const MAX_BYTES_DOCX = 40 * 1024 * 1024
// créditos fictícios (demo): o débito é calculado aqui; no backend real vem da resposta da rota
const DEMO = dados.capacidades.creditosFicticios

const tinta = (hex: string) => (['#D7F25C', '#F2C14E', '#F1D3B3', '#EEE7DB', '#F2E9D8'].includes(hex) ? '#171717' : '#fff')

/** Lê arquivos de texto no navegador; HTML vira texto puro. */
async function lerArquivoTexto(f: File): Promise<string> {
  const bruto = await f.text()
  if (/\.html?$/i.test(f.name) || f.type === 'text/html') {
    const doc = new DOMParser().parseFromString(bruto, 'text/html')
    doc.querySelectorAll('script,style,noscript').forEach((n) => n.remove())
    return (doc.body?.innerText || doc.body?.textContent || '').trim()
  }
  return bruto.trim()
}

function Segmento<T extends string>({ opcoes, valor, aoMudar, rotulo, nomes, claro }: { opcoes: readonly T[]; valor: T; aoMudar: (v: T) => void; rotulo: string; nomes: (v: T) => string; claro?: boolean }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cx('flex gap-1 rounded-full p-[3px] text-[13px]', claro ? 'bg-[#EFEEEC] p-1 text-[14px]' : 'bg-[#F5F5F4]')}>
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          onClick={() => aoMudar(o)}
          className={cx(
            'whitespace-nowrap rounded-full font-medium transition-colors',
            claro ? 'px-3 py-2 sm:px-4' : 'px-3 py-1.5',
            valor === o ? (claro ? 'bg-white text-texto shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-grafite text-fundo') : claro ? 'text-texto3 hover:text-texto' : 'text-[#525252] hover:text-texto'
          )}
        >
          {nomes(o)}
        </button>
      ))}
    </div>
  )
}

/** Miniatura que ocupa a largura do contêiner. */
function MiniaturaFluida({ cena }: { cena: Cena }) {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: `${cena.size.width} / ${cena.size.height}`, background: cena.background }}>
      {largura > 0 && <SceneRenderer cena={cena} assets={{}} escala={largura / cena.size.width} modo="miniatura" />}
    </div>
  )
}

/** Amostra de um tema: capa em miniatura com a fonte, o fundo e o acento do tema. */
function AmostraTema({ t, i, ativo, sugerido, aoEscolher }: { t: TemaVisual; i: number; ativo: boolean; sugerido: boolean; aoEscolher: () => void }) {
  const s = t.capa === 'escuro' ? t.escuro : t.capa === 'acento' ? { fundo: t.acento, tinta: t.sobreAcento } : t.claro
  const forma = t.raio === 0 ? '0' : t.raio >= 40 || t.motivo === 'formas' ? '50%' : FORMAS[i % 4]!
  return (
    <button type="button" role="radio" aria-checked={ativo} onClick={aoEscolher} title={t.descricao} className="flex flex-col gap-1.5 text-left">
      <span className={cx('relative block aspect-[16/10] w-full overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline outline-2 outline-offset-2', ativo ? 'outline-violeta' : 'outline-transparent')} style={{ background: s.fundo }}>
        <span className="absolute right-[10%] top-[14%] aspect-square w-[28%]" style={{ background: t.capa === 'acento' ? t.acento2 : t.acento, borderRadius: forma, opacity: t.motivo === 'brilho' ? 0.75 : 1, filter: t.motivo === 'brilho' ? 'blur(6px)' : undefined }} />
        <span className="absolute bottom-[12%] left-[10%] text-[19px] leading-none tracking-[-0.03em]" style={{ color: s.tinta, fontFamily: t.fontes.titulo === 'Geist' ? undefined : t.fontes.titulo, fontWeight: t.fontes.pesoTitulo }}>Aa</span>
        {sugerido && <span className="mono absolute left-[8%] top-[10%] rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-[#171717]">SUGERIDO</span>}
      </span>
      <span className="truncate text-[12px] text-[#525252]">{t.nome}</span>
    </button>
  )
}

const noIntervalo = <T,>(itens: T[], n: number) => Array.from({ length: Math.ceil(itens.length / n) }, (_, k) => itens.slice(k * n, k * n + n))

export function CriarComIA() {
  const router = useRouter()
  const params = useSearchParams()
  const { mostrar } = useToast()
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [origem, setOrigem] = useState<Origem>('zero')
  const [prompt, setPrompt] = useState(() => params.get('prompt')?.slice(0, 4000) ?? '')
  const [conteudo, setConteudo] = useState('')
  const [arquivo, setArquivo] = useState<string | null>(null)
  const [formato, setFormato] = useState<Formato>(() => (FORMATOS_IA as readonly string[]).includes(params.get('formato') ?? '') ? (params.get('formato') as Formato) : 'slides')
  const planoId = useDados((e) => e.workspace.planoId)
  const [telas, setTelas] = useState<number>(() => {
    const n = Number(params.get('telas'))
    return (QUANTIDADES_TELAS as readonly number[]).includes(n) ? n : 8
  })
  const [tipo, setTipo] = useState<TipoPedido>(() => ((TIPOS_APRESENTACAO as readonly string[]).includes(params.get('tipo') ?? '') ? (params.get('tipo') as TipoPedido) : 'auto'))
  const [publico, setPublico] = useState('')
  const [tom, setTom] = useState<Tom | ''>('')
  const [marcaNome, setMarcaNome] = useState('')
  const [cores, setCores] = useState<string[]>([])
  const [estilo, setEstilo] = useState<Estilo>('editorial')
  const [gerando, setGerando] = useState(false)
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null)
  const [nota, setNota] = useState('')
  const [tema, setTema] = useState<TemaEscolhido>('argila')
  const [temaIa, setTemaIa] = useState<TemaId | null>(null)
  const [imagens, setImagens] = useState<OpcaoImagens>('formas')
  const [densidade, setDensidade] = useState<Densidade>('detalhado')
  /** Desenhos já feitos, pela chave do conteúdo da tela (mudar o tema não redesenha; mudar o texto, sim). */
  const [desenhos, setDesenhos] = useState<Record<string, TelaDesenhada>>({})
  const [desenhando, setDesenhando] = useState(false)
  const [revelar, setRevelar] = useState(0)
  const [projetoId, setProjetoId] = useState<string | null>(null)
  const [salvandoProjeto, setSalvandoProjeto] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  /** O que foi lido do arquivo (resumo mostrado antes de gerar). */
  const [material, setMaterial] = useState<MaterialLido | null>(null)
  const [lendo, setLendo] = useState<FaseLeitura | null>(null)
  /** PDF aberto (para a IA ler as páginas escaneadas depois) e o texto de cada página. */
  const pdfAberto = useRef<DocumentoPdf | null>(null)
  const textoPaginas = useRef<string[]>([])
  const abortarLeitura = useRef<AbortController | null>(null)
  const abortar = useRef<AbortController | null>(null)
  const entradaArquivo = useRef<HTMLInputElement>(null)
  const criadoPara = useRef<DocumentoProjeto | null>(null)
  const saldo = useDados((e) => e.creditos.saldo)
  const { abrirCompra } = useCreditos()
  const opcoesTelas = QUANTIDADES_TELAS.filter((n) => podeGerarTelas(planoId, n).ok)
  useEffect(() => { if (!podeGerarTelas(planoId, telas).ok) setTelas(opcoesTelas[opcoesTelas.length - 1] ?? 6) }, [planoId, telas, opcoesTelas])
  useEffect(() => { carregarFontes(TEMAS.map((t) => t.fontes.titulo)) }, [])

  const textoBase = origem === 'zero' ? prompt : conteudo
  const podeGerar = textoBase.trim().length >= (origem === 'zero' ? 3 : 20) && !gerando && !lendo
  const caracteresMaterial = origem === 'zero' ? 0 : conteudo.length
  const marca = useMemo(() => ({ nome: marcaNome.trim().slice(0, 60), cores: cores.filter((c) => RE_HEX.test(c)) }), [marcaNome, cores])
  // "Gerar uma apresentação" = roteiro (agora) + design de cada tela (no passo 3)
  const custoTotal = custoApresentacao(telas, caracteresMaterial)
  const custoDoRoteiro = custoRoteiro(telas, caracteresMaterial)
  const semSaldo = !podeGastarCreditos(saldo, custoTotal).ok
  const tipoDetectado = tipoEfetivo({ tipo, prompt, conteudo: origem === 'zero' ? '' : conteudo })
  useEffect(() => () => { abortar.current?.abort(); abortarLeitura.current?.abort(); void pdfAberto.current?.fechar() }, [])

  const gerarRoteiro = async (outro = false) => {
    if (!podeGerar && !outro) return
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoDoRoteiro)
    if (!decisao.ok) return abrirCompra(`${decisao.motivo.replace(' Compre um pacote avulso ou faça upgrade.', '')} Escolha um pacote para continuar.`)
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl
    setGerando(true)
    try {
      const r = await dados.ia.roteiro(
        {
          origem,
          prompt: origem === 'zero' ? (outro ? `${prompt}\n\nProponha uma estrutura diferente da óbvia.` : prompt) : '',
          conteudo: origem === 'zero' ? '' : conteudo,
          formato,
          telas,
          estilo,
          tipo,
          publico: publico.trim().slice(0, 200),
          ...(tom ? { tom } : {}),
          marca,
        },
        ctrl.signal
      )
      // demo: créditos fictícios debitados aqui, para o saldo refletir o uso; real: a rota já debitou (só quando o
      // Claude escreve, com estorno se falhar) e o saldo é relido do servidor
      const cobrado = DEMO ? custoDoRoteiro : r.creditos
      dados.registrarUsoIa({ custo: cobrado, motivo: `Roteiro com IA · ${telas} telas`, gerador: r.gerador, houveResultado: cobrado > 0 })
      setNota(r.gerador === 'claude'
        ? `Escrito pela IA · ${cobrado} créditos do roteiro. O design de cada tela vem no próximo passo; reordenar e trocar o tema é grátis.`
        : DEMO
          ? `Roteiro-guia gerado localmente (a IA não está conectada neste ambiente) · ${cobrado} créditos de demonstração debitados. Revise o texto: ele é um guia do tipo "${TIPOS[r.tipo].nome}".`
          : 'Roteiro-guia gerado localmente (a IA não está conectada neste ambiente). Nenhum crédito foi cobrado.')
      setRoteiro(r.roteiro)
      setTemaIa(r.tema)
      setTema(marca.cores.length ? 'marca' : r.tema)
      setPasso(2)
    } catch (e) {
      if (ctrl.signal.aborted) return
      // saldo insuficiente (o servidor confere de novo): abre a compra com o motivo
      if ((e as { code?: string } | null)?.code === 'limite_do_plano') return abrirCompra(mensagemDeErro(e))
      mostrar(mensagemDeErro(e, 'Não foi possível gerar o roteiro. Tente novamente.'), 'erro')
    } finally {
      if (abortar.current === ctrl) setGerando(false)
    }
  }

  /** Põe o texto lido no material (e avisa se passou do teto). */
  const usarTexto = (texto: string, m: MaterialLido) => {
    const cortado = texto.length > MAX_TEXTO
    setConteudo(texto.slice(0, MAX_TEXTO))
    setMaterial({ ...m, caracteres: Math.min(texto.length, MAX_TEXTO), cortado })
  }

  const importar = async (f: File | undefined) => {
    if (!f) return
    if (/\.(docm|doc|pptx?|key|fig|pages|odt|rtf)$/i.test(f.name)) {
      mostrar('Este formato ainda não é lido. Salve como PDF ou .docx (ou cole o texto em "Colar texto").', 'erro')
      return
    }
    abortarLeitura.current?.abort()
    const ctrl = new AbortController()
    abortarLeitura.current = ctrl
    await pdfAberto.current?.fechar().catch(() => {})
    pdfAberto.current = null
    textoPaginas.current = []
    setMaterial(null)
    setArquivo(f.name)
    const base = { arquivo: f.name, paginas: 0, titulos: 0, itensLista: 0, tabelas: 0, semTexto: [], lidasPelaIa: [], emBranco: [], cortado: false }
    try {
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        setLendo({ fase: 'Abrindo o PDF…', progresso: 0 })
        const pdf = await import('@/lib/pdf/navegador')
        const d = await pdf.abrirPdf(f)
        if (ctrl.signal.aborted) return void d.fechar()
        pdfAberto.current = d
        // texto digital + OCR das páginas escaneadas, tudo no navegador e sem créditos
        const r = await lerPdfParaMaterial(d, { sinal: ctrl.signal, aoProgredir: setLendo })
        textoPaginas.current = r.porPagina
        usarTexto(r.texto, { ...base, tipo: 'pdf', ...r.material })
        if (r.aviso) mostrar(r.aviso)
        else if (!r.texto.trim()) mostrar('Não encontramos texto legível neste PDF. Se forem gráficos, tabelas ou manuscrito, a IA pode ler as páginas.')
      } else if (/\.docx$/i.test(f.name)) {
        if (f.size > MAX_BYTES_DOCX) throw Object.assign(new Error('O .docx é grande demais para ler no navegador.'), { name: 'ErroLeitura' })
        setLendo({ fase: 'Lendo o .docx…', progresso: 0.5 })
        const { textoDoDocx } = await import('@/lib/importar/docx')
        const r = textoDoDocx(new Uint8Array(await f.arrayBuffer()))
        if (!r.texto) return mostrar('O documento está vazio.', 'erro')
        usarTexto(r.texto, { ...base, tipo: 'docx', caracteres: r.caracteres, titulos: r.titulos, itensLista: r.itensLista, tabelas: r.tabelas })
      } else {
        const texto = await lerArquivoTexto(f)
        if (!texto) return mostrar('O arquivo está vazio.', 'erro')
        usarTexto(texto, { ...base, tipo: 'texto', caracteres: texto.length })
      }
    } catch (e) {
      if (ctrl.signal.aborted) return
      setArquivo(null)
      // ErroPdf/ErroDocx (name 'ErroLeitura') já trazem a mensagem para o usuário
      mostrar(e instanceof Error && e.name === 'ErroLeitura' ? e.message : `Não foi possível ler ${f.name}.`, 'erro')
    } finally {
      if (abortarLeitura.current === ctrl) setLendo(null)
    }
  }

  // páginas sem texto (escaneadas) que a IA pode ler agora, dentro do limite do plano
  const limiteIaPdf = PLANOS[planoId].limites.paginasPdfIa
  const paraIa = material ? paginasParaIa(material, limiteIaPdf) : []
  const custoDaLeitura = custoLeituraPdf(paraIa.length)

  /** A IA lê as páginas escaneadas: monta um PDF só com elas (imagem), envia e junta o texto na ordem das páginas. */
  const lerComIa = async () => {
    const d = pdfAberto.current
    if (!d || !material || !paraIa.length) return
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
      const emBranco = [...material.emBranco, ...montado.emBranco]
      if (!montado.paginas.length) {
        setMaterial(aposLeituraIa(material, paraIa, [], emBranco))
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
      usarTexto(texto, aposLeituraIa(material, paraIa, r.paginas.map((p) => p.pagina), emBranco))
      mostrar(`A IA leu ${r.paginas.length} ${r.paginas.length === 1 ? 'página' : 'páginas'} · ${r.caracteres.toLocaleString('pt-BR')} caracteres · ${cobrado} créditos.`)
    } catch (e) {
      if (ctrl.signal.aborted) return
      if ((e as { code?: string } | null)?.code === 'limite_do_plano') return abrirCompra(mensagemDeErro(e))
      mostrar(mensagemDeErro(e, 'A IA não conseguiu ler as páginas. Nenhum crédito foi cobrado.'), 'erro')
    } finally {
      if (abortarLeitura.current === ctrl) setLendo(null)
    }
  }

  // ---------- passo 2: edição do roteiro ----------
  const atualizarTela = (i: number, patch: Partial<TelaRoteiro>) => setRoteiro((r) => (r ? { ...r, telas: r.telas.map((t, k) => (k === i ? { ...t, ...patch } : t)) } : r))
  const mover = (i: number, d: number) =>
    setRoteiro((r) => {
      if (!r) return r
      const k = i + d
      if (k < 0 || k >= r.telas.length) return r
      const t = [...r.telas]
      ;[t[i], t[k]] = [t[k]!, t[i]!]
      return { ...r, telas: t }
    })
  const remover = (i: number) => setRoteiro((r) => (r && r.telas.length > 1 ? { ...r, telas: r.telas.filter((_, k) => k !== i) } : r))
  const adicionar = () => setRoteiro((r) => (r ? { ...r, telas: [...r.telas, { tipo: 'conceito', rotulo: '', titulo: 'Nova tela', texto: 'Descreva o que esta tela deve mostrar.', itens: [], notas: '' }] } : r))

  const modo = formato
  const limpo = useMemo<Roteiro | null>(() => (roteiro ? { titulo: roteiro.titulo.trim() || 'Nova apresentação', telas: roteiro.telas.map((t) => ({ ...t, titulo: t.titulo.trim() || 'Sem título' })) } : null), [roteiro])
  const chaves = useMemo(() => (limpo ? limpo.telas.map((t) => chaveDesenho(t, modo)) : []), [limpo, modo])
  const pendentes = chaves.map((k, i) => (desenhos[k] ? -1 : i)).filter((i) => i >= 0)
  const custoDoDesenho = custoDesenho(pendentes.length)
  const prontas = chaves.filter((k) => desenhos[k]).length

  const documento = useMemo(() => {
    if (!limpo || passo !== 3) return null
    return montarDocumento(limpo, { modo, tema, estilo, imagens, densidade, marca, desenho: chaves.map((k) => desenhos[k]) })
  }, [limpo, passo, modo, tema, estilo, imagens, densidade, marca, chaves, desenhos])
  useFontesDoDocumento(documento ?? { scenes: [] })

  /** Desenha as telas que ainda não têm desenho: a primeira sozinha (escreve o cache do roteiro), depois em lotes. */
  const desenhar = async (indices: number[]) => {
    if (!limpo || !indices.length) return
    const ctrl = new AbortController()
    abortar.current?.abort()
    abortar.current = ctrl
    setDesenhando(true)
    const base = { roteiro: limpo, formato: modo, estilo, tema, tipo: tipo === 'auto' ? tipoDetectado : tipo, publico: publico.trim().slice(0, 200), ...(tom ? { tom } : {}), marca }
    const guardar = (lista: { indice: number; desenho: TelaDesenhada }[]) => setDesenhos((d) => ({ ...d, ...Object.fromEntries(lista.map((t) => [chaves[t.indice]!, t.desenho])) }))
    const lote = async (ids: number[]) => {
      try {
        const r = await desenharTelas({ ...base, indices: ids }, ctrl.signal)
        const cobrado = DEMO ? custoDesenho(ids.length) : r.creditos
        dados.registrarUsoIa({ custo: cobrado, motivo: `Design com IA · ${ids.length} ${ids.length === 1 ? 'tela' : 'telas'}`, gerador: 'claude', houveResultado: cobrado > 0 })
        guardar(r.telas)
      } catch (e) {
        if (ctrl.signal.aborted) return
        // sem a rota (ou sem saldo no servidor), a tela não fica em branco: entra o desenho local
        const locais = desenharLocal(limpo, { story: modo === 'story', estilo, tema: resolverTema(tema, marca) })
        guardar(ids.map((i) => ({ indice: i, desenho: locais[i]! })))
        mostrar(mensagemDeErro(e, 'Algumas telas foram desenhadas localmente.'), 'erro')
      }
    }
    try {
      const [primeira, ...resto] = indices
      await lote([primeira!])
      const lotes = noIntervalo(resto, Math.min(3, MAX_TELAS_POR_PEDIDO_DESIGN))
      for (const par of noIntervalo(lotes, 2)) await Promise.all(par.map(lote))
    } finally {
      if (abortar.current === ctrl) setDesenhando(false)
    }
  }

  const gerarApresentacao = () => {
    if (!limpo) return
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoDoDesenho)
    if (!decisao.ok) return abrirCompra(`${decisao.motivo.replace(' Compre um pacote avulso ou faça upgrade.', '')} Escolha um pacote para continuar.`)
    setRevelar(0)
    setPasso(3)
    void desenhar(pendentes)
  }

  const total = documento?.scenes.length ?? 0
  const pronto = passo === 3 && total > 0 && prontas >= total && revelar >= total

  // revela as telas uma a uma, conforme os desenhos chegam
  useEffect(() => {
    if (passo !== 3 || revelar >= prontas) return
    const t = setTimeout(() => setRevelar((n) => n + 1), revelar === 0 ? 120 : 300)
    return () => clearTimeout(t)
  }, [passo, revelar, prontas])

  // cria o projeto quando todas as telas estão desenhadas (e atualiza o mesmo projeto ao trocar tema ou voltar ao roteiro)
  useEffect(() => {
    if (!pronto || !documento || !roteiro || criadoPara.current === documento) return
    criadoPara.current = documento
    const nome = roteiro.titulo.trim().slice(0, 80) || 'Nova apresentação'
    // voltar ao roteiro e gerar de novo atualiza o mesmo projeto em vez de criar outro
    const existente = projetoId ? dados.estado().projetos.find((p) => p.id === projetoId && !p.excluidoEm) : undefined
    setSalvandoProjeto(true)
    const gravar = existente && existente.modo === modo
      ? dados.salvarDocumento(existente.id, documento, existente.revisaoAtual).then(() => dados.atualizarProjeto(existente.id, { nome }))
      : dados.criarProjeto({ nome, modo, descricao: prompt.slice(0, 280), documento }).then((p) => setProjetoId(p.id))
    gravar
      .catch((e) => {
        if (criadoPara.current !== documento) return
        criadoPara.current = null
        mostrar(mensagemDeErro(e, 'Não foi possível criar o projeto.'), 'erro')
        setPasso(2)
      })
      .finally(() => setSalvandoProjeto(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, documento])

  const temas: TemaVisual[] = [...(marca.cores.length ? [resolverTema('marca', marca)] : []), ...TEMAS]
  const definirCor = (k: number, v: string) => setCores((c) => c.map((x, j) => (j === k ? v.toUpperCase() : x)))

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-borda pb-4">
        <h1 className="flex items-center gap-2 text-[15px] font-medium"><span className="h-2 w-2 rounded-full bg-acento" />Criar com IA</h1>
        <ol className="order-3 flex w-full items-center justify-center gap-1.5 text-[13px] sm:order-none sm:mx-auto sm:w-auto" aria-label="Etapas">
          {['Prompt', 'Roteiro', 'Apresentação'].map((rotulo, i) => (
            <li key={rotulo} aria-current={passo === i + 1 ? 'step' : undefined} className={cx('flex items-center gap-2 rounded-full px-3 py-1.5', passo === i + 1 ? 'bg-grafite text-fundo' : passo > i + 1 ? 'text-texto' : 'text-[#A3A3A3]')}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-current text-[11px] font-semibold">{i + 1}</span>
              <span className="hidden sm:inline">{rotulo}</span>
            </li>
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <button type="button" onClick={() => abrirCompra()} title="Comprar créditos" className="flex h-8 items-center gap-1.5 rounded-full border border-borda bg-superficie px-3 text-[12px] text-texto2 hover:border-bordaForte hover:text-texto">
            <Sparkles className="h-3.5 w-3.5 text-acento" /><span className="mono text-texto">{saldo.toLocaleString('pt-BR')}</span><span className="hidden md:inline">créditos · {textoApresentacoes(saldo)}</span>
          </button>
          <Link href="/app" aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-texto3 hover:bg-hover hover:text-texto"><X className="h-[18px] w-[18px]" /></Link>
        </div>
      </div>

      {passo === 1 && (
        <div className="relative flex-1 overflow-hidden">
          <div aria-hidden className="pointer-events-none hidden md:block">
            <div className="absolute left-[6%] top-[90px] h-[90px] w-[90px] rounded-full bg-coral" />
            <div className="absolute left-[11%] top-[200px] h-[60px] w-[60px] rotate-[-14deg] bg-lima [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
            <div className="absolute right-[7%] top-[110px] h-[70px] w-[70px] rotate-[18deg] bg-violeta" />
            <div className="absolute right-[10%] top-[230px] h-[55px] w-[110px] rounded-t-full bg-ipe" />
            <div className="absolute bottom-20 left-[4%] h-20 w-[120px] [background-image:radial-gradient(#171717_2.5px,transparent_3px)] [background-size:16px_16px]" />
          </div>
          <div className="relative mx-auto flex w-full max-w-[860px] flex-col gap-7 pb-10 pt-10 sm:pt-14">
            <div className="text-center">
              <h2 className="titulo-display text-balance text-[clamp(34px,4.6vw,60px)] font-semibold leading-[0.95] tracking-[-0.05em]">O que você quer apresentar hoje?</h2>
              <p className="mt-4 text-[17px] text-[#525252]">Descreva o assunto. A IA escreve o roteiro, você ajusta e ela desenha cada tela com o design system.</p>
            </div>
            <div className="self-center"><Segmento claro rotulo="Origem do conteúdo" opcoes={ORIGENS} valor={origem} aoMudar={setOrigem} nomes={(o) => NOMES_ORIGEM[o]} /></div>

            <div role="radiogroup" aria-label="Tipo de apresentação" className="-mt-2 flex flex-wrap justify-center gap-1.5">
              {(['auto', ...TIPOS_APRESENTACAO] as TipoPedido[]).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tipo === t} title={t === 'auto' ? `A IA reconhece pelo pedido${prompt.trim() ? ` (agora: ${TIPOS[tipoDetectado].nome})` : ''}` : TIPOS[t].descricao} onClick={() => setTipo(t)} className={cx('rounded-full border-[1.5px] px-3 py-1 text-[13px] font-medium transition-colors', tipo === t ? 'border-grafite bg-grafite text-fundo' : 'border-[#E2E1DE] bg-white text-[#525252] hover:border-grafite hover:text-texto')}>
                  {NOMES_TIPO_CURTO[t]}
                </button>
              ))}
            </div>

            <div
              className={cx('overflow-hidden rounded-[18px] border-2 border-grafite bg-white shadow-[8px_8px_0_#171717]', arrastando && 'ring-4 ring-acento/40')}
              onDragOver={(e) => { if (origem !== 'zero') { e.preventDefault(); setArrastando(true) } }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { if (origem === 'zero') return; e.preventDefault(); setArrastando(false); setOrigem('arquivo'); void importar(e.dataTransfer.files[0]) }}
            >
              {origem === 'arquivo' && (
                <div className="border-b border-borda px-6 py-3 text-[14px]">
                  <div className="flex items-center gap-3">
                    {arquivo ? <><FileText className="h-4 w-4 shrink-0 text-acento" /><span className="truncate font-medium">{arquivo}</span></> : <span className="text-texto3">Nenhum arquivo ainda · PDF, .docx, .txt, .md ou .html</span>}
                    <button type="button" onClick={() => entradaArquivo.current?.click()} disabled={!!lendo} className="ml-auto flex shrink-0 items-center gap-2 rounded-full border-[1.5px] border-bordaForte px-3 py-1.5 text-[13px] font-medium hover:border-grafite disabled:opacity-50"><Upload className="h-3.5 w-3.5" />{arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}</button>
                    <input ref={entradaArquivo} type="file" accept={EXTENSOES_TEXTO} aria-label="Arquivo de material" className="hidden" onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = '' }} />
                  </div>
                  {lendo && <ProgressoLeitura lendo={lendo} />}
                  {material && !lendo && (
                    <div className="mt-2.5 flex flex-col gap-2 text-[13px]" data-testid="resumo-material">
                      <div className="text-texto2" aria-live="polite">
                        <span className="font-medium text-texto">Lido:</span> {resumoMaterial(material)}
                        {material.lidasPelaIa.length > 0 && <> · {material.lidasPelaIa.length === 1 ? 'página' : 'páginas'} {listaDePaginas(material.lidasPelaIa)} {material.lidasPelaIa.length === 1 ? 'lida' : 'lidas'} pela IA</>}
                        {material.cortado && <> · usamos os primeiros {MAX_TEXTO.toLocaleString('pt-BR')} caracteres</>}
                      </div>
                      {conteudo.length > 0 && (
                        <div className="text-texto3">No roteiro, este material soma <span className="mono text-texto">{custoRoteiro(telas, conteudo.length) - custoRoteiro(telas)}</span> {custoRoteiro(telas, conteudo.length) - custoRoteiro(telas) === 1 ? 'crédito' : 'créditos'} (1 a cada {MATERIAL_CREDITOS.caracteres.toLocaleString('pt-BR')} caracteres), já incluídos no total abaixo. Revise o texto antes de gerar.</div>
                      )}
                      <AvisoPaginasPdf material={material} paraIa={paraIa} custo={custoDaLeitura} limite={limiteIaPdf} plano={PLANOS[planoId].nome} onLerComIa={() => void lerComIa()} />
                    </div>
                  )}
                </div>
              )}
              <label htmlFor="criar-prompt" className="sr-only">{origem === 'zero' ? 'Descreva a apresentação' : 'Texto de base'}</label>
              <textarea
                id="criar-prompt"
                value={origem === 'zero' ? prompt : conteudo}
                onChange={(e) => (origem === 'zero' ? setPrompt(e.target.value.slice(0, 4000)) : setConteudo(e.target.value.slice(0, MAX_TEXTO)))}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void gerarRoteiro() }}
                rows={origem === 'zero' ? 4 : 7}
                placeholder={PLACEHOLDER[origem]}
                className="w-full resize-none bg-transparent px-6 pb-3 pt-6 text-[19px] leading-normal outline-none placeholder:text-[#A3A3A3]"
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EFED] px-5 py-3 text-[13px]">
                <label className="flex min-w-[200px] flex-1 items-center gap-2 text-texto3">
                  <span className="shrink-0">Para quem</span>
                  <input value={publico} maxLength={200} onChange={(e) => setPublico(e.target.value)} placeholder={TIPOS[tipoDetectado].publico || 'ex.: diretoria, alunos, clientes'} className="min-w-0 flex-1 rounded-md bg-[#F5F5F4] px-2.5 py-1.5 text-texto outline-none placeholder:text-[#B5B5B5]" />
                </label>
                <label className="flex items-center gap-2 text-texto3">
                  <span>Tom</span>
                  <select aria-label="Tom" value={tom} onChange={(e) => setTom(e.target.value as Tom | '')} className="rounded-md bg-[#F5F5F4] px-2 py-1.5 text-texto outline-none">
                    <option value="">Padrão ({NOMES_TOM[TIPOS[tipoDetectado].tom]})</option>
                    {TONS.map((t) => <option key={t} value={t}>{NOMES_TOM[t]}</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-2 text-texto3">
                  <Palette className="h-3.5 w-3.5" aria-hidden />
                  <input aria-label="Nome da marca" value={marcaNome} maxLength={60} onChange={(e) => setMarcaNome(e.target.value)} placeholder="Marca (opcional)" className="w-[130px] rounded-md bg-[#F5F5F4] px-2.5 py-1.5 text-texto outline-none placeholder:text-[#B5B5B5]" />
                  {cores.map((c, k) => (
                    <span key={k} className="relative flex items-center">
                      <input type="color" aria-label={`Cor da marca ${k + 1}`} value={c} onChange={(e) => definirCor(k, e.target.value)} className="h-7 w-7 cursor-pointer rounded-full border border-borda bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0" />
                      <button type="button" aria-label={`Remover cor ${k + 1}`} onClick={() => setCores((x) => x.filter((_, j) => j !== k))} className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-grafite text-[9px] text-white [span:hover>&]:flex">×</button>
                    </span>
                  ))}
                  {cores.length < 3 && <button type="button" onClick={() => setCores((x) => [...x, x.length === 0 ? '#5965F2' : x.length === 1 ? '#171717' : '#F2C14E'])} className="flex h-7 items-center gap-1 rounded-full border border-dashed border-[#D6D4D0] px-2 text-[12px] hover:border-grafite hover:text-texto"><Plus className="h-3 w-3" />{cores.length ? 'cor' : 'cores da marca'}</button>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-1">
                <Segmento rotulo="Formato" opcoes={FORMATOS_IA} valor={formato} aoMudar={setFormato} nomes={(f) => NOMES_FORMATO[f]} />
                <Segmento rotulo="Quantidade de telas" opcoes={opcoesTelas.map(String)} valor={String(telas)} aoMudar={(v) => setTelas(Number(v))} nomes={(n) => `${n} telas`} />
                <Segmento rotulo="Estilo" opcoes={ESTILOS} valor={estilo} aoMudar={setEstilo} nomes={(e) => NOMES_ESTILO[e]} />
                <button
                  type="button"
                  onClick={() => void gerarRoteiro()}
                  disabled={!podeGerar}
                  className="ml-auto flex h-[46px] items-center gap-2.5 rounded-full border-2 border-grafite bg-violeta px-[22px] text-[15px] font-semibold text-white hover:bg-[#4A55E0] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {gerando ? 'Gerando roteiro' : 'Gerar roteiro →'}
                  {gerando && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                </button>
              </div>
            </div>
            <div className="-mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[12px] text-texto3">
              <span>Apresentação de {telas} telas · <span className="mono text-texto">{custoTotal}</span> créditos (1 por tela{custoDoRoteiro > 0 ? ` + ${custoDoRoteiro} pelo material longo` : ''}; o roteiro é grátis)</span>
              <span>·</span>
              {semSaldo
                ? <span className="text-perigo">você tem {saldo.toLocaleString('pt-BR')} <button type="button" onClick={() => abrirCompra()} className="ml-1 font-medium text-acento underline-offset-2 hover:underline">Comprar créditos</button></span>
                : <span>seu saldo dá {textoApresentacoes(saldo, telas)} assim</span>}
              <span className="hidden sm:inline">· ⌘↵ para gerar</span>
              {opcoesTelas.length < QUANTIDADES_TELAS.length && <span className="w-full">No plano {PLANOS[planoId].nome}, até {PLANOS[planoId].limites.telasPorPrompt} telas por apresentação. <Link href="/app/settings#plano" className="text-acento hover:underline">Ver planos</Link></span>}
            </div>

            {origem === 'zero' && (
              <div className="flex flex-col gap-3">
                <div className="rotulo-mono text-center">Ou comece por um exemplo</div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
                  {EXEMPLOS.map((ex) => (
                    <button key={ex.texto} type="button" onClick={() => { setPrompt(ex.texto); setTipo(ex.tipo) }} className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#E7E5E4] bg-white p-3.5 text-left hover:border-grafite">
                      <span className="h-10 w-10 flex-none" style={{ background: ex.cor, borderRadius: ex.raio }} />
                      <span className="text-[14px] leading-[1.4] text-[#3F3F3F]"><span className="mono mb-0.5 block text-[10px] uppercase tracking-[0.08em] text-texto3">{NOMES_TIPO_CURTO[ex.tipo]}</span>{ex.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {passo === 2 && roteiro && (
        <div className="grid min-h-0 flex-1 gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 pb-6">
            <div className="mx-auto flex max-w-[760px] flex-col gap-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="rotulo-mono">Roteiro · {roteiro.telas.length} telas</div>
                  <button type="button" onClick={() => void gerarRoteiro(true)} disabled={gerando} className="flex h-[34px] items-center gap-2 rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-3.5 text-[13px] font-medium hover:border-grafite disabled:opacity-50">
                    <RotateCcw className={cx('h-3.5 w-3.5', gerando && 'animate-spin')} />Gerar outro roteiro <span className="mono text-texto3">· {custoDoRoteiro} créditos</span>
                  </button>
                </div>
                <label htmlFor="titulo-roteiro" className="sr-only">Título da apresentação</label>
                <textarea id="titulo-roteiro" rows={1} value={roteiro.titulo} maxLength={120} onChange={(e) => setRoteiro({ ...roteiro, titulo: e.target.value.replace(/\n/g, ' ') })} className="mt-2 w-full resize-none bg-transparent p-0 text-[clamp(26px,3.6vw,38px)] font-semibold leading-[1.1] tracking-[-0.045em] outline-none [field-sizing:content]" />
              </div>
              {nota && <div className="text-[13px] text-texto3">{nota}</div>}
              {roteiro.telas.map((t, i) => {
                const c = CORES_CARTAO[i % CORES_CARTAO.length]!
                const comp = COMPONENTES[t.tipo]
                return (
                  <div key={i} className="flex items-start gap-4 rounded-[14px] border-[1.5px] border-[#E7E5E4] bg-white py-4 pl-3 pr-4 hover:border-[#A3A3A3]">
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center text-[13px] font-semibold" style={{ background: c, color: tinta(c), borderRadius: FORMAS[i % 4] === '0' ? '4px' : FORMAS[i % 4] }}>{i + 1}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <input aria-label={`Rótulo da tela ${i + 1}`} value={t.rotulo} maxLength={40} placeholder="rótulo" onChange={(e) => atualizarTela(i, { rotulo: e.target.value })} className="mono w-[120px] shrink-0 bg-transparent p-0 text-[11px] uppercase tracking-[0.06em] text-texto3 outline-none placeholder:normal-case placeholder:text-[#C5C5C5]" />
                        <span className="flex-1" />
                        {desenhos[chaves[i] ?? ''] && <span className="mono rounded-full bg-[#F0F7EC] px-1.5 py-0.5 text-[9px] text-[#3F6B4A]" title="Já desenhada: trocar o tema não custa nada">DESENHADA</span>}
                        <select aria-label={`Tipo da tela ${i + 1}`} value={t.tipo} onChange={(e) => atualizarTela(i, { tipo: e.target.value as TipoTela })} className="rounded-md bg-[#F5F5F4] px-2 py-1 text-[12px] text-[#525252] outline-none hover:bg-hover">
                          {TIPOS_TELA.map((tp) => <option key={tp} value={tp}>{NOMES_TIPO_TELA[tp]}</option>)}
                        </select>
                      </div>
                      <input aria-label={`Título da tela ${i + 1}`} value={t.titulo} maxLength={160} onChange={(e) => atualizarTela(i, { titulo: e.target.value })} className="min-w-0 bg-transparent p-0 text-[17px] font-semibold tracking-[-0.02em] outline-none" />
                      {comp.limites.texto > 0 && <textarea aria-label={`Texto da tela ${i + 1}`} value={t.texto} maxLength={600} rows={2} placeholder="Texto de apoio (opcional)" onChange={(e) => atualizarTela(i, { texto: e.target.value })} className="w-full resize-none bg-transparent p-0 text-[14px] leading-normal text-[#525252] outline-none placeholder:text-[#B5B5B5]" />}
                      {comp.maxItens > 0 && (
                        <textarea aria-label={`Itens da tela ${i + 1}`} value={t.itens.join('\n')} rows={Math.max(2, Math.min(6, t.itens.length))} placeholder={`Um por linha: ${comp.itens}`} onChange={(e) => atualizarTela(i, { itens: e.target.value.split('\n').slice(0, 6).map((l) => l.slice(0, 160)) })} className="mono w-full resize-none rounded-md bg-[#FAFAF9] px-2 py-1.5 text-[13px] leading-relaxed text-[#3F3F3F] outline-none placeholder:text-[#B5B5B5]" />
                      )}
                      {t.notas && <details className="text-[13px] text-texto3"><summary className="cursor-pointer select-none">Notas do apresentador</summary><textarea aria-label={`Notas da tela ${i + 1}`} value={t.notas} maxLength={1200} rows={3} onChange={(e) => atualizarTela(i, { notas: e.target.value })} className="mt-1 w-full resize-none rounded-md bg-[#FAFAF9] px-2 py-1.5 outline-none" /></details>}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" title="Subir" aria-label={`Subir tela ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)} className="flex h-[26px] w-7 items-center justify-center rounded-md text-texto3 hover:bg-hover hover:text-texto disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Descer" aria-label={`Descer tela ${i + 1}`} disabled={i === roteiro.telas.length - 1} onClick={() => mover(i, 1)} className="flex h-[26px] w-7 items-center justify-center rounded-md text-texto3 hover:bg-hover hover:text-texto disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Remover" aria-label={`Remover tela ${i + 1}`} disabled={roteiro.telas.length <= 1} onClick={() => remover(i)} className="flex h-[26px] w-7 items-center justify-center rounded-md text-texto3 hover:bg-[#FBF0EE] hover:text-[#C0392B] disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )
              })}
              {roteiro.telas.length < 100 && <button type="button" onClick={adicionar} className="h-12 rounded-[14px] border-[1.5px] border-dashed border-[#D6D4D0] text-[14px] text-texto3 hover:border-grafite hover:text-texto">+ Adicionar tela</button>}
            </div>
          </div>
          <aside aria-label="Aparência da apresentação" className="flex flex-col gap-7 self-start rounded-xl border border-borda bg-white p-5 lg:sticky lg:top-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between"><span className="text-[14px] font-semibold">Tema</span><span className="text-[12px] text-texto3">cores, fontes e formas</span></div>
              <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2.5">
                {temas.map((t, i) => <AmostraTema key={t.id} t={t} i={i} ativo={tema === t.id} sugerido={t.id === temaIa} aoEscolher={() => setTema(t.id as TemaEscolhido)} />)}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="text-[14px] font-semibold">Estilo</div>
              <div className="[&>div]:w-full [&_button]:flex-1"><Segmento rotulo="Estilo da apresentação" opcoes={ESTILOS} valor={estilo} aoMudar={setEstilo} nomes={(e) => NOMES_ESTILO[e]} /></div>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="text-[14px] font-semibold">Imagens</div>
              {([['formas', 'Formas do tema', 'motivos e cor'], ['placeholders', 'Espaços para imagens', 'você envia'], ['nenhuma', 'Sem imagens', 'só tipografia']] as const).map(([id, rotulo, sub]) => (
                <button key={id} type="button" aria-pressed={imagens === id} onClick={() => setImagens(id)} className={cx('flex justify-between gap-2 rounded-[10px] border-[1.5px] px-3.5 py-3 text-left text-[14px]', imagens === id ? 'border-violeta bg-[#F4F5FE]' : 'border-borda bg-white hover:border-bordaForte')}>
                  <span>{rotulo}</span><span className="text-[12px] text-texto3">{sub}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="text-[14px] font-semibold">Texto por tela</div>
              <div className="[&>div]:w-full [&_button]:flex-1">
                <Segmento rotulo="Texto por tela" opcoes={['minimo', 'medio', 'detalhado'] as const} valor={densidade} aoMudar={setDensidade} nomes={(d) => ({ minimo: 'Mínimo', medio: 'Médio', detalhado: 'Detalhado' })[d]} />
              </div>
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <button type="button" onClick={gerarApresentacao} className="h-[52px] rounded-full border-2 border-grafite bg-grafite text-[15px] font-semibold text-fundo shadow-[5px_5px_0_#5965F2] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">Gerar apresentação</button>
              <p className="text-center text-[12px] text-texto3">{pendentes.length ? <>A IA desenha {pendentes.length} {pendentes.length === 1 ? 'tela' : 'telas'} · <span className="mono text-texto">{custoDoDesenho}</span> créditos</> : 'Todas as telas já estão desenhadas · grátis'}</p>
              <button type="button" onClick={() => setPasso(1)} className="h-10 text-[14px] text-texto3 hover:text-texto">← Voltar ao prompt</button>
            </div>
          </aside>
        </div>
      )}

      {passo === 3 && documento && (
        <div className="flex-1 pb-10 pt-8">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="rotulo-mono flex items-center gap-2" aria-live="polite">
                  {(!pronto || salvandoProjeto) && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-[#E7E5E4] border-t-violeta" />}
                  {pronto ? (salvandoProjeto ? 'Salvando o projeto…' : `Pronto · ${total} telas`) : `Desenhando tela ${Math.min(revelar + 1, total)} de ${total}`}
                </div>
                <h2 className="mt-2 text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.045em]">{roteiro?.titulo}</h2>
              </div>
              <div className={cx('flex flex-wrap gap-2.5 transition-opacity', !pronto && 'pointer-events-none opacity-35')}>
                <button type="button" onClick={() => setPasso(2)} className="flex h-11 items-center rounded-full px-4 text-[14px] text-texto3 hover:text-texto">← Ajustar roteiro</button>
                {projetoId && <button type="button" onClick={() => abrirApresentacao(router, projetoId)} className="flex h-11 items-center rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-[18px] text-[14px] font-medium hover:border-grafite">Apresentar</button>}
                {projetoId && <Link href={`/app/projects/${projetoId}/share`} className="flex h-11 items-center rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-[18px] text-[14px] font-medium hover:border-grafite">Publicar e enviar</Link>}
                {projetoId && <button type="button" onClick={() => router.push(`/app/projects/${projetoId}/edit`)} className="flex h-11 items-center rounded-full border-2 border-grafite bg-violeta px-[18px] text-[14px] font-semibold text-white hover:bg-[#4A55E0]">Abrir no editor →</button>}
              </div>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-[#EDECEA]"><div className="h-1 bg-violeta transition-[width] duration-400" style={{ width: `${total ? (Math.min(revelar, total) / total) * 100 : 0}%` }} /></div>
            <div role="radiogroup" aria-label="Trocar tema" className={cx('flex flex-wrap items-center gap-2 text-[12px] text-texto3 transition-opacity', !pronto && 'pointer-events-none opacity-35')}>
              <span className="mr-1">Tema · grátis:</span>
              {temas.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={tema === t.id} title={t.nome} onClick={() => setTema(t.id as TemaEscolhido)} className={cx('flex h-7 items-center gap-1.5 rounded-full border-[1.5px] pl-1 pr-2.5', tema === t.id ? 'border-grafite text-texto' : 'border-[#E2E1DE] hover:border-grafite')}>
                  <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${t.capa === 'escuro' ? t.escuro.fundo : t.claro.fundo} 50%, ${t.acento} 50%)`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />{t.nome}
                </button>
              ))}
              {desenhando && <span className="ml-auto">a IA está desenhando…</span>}
            </div>
            <div className={cx('grid gap-5', formato === 'story' ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))]')}>
              {documento.scenes.map((cena, i) => {
                const visivel = i < revelar && !!desenhos[chaves[i] ?? '']
                return (
                  <div key={cena.id} className="flex flex-col gap-2">
                    <div className={cx('overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)]', visivel ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-40')}>
                      {visivel ? <MiniaturaFluida cena={cena} /> : <div className="flex items-center justify-center bg-[#F0EFED]" style={{ aspectRatio: `${cena.size.width} / ${cena.size.height}` }}><span aria-hidden className="h-[22px] w-[22px] animate-spin rounded-full border-[2.5px] border-[#E2E1DE] border-t-violeta" /></div>}
                    </div>
                    <div className="truncate text-[13px] text-[#525252]">{String(i + 1).padStart(2, '0')} · {cena.title}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
