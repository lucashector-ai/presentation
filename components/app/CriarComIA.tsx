'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, FileText, RotateCcw, Upload, X } from 'lucide-react'
import { Marca } from '@/components/ui/Logo'
import { cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { SceneRenderer } from '@/components/renderer/SceneRenderer'
import { useFontesDoDocumento } from '@/components/renderer/fontes'
import { api, ErroApiCliente } from '@/lib/api/cliente'
import { atualizarProjeto, criarProjeto, ErroDemo, gastarCreditos, obterProjeto, salvarDocumento, saldoCreditos } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { sessaoAtiva } from '@/lib/sessao'
import { PALETA } from '@/lib/design-tokens'
import { FORMATOS_IA, ORIGENS, QUANTIDADES_TELAS } from '@/lib/ia/pedido'
import { ESTILOS, TEMAS, TIPOS_TELA, montarDocumento, type Densidade, type Estilo, type OpcaoImagens, type Roteiro, type TemaId, type TelaRoteiro, type TipoTela } from '@/lib/ia/roteiro'
import { custoDe, podeGastarCreditos } from '@/lib/planos'
import type { Cena, DocumentoProjeto } from '@/lib/scene/schema'

type Formato = (typeof FORMATOS_IA)[number]
type Origem = (typeof ORIGENS)[number]

const NOMES_ORIGEM: Record<Origem, string> = { zero: 'Gerar do zero', texto: 'Colar texto', arquivo: 'Importar arquivo' }
const NOMES_FORMATO: Record<Formato, string> = { slides: 'Slides', story: 'Story', explorar: 'Explorar' }
const NOMES_ESTILO: Record<Estilo, string> = { editorial: 'Editorial', ousado: 'Ousado', minimal: 'Minimal' }
const NOMES_TIPO: Record<TipoTela, string> = { capa: 'Capa', conceito: 'Conceito', secao: 'Seção', lista: 'Lista', numeros: 'Números', citacao: 'Citação', paleta: 'Paleta', tipografia: 'Tipografia', imagem: 'Imagem', comparacao: 'Comparação', encerramento: 'Encerramento' }
const DICA_ITENS: Partial<Record<TipoTela, string>> = { lista: 'Um ponto por linha', numeros: 'valor|legenda — ex.: 38%|mais passageiros', paleta: 'Nome|#hex — ex.: Terracota|#B4532A', comparacao: 'Linhas alternadas: esquerda, direita, esquerda…' }
const PLACEHOLDER: Record<Origem, string> = {
  zero: 'Ex.: Identidade visual para uma marca de cerâmica artesanal, com conceito, paleta, tipografia e aplicações…',
  texto: 'Cole aqui seu briefing, roteiro ou anotações. A IA transforma em telas.',
  arquivo: 'Arraste um arquivo de texto (.txt, .md, .html) — o conteúdo aparece aqui para você revisar.',
}
const EXEMPLOS = [
  { texto: 'Rebrand de uma cafeteria de bairro em São Paulo, com conceito, paleta, tipografia e aplicações.', cor: '#B4532A', raio: '50%' },
  { texto: 'Proposta de campanha de verão para uma marca de moda praia, com key visual e peças digitais.', cor: '#1F3B4D', raio: '6px' },
  { texto: 'Portfólio de diretora de arte com 5 cases, focado em identidade visual e editorial.', cor: '#D7F25C', raio: '0' },
  { texto: 'Pitch para festival de música independente buscando patrocinadores.', cor: '#E4572E', raio: '999px 999px 0 0' },
]
const FORMAS = ['50%', '6px', '0', '999px 999px 0 0']
const CORES_CARTAO = ['#E4572E', '#5965F2', '#F2C14E', '#1F3B4D', '#D7F25C', '#B4532A']
const EXTENSOES_TEXTO = '.txt,.md,.markdown,.html,.htm,.csv'
const MAX_TEXTO = 60000

const cor = (id: string) => PALETA.find((p) => p.id === id) ?? PALETA[0]!
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
  const [telas, setTelas] = useState<number>(8)
  const [estilo, setEstilo] = useState<Estilo>('editorial')
  const [gerando, setGerando] = useState(false)
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null)
  const [nota, setNota] = useState('')
  const [tema, setTema] = useState<TemaId>('argila')
  const [imagens, setImagens] = useState<OpcaoImagens>('formas')
  const [densidade, setDensidade] = useState<Densidade>('medio')
  const [desenhadas, setDesenhadas] = useState(0)
  const [projetoId, setProjetoId] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const abortar = useRef<AbortController | null>(null)
  const entradaArquivo = useRef<HTMLInputElement>(null)
  const criadoPara = useRef<DocumentoProjeto | null>(null)
  const saldo = useDemo((e) => e.creditos.saldo)

  const textoBase = origem === 'zero' ? prompt : conteudo
  const podeGerar = textoBase.trim().length >= (origem === 'zero' ? 3 : 20) && !gerando
  const custo = custoDe({ roteiro: 1, tela: telas })

  const [liberado, setLiberado] = useState(false)
  useEffect(() => {
    if (sessaoAtiva()) return setLiberado(true)
    router.replace(`/signup?${new URLSearchParams({ proximo: `${window.location.pathname}${window.location.search}` })}`)
  }, [router])
  useEffect(() => () => abortar.current?.abort(), [])

  const gerarRoteiro = async (outro = false) => {
    if (!podeGerar && !outro) return
    const decisao = podeGastarCreditos(saldoCreditos(), custo)
    if (!decisao.ok) return mostrar(decisao.motivo, 'erro')
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl
    setGerando(true)
    try {
      const r = await api.ia.roteiro(
        {
          origem,
          prompt: origem === 'zero' ? (outro ? `${prompt}\n\nProponha uma estrutura diferente da óbvia.` : prompt) : '',
          conteudo: origem === 'zero' ? '' : conteudo,
          formato,
          telas,
          estilo,
        },
        ctrl.signal
      )
      if (r.gerador === 'claude') {
        gastarCreditos(custo, `Roteiro com IA · ${telas} telas`)
        setNota(`Escrito pela IA · ${custo} créditos usados.`)
      } else {
        setNota('Roteiro-guia gerado localmente (a IA não está conectada neste ambiente). Nenhum crédito foi cobrado.')
      }
      setRoteiro(r.roteiro)
      setPasso(2)
    } catch (e) {
      if (ctrl.signal.aborted) return
      mostrar(e instanceof ErroApiCliente || e instanceof ErroDemo ? e.message : 'Não foi possível gerar o roteiro. Tente novamente.', 'erro')
    } finally {
      if (abortar.current === ctrl) setGerando(false)
    }
  }

  const importar = async (f: File | undefined) => {
    if (!f) return
    if (/\.(pdf|docx?|pptx?|key|fig)$/i.test(f.name)) {
      mostrar('Por enquanto o Mostra lê arquivos de texto (.txt, .md, .html). Abra o PDF/DOCX e cole o texto em "Colar texto".', 'erro')
      return
    }
    try {
      const texto = await lerArquivoTexto(f)
      if (!texto) return mostrar('O arquivo está vazio.', 'erro')
      setConteudo(texto.slice(0, MAX_TEXTO))
      setArquivo(f.name)
      if (texto.length > MAX_TEXTO) mostrar('O texto é longo; usamos os primeiros 60 mil caracteres.')
    } catch {
      mostrar(`Não foi possível ler ${f.name}.`, 'erro')
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
  const adicionar = () => setRoteiro((r) => (r ? { ...r, telas: [...r.telas, { tipo: 'conceito', titulo: 'Nova tela', texto: 'Descreva o que esta tela deve mostrar.', itens: [], notas: '' }] } : r))

  const modo = formato
  const documento = useMemo(() => {
    if (!roteiro || passo !== 3) return null
    const limpo: Roteiro = { titulo: roteiro.titulo.trim() || 'Nova apresentação', telas: roteiro.telas.map((t) => ({ ...t, titulo: t.titulo.trim() || 'Sem título' })) }
    return montarDocumento(limpo, { modo, tema, estilo, imagens, densidade })
  }, [roteiro, passo, modo, tema, estilo, imagens, densidade])
  useFontesDoDocumento(documento ?? { scenes: [] })

  const gerarApresentacao = () => {
    if (!roteiro) return
    setDesenhadas(0)
    setPasso(3)
  }

  // cria o projeto assim que o documento existe e revela as telas uma a uma
  useEffect(() => {
    if (passo !== 3 || !documento || !roteiro) return
    if (criadoPara.current !== documento) try {
      criadoPara.current = documento
      const nome = roteiro.titulo.trim().slice(0, 80) || 'Nova apresentação'
      // voltar ao roteiro e gerar de novo atualiza o mesmo projeto em vez de criar outro
      const existente = projetoId ? obterProjeto(projetoId) : undefined
      if (existente && existente.modo === modo) {
        salvarDocumento(existente.id, documento, existente.revisaoAtual)
        atualizarProjeto(existente.id, { nome })
      } else {
        setProjetoId(criarProjeto({ nome, modo, descricao: prompt.slice(0, 280), documento }).id)
      }
    } catch (e) {
      mostrar(e instanceof ErroDemo ? e.message : 'Não foi possível criar o projeto.', 'erro')
      setPasso(2)
      return
    }
    const total = documento.scenes.length
    let n = 0
    const t = setInterval(() => {
      n++
      setDesenhadas(n)
      if (n >= total) clearInterval(t)
    }, 380)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, documento])

  const total = documento?.scenes.length ?? 0
  const pronto = passo === 3 && total > 0 && desenhadas >= total

  if (!liberado) return <div className="min-h-dvh bg-fundo" />
  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      <header className="flex h-16 items-center gap-4 border-b border-borda bg-white px-4 sm:px-6">
        <Link href="/app" aria-label="Mostra — voltar ao painel" className="text-[22px]"><Marca /></Link>
        <span className="hidden text-[#D4D4D4] sm:inline">/</span>
        <span className="hidden items-center gap-2 text-[14px] font-medium sm:flex"><span className="h-2 w-2 rounded-full bg-acento" />Criar com IA</span>
        <ol className="mx-auto flex items-center gap-1.5 text-[13px]" aria-label="Etapas">
          {['Prompt', 'Roteiro', 'Apresentação'].map((rotulo, i) => (
            <li key={rotulo} aria-current={passo === i + 1 ? 'step' : undefined} className={cx('flex items-center gap-2 rounded-full px-3 py-1.5', passo === i + 1 ? 'bg-grafite text-fundo' : passo > i + 1 ? 'text-texto' : 'text-[#A3A3A3]')}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-current text-[11px] font-semibold">{i + 1}</span>
              <span className="hidden sm:inline">{rotulo}</span>
            </li>
          ))}
        </ol>
        <Link href="/app" aria-label="Fechar" className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-texto3 hover:bg-hover hover:text-texto"><X className="h-5 w-5" /></Link>
      </header>

      {passo === 1 && (
        <main className="relative flex-1 overflow-hidden">
          <div aria-hidden className="pointer-events-none hidden md:block">
            <div className="absolute left-[6%] top-[90px] h-[90px] w-[90px] rounded-full bg-coral" />
            <div className="absolute left-[11%] top-[200px] h-[60px] w-[60px] rotate-[-14deg] bg-lima [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
            <div className="absolute right-[7%] top-[110px] h-[70px] w-[70px] rotate-[18deg] bg-violeta" />
            <div className="absolute right-[10%] top-[230px] h-[55px] w-[110px] rounded-t-full bg-ipe" />
            <div className="absolute bottom-20 left-[4%] h-20 w-[120px] [background-image:radial-gradient(#171717_2.5px,transparent_3px)] [background-size:16px_16px]" />
          </div>
          <div className="relative mx-auto flex max-w-[820px] flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 sm:pt-[72px]">
            <div className="text-center">
              <h1 className="titulo-display text-balance text-[clamp(40px,5.4vw,72px)] font-semibold leading-[0.95] tracking-[-0.05em]">O que você quer apresentar hoje?</h1>
              <p className="mt-4 text-[18px] text-[#525252]">Descreva o projeto. A IA monta o roteiro, você ajusta e ela desenha as telas.</p>
            </div>
            <div className="self-center"><Segmento claro rotulo="Origem do conteúdo" opcoes={ORIGENS} valor={origem} aoMudar={setOrigem} nomes={(o) => NOMES_ORIGEM[o]} /></div>

            <div
              className={cx('overflow-hidden rounded-[18px] border-2 border-grafite bg-white shadow-[8px_8px_0_#171717]', arrastando && 'ring-4 ring-acento/40')}
              onDragOver={(e) => { if (origem !== 'zero') { e.preventDefault(); setArrastando(true) } }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { if (origem === 'zero') return; e.preventDefault(); setArrastando(false); setOrigem('arquivo'); void importar(e.dataTransfer.files[0]) }}
            >
              {origem === 'arquivo' && (
                <div className="flex items-center gap-3 border-b border-borda px-6 py-3 text-[14px]">
                  {arquivo ? <><FileText className="h-4 w-4 text-acento" /><span className="truncate font-medium">{arquivo}</span><span className="text-texto3">· {conteudo.length.toLocaleString('pt-BR')} caracteres</span></> : <span className="text-texto3">Nenhum arquivo ainda.</span>}
                  <button type="button" onClick={() => entradaArquivo.current?.click()} className="ml-auto flex items-center gap-2 rounded-full border-[1.5px] border-bordaForte px-3 py-1.5 text-[13px] font-medium hover:border-grafite"><Upload className="h-3.5 w-3.5" />Escolher arquivo</button>
                  <input ref={entradaArquivo} type="file" accept={EXTENSOES_TEXTO} className="hidden" onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = '' }} />
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
              <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3">
                <Segmento rotulo="Formato" opcoes={FORMATOS_IA} valor={formato} aoMudar={setFormato} nomes={(f) => NOMES_FORMATO[f]} />
                <Segmento rotulo="Quantidade de telas" opcoes={QUANTIDADES_TELAS.map(String)} valor={String(telas)} aoMudar={(v) => setTelas(Number(v))} nomes={(n) => `${n} telas`} />
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
            <p className="-mt-4 text-center text-[12px] text-texto3"><span className="mono">{custo}</span> créditos por roteiro de {telas} telas · saldo <span className="mono">{saldo.toLocaleString('pt-BR')}</span> · ⌘↵ para gerar</p>

            {origem === 'zero' && (
              <div className="flex flex-col gap-3">
                <div className="rotulo-mono text-center">Ou comece por um exemplo</div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                  {EXEMPLOS.map((ex) => (
                    <button key={ex.texto} type="button" onClick={() => setPrompt(ex.texto)} className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#E7E5E4] bg-white p-3.5 text-left hover:border-grafite">
                      <span className="h-10 w-10 flex-none" style={{ background: ex.cor, borderRadius: ex.raio }} />
                      <span className="text-[14px] leading-[1.4] text-[#3F3F3F]">{ex.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {passo === 2 && roteiro && (
        <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-auto px-4 pb-16 pt-10 sm:px-[clamp(20px,4vw,64px)] lg:pb-[120px]">
            <div className="mx-auto flex max-w-[760px] flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="rotulo-mono">Roteiro · {roteiro.telas.length} telas</div>
                  <label htmlFor="titulo-roteiro" className="sr-only">Título da apresentação</label>
                  <input id="titulo-roteiro" value={roteiro.titulo} maxLength={120} onChange={(e) => setRoteiro({ ...roteiro, titulo: e.target.value })} className="mt-2 w-full bg-transparent p-0 text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.045em] outline-none" />
                </div>
                <button type="button" onClick={() => void gerarRoteiro(true)} disabled={gerando} className="flex h-[38px] items-center gap-2 rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-3.5 text-[13px] font-medium hover:border-grafite disabled:opacity-50">
                  <RotateCcw className={cx('h-3.5 w-3.5', gerando && 'animate-spin')} />Gerar outro roteiro
                </button>
              </div>
              {nota && <div className="text-[13px] text-texto3">{nota}</div>}
              {roteiro.telas.map((t, i) => {
                const c = CORES_CARTAO[i % CORES_CARTAO.length]!
                const usaItens = t.tipo in DICA_ITENS
                return (
                  <div key={i} className="flex items-start gap-4 rounded-[14px] border-[1.5px] border-[#E7E5E4] bg-white py-4 pl-3 pr-4 hover:border-[#A3A3A3]">
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center text-[13px] font-semibold" style={{ background: c, color: tinta(c), borderRadius: FORMAS[i % 4] === '0' ? '4px' : FORMAS[i % 4] }}>{i + 1}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <input aria-label={`Título da tela ${i + 1}`} value={t.titulo} maxLength={120} onChange={(e) => atualizarTela(i, { titulo: e.target.value })} className="min-w-0 flex-1 bg-transparent p-0 text-[17px] font-semibold tracking-[-0.02em] outline-none" />
                        <select aria-label={`Tipo da tela ${i + 1}`} value={t.tipo} onChange={(e) => atualizarTela(i, { tipo: e.target.value as TipoTela })} className="rounded-md bg-[#F5F5F4] px-2 py-1 text-[12px] text-[#525252] outline-none hover:bg-hover">
                          {TIPOS_TELA.map((tp) => <option key={tp} value={tp}>{NOMES_TIPO[tp]}</option>)}
                        </select>
                      </div>
                      <textarea aria-label={`Texto da tela ${i + 1}`} value={t.texto} maxLength={600} rows={2} placeholder="Texto de apoio (opcional)" onChange={(e) => atualizarTela(i, { texto: e.target.value })} className="w-full resize-none bg-transparent p-0 text-[14px] leading-normal text-[#525252] outline-none placeholder:text-[#B5B5B5]" />
                      {usaItens && (
                        <textarea aria-label={`Itens da tela ${i + 1}`} value={t.itens.join('\n')} rows={Math.max(2, Math.min(6, t.itens.length))} placeholder={DICA_ITENS[t.tipo]} onChange={(e) => atualizarTela(i, { itens: e.target.value.split('\n').slice(0, 6).map((l) => l.slice(0, 160)) })} className="mono w-full resize-none rounded-md bg-[#FAFAF9] px-2 py-1.5 text-[13px] leading-relaxed text-[#3F3F3F] outline-none placeholder:text-[#B5B5B5]" />
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
          <aside className="flex flex-col gap-7 overflow-auto border-t border-borda bg-white px-6 py-7 lg:border-l lg:border-t-0">
            <div className="flex flex-col gap-3">
              <div className="text-[14px] font-semibold">Tema</div>
              <div role="radiogroup" aria-label="Tema" className="grid grid-cols-2 gap-2.5">
                {TEMAS.map((t, i) => {
                  const base = cor(t.base)
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={tema === t.id} onClick={() => setTema(t.id)} className="flex flex-col gap-1.5 text-left">
                      <span className={cx('relative block aspect-[16/10] w-full overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline outline-2 outline-offset-2', tema === t.id ? 'outline-violeta' : 'outline-transparent')} style={{ background: base.fundo }}>
                        <span className="absolute right-[10%] top-[12%] aspect-square w-[30%]" style={{ background: t.acento, borderRadius: FORMAS[i % 4] }} />
                        <span className="absolute bottom-[10%] left-[10%] text-[18px] font-semibold tracking-[-0.04em]" style={{ color: base.tinta, fontFamily: t.fonteTitulo === 'Geist' ? undefined : t.fonteTitulo }}>Aa</span>
                      </span>
                      <span className="text-[12px] text-[#525252]">{t.nome}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="text-[14px] font-semibold">Imagens</div>
              {([['formas', 'Formas e cor', 'Memphis'], ['placeholders', 'Placeholders', 'você envia'], ['nenhuma', 'Sem imagens', 'só tipografia']] as const).map(([id, rotulo, sub]) => (
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
            <div className="mt-auto flex flex-col gap-2.5">
              <button type="button" onClick={gerarApresentacao} className="h-[52px] rounded-full border-2 border-grafite bg-grafite text-[15px] font-semibold text-fundo shadow-[5px_5px_0_#5965F2] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">Gerar apresentação</button>
              <button type="button" onClick={() => setPasso(1)} className="h-10 text-[14px] text-texto3 hover:text-texto">← Voltar ao prompt</button>
            </div>
          </aside>
        </main>
      )}

      {passo === 3 && documento && (
        <main className="flex-1 px-4 pb-20 pt-10 sm:px-[clamp(20px,4vw,64px)]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="rotulo-mono flex items-center gap-2" aria-live="polite">
                  {!pronto && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-[#E7E5E4] border-t-violeta" />}
                  {pronto ? `Pronto · ${total} telas` : `Desenhando tela ${Math.min(desenhadas + 1, total)} de ${total}`}
                </div>
                <h1 className="mt-2 text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.045em]">{roteiro?.titulo}</h1>
              </div>
              <div className={cx('flex flex-wrap gap-2.5 transition-opacity', !pronto && 'pointer-events-none opacity-35')}>
                <button type="button" onClick={() => setPasso(2)} className="flex h-11 items-center rounded-full px-4 text-[14px] text-texto3 hover:text-texto">← Ajustar roteiro</button>
                {projetoId && <Link href={`/app/projects/${projetoId}/apresentar`} className="flex h-11 items-center rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-[18px] text-[14px] font-medium hover:border-grafite">Apresentar</Link>}
                {projetoId && <button type="button" onClick={() => router.push(`/app/projects/${projetoId}/edit`)} className="flex h-11 items-center rounded-full border-2 border-grafite bg-violeta px-[18px] text-[14px] font-semibold text-white hover:bg-[#4A55E0]">Abrir no editor →</button>}
              </div>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-[#EDECEA]"><div className="h-1 bg-violeta transition-[width] duration-400" style={{ width: `${total ? (Math.min(desenhadas, total) / total) * 100 : 0}%` }} /></div>
            <div className={cx('grid gap-5', formato === 'story' ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))]')}>
              {documento.scenes.map((cena, i) => (
                <div key={cena.id} className="flex flex-col gap-2">
                  <div className={cx('overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)]', i < desenhadas ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-40')}>
                    {i < desenhadas ? <MiniaturaFluida cena={cena} /> : <div className="flex items-center justify-center bg-[#F0EFED]" style={{ aspectRatio: `${cena.size.width} / ${cena.size.height}` }}><span aria-hidden className="h-[22px] w-[22px] animate-spin rounded-full border-[2.5px] border-[#E2E1DE] border-t-violeta" /></div>}
                  </div>
                  <div className="truncate text-[13px] text-[#525252]">{String(i + 1).padStart(2, '0')} · {cena.title}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
