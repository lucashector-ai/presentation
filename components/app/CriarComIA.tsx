'use client'
/**
 * "Criar com IA" em passos: Briefing → Marca → Material → Estilo → Tamanho → Revisar e gerar → Roteiro → Design.
 * O custo fica sempre à vista; o que é grátis aparece como grátis. Marca (logo, cores, fontes), estilo, fotos e
 * números são pedidos antes e aplicados sem IA (ou entram no roteiro de uma vez), para não gerar de novo depois.
 * O atalho do painel (/app/criar?prompt=…&telas=…) chega com o briefing preenchido, já no passo da marca.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { abrirApresentacao } from '@/components/viewer/retorno'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, Check, Lock, RotateCcw, Sparkles, X } from 'lucide-react'
import { cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { useFontesDoDocumento } from '@/components/renderer/fontes'
import { dados, mensagemDeErro, useCarregar, useDados, type KitMarca } from '@/lib/dados'
import { desenharTelas } from '@/lib/ia/clienteDesign'
import { chaveDesenho, MAX_TELAS_POR_PEDIDO_DESIGN } from '@/lib/ia/design'
import { COMPONENTES, NOMES_CATEGORIA, NOMES_TIPO_TELA, PARES_FONTES, RE_HEX, TEMAS, regrasDe, resolverTema, temaPorId, type Marca, type TemaId, type TemaVisual } from '@/lib/ia/designSystem'
import { desenharLocal } from '@/lib/ia/desenhoLocal'
import type { FotoMontagem, LogoMontagem, TelaDesenhada } from '@/lib/ia/montagem'
import { IDIOMAS, MAX_PROMPT, NOMES_IDIOMA, caracteresMaterial, tipoEfetivo, type Idioma } from '@/lib/ia/pedido'
import { analisarPedido, direcoesParaRoteiro } from '@/lib/ia/analisePedido'
import { EditorPedido, dividirNoLimite } from './criar/EditorPedido'
import { TIPOS_TELA, montarDocumento, type Densidade, type Estilo, type OpcaoImagens, type Roteiro, type TelaRoteiro, type TipoTela } from '@/lib/ia/roteiro'
import { NOMES_TOM, TIPOS, TIPOS_APRESENTACAO, TONS, type TipoApresentacao, type TipoPedido, type Tom } from '@/lib/ia/tiposApresentacao'
import { PLANOS, custoApresentacao, custoDesenho, custoRoteiro, podeGastarCreditos, podeGerarTelas, proximoPlano, textoApresentacoes, type PlanoId } from '@/lib/planos'
import { ATALHOS_TELAS, MIN_TELAS_IA, exemploApresentacoes, limitarTelas, textoCreditos, textoTelas } from '@/lib/telasIa'
import { useCreditos } from './Creditos'
import { GaleriaEstilos } from './criar/GaleriaEstilos'
import { PassoMarca } from './criar/PassoMarca'
import { PassoMaterial } from './criar/PassoMaterial'
import { CHAVE_PEDIDO_COLADO, INFO_PASSO, MARCA_VAZIA, MATERIAL_VAZIO, PASSOS, PASSOS_PEDIDO, linhasDeNumeros, type Briefing, type Formato, type MarcaEscolhida, type MaterialEscolhido, type Passo } from './criar/estado'
import { Amostras, MiniaturaFluida, Secao, Segmento, SeloCusto } from './criar/ui'
import type { DocumentoProjeto } from '@/lib/scene/schema'

const FORMATOS: readonly Formato[] = ['slides', 'story', 'explorar']
const NOMES_FORMATO: Record<Formato, string> = { slides: 'Slides', story: 'Story', explorar: 'Explorar' }
const DICA_FORMATO: Record<Formato, string> = { slides: 'horizontal 16:9, em sequência', story: 'vertical 9:16, para o celular', explorar: 'capa vira menu, navegação livre' }
const ESTILOS_ENERGIA = ['auto', 'editorial', 'ousado', 'minimal'] as const
const NOMES_ENERGIA: Record<(typeof ESTILOS_ENERGIA)[number], string> = { auto: 'Do estilo', editorial: 'Editorial', ousado: 'Ousado', minimal: 'Minimal' }
const NOMES_TIPO_CURTO: Record<TipoPedido, string> = {
  auto: 'Automático', pitch: 'Pitch', proposta: 'Proposta', projeto: 'Projeto', relatorio: 'Relatório', aula: 'Aula', portfolio: 'Portfólio',
  lancamento: 'Lançamento', case: 'Case', evento: 'Evento', institucional: 'Institucional', identidade: 'Identidade visual', geral: 'Outro',
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
// créditos fictícios (demo): o débito é calculado aqui; no backend real vem da resposta da rota
const DEMO = dados.capacidades.creditosFicticios

const tinta = (hex: string) => (['#D7F25C', '#F2C14E', '#F1D3B3', '#EEE7DB', '#F2E9D8'].includes(hex) ? '#171717' : '#fff')
const noIntervalo = <T,>(itens: T[], n: number) => Array.from({ length: Math.ceil(itens.length / n) }, (_, k) => itens.slice(k * n, k * n + n))
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function CriarComIA() {
  const router = useRouter()
  const params = useSearchParams()
  const { mostrar } = useToast()
  const { abrirCompra, abrirPlano } = useCreditos()
  useCarregar(['assets'])
  const planoId = useDados((e) => e.workspace.planoId)
  const saldo = useDados((e) => e.creditos.saldo)
  const assetsDoEspaco = useDados((e) => e.assets)
  const limite = PLANOS[planoId].limites.telasPorPrompt

  // ---------- o pedido (passos 1 a 6) ----------
  const promptInicial = params.get('prompt')?.slice(0, MAX_PROMPT) ?? ''
  const [passo, setPasso] = useState<Passo>(promptInicial ? 'marca' : 'briefing')
  const [visitados, setVisitados] = useState<Set<Passo>>(() => new Set(promptInicial ? ['briefing', 'marca'] : ['briefing']))
  const [briefing, setBriefing] = useState<Briefing>(() => ({
    prompt: promptInicial,
    tipo: (TIPOS_APRESENTACAO as readonly string[]).includes(params.get('tipo') ?? '') ? (params.get('tipo') as TipoPedido) : 'auto',
    publico: '',
    tom: '',
    idioma: 'pt-BR',
  }))
  const [formato, setFormato] = useState<Formato>(() => ((FORMATOS as readonly string[]).includes(params.get('formato') ?? '') ? (params.get('formato') as Formato) : 'slides'))
  const [telas, setTelasBruto] = useState<number>(() => Number(params.get('telas')) || 10)
  /** A pessoa escolheu o número de telas (no tamanho ou pelo atalho): o número citado no pedido não muda mais o valor. */
  const telasEscolhidas = useRef(!!Number(params.get('telas')))
  const [marca, setMarca] = useState<MarcaEscolhida>(MARCA_VAZIA)
  const [material, setMaterial] = useState<MaterialEscolhido>(MATERIAL_VAZIO)
  const [lendoMaterial, setLendoMaterial] = useState(false)
  const [tema, setTema] = useState<TemaId | 'auto'>('auto')
  const [energia, setEnergia] = useState<Estilo | 'auto'>('auto')
  const [kits, setKits] = useState<KitMarca[]>([])
  // pedido longo colado no cartão do painel: chega pela sessão do navegador, inteiro
  useEffect(() => {
    if (!params.get('colado')) return
    let colado = ''
    try { colado = sessionStorage.getItem(CHAVE_PEDIDO_COLADO) ?? ''; sessionStorage.removeItem(CHAVE_PEDIDO_COLADO) } catch { /* sem armazenamento */ }
    if (!colado) return
    const [cabe, resto] = dividirNoLimite(colado)
    setBriefing((b) => ({ ...b, prompt: cabe }))
    if (resto) setMaterial((m) => ({ ...m, origem: 'texto', conteudo: resto }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const telasOk = limitarTelas(telas, limite)
  useEffect(() => { if (telas !== telasOk && podeGerarTelas(planoId, telasOk).ok) setTelasBruto(telasOk) }, [telas, telasOk, planoId])
  const setTelas = (n: number) => { telasEscolhidas.current = true; setTelasBruto(n) }
  // o que o pedido já diz (número de telas, estrutura, cores com papéis, marca), lido sem IA
  const analise = useMemo(() => analisarPedido(briefing.prompt), [briefing.prompt])
  const telasPedidas = analise.telas
  // número de telas citado no pedido ("Crie 15 slides") pré-seleciona o tamanho, dentro do limite do plano
  useEffect(() => {
    if (telasEscolhidas.current || !telasPedidas) return
    setTelasBruto(limitarTelas(telasPedidas, limite))
  }, [telasPedidas, limite])
  const acimaDoLimite = !!telasPedidas && telasPedidas > limite
  const planoParaPedido = telasPedidas ? (['plus', 'pro', 'studio'] as PlanoId[]).find((p) => PLANOS[p].limites.telasPorPrompt >= telasPedidas) : undefined
  useEffect(() => { void dados.marcas.listar().then(setKits, () => setKits([])) }, [])

  const avisoTelas = telasPedidas ? (
    acimaDoLimite ? (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border-[1.5px] border-[#F2C14E] bg-[#FFF8E6] px-4 py-3 text-[13px] text-[#5A4500]">
        <span className="min-w-0 flex-1"><strong className="font-semibold">Seu pedido tem {telasPedidas} telas.</strong> O plano {PLANOS[planoId].nome} gera até {limite} por apresentação: com {limite}, a IA mantém a ordem e junta as telas de assunto mais próximo (nada é cortado em silêncio).</span>
        {planoParaPedido && <button type="button" onClick={() => abrirPlano(planoParaPedido)} className="h-8 shrink-0 rounded-full border-[1.5px] border-grafite bg-grafite px-3 text-[12px] font-semibold text-fundo">Fazer upgrade para o {PLANOS[planoParaPedido].nome} · {telasPedidas} telas</button>}
      </div>
    ) : (
      <div className="flex items-center gap-2 text-[13px] text-texto3"><Check className="h-3.5 w-3.5 text-[#2F6B45]" />{analise.estrutura.length >= 3 ? `Estrutura de ${telasPedidas} telas reconhecida no pedido: a IA segue tela a tela.` : `${telasPedidas} telas pedidas no texto.`}{telasOk === telasPedidas ? ' Já selecionado no tamanho.' : ` Selecionado: ${telasOk}.`}</div>
    )
  ) : null

  const ir = (p: Passo) => {
    setPasso(p)
    setVisitados((v) => new Set(v).add(p))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // cores em hex do pedido viram a marca (com papéis) sem digitar de novo; o nome da empresa também. Uma vez por pedido
  // e só se a pessoa ainda não definiu cores (um kit ou a escolha dela mandam).
  const marcaAplicadaPara = useRef('')
  useEffect(() => {
    if (passo === 'briefing' || !briefing.prompt.trim() || marcaAplicadaPara.current === briefing.prompt) return
    marcaAplicadaPara.current = briefing.prompt
    const pal = analise.paleta
    const nome = analise.marca
    if (!pal && !nome) return
    let aplicou = false
    setMarca((m) => {
      if (m.kitId || m.cores.length) return nome && !m.nome ? { ...m, nome } : m
      aplicou = !!pal
      const { claro, cartao, positivo, negativo } = pal?.papeis ?? {}
      const papeis = { ...(claro ? { claro } : {}), ...(cartao ? { cartao } : {}), ...(positivo ? { positivo } : {}), ...(negativo ? { negativo } : {}) }
      return { ...m, nome: m.nome || nome, ...(pal ? { cores: pal.cores, aplicarCores: true, papeis: Object.keys(papeis).length ? papeis : null } : {}) }
    })
    if (pal) queueMicrotask(() => { if (aplicou) mostrar(`Cores do pedido aplicadas à marca (${pal.cores.join(', ')}${Object.keys(pal.papeis).length > 2 ? ', fundo, cartões e indicadores' : ''}) · grátis.`, 'sucesso') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, briefing.prompt])

  // ---------- o que vai para a IA e para a montagem ----------
  const tipoDetectado = tipoEfetivo({ tipo: briefing.tipo, prompt: briefing.prompt, conteudo: material.origem === 'zero' ? '' : material.conteudo })
  const marcaMont = useMemo<Marca & { aplicarCores: boolean }>(() => ({ nome: marca.nome.trim().slice(0, 60), cores: marca.cores.filter((c) => RE_HEX.test(c)).slice(0, 4), aplicarCores: marca.aplicarCores, fontes: marca.fontes, ...(marca.papeis ? { papeis: marca.papeis } : {}) }), [marca.nome, marca.cores, marca.aplicarCores, marca.fontes, marca.papeis])
  const logoMont = useMemo<LogoMontagem | null>(() => (marca.logo ? { assetId: marca.logo.assetId, largura: marca.logo.largura, altura: marca.logo.altura, cor: marca.logo.cor, rodape: marca.logoRodape } : null), [marca.logo, marca.logoRodape])
  const fotosMont = useMemo<FotoMontagem[]>(() => material.fotos.map((f) => ({ assetId: f.assetId, legenda: f.legenda })), [material.fotos])
  const assets = useMemo<AssetsResolvidos>(() => {
    const m: AssetsResolvidos = Object.fromEntries(assetsDoEspaco.map((a) => [a.id, { url: a.url, thumbUrl: a.thumbUrl, posterUrl: a.posterUrl }]))
    if (marca.logo) m[marca.logo.assetId] = { url: marca.logo.url }
    for (const f of material.fotos) m[f.assetId] = { url: f.url }
    return m
  }, [assetsDoEspaco, marca.logo, material.fotos])
  const [temaIa, setTemaIa] = useState<TemaId | null>(null)
  /** Tipo que o roteiro seguiu (em "auto", o que a IA confirmou a partir do pedido inteiro). */
  const [tipoIa, setTipoIa] = useState<TipoApresentacao | null>(null)
  const temaEfetivo: TemaId = tema !== 'auto' ? tema : (temaIa ?? TIPOS[tipoDetectado].temas[0]!)
  const temaVisual: TemaVisual = useMemo(() => resolverTema(temaEfetivo, marcaMont), [temaEfetivo, marcaMont])
  const estiloEf: Estilo = energia !== 'auto' ? energia : tema === 'auto' && !temaIa ? TIPOS[tipoDetectado].estilo : regrasDe(temaPorId(temaEfetivo)).energia
  const conteudoEf = material.origem === 'zero' ? '' : material.conteudo.trim()
  const numeros = linhasDeNumeros(material.numeros)
  const chars = caracteresMaterial({ prompt: briefing.prompt, conteudo: conteudoEf, material: { numeros, obrigatorio: material.obrigatorio, evitar: material.evitar } })
  const custoDoRoteiro = custoRoteiro(telasOk, chars)
  const custoTotal = custoApresentacao(telasOk, chars)
  const semSaldo = !podeGastarCreditos(saldo, custoTotal).ok
  const briefingOk = briefing.prompt.trim().length >= 3 || conteudoEf.length >= 20

  // ---------- roteiro e design (passos 7 e 8) ----------
  const [gerando, setGerando] = useState(false)
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null)
  const [nota, setNota] = useState('')
  const [imagens, setImagens] = useState<OpcaoImagens | null>(null)
  const imagensEf: OpcaoImagens = imagens ?? (material.fotos.length ? 'placeholders' : 'formas')
  const [densidade, setDensidade] = useState<Densidade>('detalhado')
  /** Desenhos já feitos, pela chave do conteúdo da tela (mudar o estilo não redesenha; mudar o texto, sim). */
  const [desenhos, setDesenhos] = useState<Record<string, TelaDesenhada>>({})
  const [desenhando, setDesenhando] = useState(false)
  const [revelar, setRevelar] = useState(0)
  const [projetoId, setProjetoId] = useState<string | null>(null)
  const [salvandoProjeto, setSalvandoProjeto] = useState(false)
  const [galeriaNoDesign, setGaleriaNoDesign] = useState(false)
  const abortar = useRef<AbortController | null>(null)
  const criadoPara = useRef<DocumentoProjeto | null>(null)
  const filaGravacao = useRef<Promise<unknown>>(Promise.resolve())
  const idProjeto = useRef<string | null>(null)
  useEffect(() => () => abortar.current?.abort(), [])
  const aoLerMaterial = useCallback((v: boolean) => setLendoMaterial(v), [])

  const gerarRoteiro = async (outro = false) => {
    if (!briefingOk || gerando || lendoMaterial) return
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoDoRoteiro)
    if (!decisao.ok) return abrirCompra(`${decisao.motivo.replace(' Compre um pacote avulso ou faça upgrade.', '')} Escolha um pacote para continuar.`)
    const lim = podeGerarTelas(planoId, telasOk)
    if (!lim.ok) return abrirPlano(lim.upgradePara ?? 'plus')
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl
    setGerando(true)
    try {
      const r = await dados.ia.roteiro(
        {
          origem: conteudoEf ? (material.origem === 'zero' ? 'texto' : material.origem) : 'zero',
          prompt: outro ? `${briefing.prompt}\n\nProponha uma estrutura diferente da óbvia.` : briefing.prompt,
          conteudo: conteudoEf,
          formato,
          telas: telasOk,
          estilo: estiloEf,
          ...(tema !== 'auto' ? { tema } : {}),
          tipo: briefing.tipo,
          publico: briefing.publico.trim().slice(0, 200),
          ...(briefing.tom ? { tom: briefing.tom } : {}),
          idioma: briefing.idioma,
          marca: marcaMont,
          material: { numeros, obrigatorio: material.obrigatorio.trim(), evitar: material.evitar.trim(), fotos: material.fotos.map((f) => f.legenda.trim()) },
        },
        ctrl.signal
      )
      // demo: créditos fictícios debitados aqui; real: a rota já debitou (só quando o Claude escreve, com estorno se falhar)
      const cobrado = DEMO ? custoDoRoteiro : r.creditos
      dados.registrarUsoIa({ custo: cobrado, motivo: `Roteiro com IA · ${telasOk} telas`, gerador: r.gerador, houveResultado: cobrado > 0 })
      setNota(r.gerador === 'claude'
        ? `Escrito pela IA · roteiro ${textoCreditos(cobrado)}. Edite à vontade: reordenar, mudar texto e trocar o estilo é grátis.`
        : DEMO
          ? `Roteiro-guia gerado localmente (a IA não está conectada neste ambiente) · ${textoCreditos(cobrado)} de demonstração. Revise o texto: ele é um guia do tipo "${TIPOS[r.tipo].nome}".`
          : 'Roteiro-guia gerado localmente (a IA não está conectada neste ambiente). Nenhum crédito foi cobrado.')
      setRoteiro(r.roteiro)
      setTemaIa(r.tema)
      setTipoIa(r.tipo)
      if (tema === 'auto') setTema(r.tema)
      ir('roteiro')
    } catch (e) {
      if (ctrl.signal.aborted) return
      if ((e as { code?: string } | null)?.code === 'limite_do_plano') return abrirCompra(mensagemDeErro(e))
      mostrar(mensagemDeErro(e, 'Não foi possível gerar o roteiro. Tente novamente.'), 'erro')
    } finally {
      if (abortar.current === ctrl) setGerando(false)
    }
  }

  // edição do roteiro
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
  const adicionar = () => setRoteiro((r) => (r && r.telas.length < limite ? { ...r, telas: [...r.telas, { tipo: 'conceito', rotulo: '', titulo: 'Nova tela', texto: 'Descreva o que esta tela deve mostrar.', itens: [], notas: '' }] } : r))

  const modo = formato
  const limpo = useMemo<Roteiro | null>(() => (roteiro ? { titulo: roteiro.titulo.trim() || 'Nova apresentação', telas: roteiro.telas.map((t) => ({ ...t, titulo: t.titulo.trim() || 'Sem título' })) } : null), [roteiro])
  const chaves = useMemo(() => (limpo ? limpo.telas.map((t) => chaveDesenho(t, modo)) : []), [limpo, modo])
  /** Direção visual que o pedido dá para cada tela do roteiro (gráfico de linhas, cards grandes, fundo azul…). */
  const direcoes = useMemo(() => (limpo ? direcoesParaRoteiro(briefing.prompt, limpo.telas) : []), [limpo, briefing.prompt])
  const pendentes = chaves.map((k, i) => (desenhos[k] ? -1 : i)).filter((i) => i >= 0)
  const custoDoDesenho = custoDesenho(pendentes.length)
  const prontas = chaves.filter((k) => desenhos[k]).length

  const documento = useMemo(() => {
    if (!limpo || passo !== 'design') return null
    return montarDocumento(limpo, { modo, tema: temaEfetivo, estilo: estiloEf, imagens: imagensEf, densidade, marca: marcaMont, logo: logoMont, fotos: fotosMont, desenho: chaves.map((k) => desenhos[k]), direcoes })
  }, [limpo, passo, modo, temaEfetivo, estiloEf, imagensEf, densidade, marcaMont, logoMont, fotosMont, chaves, desenhos, direcoes])
  useFontesDoDocumento(documento ?? { scenes: [] })

  /** Desenha as telas que ainda não têm desenho: a primeira sozinha (escreve o cache do roteiro), depois em lotes paralelos. */
  const desenhar = async (indices: number[]) => {
    if (!limpo || !indices.length) return
    const ctrl = new AbortController()
    abortar.current?.abort()
    abortar.current = ctrl
    setDesenhando(true)
    const base = { roteiro: limpo, formato: modo, estilo: estiloEf, tema: temaEfetivo, tipo: briefing.tipo === 'auto' ? tipoIa ?? tipoDetectado : briefing.tipo, publico: briefing.publico.trim().slice(0, 200), ...(briefing.tom ? { tom: briefing.tom } : {}), marca: marcaMont, direcoes }
    // guarda a base do estilo em que a tela foi desenhada: trocar para um estilo de base oposta inverte claro e escuro
    const base0 = temaVisual.base
    const estilo0 = estiloEf
    const guardar = (lista: { indice: number; desenho: TelaDesenhada }[]) => setDesenhos((d) => ({ ...d, ...Object.fromEntries(lista.map((t) => [chaves[t.indice]!, { ...t.desenho, baseTema: base0, estiloDesenho: estilo0 }])) }))
    const lote = async (ids: number[]) => {
      try {
        const r = await desenharTelas({ ...base, indices: ids }, ctrl.signal)
        const cobrado = DEMO ? custoDesenho(ids.length) : r.creditos
        dados.registrarUsoIa({ custo: cobrado, motivo: `Design com IA · ${plural(ids.length, 'tela', 'telas')}`, gerador: 'claude', houveResultado: cobrado > 0 })
        guardar(r.telas)
      } catch (e) {
        if (ctrl.signal.aborted) return
        // sem a rota (ou sem saldo no servidor), a tela não fica em branco: entra o desenho local
        const locais = desenharLocal(limpo, { story: modo === 'story', estilo: estiloEf, tema: temaVisual, direcoes })
        guardar(ids.map((i) => ({ indice: i, desenho: locais[i]! })))
        mostrar(mensagemDeErro(e, 'Algumas telas foram desenhadas localmente.'), 'erro')
      }
    }
    try {
      const [primeira, ...resto] = indices
      await lote([primeira!])
      // 30 telas: 1 + lotes de 3, quatro pedidos por vez (o roteiro do deck já está no cache)
      const lotes = noIntervalo(resto, Math.min(3, MAX_TELAS_POR_PEDIDO_DESIGN))
      for (const grupo of noIntervalo(lotes, 4)) await Promise.all(grupo.map(lote))
    } finally {
      if (abortar.current === ctrl) setDesenhando(false)
    }
  }

  const gerarApresentacao = () => {
    if (!limpo) return
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoDoDesenho)
    if (!decisao.ok) return abrirCompra(`${decisao.motivo.replace(' Compre um pacote avulso ou faça upgrade.', '')} Escolha um pacote para continuar.`)
    setRevelar(0)
    ir('design')
    void desenhar(pendentes)
  }

  const total = documento?.scenes.length ?? 0
  const pronto = passo === 'design' && total > 0 && prontas >= total && revelar >= total

  // revela as telas uma a uma, conforme os desenhos chegam
  useEffect(() => {
    if (passo !== 'design' || revelar >= prontas) return
    const t = setTimeout(() => setRevelar((n) => n + 1), revelar === 0 ? 120 : prontas > 12 ? 120 : 260)
    return () => clearTimeout(t)
  }, [passo, revelar, prontas])

  // cria o projeto quando todas as telas estão desenhadas; trocar estilo, cores ou logo atualiza o mesmo projeto
  // (gravações em fila: a próxima parte da revisão da anterior, sem conflito)
  useEffect(() => {
    if (!pronto || !documento || !roteiro || criadoPara.current === documento) return
    criadoPara.current = documento
    const nome = roteiro.titulo.trim().slice(0, 80) || 'Nova apresentação'
    setSalvandoProjeto(true)
    const gravar = async () => {
      if (criadoPara.current !== documento) return
      // a gravação anterior pode ter acabado de criar o projeto: o id vem da ref, não do estado do render
      const id = idProjeto.current
      const existente = id ? dados.estado().projetos.find((p) => p.id === id && !p.excluidoEm) : undefined
      if (existente && existente.modo === modo) {
        await dados.salvarDocumento(existente.id, documento, existente.revisaoAtual)
        if (existente.nome !== nome) await dados.atualizarProjeto(existente.id, { nome })
      } else {
        const p = await dados.criarProjeto({ nome, modo, descricao: briefing.prompt.slice(0, 280), documento })
        idProjeto.current = p.id
        setProjetoId(p.id)
      }
    }
    const tarefa = filaGravacao.current.then(gravar).catch((e) => {
      if (criadoPara.current !== documento) return
      criadoPara.current = null
      mostrar(mensagemDeErro(e, 'Não foi possível salvar o projeto.'), 'erro')
    })
    filaGravacao.current = tarefa
    void tarefa.finally(() => { if (filaGravacao.current === tarefa) setSalvandoProjeto(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, documento])

  // ---------- kits de marca ----------
  const aplicarKit = (k: KitMarca) => {
    const urlLogo = k.logo ? assets[k.logo.assetId]?.url ?? (dados.modo === 'real' ? `/api/midias/${k.logo.assetId}` : undefined) : undefined
    setMarca({
      nome: k.nome,
      cores: k.cores,
      aplicarCores: true,
      fontes: k.fontes && PARES_FONTES.some((p) => p.titulo === k.fontes!.titulo && p.texto === k.fontes!.texto) ? k.fontes : null,
      logo: k.logo && urlLogo ? { assetId: k.logo.assetId, url: urlLogo, nome: 'Logo do kit', largura: k.logo.largura, altura: k.logo.altura, cor: k.logo.cor, cores: k.cores } : null,
      logoRodape: k.logoRodape,
      kitId: k.id,
    })
    mostrar(`Kit “${k.nome}” aplicado · grátis.`, 'sucesso')
  }
  const salvarKit = async () => {
    try {
      const k = await dados.marcas.salvar({
        ...(marca.kitId ? { id: marca.kitId } : {}),
        nome: marca.nome.trim() || 'Minha marca',
        cores: marca.cores.filter((c) => RE_HEX.test(c)),
        fontes: marca.fontes,
        logo: marca.logo ? { assetId: marca.logo.assetId, largura: marca.logo.largura, altura: marca.logo.altura, cor: marca.logo.cor } : null,
        logoRodape: marca.logoRodape,
      })
      setMarca((m) => ({ ...m, kitId: k.id }))
      setKits((ks) => [k, ...ks.filter((x) => x.id !== k.id)])
      mostrar(`Kit de marca “${k.nome}” salvo no espaço.`, 'sucesso')
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível salvar o kit de marca.'), 'erro')
    }
  }
  const excluirKit = async (k: KitMarca) => {
    try {
      await dados.marcas.excluir(k.id)
      setKits((ks) => ks.filter((x) => x.id !== k.id))
      if (marca.kitId === k.id) setMarca((m) => ({ ...m, kitId: null }))
      mostrar(`Kit “${k.nome}” apagado. O logo continua na biblioteca.`)
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível apagar o kit.'), 'erro')
    }
  }

  // prévia da capa com a marca e o estilo atuais (marca, revisar)
  const previaCapa = useMemo(() => {
    const t = briefing.prompt.trim() ? briefing.prompt.split(/[.,\n]/)[0]!.slice(0, 60) : 'Sua apresentação'
    const doc = montarDocumento({ titulo: t, telas: [{ tipo: 'capa', rotulo: marcaMont.nome.slice(0, 30), titulo: t, texto: 'Proposta · 2026', itens: [], notas: '' }] }, { modo: 'slides', tema: temaEfetivo, estilo: estiloEf, marca: marcaMont, logo: logoMont })
    return doc.scenes[0]!
  }, [briefing.prompt, temaEfetivo, estiloEf, marcaMont, logoMont])
  useFontesDoDocumento({ scenes: [previaCapa] })

  const temRoteiro = !!roteiro
  const indicePedido = (PASSOS_PEDIDO as readonly Passo[]).indexOf(passo)
  const proximo = indicePedido >= 0 && indicePedido < PASSOS_PEDIDO.length - 1 ? PASSOS_PEDIDO[indicePedido + 1]! : null
  const anterior = indicePedido > 0 ? PASSOS_PEDIDO[indicePedido - 1]! : null
  const podeAbrir = (p: Passo) => (p === 'roteiro' ? temRoteiro : p === 'design' ? temRoteiro && prontas > 0 : true)
  const nomeEstilo = tema === 'auto' ? `Sugestão da IA${temaIa ? ` (${temaPorId(temaIa).nome})` : ''}` : temaPorId(tema).nome

  const resumoCusto = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-texto3">
      <span><span className="mono text-texto">{plural(telasOk, 'tela', 'telas')}</span> · <span className="mono text-texto">{textoCreditos(custoTotal)}</span>{custoTotal > 0 && <> (roteiro {textoCreditos(custoDoRoteiro)} agora + design {textoCreditos(custoDesenho(telasOk))} depois)</>}</span>
      <span aria-hidden>·</span>
      {semSaldo ? <span className="text-perigo">saldo {saldo.toLocaleString('pt-BR')} <button type="button" onClick={() => abrirCompra()} className="ml-1 font-medium text-acento underline-offset-2 hover:underline">Comprar créditos</button></span> : <span>saldo dá {textoApresentacoes(saldo, telasOk)} deste tamanho</span>}
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-borda pb-4">
        <h1 className="flex items-center gap-2 text-[15px] font-medium"><span className="h-2 w-2 rounded-full bg-acento" />Criar com IA</h1>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => abrirCompra()} title={`Comprar créditos · ${exemploApresentacoes(saldo)}`} className="flex h-8 items-center gap-1.5 rounded-full border border-borda bg-superficie px-3 text-[12px] text-texto2 hover:border-bordaForte hover:text-texto">
            <Sparkles className="h-3.5 w-3.5 text-acento" /><span className="mono text-texto">{saldo.toLocaleString('pt-BR')}</span><span className="hidden md:inline">créditos · {textoTelas(saldo)}</span>
          </button>
          <Link href="/app" aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-texto3 hover:bg-hover hover:text-texto"><X className="h-[18px] w-[18px]" /></Link>
        </div>
        <nav aria-label="Passos" className="order-3 -mx-1 w-full overflow-x-auto px-1 pb-1">
          <ol className="flex min-w-max items-center gap-1 text-[13px]">
            {PASSOS.map((p, i) => {
              const atual = passo === p
              const feito = visitados.has(p) && !atual && (p !== 'briefing' || briefingOk)
              const ok = podeAbrir(p)
              return (
                <li key={p} className="flex items-center">
                  {i === 6 && <span aria-hidden className="mx-1.5 h-4 w-px bg-borda" />}
                  <button type="button" disabled={!ok} aria-current={atual ? 'step' : undefined} onClick={() => ir(p)} className={cx('flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors disabled:cursor-not-allowed', atual ? 'bg-grafite text-fundo' : ok ? 'text-texto hover:bg-hover' : 'text-[#B5B5B5]')}>
                    <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-current text-[11px] font-semibold', feito && 'border-[#2F6B45] bg-[#2F6B45] text-white')}>{feito ? <Check className="h-3 w-3" /> : i + 1}</span>
                    <span>{INFO_PASSO[p].nome}</span>
                    {INFO_PASSO[p].opcional && !atual && <span className="hidden text-[11px] text-texto3 lg:inline">opcional</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </div>

      {(PASSOS_PEDIDO as readonly Passo[]).includes(passo) && (
        <div className="flex flex-col gap-6 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="rotulo-mono">Passo {indicePedido + 1} de {PASSOS_PEDIDO.length}{INFO_PASSO[passo].opcional ? ' · opcional' : ''}</div>
              <h2 className="titulo-display mt-1.5 text-balance text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1] tracking-[-0.045em]">
                {{ briefing: 'O que você quer apresentar?', marca: 'A sua marca, antes de gerar', material: 'O que você já tem', estilo: 'Escolha o estilo de design', tamanho: 'Formato e tamanho', revisar: 'Revisar e gerar', roteiro: '', design: '' }[passo]}
              </h2>
              <p className="mt-2 max-w-[640px] text-[15px] text-[#525252]">
                {{ briefing: 'Descreva o assunto. Nos próximos passos você dá a marca, o material e o estilo: tudo entra de uma vez, sem gerar de novo.', marca: 'Logo, cores e fontes entram nas telas sem usar IA. Sem cores definidas, sugerimos paletas.', material: 'Texto, PDF, fotos e números que já existem. Pule se não tiver.', estilo: `${TEMAS.length} estilos com tipografia, cor, forma e composição próprias. Trocar depois é grátis.`, tamanho: `De ${MIN_TELAS_IA} até ${limite} telas no plano ${PLANOS[planoId].nome}. Cada tela entra no custo; o resto é grátis.`, revisar: 'Confira tudo. O custo abaixo é o que será cobrado.', roteiro: '', design: '' }[passo]}
              </p>
            </div>
          </div>

          {passo === 'briefing' && (
            <div className="flex flex-col gap-5">
              <div role="radiogroup" aria-label="Tipo de apresentação" className="flex flex-wrap gap-1.5">
                {(['auto', ...TIPOS_APRESENTACAO] as TipoPedido[]).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={briefing.tipo === t} title={t === 'auto' ? `A IA reconhece pelo pedido${briefing.prompt.trim() ? ` (agora: ${TIPOS[tipoDetectado].nome})` : ''}` : TIPOS[t].descricao} onClick={() => setBriefing((b) => ({ ...b, tipo: t }))} className={cx('rounded-full border-[1.5px] px-3 py-1 text-[13px] font-medium transition-colors', briefing.tipo === t ? 'border-grafite bg-grafite text-fundo' : 'border-[#E2E1DE] bg-white text-[#525252] hover:border-grafite hover:text-texto')}>
                    {NOMES_TIPO_CURTO[t]}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-[18px] border-2 border-grafite bg-white shadow-[6px_6px_0_#171717] sm:shadow-[8px_8px_0_#171717]">
                <EditorPedido
                  valor={briefing.prompt}
                  aoMudar={(v) => setBriefing((b) => ({ ...b, prompt: v }))}
                  aoExcedente={(resto) => {
                    // nada se perde: o que passou do limite do pedido vai para o material (texto colado)
                    setMaterial((m) => ({ ...m, origem: m.origem === 'zero' ? 'texto' : m.origem, conteudo: [m.conteudo.trim(), resto].filter(Boolean).join('\n\n') }))
                    mostrar(`O pedido passou de ${MAX_PROMPT.toLocaleString('pt-BR')} caracteres: o restante (${resto.length.toLocaleString('pt-BR')}) foi para o material e também vai para a IA.`, 'sucesso')
                  }}
                  aoEnviar={() => { if (briefingOk) ir('marca') }}
                  placeholder="Ex.: Proposta de identidade visual para uma marca de cerâmica artesanal, com conceito, paleta, tipografia e aplicações… Pode colar um briefing completo, com a estrutura de cada tela, dados e regras."
                />
                <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EFED] px-5 py-3 text-[13px]">
                  <label className="flex min-w-[220px] flex-1 items-center gap-2 text-texto3">
                    <span className="shrink-0">Para quem</span>
                    <input value={briefing.publico} maxLength={200} onChange={(e) => setBriefing((b) => ({ ...b, publico: e.target.value }))} placeholder={TIPOS[tipoDetectado].publico || 'ex.: diretoria, alunos, clientes'} className="min-w-0 flex-1 rounded-md bg-[#F5F5F4] px-2.5 py-1.5 text-texto outline-none placeholder:text-[#B5B5B5]" />
                  </label>
                  <label className="flex items-center gap-2 text-texto3">
                    <span>Tom</span>
                    <select aria-label="Tom" value={briefing.tom} onChange={(e) => setBriefing((b) => ({ ...b, tom: e.target.value as Tom | '' }))} className="rounded-md bg-[#F5F5F4] px-2 py-1.5 text-texto outline-none">
                      <option value="">Padrão ({NOMES_TOM[TIPOS[tipoDetectado].tom]})</option>
                      {TONS.map((t) => <option key={t} value={t}>{NOMES_TOM[t]}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-texto3">
                    <span>Idioma</span>
                    <select aria-label="Idioma" value={briefing.idioma} onChange={(e) => setBriefing((b) => ({ ...b, idioma: e.target.value as Idioma }))} className="rounded-md bg-[#F5F5F4] px-2 py-1.5 text-texto outline-none">
                      {IDIOMAS.map((i) => <option key={i} value={i}>{NOMES_IDIOMA[i]}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              {avisoTelas}
              <div className="flex flex-col gap-3">
                <div className="rotulo-mono">Ou comece por um exemplo</div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
                  {EXEMPLOS.map((ex) => (
                    <button key={ex.texto} type="button" onClick={() => setBriefing((b) => ({ ...b, prompt: ex.texto, tipo: ex.tipo }))} className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#E7E5E4] bg-white p-3.5 text-left hover:border-grafite">
                      <span className="h-10 w-10 flex-none" style={{ background: ex.cor, borderRadius: ex.raio }} />
                      <span className="text-[14px] leading-[1.4] text-[#3F3F3F]"><span className="mono mb-0.5 block text-[10px] uppercase tracking-[0.08em] text-texto3">{NOMES_TIPO_CURTO[ex.tipo]}</span>{ex.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {passo === 'marca' && (
            <PassoMarca marca={marca} aoMudar={setMarca} prompt={briefing.prompt} kits={kits} aoSalvarKit={salvarKit} aoExcluirKit={excluirKit} aplicarKit={aplicarKit} previa={<div className="overflow-hidden rounded-md"><MiniaturaFluida cena={previaCapa} assets={assets} /></div>} />
          )}

          <div hidden={passo !== 'material'}>
            <PassoMaterial material={material} aoMudar={setMaterial} telas={telasOk} planoId={planoId} aoLer={aoLerMaterial} />
          </div>

          {passo === 'estilo' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-texto3">
                <span>Energia</span>
                <Segmento rotulo="Energia do estilo" opcoes={ESTILOS_ENERGIA} valor={energia} aoMudar={setEnergia} nomes={(e) => NOMES_ENERGIA[e]} />
                <span className="ml-auto"><SeloCusto>grátis · trocar depois também</SeloCusto></span>
              </div>
              <GaleriaEstilos valor={tema} aoEscolher={setTema} marca={marcaMont} logo={logoMont} assets={assets} titulo={briefing.prompt.split(/[.,\n]/)[0] ?? ''} energia={energia === 'auto' ? null : energia} sugerido={temaIa ?? TIPOS[tipoDetectado].temas[0]} />
            </div>
          )}

          {(passo === 'tamanho' || passo === 'revisar') && acimaDoLimite && avisoTelas}
          {passo === 'tamanho' && <PassoTamanho formato={formato} aoFormato={setFormato} telas={telasOk} aoTelas={setTelas} planoId={planoId} limite={limite} aoUpgrade={(p) => abrirPlano(p)} chars={chars} />}

          {passo === 'revisar' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex flex-col gap-3">
                <LinhaResumo titulo="Briefing" aoEditar={() => ir('briefing')} vazio={!briefingOk ? 'Descreva a apresentação (ou traga um texto no material).' : undefined}>
                  <span className="line-clamp-2">{briefing.prompt || conteudoEf.slice(0, 160)}</span>
                  <span className="text-texto3"> · {briefing.tipo === 'auto' ? `${TIPOS[tipoDetectado].nome} (automático)` : TIPOS[briefing.tipo].nome}{briefing.publico ? ` · para ${briefing.publico}` : ''} · {NOMES_IDIOMA[briefing.idioma]}</span>
                </LinhaResumo>
                <LinhaResumo titulo="Marca" gratis aoEditar={() => ir('marca')} vazio={!marca.logo && !marca.cores.length && !marca.fontes && !marca.nome ? 'Sem marca: cores e fontes do estilo.' : undefined}>
                  <span className="flex flex-wrap items-center gap-2">
                    {marca.logo && <img src={marca.logo.url} alt="Logo" className="h-6 max-w-[90px] object-contain" />}
                    {marca.nome && <span className="font-medium">{marca.nome}</span>}
                    {marca.cores.length > 0 && <Amostras cores={marca.cores} tamanho={18} />}
                    {marca.fontes && <span className="text-texto3">{marca.fontes.titulo} + {marca.fontes.texto}</span>}
                  </span>
                </LinhaResumo>
                <LinhaResumo titulo="Material" aoEditar={() => ir('material')} vazio={!conteudoEf && !material.fotos.length && !numeros.length && !material.obrigatorio && !material.evitar ? 'Nada extra: a IA escreve a partir do briefing.' : undefined}>
                  {[conteudoEf && `${conteudoEf.length.toLocaleString('pt-BR')} caracteres de texto`, material.fotos.length && plural(material.fotos.length, 'foto própria', 'fotos próprias'), numeros.length && plural(numeros.length, 'número-chave', 'números-chave'), material.obrigatorio && 'o que não pode faltar', material.evitar && 'o que evitar'].filter(Boolean).join(' · ')}
                </LinhaResumo>
                <LinhaResumo titulo="Estilo" gratis aoEditar={() => ir('estilo')}>
                  {nomeEstilo}{tema !== 'auto' && temaPorId(tema).categoria ? ` · ${NOMES_CATEGORIA[temaPorId(tema).categoria!]}` : ''} · energia {NOMES_ENERGIA[energia].toLowerCase()}
                </LinhaResumo>
                <LinhaResumo titulo="Tamanho" aoEditar={() => ir('tamanho')}>
                  {NOMES_FORMATO[formato]} · {plural(telasOk, 'tela', 'telas')}
                </LinhaResumo>
              </div>
              <aside className="flex flex-col gap-4 self-start rounded-xl border border-borda bg-white p-5 lg:sticky lg:top-6">
                <div className="overflow-hidden rounded-md"><MiniaturaFluida cena={previaCapa} assets={assets} /></div>
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <div className="flex justify-between"><span>Roteiro, agora</span><span className="mono">{textoCreditos(custoDoRoteiro)}</span></div>
                  <div className="flex justify-between"><span>Design de {plural(telasOk, 'tela', 'telas')}, no fim</span><span className="mono">{textoCreditos(custoDesenho(telasOk))}</span></div>
                  <div className="flex justify-between border-t border-borda pt-1.5 font-semibold"><span>Total</span><span className="mono">{textoCreditos(custoTotal)}</span></div>
                  <div className="flex justify-between text-texto3"><span>Seu saldo depois</span><span className="mono">{semSaldo ? 'insuficiente' : (saldo - custoTotal).toLocaleString('pt-BR')}</span></div>
                </div>
                <ul className="flex flex-col gap-1 text-[12px] text-texto2">
                  {['Logo, cores e fontes da marca', 'Fotos nos espaços de imagem', 'Trocar o estilo depois', 'Reordenar e editar o roteiro'].map((x) => <li key={x} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[#2F6B45]" />{x} <span className="text-texto3">· grátis</span></li>)}
                </ul>
                <button type="button" onClick={() => void gerarRoteiro(temRoteiro)} disabled={!briefingOk || gerando || lendoMaterial} className="flex h-[52px] items-center justify-center gap-2.5 rounded-full border-2 border-grafite bg-violeta text-[15px] font-semibold text-white hover:bg-[#4A55E0] disabled:cursor-not-allowed disabled:opacity-45">
                  {gerando ? 'Gerando roteiro' : temRoteiro ? 'Gerar outro roteiro →' : 'Gerar roteiro →'}
                  {gerando && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                </button>
                {temRoteiro && <button type="button" onClick={() => ir('roteiro')} className="h-9 text-[13px] text-texto3 hover:text-texto">Voltar ao roteiro atual · grátis</button>}
                {semSaldo && <p className="text-center text-[12px] text-perigo">Saldo insuficiente para o total. <button type="button" onClick={() => abrirCompra()} className="font-medium text-acento hover:underline">Comprar créditos</button></p>}
              </aside>
            </div>
          )}

          <div className="sticky bottom-0 z-30 mt-2 border-t border-borda bg-fundo/95 backdrop-blur supports-[backdrop-filter]:bg-fundo/85">
            <div className="flex w-full flex-wrap items-center gap-3 py-3">
              {resumoCusto}
              <div className="ml-auto flex items-center gap-2">
                {anterior && <button type="button" onClick={() => ir(anterior)} className="h-10 rounded-full px-3 text-[14px] text-texto3 hover:text-texto">← Voltar</button>}
                {INFO_PASSO[passo].opcional && proximo && <button type="button" onClick={() => ir(proximo)} className="h-10 rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-4 text-[14px] font-medium hover:border-grafite">Pular</button>}
                {passo !== 'revisar' && <button type="button" onClick={() => ir('revisar')} className="hidden h-10 rounded-full px-3 text-[14px] text-texto3 hover:text-texto md:block">Ir para revisar</button>}
                {proximo && <button type="button" disabled={passo === 'briefing' && !briefingOk && !conteudoEf} onClick={() => ir(proximo)} className="flex h-10 items-center gap-2 rounded-full border-2 border-grafite bg-grafite px-5 text-[14px] font-semibold text-fundo hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-40">Continuar →</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {passo === 'roteiro' && roteiro && (
        <div className="grid min-h-0 flex-1 gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 pb-6">
            <div className="mx-auto flex max-w-[760px] flex-col gap-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="rotulo-mono">Roteiro · {roteiro.telas.length} telas</div>
                  <button type="button" onClick={() => void gerarRoteiro(true)} disabled={gerando} className="flex h-[34px] items-center gap-2 rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-3.5 text-[13px] font-medium hover:border-grafite disabled:opacity-50">
                    <RotateCcw className={cx('h-3.5 w-3.5', gerando && 'animate-spin')} />Gerar outro roteiro <span className="mono text-texto3">· {textoCreditos(custoDoRoteiro)}</span>
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
                        {desenhos[chaves[i] ?? ''] ? <span className="mono rounded-full bg-[#F0F7EC] px-1.5 py-0.5 text-[9px] text-[#3F6B4A]" title="Já desenhada: trocar o estilo não custa nada">DESENHADA</span> : Object.keys(desenhos).length > 0 && <span className="mono rounded-full bg-acentoSuave px-1.5 py-0.5 text-[9px] text-acento" title="Alterada: será redesenhada">{textoCreditos(custoDesenho(1)).toUpperCase()}</span>}
                        <select aria-label={`Tipo da tela ${i + 1}`} value={t.tipo} onChange={(e) => atualizarTela(i, { tipo: e.target.value as TipoTela })} className="rounded-md bg-[#F5F5F4] px-2 py-1 text-[12px] text-[#525252] outline-none hover:bg-hover">
                          {TIPOS_TELA.map((tp) => <option key={tp} value={tp}>{NOMES_TIPO_TELA[tp]}</option>)}
                        </select>
                      </div>
                      <input aria-label={`Título da tela ${i + 1}`} value={t.titulo} maxLength={160} onChange={(e) => atualizarTela(i, { titulo: e.target.value })} className="min-w-0 bg-transparent p-0 text-[17px] font-semibold tracking-[-0.02em] outline-none" />
                      {comp.limites.texto > 0 && <textarea aria-label={`Texto da tela ${i + 1}`} value={t.texto} maxLength={600} rows={2} placeholder="Texto de apoio (opcional)" onChange={(e) => atualizarTela(i, { texto: e.target.value })} className="w-full resize-none bg-transparent p-0 text-[14px] leading-normal text-[#525252] outline-none placeholder:text-[#B5B5B5]" />}
                      {comp.maxItens > 0 && (
                        <textarea aria-label={`Itens da tela ${i + 1}`} value={t.itens.join('\n')} rows={Math.max(2, Math.min(6, t.itens.length))} placeholder={`Um por linha: ${comp.itens}`} onChange={(e) => atualizarTela(i, { itens: e.target.value.split('\n').slice(0, Math.max(6, comp.maxItens)).map((l) => l.slice(0, 160)) })} className="mono w-full resize-none rounded-md bg-[#FAFAF9] px-2 py-1.5 text-[13px] leading-relaxed text-[#3F3F3F] outline-none placeholder:text-[#B5B5B5]" />
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
              {roteiro.telas.length < limite
                ? <button type="button" onClick={adicionar} className="h-12 rounded-[14px] border-[1.5px] border-dashed border-[#D6D4D0] text-[14px] text-texto3 hover:border-grafite hover:text-texto">+ Adicionar tela <span className="mono">· {textoCreditos(custoDesenho(1))} no design</span></button>
                : <p className="text-center text-[13px] text-texto3">Limite de {limite} telas do plano {PLANOS[planoId].nome}. {proximoPlano(planoId) && <button type="button" onClick={() => abrirPlano(proximoPlano(planoId)!)} className="text-acento hover:underline">Ver planos</button>}</p>}
            </div>
          </div>
          <aside aria-label="Aparência da apresentação" className="flex flex-col gap-6 self-start rounded-xl border border-borda bg-white p-5 lg:sticky lg:top-6">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between"><span className="text-[14px] font-semibold">Estilo</span><SeloCusto /></div>
              <div className="overflow-hidden rounded-md"><MiniaturaFluida cena={previaCapa} assets={assets} /></div>
              <div className="flex items-center justify-between text-[13px]"><span className="font-medium">{temaPorId(temaEfetivo).nome}</span><button type="button" onClick={() => ir('estilo')} className="text-acento hover:underline">Trocar estilo</button></div>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between"><span className="text-[14px] font-semibold">Imagens</span><SeloCusto /></div>
              {([['formas', 'Formas do estilo', 'motivos e cor'], ['placeholders', material.fotos.length ? 'Suas fotos' : 'Espaços para imagens', material.fotos.length ? plural(material.fotos.length, 'foto', 'fotos') : 'você envia'], ['nenhuma', 'Sem imagens', 'só tipografia']] as const).map(([id, rotulo, sub]) => (
                <button key={id} type="button" aria-pressed={imagensEf === id} onClick={() => setImagens(id)} className={cx('flex justify-between gap-2 rounded-[10px] border-[1.5px] px-3.5 py-3 text-left text-[14px]', imagensEf === id ? 'border-violeta bg-[#F4F5FE]' : 'border-borda bg-white hover:border-bordaForte')}>
                  <span>{rotulo}</span><span className="text-[12px] text-texto3">{sub}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between"><span className="text-[14px] font-semibold">Texto por tela</span><SeloCusto /></div>
              <Segmento cheio rotulo="Texto por tela" opcoes={['minimo', 'medio', 'detalhado'] as const} valor={densidade} aoMudar={setDensidade} nomes={(d) => ({ minimo: 'Mínimo', medio: 'Médio', detalhado: 'Detalhado' })[d]} />
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <button type="button" onClick={gerarApresentacao} className="h-[52px] rounded-full border-2 border-grafite bg-grafite text-[15px] font-semibold text-fundo shadow-[5px_5px_0_#5965F2] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
                Gerar apresentação <span className="mono font-normal opacity-80">· {textoCreditos(custoDoDesenho)}</span>
              </button>
              <p className="text-center text-[12px] text-texto3">{pendentes.length ? (pendentes.length === chaves.length ? `A IA desenha ${plural(pendentes.length, 'tela', 'telas')}` : `Redesenha só ${plural(pendentes.length, 'tela alterada', 'telas alteradas')}; as outras ficam`) : 'Todas as telas já estão desenhadas · grátis'}</p>
              <button type="button" onClick={() => ir('revisar')} className="h-10 text-[14px] text-texto3 hover:text-texto">← Voltar ao pedido</button>
            </div>
          </aside>
        </div>
      )}

      {passo === 'design' && documento && (
        <div className="flex-1 pb-10 pt-8">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="rotulo-mono flex items-center gap-2" aria-live="polite">
                  {(!pronto || salvandoProjeto) && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-[#E7E5E4] border-t-violeta" />}
                  {pronto ? (salvandoProjeto ? 'Salvando o projeto…' : `Pronto · ${total} telas`) : `Desenhando tela ${Math.min(revelar + 1, total)} de ${total}`}
                </div>
                <h2 className="mt-2 text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.045em]">{roteiro?.titulo}</h2>
              </div>
              <div className={cx('flex flex-wrap gap-2.5 transition-opacity', !pronto && 'pointer-events-none opacity-35')}>
                <button type="button" onClick={() => ir('roteiro')} className="flex h-11 items-center rounded-full px-4 text-[14px] text-texto3 hover:text-texto">← Ajustar roteiro</button>
                {projetoId && <button type="button" onClick={() => abrirApresentacao(router, projetoId)} className="flex h-11 items-center rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-[18px] text-[14px] font-medium hover:border-grafite">Apresentar</button>}
                {projetoId && <Link href={`/app/projects/${projetoId}/share`} className="flex h-11 items-center rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-[18px] text-[14px] font-medium hover:border-grafite">Publicar e enviar</Link>}
                {projetoId && <button type="button" onClick={() => router.push(`/app/projects/${projetoId}/edit`)} className="flex h-11 items-center rounded-full border-2 border-grafite bg-violeta px-[18px] text-[14px] font-semibold text-white hover:bg-[#4A55E0]">Abrir no editor →</button>}
              </div>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-[#EDECEA]"><div className="h-1 bg-violeta transition-[width] duration-400" style={{ width: `${total ? (Math.min(revelar, total) / total) * 100 : 0}%` }} /></div>
            <div className={cx('flex flex-col gap-3 transition-opacity', !pronto && 'pointer-events-none opacity-35')}>
              <div role="radiogroup" aria-label="Trocar estilo" className="flex flex-wrap items-center gap-2 text-[12px] text-texto3">
                <span className="mr-1">Estilo · grátis:</span>
                {(TEMAS as readonly TemaVisual[]).map((t) => {
                  const r = resolverTema(t.id, marcaMont)
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={temaEfetivo === t.id} title={t.descricao} onClick={() => setTema(t.id as TemaId)} className={cx('flex h-7 items-center gap-1.5 rounded-full border-[1.5px] pl-1 pr-2.5', temaEfetivo === t.id ? 'border-grafite text-texto' : 'border-[#E2E1DE] hover:border-grafite')}>
                      <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${r.capa === 'escuro' ? r.escuro.fundo : r.claro.fundo} 50%, ${r.acento} 50%)`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />{t.nome}
                    </button>
                  )
                })}
                <button type="button" onClick={() => setGaleriaNoDesign((v) => !v)} className="ml-1 text-acento hover:underline">{galeriaNoDesign ? 'Fechar galeria' : 'Ver galeria'}</button>
              </div>
              {marca.logo && (
                <label className="flex items-center gap-2 text-[12px] text-texto3">
                  <input type="checkbox" checked={marca.logoRodape} onChange={(e) => setMarca((m) => ({ ...m, logoRodape: e.target.checked }))} /> Logo também no rodapé · grátis
                </label>
              )}
              {galeriaNoDesign && <GaleriaEstilos comAuto={false} valor={temaEfetivo} aoEscolher={(id) => id !== 'auto' && setTema(id)} marca={marcaMont} logo={logoMont} assets={assets} titulo={roteiro?.titulo ?? ''} energia={energia === 'auto' ? null : energia} sugerido={temaIa} />}
              {desenhando && <span className="text-[12px] text-texto3">a IA está desenhando…</span>}
            </div>
            <div className={cx('grid gap-5', formato === 'story' ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))]')}>
              {documento.scenes.map((cena, i) => {
                const visivel = i < revelar && !!desenhos[chaves[i] ?? '']
                return (
                  <div key={cena.id} className="flex flex-col gap-2">
                    <div className={cx('overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)]', visivel ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-40')}>
                      {visivel ? <MiniaturaFluida cena={cena} assets={assets} /> : <div className="flex items-center justify-center bg-[#F0EFED]" style={{ aspectRatio: `${cena.size.width} / ${cena.size.height}` }}><span aria-hidden className="h-[22px] w-[22px] animate-spin rounded-full border-[2.5px] border-[#E2E1DE] border-t-violeta" /></div>}
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

/** Uma linha do resumo no passo "Revisar e gerar". */
function LinhaResumo({ titulo, children, aoEditar, vazio, gratis }: { titulo: string; children?: React.ReactNode; aoEditar: () => void; vazio?: string; gratis?: boolean }) {
  return (
    <div className="flex items-start gap-4 rounded-[14px] border-[1.5px] border-[#E7E5E4] bg-white px-4 py-3.5">
      <div className="w-[88px] shrink-0 pt-0.5 text-[13px] font-semibold">{titulo}</div>
      <div className="min-w-0 flex-1 text-[14px] text-[#3F3F3F]">{vazio ? <span className="text-texto3">{vazio}</span> : children}</div>
      {gratis && <SeloCusto />}
      <button type="button" onClick={aoEditar} aria-label={`Editar ${titulo.toLowerCase()}`} className="shrink-0 text-[13px] text-acento hover:underline">Editar</button>
    </div>
  )
}

/** Passo "Tamanho": formato e número de telas (atalhos e campo livre até o limite do plano), com o custo. */
function PassoTamanho({ formato, aoFormato, telas, aoTelas, planoId, limite, aoUpgrade, chars }: { formato: Formato; aoFormato: (f: Formato) => void; telas: number; aoTelas: (n: number) => void; planoId: PlanoId; limite: number; aoUpgrade: (p: PlanoId) => void; chars: number }) {
  const [livre, setLivre] = useState(String(telas))
  useEffect(() => setLivre(String(telas)), [telas])
  const planoQueLibera = (n: number) => (['plus', 'pro', 'studio'] as PlanoId[]).find((p) => PLANOS[p].limites.telasPorPrompt >= n)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <Secao titulo="Formato" selo={<SeloCusto />} id="titulo-formato">
          <div role="radiogroup" aria-label="Formato" className="grid gap-2 sm:grid-cols-3">
            {FORMATOS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={formato === f} onClick={() => aoFormato(f)} className={cx('flex flex-col gap-1 rounded-[12px] border-[1.5px] px-4 py-3 text-left', formato === f ? 'border-violeta bg-[#F4F5FE]' : 'border-[#E7E5E4] bg-white hover:border-grafite')}>
                <span className="flex items-center gap-2 text-[15px] font-medium"><span className={cx('inline-block rounded-[3px] border-2 border-current', f === 'story' ? 'h-5 w-3' : 'h-3 w-5')} />{NOMES_FORMATO[f]}</span>
                <span className="text-[12px] text-texto3">{DICA_FORMATO[f]}</span>
              </button>
            ))}
          </div>
        </Secao>
        <Secao titulo="Quantas telas" dica={`De ${MIN_TELAS_IA} a ${limite} no plano ${PLANOS[planoId].nome}. Uma apresentação pode crescer depois: cada tela nova desenhada entra no custo.`} id="titulo-telas">
          <div role="radiogroup" aria-label="Quantidade de telas" className="flex flex-wrap gap-2">
            {ATALHOS_TELAS.map((n) => {
              const ok = n <= limite
              const p = planoQueLibera(n)
              return ok ? (
                <button key={n} type="button" role="radio" aria-checked={telas === n} onClick={() => aoTelas(n)} className={cx('h-10 min-w-[86px] rounded-full border-[1.5px] px-3 text-[14px] font-medium', telas === n ? 'border-grafite bg-grafite text-fundo' : 'border-[#E2E1DE] bg-white text-[#3F3F3F] hover:border-grafite')}>{n} telas</button>
              ) : (
                <button key={n} type="button" onClick={() => p && aoUpgrade(p)} title={p ? `Disponível no plano ${PLANOS[p].nome}` : undefined} className="flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#E2E1DE] px-3 text-[13px] text-[#A3A3A3] hover:border-grafite hover:text-texto">
                  <Lock className="h-3 w-3" />{n} {p && <span className="mono text-[10px] uppercase">{PLANOS[p].nome}</span>}
                </button>
              )
            })}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-texto2">
            Outro número
            <input
              type="number"
              aria-label="Número de telas"
              min={MIN_TELAS_IA}
              max={limite}
              value={livre}
              onChange={(e) => setLivre(e.target.value)}
              onBlur={() => aoTelas(limitarTelas(Number(livre), limite))}
              onKeyDown={(e) => { if (e.key === 'Enter') aoTelas(limitarTelas(Number(livre), limite)) }}
              className="mono h-9 w-[84px] rounded-[10px] border-[1.5px] border-[#E7E5E4] bg-white px-2.5 text-[14px] outline-none focus:border-grafite"
            />
            <span className="text-texto3">telas</span>
          </label>
        </Secao>
      </div>
      <aside className="flex flex-col gap-2 self-start rounded-xl border border-borda bg-white p-5 text-[13px] lg:sticky lg:top-6">
        <div className="text-[14px] font-semibold">Custo de {plural(telas, 'tela', 'telas')}</div>
        <div className="flex justify-between"><span>Roteiro (estrutura e texto)</span><span className="mono">{textoCreditos(custoRoteiro(telas, chars))}</span></div>
        <div className="flex justify-between"><span>Design de cada tela</span><span className="mono">{textoCreditos(custoDesenho(telas))}</span></div>
        <div className="flex justify-between border-t border-borda pt-1.5 font-semibold"><span>Total</span><span className="mono">{textoCreditos(custoApresentacao(telas, chars))}</span></div>
        <p className="pt-1 text-[12px] text-texto3">Marca, estilo, fotos, reordenar e trocar o estilo depois: grátis.</p>
      </aside>
    </div>
  )
}
