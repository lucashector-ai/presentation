'use client'
/**
 * "Criar com IA" em conversa: a pessoa descreve (ou cola o briefing inteiro) e o agente responde com o que entendeu;
 * as decisões que faltam (logo, identidade visual, fontes, tamanho) abrem no painel ao lado, já com o que veio no
 * pedido marcado. Depois vem o plano (o roteiro, editável) com a aparência ao lado, e ao gerar as telas aparecem uma
 * a uma no mesmo painel. As mensagens do agente são montadas sem IA (criar/chat.ts); só o plano e o design gastam
 * créditos, sempre à vista. O atalho do painel (/app/criar?prompt=… ou ?colado=1) chega já enviado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { abrirApresentacao } from '@/components/viewer/retorno'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, Check, Home, Lock, PanelLeftClose, PanelLeftOpen, Play, RotateCcw, Sparkles, X } from 'lucide-react'
import { cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { useFontesDoDocumento } from '@/components/renderer/fontes'
import { dados, mensagemDeErro, useCarregar, useDados, type KitMarca } from '@/lib/dados'
import { desenharTelas } from '@/lib/ia/clienteDesign'
import { chaveDesenho, MAX_TELAS_POR_PEDIDO_DESIGN } from '@/lib/ia/design'
import { COMPONENTES, NOMES_TIPO_TELA, RE_HEX, TEMAS, regrasDe, resolverTema, temaPorId, type Marca, type TemaId, type TemaVisual } from '@/lib/ia/designSystem'
import { desenharLocal } from '@/lib/ia/desenhoLocal'
import type { FotoMontagem, LogoMontagem, TelaDesenhada } from '@/lib/ia/montagem'
import { IDIOMAS, MAX_PROMPT, NOMES_IDIOMA, caracteresMaterial, tipoEfetivo, type Idioma } from '@/lib/ia/pedido'
import { analisarPedido, direcoesParaRoteiro } from '@/lib/ia/analisePedido'
import { dividirNoLimite } from './criar/EditorPedido'
import { TIPOS_TELA, montarDocumento, type Densidade, type Estilo, type OpcaoImagens, type Roteiro, type TelaRoteiro, type TipoTela } from '@/lib/ia/roteiro'
import { NOMES_TOM, TIPOS, TIPOS_APRESENTACAO, TONS, type TipoApresentacao, type TipoPedido, type Tom } from '@/lib/ia/tiposApresentacao'
import { PLANOS, custoApresentacao, custoDesenho, custoRoteiro, podeGastarCreditos, podeGerarTelas, proximoPlano, type PlanoId } from '@/lib/planos'
import { ATALHOS_TELAS, MIN_TELAS_IA, exemploApresentacoes, limitarTelas, textoCreditos, textoTelas } from '@/lib/telasIa'
import { useCreditos } from './Creditos'
import { GaleriaEstilos } from './criar/GaleriaEstilos'
import { PassoMarca } from './criar/PassoMarca'
import { PassoMaterial } from './criar/PassoMaterial'
import { CHAVE_PEDIDO_COLADO, MARCA_VAZIA, MATERIAL_VAZIO, linhasDeNumeros, type Briefing, type Formato, type MarcaEscolhida, type MaterialEscolhido } from './criar/estado'
import { Amostras, MiniaturaFluida, Secao, Segmento, SeloCusto } from './criar/ui'
import { MenuEstilos } from './criar/MenuEstilos'
import { idMensagem, mensagemDecisoes, mensagemEntendimento, mensagemGerando, mensagemPlano, mensagemPronta, tamanhoTexto, type Mensagem } from './criar/chat'
import { Compositor, Inicio, ListaMensagens, nomeDoAnexo, type AcaoMais } from './criar/Conversa'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import { marcaDoPerfil } from '@/lib/marca/perfil'

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
]
// créditos fictícios (demo): o débito é calculado aqui; no backend real vem da resposta da rota
const DEMO = dados.capacidades.creditosFicticios

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

  // ---------- a conversa e o painel ao lado ----------
  const promptInicial = params.get('prompt')?.slice(0, MAX_PROMPT) ?? ''
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [enviado, setEnviado] = useState(false)
  const [vista, setVista] = useState<Vista | null>(null)
  /** O design começou (as telas aparecem no painel ao lado, uma a uma). */
  const [design, setDesign] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [colado, setColado] = useState<string | null>(null)
  const [conversaRecolhida, setConversaRecolhida] = useState(false)
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
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border-[1.5px] border-aviso bg-avisoFundo px-4 py-3 text-[13px] text-avisoTexto">
        <span className="min-w-0 flex-1"><strong className="font-semibold">Seu pedido tem {telasPedidas} telas.</strong> O plano {PLANOS[planoId].nome} gera até {limite} por apresentação: com {limite}, a IA mantém a ordem e junta as telas de assunto mais próximo (nada é cortado em silêncio).</span>
        {planoParaPedido && <button type="button" onClick={() => abrirPlano(planoParaPedido)} className="h-8 shrink-0 rounded-full border-[1.5px] border-tinta bg-acao px-3 text-[12px] font-semibold text-acaoTexto">Fazer upgrade para o {PLANOS[planoParaPedido].nome} · {telasPedidas} telas</button>}
      </div>
    ) : (
      <div className="flex items-center gap-2 text-[13px] text-texto3"><Check className="h-3.5 w-3.5 text-sucessoTexto" />{analise.estrutura.length >= 3 ? `Estrutura de ${telasPedidas} telas reconhecida no pedido: a IA segue tela a tela.` : `${telasPedidas} telas pedidas no texto.`}{telasOk === telasPedidas ? ' Já selecionado no tamanho.' : ` Selecionado: ${telasOk}.`}</div>
    )
  ) : null

  // cores em hex do pedido viram a marca (com papéis) sem digitar de novo; o nome da empresa também. Uma vez por pedido
  // e só se a pessoa ainda não definiu cores (um kit ou a escolha dela mandam).
  const marcaAplicadaPara = useRef('')
  useEffect(() => {
    if (!enviado || !briefing.prompt.trim() || marcaAplicadaPara.current === briefing.prompt) return
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
  }, [enviado, briefing.prompt])

  // ---------- o que vai para a IA e para a montagem ----------
  const tipoDetectado = tipoEfetivo({ tipo: briefing.tipo, prompt: briefing.prompt, conteudo: material.origem === 'zero' ? '' : material.conteudo })
  const marcaMont = useMemo<Marca & { aplicarCores: boolean }>(() => ({ nome: marca.nome.trim().slice(0, 60), cores: marca.cores.filter((c) => RE_HEX.test(c)).slice(0, 4), aplicarCores: marca.aplicarCores, fontes: marca.fontes, ...(marca.papeis ? { papeis: marca.papeis } : {}), ...(marca.perfil ? { perfil: marca.perfil } : {}) }), [marca.nome, marca.cores, marca.aplicarCores, marca.fontes, marca.papeis, marca.perfil])
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
  // o manual pede pouco texto: as telas começam na densidade média (a pessoa ainda pode trocar no design)
  const densidadeManual = marca.perfil?.densidade ?? null
  useEffect(() => { if (densidadeManual) setDensidade(densidadeManual === 'baixa' ? 'medio' : 'detalhado') }, [densidadeManual])
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

  /** Escreve o roteiro (o plano). `pedido` = o pedido com os ajustes da conversa. Devolve o plano, ou null. */
  const gerarRoteiro = async (pedido: string = briefing.prompt): Promise<{ roteiro: Roteiro; nota: string } | null> => {
    if (gerando || lendoMaterial || (pedido.trim().length < 3 && conteudoEf.length < 20)) return null
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoDoRoteiro)
    if (!decisao.ok) { abrirCompra(`${decisao.motivo.replace(' Compre um pacote avulso ou faça upgrade.', '')} Escolha um pacote para continuar.`); return null }
    const lim = podeGerarTelas(planoId, telasOk)
    if (!lim.ok) { abrirPlano(lim.upgradePara ?? 'plus'); return null }
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl
    setGerando(true)
    try {
      const r = await dados.ia.roteiro(
        {
          origem: conteudoEf ? (material.origem === 'zero' ? 'texto' : material.origem) : 'zero',
          prompt: pedido,
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
      const n = (r.gerador === 'claude'
        ? `Escrito pela IA · roteiro ${textoCreditos(cobrado)}. Edite à vontade: reordenar, mudar texto e trocar o estilo é grátis.`
        : DEMO
          ? `Roteiro-guia gerado localmente (a IA não está conectada neste ambiente) · ${textoCreditos(cobrado)} de demonstração. Revise o texto: ele é um guia do tipo "${TIPOS[r.tipo].nome}".`
          : 'Roteiro-guia gerado localmente (a IA não está conectada neste ambiente). Nenhum crédito foi cobrado.')
      setNota(n)
      setRoteiro(r.roteiro)
      setTemaIa(r.tema)
      setTipoIa(r.tipo)
      if (tema === 'auto') setTema(r.tema)
      return { roteiro: r.roteiro, nota: n }
    } catch (e) {
      if (ctrl.signal.aborted) return null
      if ((e as { code?: string } | null)?.code === 'limite_do_plano') abrirCompra(mensagemDeErro(e))
      else mostrar(mensagemDeErro(e, 'Não foi possível gerar o roteiro. Tente novamente.'), 'erro')
      return null
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
    if (!limpo || !design) return null
    return montarDocumento(limpo, { modo, tema: temaEfetivo, estilo: estiloEf, imagens: imagensEf, densidade, marca: marcaMont, logo: logoMont, fotos: fotosMont, desenho: chaves.map((k) => desenhos[k]), direcoes })
  }, [limpo, design, modo, temaEfetivo, estiloEf, imagensEf, densidade, marcaMont, logoMont, fotosMont, chaves, desenhos, direcoes])
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

  const iniciarDesign = () => {
    if (!limpo) return false
    const decisao = podeGastarCreditos(dados.estado().creditos.saldo, custoDoDesenho)
    if (!decisao.ok) { abrirCompra(`${decisao.motivo.replace(' Compre um pacote avulso ou faça upgrade.', '')} Escolha um pacote para continuar.`); return false }
    setRevelar(0)
    setDesign(true)
    setVista('apresentacao')
    void desenhar(pendentes)
    return true
  }

  const total = documento?.scenes.length ?? 0
  const pronto = design && total > 0 && prontas >= total && revelar >= total

  // revela as telas uma a uma, conforme os desenhos chegam
  useEffect(() => {
    if (!design || revelar >= prontas) return
    const t = setTimeout(() => setRevelar((n) => n + 1), revelar === 0 ? 120 : prontas > 12 ? 120 : 260)
    return () => clearTimeout(t)
  }, [design, revelar, prontas])

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
      // par da biblioteca ou quaisquer famílias do Google escolhidas no kit
      fontes: k.fontes?.titulo && k.fontes.texto ? k.fontes : null,
      logo: k.logo && urlLogo ? { assetId: k.logo.assetId, url: urlLogo, nome: 'Logo do kit', largura: k.logo.largura, altura: k.logo.altura, cor: k.logo.cor, cores: k.cores } : null,
      logoRodape: k.logoRodape,
      kitId: k.id,
      // manual da marca do kit: perfil e os papéis de cor dele (fundo claro, cartão, indicadores)
      perfil: k.perfil ?? null,
      papeis: k.perfil ? marcaDoPerfil(k.perfil).papeis : null,
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
        perfil: marca.perfil ?? null,
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
    // o título da capa pedido na estrutura ("Título: …"), senão a primeira frase do pedido (sem o "| Marca")
    const t = analise.estrutura[0]?.titulo || (briefing.prompt.trim() ? briefing.prompt.split(/[.,\n]|\s[|·—–]\s/)[0]!.slice(0, 60) : 'Sua apresentação')
    const doc = montarDocumento({ titulo: t, telas: [{ tipo: 'capa', rotulo: marcaMont.nome.slice(0, 30), titulo: t, texto: 'Proposta · 2026', itens: [], notas: '' }] }, { modo: 'slides', tema: temaEfetivo, estilo: estiloEf, marca: marcaMont, logo: logoMont })
    return doc.scenes[0]!
  }, [briefing.prompt, analise, temaEfetivo, estiloEf, marcaMont, logoMont])
  useFontesDoDocumento({ scenes: [previaCapa] })

  const temRoteiro = !!roteiro
  const nomeEstilo = tema === 'auto' ? `Sugestão da IA${temaIa ? ` (${temaPorId(temaIa).nome})` : ''}` : temaPorId(tema).nome
  // ---------- a conversa ----------
  const dizer = (m: DistributiveOmit<Mensagem, 'id'>) => { const id = idMensagem(); setMensagens((ms) => [...ms, { ...m, id } as Mensagem]); return id }
  const concluir = (id: string, texto?: string) => setMensagens((ms) => ms.map((m) => (m.id === id && m.de === 'etapa' ? { ...m, feito: true, texto: texto ?? m.texto } : m)))
  const tirar = (id: string) => setMensagens((ms) => ms.filter((m) => m.id !== id))
  const depois = (ms: number, fn: () => void) => window.setTimeout(fn, ms)

  /** Primeiro envio: o pedido (e o texto colado) vira o briefing; o agente diz o que entendeu e abre as decisões ao lado. */
  const enviarPedido = (texto: string, anexo: string | null) => {
    const completo = [texto.trim(), anexo?.trim()].filter(Boolean).join('\n\n')
    if (!completo) return
    const [cabe, resto] = dividirNoLimite(completo)
    const conteudo = [material.conteudo.trim(), resto].filter(Boolean).join('\n\n')
    setBriefing((b) => ({ ...b, prompt: cabe }))
    if (resto) setMaterial((m) => ({ ...m, origem: m.origem === 'zero' ? 'texto' : m.origem, conteudo }))
    setEnviado(true)
    dizer({ de: 'pessoa', texto: texto.trim(), ...(anexo ? { anexo: { nome: nomeDoAnexo(anexo), tamanho: tamanhoTexto(anexo) } } : {}) })
    const an = analisarPedido(cabe)
    const nTelas = telasEscolhidas.current || !an.telas ? telasOk : limitarTelas(an.telas, limite)
    const tipo = tipoEfetivo({ tipo: briefing.tipo, prompt: cabe, conteudo: material.origem === 'zero' && !resto ? '' : conteudo })
    const nomeMarca = marca.nome || an.marca
    const cores = marca.cores.length ? marca.cores : an.paleta?.cores ?? []
    const lendo = dizer({ de: 'etapa', texto: 'Lendo o pedido…', feito: false })
    depois(500, () => {
      concluir(lendo, 'Pedido lido')
      dizer({ de: 'ia', texto: mensagemEntendimento({ telas: nTelas, tipo: TIPOS[tipo].nome, marca: nomeMarca, publico: briefing.publico.trim(), estrutura: an.estrutura.length, cores, temLogo: !!marca.logo, temKit: !!marca.kitId, material: !!conteudo || material.fotos.length > 0 }) })
    })
    depois(1100, () => {
      dizer({ de: 'ia', texto: mensagemDecisoes({ temLogo: !!marca.logo, temKit: !!marca.kitId, cores, marca: nomeMarca, temFontes: !!marca.fontes }) })
      setVista('decisoes')
    })
  }

  /** Escreve (ou refaz) o plano e abre ao lado para revisar. */
  const criarPlano = async (pedido?: string, ajuste = false) => {
    if (!ajuste && !temRoteiro) dizer({ de: 'etapa', texto: 'Decisões de marca confirmadas', feito: true })
    const etapa = dizer({ de: 'etapa', texto: ajuste ? 'Refazendo o plano…' : 'Escrevendo o plano…', feito: false })
    const r = await gerarRoteiro(pedido)
    if (!r) return tirar(etapa)
    concluir(etapa, ajuste ? 'Plano refeito' : 'Plano criado')
    dizer({ de: 'ia', texto: mensagemPlano({ titulo: r.roteiro.titulo, telas: r.roteiro.telas.map((t) => t.titulo), nota: r.nota, ajuste }), cartao: 'plano' })
    setDesign(false)
    setVista('plano')
  }

  const etapaDesign = useRef<string | null>(null)
  const gerarApresentacao = () => {
    if (!limpo) return
    const refazer = pendentes.length
    if (!iniciarDesign()) return
    dizer({ de: 'pessoa', texto: 'Gerar' })
    dizer({ de: 'ia', texto: mensagemGerando({ telas: limpo.telas.length, estilo: temaPorId(temaEfetivo).nome, logo: !!marca.logo, fontes: marca.fontes ? `${marca.fontes.titulo} + ${marca.fontes.texto}` : null, refazer }) })
    etapaDesign.current = dizer({ de: 'etapa', texto: 'Criando o visual…', feito: false })
  }
  // fim do design: a etapa vira "criado" e o agente entrega a apresentação (com a capa no cartão)
  useEffect(() => {
    if (!pronto || !etapaDesign.current) return
    concluir(etapaDesign.current, `“${limpo?.titulo ?? 'Apresentação'}” criada`)
    etapaDesign.current = null
    dizer({ de: 'ia', texto: mensagemPronta({ telas: total, limitado: telasPedidas ? { limite, pedidas: telasPedidas } : null }), cartao: 'apresentacao' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto])

  /** Mensagem depois do primeiro envio: antes do plano vira parte do pedido; depois, refaz o plano com o ajuste. */
  const enviarAjuste = (texto: string, anexo: string | null) => {
    const extra = [texto.trim(), anexo?.trim()].filter(Boolean).join('\n\n')
    if (!extra) return
    dizer({ de: 'pessoa', texto: texto.trim(), ...(anexo ? { anexo: { nome: nomeDoAnexo(anexo), tamanho: tamanhoTexto(anexo) } } : {}) })
    const pedido = `${briefing.prompt}\n\nAjuste: ${extra}`.slice(0, MAX_PROMPT)
    setBriefing((b) => ({ ...b, prompt: pedido }))
    if (!temRoteiro) {
      depois(300, () => { dizer({ de: 'ia', texto: 'Anotado: isso entra no plano. Quando as decisões ao lado estiverem certas, clique em Criar o plano.' }); setVista('decisoes') })
      return
    }
    void criarPlano(pedido, true)
  }

  const enviar = () => {
    const t = rascunho
    const a = colado
    setRascunho('')
    setColado(null)
    if (!enviado) enviarPedido(t, a)
    else enviarAjuste(t, a)
  }

  // atalho do painel: a ideia (?prompt=) ou o briefing longo colado (?colado=1) já chegam enviados
  const chegou = useRef(false)
  useEffect(() => {
    if (chegou.current) return
    chegou.current = true
    let longo = ''
    if (params.get('colado')) {
      try { longo = sessionStorage.getItem(CHAVE_PEDIDO_COLADO) ?? ''; sessionStorage.removeItem(CHAVE_PEDIDO_COLADO) } catch { /* sem armazenamento */ }
    }
    if (longo) enviarPedido('', longo)
    else if (promptInicial) enviarPedido(promptInicial, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parar = () => { abortar.current?.abort(); setGerando(false); setDesenhando(false) }
  const ocupado = gerando || desenhando

  const acoesMais: AcaoMais[] = [
    { id: 'material', rotulo: 'Anexar PDF, texto, fotos ou números', icone: 'material', executar: () => setVista('material') },
    { id: 'logo', rotulo: 'Logo, cores e fontes da marca', icone: 'logo', executar: () => setVista('decisoes') },
    { id: 'estilo', rotulo: 'Escolher o estilo de design', icone: 'estilo', executar: () => setVista('estilos') },
  ]
  const compositor = (grande: boolean) => (
    <Compositor
      grande={grande}
      autoFoco={grande}
      valor={rascunho}
      aoMudar={setRascunho}
      colado={colado}
      aoColar={(t) => setColado((c) => (c ? `${c}\n\n${t}` : t))}
      aoTirarColado={() => setColado(null)}
      aoEnviar={enviar}
      aoParar={parar}
      ocupado={ocupado}
      acoes={acoesMais}
      placeholder={grande ? 'Ex.: Proposta de identidade visual para uma marca de cerâmica artesanal, com conceito, paleta, tipografia e aplicações… Pode colar um briefing completo.' : temRoteiro ? 'Peça um ajuste no plano…' : 'Envie uma mensagem para o agente…'}
    />
  )

  const capa = documento?.scenes[0] ?? null
  const titulo = roteiro?.titulo.trim() || analise.estrutura[0]?.titulo || (enviado ? briefing.prompt.split(/[.,\n]|\s[|·—–]\s/)[0]!.slice(0, 60) : '') || 'Criar com IA'
  const vistasDisponiveis: Vista[] = [...(enviado ? (['decisoes'] as const) : []), 'material', 'estilos', ...(temRoteiro ? (['plano'] as const) : []), ...(design ? (['apresentacao'] as const) : [])]
  const painelAberto = vista !== null
  const checklist = [
    { id: 'titulo-logo', nome: 'Logo', feito: !!marca.logo, valor: marca.logo ? 'Enviado' : `Sem logo${marca.nome ? `: “${marca.nome}” em texto` : ''}` },
    { id: 'titulo-cores', nome: 'Identidade visual', feito: marca.cores.length > 0, valor: marca.cores.length ? <Amostras cores={marca.cores} tamanho={14} /> : 'Cores do estilo' },
    { id: 'titulo-fontes', nome: 'Fontes', feito: !!marca.fontes, valor: marca.fontes ? `${marca.fontes.titulo} + ${marca.fontes.texto}` : 'Do estilo' },
    { id: 'titulo-tamanho', nome: 'Tamanho', feito: true, valor: `${plural(telasOk, 'tela', 'telas')} · ${NOMES_FORMATO[formato]}` },
  ]

  return (
    <div className="flex h-dvh flex-col bg-fundo text-texto">
      <header className="flex h-14 shrink-0 items-center gap-2 px-3">
        <Link href="/app" aria-label="Voltar ao painel" className="flex h-9 w-9 items-center justify-center rounded-full border border-borda bg-superficie text-texto2 hover:border-bordaForte hover:text-texto"><Home className="h-4 w-4" /></Link>
        <h1 className="min-w-0 truncate text-[15px] font-medium">{titulo}</h1>
        {painelAberto && (
          <button type="button" onClick={() => setConversaRecolhida((v) => !v)} aria-label={conversaRecolhida ? 'Mostrar a conversa' : 'Recolher a conversa'} title={conversaRecolhida ? 'Mostrar a conversa' : 'Recolher a conversa'} className="hidden h-8 w-8 items-center justify-center rounded-lg text-texto3 hover:bg-hover hover:text-texto lg:flex">
            {conversaRecolhida ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => abrirCompra()} title={`Comprar créditos · ${exemploApresentacoes(saldo)}`} className="flex h-8 items-center gap-1.5 rounded-full border border-borda bg-superficie px-3 text-[12px] text-texto2 hover:border-bordaForte hover:text-texto">
            <Sparkles className="h-3.5 w-3.5 text-acento" /><span className="mono text-texto">{saldo.toLocaleString('pt-BR')}</span><span className="hidden md:inline">créditos · {textoTelas(saldo)}</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        {/* conversa: centralizada até o painel abrir; depois, coluna à esquerda */}
        <section aria-label="Conversa" className={cx('min-h-0 flex-col', painelAberto ? cx('hidden w-full shrink-0 lg:w-[400px] xl:w-[420px]', conversaRecolhida ? 'lg:hidden' : 'lg:flex') : 'flex w-full')}>
          {!enviado ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-8">
              <Inicio compositor={compositor(true)}>
                <OpcoesBriefing briefing={briefing} aoMudar={setBriefing} tipoDetectado={tipoDetectado} />
                {avisoTelas}
                <div className="flex flex-col gap-2.5">
                  <div className="rotulo-mono">Ou comece por um exemplo</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {EXEMPLOS.map((ex) => (
                      <button key={ex.texto} type="button" onClick={() => { setRascunho(ex.texto); setBriefing((b) => ({ ...b, tipo: ex.tipo })) }} className="flex min-w-0 items-center gap-3 rounded-[12px] border border-borda bg-superficie p-3 text-left hover:border-bordaForte">
                        <span className="h-8 w-8 flex-none" style={{ background: ex.cor, borderRadius: ex.raio }} />
                        <span className="text-[13px] leading-[1.4] text-textoCorpo"><span className="mono mb-0.5 block text-[10px] uppercase tracking-[0.08em] text-texto3">{NOMES_TIPO_CURTO[ex.tipo]}</span>{ex.texto}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Inicio>
            </div>
          ) : (
            <div className={cx('flex min-h-0 flex-1 flex-col', !painelAberto && 'mx-auto w-full max-w-[760px]')}>
              <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-2">
                <ListaMensagens mensagens={mensagens} titulo={titulo} capa={capa} assets={assets} vistaAtual={vista} aoAbrir={(c) => { setVista(c); setConversaRecolhida(false) }} />
              </div>
              {compositor(false)}
            </div>
          )}
        </section>

        {/* painel ao lado: decisões, material, estilos, plano e a apresentação */}
        <section aria-label="Painel ao lado" hidden={!painelAberto} className="painel-criar flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-borda bg-superficie">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-borda px-3">
            <div role="tablist" aria-label="O que mostrar ao lado" className="flex min-w-0 items-center gap-1 overflow-x-auto">
              <button type="button" role="tab" aria-selected={false} onClick={() => setVista(null)} className="flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-medium text-texto2 hover:bg-hover hover:text-texto lg:hidden">Conversa</button>
              {vistasDisponiveis.map((v) => (
                <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={cx('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors', vista === v ? 'bg-acao text-acaoTexto' : 'text-texto2 hover:bg-hover hover:text-texto')}>
                  {NOMES_VISTA[v]}
                  {v === 'apresentacao' && !pronto && design && <span aria-hidden className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            {design && projetoId && pronto && (
              <>
                <button type="button" onClick={() => abrirApresentacao(router, projetoId)} className="hidden h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-texto2 hover:bg-hover hover:text-texto sm:flex"><Play className="h-3.5 w-3.5 fill-current" />Apresentar</button>
                <Link href={`/app/projects/${projetoId}/share`} className="hidden h-8 items-center rounded-full px-3 text-[13px] font-medium text-texto2 hover:bg-hover hover:text-texto sm:flex">Compartilhar</Link>
              </>
            )}
            <button type="button" aria-label="Fechar o painel" onClick={() => setVista(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-texto3 hover:bg-hover hover:text-texto"><X className="h-4 w-4" /></button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto">
            {vista === 'decisoes' && (
              <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em]">Decisões antes do plano</h2>
                  <p className="mt-1 text-[14px] text-texto2">O que veio no pedido já está marcado. Tudo aqui entra nas telas sem IA (grátis) e dá para trocar depois.</p>
                </div>
                <ul aria-label="Decisões" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {checklist.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex w-full flex-col gap-1 rounded-[12px] border border-borda bg-fundo px-3 py-2.5 text-left hover:border-bordaForte">
                        <span className="flex items-center gap-1.5 text-[12px] font-medium text-texto2">
                          <span className={cx('flex h-4 w-4 items-center justify-center rounded-full', c.feito ? 'bg-sucessoTexto text-sucessoFundo' : 'border border-bordaForte')}>{c.feito && <Check className="h-2.5 w-2.5" />}</span>{c.nome}
                        </span>
                        <span className="truncate text-[13px] text-texto">{c.valor}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Secao titulo="Briefing" dica="Tipo, público, tom e idioma (opcional)." selo={<SeloCusto />} id="titulo-briefing">
                  <OpcoesBriefing briefing={briefing} aoMudar={setBriefing} tipoDetectado={tipoDetectado} />
                </Secao>
                <PassoMarca marca={marca} aoMudar={setMarca} prompt={briefing.prompt} kits={kits} aoSalvarKit={salvarKit} aoExcluirKit={excluirKit} aplicarKit={aplicarKit} previa={<div className="overflow-hidden rounded-md"><MiniaturaFluida cena={previaCapa} assets={assets} /></div>} />
                <EscolhaTamanho formato={formato} aoFormato={setFormato} telas={telasOk} aoTelas={setTelas} planoId={planoId} limite={limite} aoUpgrade={(p) => abrirPlano(p)} bloqueado={temRoteiro} />
                {avisoTelas}
              </div>
            )}

            <div hidden={vista !== 'material'} className="p-4 sm:p-6">
              <h2 className="mb-1 text-[22px] font-semibold tracking-[-0.03em]">Material</h2>
              <p className="mb-5 text-[14px] text-texto2">Texto, PDF, fotos e números que já existem. Tudo entra no plano de uma vez.</p>
              <PassoMaterial material={material} aoMudar={setMaterial} telas={telasOk} planoId={planoId} aoLer={aoLerMaterial} />
            </div>

            {vista === 'estilos' && (
              <div className="flex flex-col gap-4 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-[-0.03em]">Estilos</h2>
                    <p className="mt-1 text-[14px] text-texto2">{TEMAS.length} estilos com tipografia, cor, forma e composição próprias. Trocar é grátis, antes ou depois.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-texto3">
                    <span>Energia</span>
                    <Segmento rotulo="Energia do estilo" opcoes={ESTILOS_ENERGIA} valor={energia} aoMudar={setEnergia} nomes={(e) => NOMES_ENERGIA[e]} />
                  </div>
                </div>
                <GaleriaEstilos comAuto={!design} valor={design ? temaEfetivo : tema} aoEscolher={(id) => { if (design && id === 'auto') return; setTema(id) }} marca={marcaMont} logo={logoMont} assets={assets} titulo={roteiro?.titulo || briefing.prompt.split(/[.,\n]/)[0] || ''} energia={energia === 'auto' ? null : energia} sugerido={temaIa ?? TIPOS[tipoDetectado].temas[0]} />
              </div>
            )}

            {vista === 'plano' && roteiro && (
              <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="rotulo-mono">Plano · {roteiro.telas.length} telas</div>
                    <button type="button" onClick={() => void criarPlano(`${briefing.prompt}\n\nProponha uma estrutura diferente da óbvia.`, true)} disabled={gerando} className="flex h-8 items-center gap-2 rounded-full border border-bordaForte bg-superficie px-3 text-[12px] font-medium hover:border-tinta disabled:opacity-50">
                      <RotateCcw className={cx('h-3.5 w-3.5', gerando && 'animate-spin')} />Outro plano <span className="mono text-texto3">· {textoCreditos(custoDoRoteiro)}</span>
                    </button>
                  </div>
                  <label htmlFor="titulo-roteiro" className="sr-only">Título da apresentação</label>
                  <textarea id="titulo-roteiro" rows={1} value={roteiro.titulo} maxLength={120} onChange={(e) => setRoteiro({ ...roteiro, titulo: e.target.value.replace(/\n/g, ' ') })} className="w-full resize-none bg-transparent p-0 text-[clamp(24px,3vw,32px)] font-semibold leading-[1.1] tracking-[-0.045em] outline-none [field-sizing:content]" />
                  {nota && <p className="text-[13px] text-texto3">{nota}</p>}
                  {roteiro.telas.map((t, i) => <CartaoTela key={i} t={t} i={i} total={roteiro.telas.length} desenhada={!!desenhos[chaves[i] ?? '']} alterada={!desenhos[chaves[i] ?? ''] && Object.keys(desenhos).length > 0} aoMudar={(p) => atualizarTela(i, p)} aoMover={(d) => mover(i, d)} aoRemover={() => remover(i)} />)}
                  {roteiro.telas.length < limite
                    ? <button type="button" onClick={adicionar} className="h-11 rounded-[12px] border-[1.5px] border-dashed border-bordaHover text-[13px] text-texto3 hover:border-tinta hover:text-texto">+ Adicionar tela <span className="mono">· {textoCreditos(custoDesenho(1))} no design</span></button>
                    : <p className="text-center text-[13px] text-texto3">Limite de {limite} telas do plano {PLANOS[planoId].nome}. {proximoPlano(planoId) && <button type="button" onClick={() => abrirPlano(proximoPlano(planoId)!)} className="text-acento hover:underline">Ver planos</button>}</p>}
                </div>
                <aside aria-label="Aparência da apresentação" className="flex flex-col gap-5 self-start xl:sticky xl:top-0">
                  <div className="flex flex-col gap-2.5 rounded-[14px] border border-borda p-3">
                    <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold">Estilo</span><SeloCusto /></div>
                    <div className="overflow-hidden rounded-md"><MiniaturaFluida cena={previaCapa} assets={assets} /></div>
                    <div className="text-[13px] font-medium">{temaPorId(temaEfetivo).nome}</div>
                    <button type="button" onClick={() => setVista('estilos')} className="h-8 rounded-full border border-bordaForte text-[13px] font-medium hover:border-tinta">Explorar estilos…</button>
                  </div>
                  <div className="flex flex-col gap-2 rounded-[14px] border border-borda p-3">
                    <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold">Marca</span><button type="button" onClick={() => setVista('decisoes')} className="text-[12px] text-acento hover:underline">Editar</button></div>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-texto2">
                      {marca.logo ? <img src={marca.logo.url} alt="Logo" className="h-5 max-w-[80px] object-contain" /> : <span>sem logo</span>}
                      {marca.cores.length > 0 && <Amostras cores={marca.cores} tamanho={14} />}
                      <span className="truncate">{marca.fontes ? `${marca.fontes.titulo} + ${marca.fontes.texto}` : 'fontes do estilo'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold">Imagens</span><SeloCusto /></div>
                    {([['formas', 'Formas do estilo', 'motivos e cor'], ['placeholders', material.fotos.length ? 'Suas fotos' : 'Espaços para imagens', material.fotos.length ? plural(material.fotos.length, 'foto', 'fotos') : 'você envia'], ['nenhuma', 'Sem imagens', 'só tipografia']] as const).map(([id, rotulo, sub]) => (
                      <button key={id} type="button" aria-pressed={imagensEf === id} onClick={() => setImagens(id)} className={cx('flex justify-between gap-2 rounded-[10px] border px-3 py-2 text-left text-[13px]', imagensEf === id ? 'border-violeta bg-acentoSuave' : 'border-borda bg-superficie hover:border-bordaForte')}>
                        <span>{rotulo}</span><span className="text-[12px] text-texto3">{sub}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold">Texto por tela</span><SeloCusto /></div>
                    <Segmento cheio rotulo="Texto por tela" opcoes={['minimo', 'medio', 'detalhado'] as const} valor={densidade} aoMudar={setDensidade} nomes={(d) => ({ minimo: 'Mínimo', medio: 'Médio', detalhado: 'Detalhado' })[d]} />
                  </div>
                </aside>
              </div>
            )}

            {vista === 'apresentacao' && documento && (
              <div className="flex flex-col gap-4 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="rotulo-mono flex items-center gap-2" aria-live="polite">
                    {(!pronto || salvandoProjeto) && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-bordaForte border-t-violeta" />}
                    {pronto ? (salvandoProjeto ? 'Salvando o projeto…' : `Pronto · ${total} telas`) : `Desenhando tela ${Math.min(revelar + 1, total)} de ${total}`}
                  </div>
                  <div className={cx('flex flex-wrap gap-2 transition-opacity', !pronto && 'pointer-events-none opacity-35')}>
                    <button type="button" onClick={() => setVista('plano')} className="flex h-9 items-center rounded-full px-3 text-[13px] text-texto3 hover:text-texto">← Ajustar o plano</button>
                    {projetoId && <button type="button" onClick={() => router.push(`/app/projects/${projetoId}/edit`)} className="flex h-9 items-center rounded-full border-2 border-tinta bg-violeta px-4 text-[13px] font-semibold text-white hover:bg-acentoHover">Abrir no editor →</button>}
                  </div>
                </div>
                <div className="h-1 overflow-hidden rounded-sm bg-borda"><div className="h-1 bg-violeta transition-[width] duration-400" style={{ width: `${total ? (Math.min(revelar, total) / total) * 100 : 0}%` }} /></div>
                <div className={cx('flex flex-wrap items-center gap-3 transition-opacity', !pronto && 'pointer-events-none opacity-35')}>
                  <MenuEstilos valor={temaEfetivo} aoEscolher={setTema} marca={marcaMont} aoVerGaleria={() => setVista('estilos')} desativado={!pronto} />
                  <span className="text-[12px] text-texto3">trocar é grátis</span>
                  {marca.logo && (
                    <label className="ml-auto flex items-center gap-2 text-[12px] text-texto3">
                      <input type="checkbox" checked={marca.logoRodape} onChange={(e) => setMarca((m) => ({ ...m, logoRodape: e.target.checked }))} /> Logo também no rodapé
                    </label>
                  )}
                </div>
                <div className={cx('grid gap-4', formato === 'story' ? 'grid-cols-3 xl:grid-cols-5' : 'sm:grid-cols-2 2xl:grid-cols-3')}>
                  {documento.scenes.map((cena, i) => {
                    const visivel = i < revelar && !!desenhos[chaves[i] ?? '']
                    return (
                      <div key={cena.id} className="flex min-w-0 flex-col gap-1.5">
                        <div className={cx('overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)]', visivel ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-90')}>
                          {visivel ? <MiniaturaFluida cena={cena} assets={assets} /> : (
                            // ainda desenhando: o título da tela no lugar (o plano já diz o que vem)
                            <div className="flex items-center justify-center bg-fundo p-6 text-center" style={{ aspectRatio: `${cena.size.width} / ${cena.size.height}` }}>
                              <span className="line-clamp-3 text-[14px] font-medium text-texto2">{limpo?.telas[i]?.titulo ?? cena.title}</span>
                            </div>
                          )}
                        </div>
                        <div className="truncate text-[12px] text-texto3">{String(i + 1).padStart(2, '0')} · {cena.title}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* rodapé do painel: a ação do momento, com o custo à vista */}
          {(vista === 'decisoes' || vista === 'material' || vista === 'estilos') && enviado && !design && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-borda px-4 py-3">
              <span className="min-w-0 flex-1 text-[12px] text-texto3">
                {temRoteiro ? 'O plano já existe: mudanças de marca e estilo entram no design, grátis.' : <>Plano agora <span className="mono text-texto">{textoCreditos(custoDoRoteiro)}</span> · design de {plural(telasOk, 'tela', 'telas')} depois <span className="mono text-texto">{textoCreditos(custoDesenho(telasOk))}</span>{semSaldo && <> · <button type="button" onClick={() => abrirCompra()} className="text-perigo underline-offset-2 hover:underline">saldo insuficiente</button></>}</>}
              </span>
              {temRoteiro
                ? <button type="button" onClick={() => setVista('plano')} className="flex h-10 items-center rounded-full border-2 border-tinta bg-acao px-5 text-[14px] font-semibold text-acaoTexto hover:bg-acaoHover">Voltar ao plano →</button>
                : <button type="button" onClick={() => void criarPlano()} disabled={!briefingOk || gerando || lendoMaterial} className="flex h-10 items-center gap-2 rounded-full border-2 border-tinta bg-violeta px-5 text-[14px] font-semibold text-white hover:bg-acentoHover disabled:cursor-not-allowed disabled:opacity-45">
                    {gerando ? 'Escrevendo o plano' : 'Criar o plano →'}
                    {gerando && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  </button>}
            </div>
          )}
          {vista === 'plano' && roteiro && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-borda px-4 py-3">
              <span className="min-w-0 flex-1 text-[12px] text-texto3">{pendentes.length ? (pendentes.length === chaves.length ? `A IA desenha ${plural(pendentes.length, 'tela', 'telas')}` : `Redesenha só ${plural(pendentes.length, 'tela alterada', 'telas alteradas')}; as outras ficam`) : 'Todas as telas já estão desenhadas · grátis'}</span>
              <button type="button" onClick={gerarApresentacao} disabled={desenhando} className="flex h-10 items-center gap-2 rounded-full border-2 border-tinta bg-violeta px-5 text-[14px] font-semibold text-white hover:bg-acentoHover disabled:opacity-45">
                <Sparkles className="h-4 w-4" />Gerar apresentação <span className="mono font-normal opacity-80">· {textoCreditos(custoDoDesenho)}</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type Vista = 'decisoes' | 'material' | 'estilos' | 'plano' | 'apresentacao'
const NOMES_VISTA: Record<Vista, string> = { decisoes: 'Decisões', material: 'Material', estilos: 'Estilos', plano: 'Plano', apresentacao: 'Apresentação' }

/** Tipo, público, tom e idioma do pedido. */
function OpcoesBriefing({ briefing, aoMudar, tipoDetectado }: { briefing: Briefing; aoMudar: (f: (b: Briefing) => Briefing) => void; tipoDetectado: TipoApresentacao }) {
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Tipo de apresentação" className="flex flex-wrap gap-1.5">
        {(['auto', ...TIPOS_APRESENTACAO] as TipoPedido[]).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={briefing.tipo === t} title={t === 'auto' ? `A IA reconhece pelo pedido${briefing.prompt.trim() ? ` (agora: ${TIPOS[tipoDetectado].nome})` : ''}` : TIPOS[t].descricao} onClick={() => aoMudar((b) => ({ ...b, tipo: t }))} className={cx('rounded-full border px-3 py-1 text-[12px] font-medium transition-colors', briefing.tipo === t ? 'border-tinta bg-acao text-acaoTexto' : 'border-borda bg-superficie text-textoCorpo hover:border-bordaForte hover:text-texto')}>
            {NOMES_TIPO_CURTO[t]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 text-texto3">
          <span className="shrink-0">Para quem</span>
          <input value={briefing.publico} maxLength={200} onChange={(e) => aoMudar((b) => ({ ...b, publico: e.target.value }))} placeholder={TIPOS[tipoDetectado].publico || 'ex.: diretoria, alunos, clientes'} className="min-w-0 flex-1 rounded-md bg-superficie2 px-2.5 py-1.5 text-texto outline-none placeholder:text-texto3" />
        </label>
        <label className="flex items-center gap-2 text-texto3">
          <span>Tom</span>
          <select aria-label="Tom" value={briefing.tom} onChange={(e) => aoMudar((b) => ({ ...b, tom: e.target.value as Tom | '' }))} className="rounded-md bg-superficie2 px-2 py-1.5 text-texto outline-none">
            <option value="">Padrão ({NOMES_TOM[TIPOS[tipoDetectado].tom]})</option>
            {TONS.map((t) => <option key={t} value={t}>{NOMES_TOM[t]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-texto3">
          <span>Idioma</span>
          <select aria-label="Idioma" value={briefing.idioma} onChange={(e) => aoMudar((b) => ({ ...b, idioma: e.target.value as Idioma }))} className="rounded-md bg-superficie2 px-2 py-1.5 text-texto outline-none">
            {IDIOMAS.map((i) => <option key={i} value={i}>{NOMES_IDIOMA[i]}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

/** Uma tela do plano: número à esquerda, rótulo, tipo, título, texto, itens e notas editáveis; subir, descer e tirar. */
function CartaoTela({ t, i, total, desenhada, alterada, aoMudar, aoMover, aoRemover }: { t: TelaRoteiro; i: number; total: number; desenhada: boolean; alterada: boolean; aoMudar: (p: Partial<TelaRoteiro>) => void; aoMover: (d: number) => void; aoRemover: () => void }) {
  const comp = COMPONENTES[t.tipo]
  return (
    <div className="group flex overflow-hidden rounded-[14px] border border-borda bg-superficie hover:border-bordaForte">
      <span className="flex w-11 shrink-0 items-start justify-center bg-acentoSuave pt-4 text-[14px] font-semibold text-acento">{i + 1}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-3.5 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <input aria-label={`Rótulo da tela ${i + 1}`} value={t.rotulo} maxLength={40} placeholder="rótulo" onChange={(e) => aoMudar({ rotulo: e.target.value })} className="mono w-[120px] shrink-0 bg-transparent p-0 text-[11px] uppercase tracking-[0.06em] text-texto3 outline-none placeholder:normal-case placeholder:text-texto3" />
          <span className="flex-1" />
          {desenhada ? <span className="mono rounded-full bg-sucessoFundo px-1.5 py-0.5 text-[9px] text-sucessoTexto" title="Já desenhada: trocar o estilo não custa nada">DESENHADA</span> : alterada && <span className="mono rounded-full bg-acentoSuave px-1.5 py-0.5 text-[9px] text-acento" title="Alterada: será redesenhada">{textoCreditos(custoDesenho(1)).toUpperCase()}</span>}
          <select aria-label={`Tipo da tela ${i + 1}`} value={t.tipo} onChange={(e) => aoMudar({ tipo: e.target.value as TipoTela })} className="rounded-md bg-superficie2 px-2 py-1 text-[12px] text-textoCorpo outline-none hover:bg-hover">
            {TIPOS_TELA.map((tp) => <option key={tp} value={tp}>{NOMES_TIPO_TELA[tp]}</option>)}
          </select>
        </div>
        <input aria-label={`Título da tela ${i + 1}`} value={t.titulo} maxLength={160} onChange={(e) => aoMudar({ titulo: e.target.value })} className="min-w-0 bg-transparent p-0 text-[17px] font-semibold tracking-[-0.02em] outline-none" />
        {comp.limites.texto > 0 && <textarea aria-label={`Texto da tela ${i + 1}`} value={t.texto} maxLength={600} rows={2} placeholder="Texto de apoio (opcional)" onChange={(e) => aoMudar({ texto: e.target.value })} className="w-full resize-none bg-transparent p-0 text-[14px] leading-normal text-textoCorpo outline-none placeholder:text-texto3 [field-sizing:content]" />}
        {comp.maxItens > 0 && (
          <textarea aria-label={`Itens da tela ${i + 1}`} value={t.itens.join('\n')} rows={Math.max(2, Math.min(6, t.itens.length))} placeholder={`Um por linha: ${comp.itens}`} onChange={(e) => aoMudar({ itens: e.target.value.split('\n').slice(0, Math.max(6, comp.maxItens)).map((l) => l.slice(0, 160)) })} className="w-full resize-none rounded-md bg-fundo px-2 py-1.5 text-[13px] leading-relaxed text-textoCorpo outline-none placeholder:text-texto3" />
        )}
        {t.notas && <details className="text-[13px] text-texto3"><summary className="cursor-pointer select-none">Notas do apresentador</summary><textarea aria-label={`Notas da tela ${i + 1}`} value={t.notas} maxLength={1200} rows={3} onChange={(e) => aoMudar({ notas: e.target.value })} className="mt-1 w-full resize-none rounded-md bg-fundo px-2 py-1.5 outline-none" /></details>}
      </div>
      <div className="flex flex-col gap-0.5 p-1.5 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" title="Subir" aria-label={`Subir tela ${i + 1}`} disabled={i === 0} onClick={() => aoMover(-1)} className="flex h-[26px] w-7 items-center justify-center rounded-md text-texto3 hover:bg-hover hover:text-texto disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" title="Descer" aria-label={`Descer tela ${i + 1}`} disabled={i === total - 1} onClick={() => aoMover(1)} className="flex h-[26px] w-7 items-center justify-center rounded-md text-texto3 hover:bg-hover hover:text-texto disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
        <button type="button" title="Remover" aria-label={`Remover tela ${i + 1}`} disabled={total <= 1} onClick={aoRemover} className="flex h-[26px] w-7 items-center justify-center rounded-md text-texto3 hover:bg-perigo/10 hover:text-perigo disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

/** Formato e número de telas (atalhos e campo livre até o limite do plano). Depois do plano, só leitura. */
function EscolhaTamanho({ formato, aoFormato, telas, aoTelas, planoId, limite, aoUpgrade, bloqueado }: { formato: Formato; aoFormato: (f: Formato) => void; telas: number; aoTelas: (n: number) => void; planoId: PlanoId; limite: number; aoUpgrade: (p: PlanoId) => void; bloqueado: boolean }) {
  const [livre, setLivre] = useState(String(telas))
  useEffect(() => setLivre(String(telas)), [telas])
  const planoQueLibera = (n: number) => (['plus', 'pro', 'studio'] as PlanoId[]).find((p) => PLANOS[p].limites.telasPorPrompt >= n)
  return (
    <Secao titulo="Formato e tamanho" dica={bloqueado ? 'O plano já foi escrito com este tamanho. Para mudar, peça outro plano na conversa.' : `De ${MIN_TELAS_IA} a ${limite} telas no plano ${PLANOS[planoId].nome}. Cada tela entra no custo do design.`} id="titulo-tamanho">
      <fieldset disabled={bloqueado} className="flex flex-col gap-3 disabled:opacity-60">
        <div role="radiogroup" aria-label="Formato" className="grid gap-2 sm:grid-cols-3">
          {FORMATOS.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={formato === f} onClick={() => aoFormato(f)} className={cx('flex flex-col gap-0.5 rounded-[12px] border-[1.5px] px-3 py-2.5 text-left', formato === f ? 'border-violeta bg-acentoSuave' : 'border-bordaForte bg-superficie hover:border-tinta')}>
              <span className="flex items-center gap-2 text-[14px] font-medium"><span className={cx('inline-block rounded-[3px] border-2 border-current', f === 'story' ? 'h-4 w-2.5' : 'h-2.5 w-4')} />{NOMES_FORMATO[f]}</span>
              <span className="text-[12px] text-texto3">{DICA_FORMATO[f]}</span>
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Quantidade de telas" className="flex flex-wrap gap-2">
          {ATALHOS_TELAS.map((n) => {
            const p = planoQueLibera(n)
            return n <= limite ? (
              <button key={n} type="button" role="radio" aria-checked={telas === n} onClick={() => aoTelas(n)} className={cx('h-9 min-w-[78px] rounded-full border-[1.5px] px-3 text-[13px] font-medium', telas === n ? 'border-tinta bg-acao text-acaoTexto' : 'border-bordaForte bg-superficie text-textoCorpo hover:border-tinta')}>{n} telas</button>
            ) : (
              <button key={n} type="button" onClick={() => p && aoUpgrade(p)} title={p ? `Disponível no plano ${PLANOS[p].nome}` : undefined} className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-bordaForte px-3 text-[12px] text-texto3 hover:border-tinta hover:text-texto">
                <Lock className="h-3 w-3" />{n} {p && <span className="mono text-[10px] uppercase">{PLANOS[p].nome}</span>}
              </button>
            )
          })}
          <label className="flex items-center gap-2 text-[13px] text-texto2">
            ou
            <input type="number" aria-label="Número de telas" min={MIN_TELAS_IA} max={limite} value={livre} onChange={(e) => setLivre(e.target.value)} onBlur={() => aoTelas(limitarTelas(Number(livre), limite))} onKeyDown={(e) => { if (e.key === 'Enter') aoTelas(limitarTelas(Number(livre), limite)) }} className="mono h-9 w-[72px] rounded-[10px] border-[1.5px] border-bordaForte bg-superficie px-2.5 text-[13px] outline-none focus:border-tinta" />
          </label>
        </div>
      </fieldset>
    </Secao>
  )
}
