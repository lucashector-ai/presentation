'use client'
import { MapaExplorar } from './MapaExplorar'
import { Roteiro } from './Roteiro'
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, PanelLeft, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { mesmoEditorForaDoCanvas, useEditor, type AberturaEditor, type Editor as EditorEstado, type Ferramenta } from '@/lib/editor/useEditor'
import { PASSO_GRANDE, deslocarComGrade } from '@/lib/editor/guias'
import { atalhoFigma, opacidadePorDigito, type MemoriaDigito } from '@/lib/editor/atalhos'
import { envolvente } from '@/lib/scene/transform'
import { mapaDe, paiDe, temAutoLayout } from '@/lib/scene/arvore'
import { moverNoFluxo, passoDaSeta } from '@/lib/editor/autolayout'
import { importarArquivos, importarConteudo, type Avisar } from '@/lib/editor/importar'
import { lerDataTransfer, serializarCamadas } from '@/lib/importar/clipboard'
import { EXTENSOES_ACEITAS } from '@/lib/importar/arquivos'
import { dados, mensagemDeErro, useCarregar, useDados } from '@/lib/dados'
import { useFontesDoDocumento } from '@/components/renderer/fontes'
import { PainelEsquerdo } from './PainelEsquerdo'
import { Canvas } from './Canvas'
import { Inspetor } from './inspetor/Inspetor'
import { MenuContexto } from './MenuContexto'
import { BarraFerramentas } from './BarraFerramentas'
import { Cabecalho, type OpcoesApresentar } from './Cabecalho'
import { Rodape } from './Rodape'
import { definirEscala, lerEscala, zoomMais, zoomMenos } from './escalaCanvas'
import { Gaveta } from './Gaveta'
import { EVENTO_ABRIR, PainelPreencher, preencherSelecao } from './PreencherGrade'
import { atalhoPreencher } from '@/lib/editor/preencher'
import { Viewer } from '@/components/viewer/Viewer'
import { consumirTela, marcarOrigem, pedirTelaCheia, urlApresentar } from '@/components/viewer/retorno'
import { Compartilhar } from '@/components/compartilhar/Compartilhar'
import { PainelEquipe } from '@/components/app/Equipe'
import { EsqueletoEditor } from './EsqueletoEditor'
import { alternarGuias, ehAtalhoGuias } from './guias/estado'
import { Atrasado, Botao, BotaoIcone, Carregando, Modal, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { MAX_HTML_EMBED } from '@/lib/scene/schema'
import { gerarBento } from '@/lib/editor/bento'
import { acimaDe, FEED, gerarFeedInstagram, gerarMockup, MODELOS_MOCKUP, type ImagemMockup } from '@/lib/editor/mockups'
import { novoId } from '@/lib/scene/order'

/**
 * Painéis e botões que recebem o editor inteiro só re-renderizam quando algo além do zoom/pan muda; durante um
 * gesto no canvas (arrastar, redimensionar, girar, editar texto) o inspetor recebe o editor "adiado"
 * (useDeferredValue: acompanha quando sobra tempo entre os quadros) e os demais painéis esperam o fim do gesto.
 */
const comEditor = <P extends { editor: EditorEstado }>(C: (p: P) => React.ReactNode) =>
  memo(C, (a, b) => Object.keys(b).every((k) => (k === 'editor' ? mesmoEditorForaDoCanvas(a.editor, b.editor) : a[k as keyof P] === b[k as keyof P])))
const PainelEsquerdoM = comEditor(PainelEsquerdo)
const InspetorM = comEditor(Inspetor)
const CanvasM = memo(Canvas)

const ATALHOS: [string, string][] = [
  ['V', 'Mover / selecionar'], ['F', 'Frame (arraste para desenhar)'], ['R', 'Retângulo'], ['O', 'Elipse'], ['L', 'Linha'], ['Shift + L', 'Seta'], ['P', 'Caneta (clique = canto, arraste = curva)'], ['T', 'Texto'], ['S', 'Hotspot (área clicável)'], ['H', 'Mão'], ['Espaço + arrastar', 'Mão temporária (pan)'],
  ['Alt + A / D', 'Alinhar à esquerda / direita'], ['Alt + W / S', 'Alinhar ao topo / à base'], ['Alt + H / V', 'Centralizar na horizontal / vertical'], ['Shift + H / V', 'Espelhar na horizontal / vertical'],
  ['1 … 9 / 0', 'Opacidade 10–90% / 100% (dois dígitos: 5 5 = 55%)'], ['Alt + arrastar', 'Duplicar e arrastar a cópia'],
  ['Ctrl/⌘ + roda', 'Zoom no cursor'], ['Shift + 1', 'Ajustar à tela'], ['Shift + 2', 'Zoom na seleção'], ['Ctrl/⌘ + Shift + C', 'Copiar como PNG'], ['Ctrl/⌘ + ] / [', 'Um passo à frente / atrás'], ['Ctrl/⌘ + 0', 'Zoom 100%'], ['+ / −', 'Zoom'],
  ['Ctrl/⌘ + C / X / V', 'Copiar, recortar, colar (também do Figma e Illustrator)'], ['Ctrl/⌘ + D', 'Duplicar'], ['Delete', 'Excluir'],
  ['Ctrl/⌘ + G', 'Agrupar'], ['Ctrl/⌘ + Shift + G', 'Desagrupar / desfazer frame'], ['Ctrl/⌘ + Alt + G', 'Envolver em frame'], ['Shift + A', 'Adicionar auto layout'], ['Shift + Alt + A', 'Remover auto layout'],
  ['Enter / duplo clique', 'Editar texto, editar vetor (forma/SVG) ou selecionar filhos'], ['Editar vetor: V Q P B X E ⇧B', 'Mover, Laço, Caneta, Curvar, Cortar, Apagar, Pintar'], ['Editar vetor: Delete / setas / Esc', 'Apagar nós / mover nós (Shift = 8) / concluir'],
  ['Ctrl + Alt + ← → ↑ ↓', 'Preencher metade esquerda / direita / superior / inferior'], ['Ctrl + Alt + Enter', 'Preencher a tela inteira'], ['Ctrl + Alt + D F G / E T', 'Terços / dois terços'], ['Ctrl + Alt + U I J K', 'Quartos (cantos)'], ['Shift + Enter', 'Selecionar frame pai'], ['Ctrl/⌘ + clique', 'Selecionar camada dentro do frame'], ['Ctrl/⌘ + Alt + C / V', 'Copiar / colar estilo'],
  [']  /  [', 'Trazer para frente / enviar para trás'], ['Setas', 'Mover 1 px (Shift = 8 px)'], ['Ctrl/⌘ + A', 'Selecionar tudo'],
  ['Ctrl/⌘ + Z', 'Desfazer'], ['Ctrl/⌘ + Shift + Z', 'Refazer'], ['Ctrl/⌘ + L', 'Travar / destravar'], ['Ctrl/⌘ + Shift + H', 'Ocultar / mostrar'],
  ['Ctrl/⌘ + arrastar', 'Mover / redimensionar sem encaixe'], ['Alt (segurar)', 'Medir distâncias até a camada sob o cursor'], ['Alt + alça', 'Redimensionar a partir do centro'], ['Shift + arrastar', 'Travar eixo / proporção'],
  ["Shift + '", 'Grade (encaixe na grade)'], ['Ctrl + Shift + 4', 'Mostrar / esconder guias de layout'], ['T + clique', 'Texto com largura automática (arraste = largura fixa)'], ['← →', 'Telas (sem seleção)'], ['Ctrl/⌘ + Enter', 'Pré-visualizar'], ['?', 'Esta lista'],
]

/**
 * Abre o projeto pela camada de dados (no modo real, GET /api/projects/:id com a revisão atual) e só então monta o
 * editor; mídias e conta carregam em paralelo. Estados: abrindo, não encontrado e erro (com tentar de novo).
 */
export function EditorShell({ projetoId }: { projetoId: string }) {
  const [abertura, setAbertura] = useState<{ id: string; estado: 'abrindo' } | { id: string; estado: 'pronto'; inicial: AberturaEditor } | { id: string; estado: 'ausente' } | { id: string; estado: 'erro'; mensagem: string }>({ id: projetoId, estado: 'abrindo' })
  const [tentativa, setTentativa] = useState(0)
  useCarregar(['assets', 'conta'])
  useEffect(() => {
    let vivo = true
    setAbertura({ id: projetoId, estado: 'abrindo' })
    dados.abrirProjeto(projetoId, { forcar: true }).then(
      (p) => { if (vivo) setAbertura(p ? { id: projetoId, estado: 'pronto', inicial: { documento: p.documento, revisao: p.revisaoAtual } } : { id: projetoId, estado: 'ausente' }) },
      (e) => { if (vivo) setAbertura({ id: projetoId, estado: 'erro', mensagem: mensagemDeErro(e, 'Não foi possível abrir o projeto.') }) }
    )
    return () => { vivo = false }
  }, [projetoId, tentativa])

  if (abertura.id !== projetoId || abertura.estado === 'abrindo') return <EsqueletoEditor><Atrasado><Carregando texto="Abrindo o editor…" /></Atrasado></EsqueletoEditor>
  if (abertura.estado === 'ausente') return <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-texto2">Projeto não encontrado. <Link className="ml-1 underline" href="/app">Voltar ao painel</Link></div>
  if (abertura.estado === 'erro') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-fundo p-6 text-center text-sm text-texto2" role="alert">
        <p className="max-w-sm">{abertura.mensagem}</p>
        <div className="flex gap-2"><Botao variante="secundario" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao><Link href="/app" className="inline-flex h-10 items-center rounded-lg px-4 underline">Voltar ao painel</Link></div>
      </div>
    )
  }
  return <Editor key={projetoId} projetoId={projetoId} inicial={abertura.inicial} />
}

function Editor({ projetoId, inicial }: { projetoId: string; inicial: AberturaEditor }) {
  const editor = useEditor(projetoId, inicial)
  const { estado, cena, acoes, validacao, camadasSelecionadas } = editor
  useFontesDoDocumento(estado.documento)
  const projeto = useDados((e) => e.projetos.find((p) => p.id === projetoId))
  const assetsLista = useDados((e) => e.assets)
  const assets = useMemo(() => Object.fromEntries(assetsLista.map((a) => [a.id, a])), [assetsLista])
  // imagens prontas do workspace: preenchem a tela dos mockups e os posts do feed ao inserir o bloco
  const imagensMockup = useMemo<ImagemMockup[]>(() => assetsLista.filter((a) => a.tipo === 'image' && a.status === 'ready').map((a) => ({ id: a.id, width: a.width, height: a.height })), [assetsLista])
  const router = useRouter()
  const { mostrar } = useToast()
  const avisar: Avisar = useCallback((t, tipo) => mostrar(t, tipo ?? 'info'), [mostrar])
  const [preview, setPreview] = useState(false)
  const [compartilhar, setCompartilhar] = useState(false)
  const [convidar, setConvidar] = useState(false)
  const [atalhos, setAtalhos] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [preencher, setPreencher] = useState<{ x: number; y: number } | null>(null)
  const fecharPreencher = useCallback(() => setPreencher(null), [])
  const [gaveta, setGaveta] = useState<'esquerda' | 'direita' | null>(null)
  const [embed, setEmbed] = useState<{ ponto?: { x: number; y: number } } | null>(null)
  const [interagir3d, setInteragir3d] = useState(false)
  const [mapa, setMapa] = useState(false)
  // Explorar: o mapa das telas abre do inspetor da tela ou do painel de telas (evento, para não passar props por tudo)
  useEffect(() => {
    const abrir = () => setMapa(true)
    window.addEventListener('mostra:abrir-mapa', abrir)
    return () => window.removeEventListener('mostra:abrir-mapa', abrir)
  }, [])
  const arquivoRef = useRef<HTMLInputElement>(null)
  const pontoArquivo = useRef<{ x: number; y: number } | undefined>(undefined)
  const sel = estado.selecao
  const digitoAnterior = useRef<MemoriaDigito | null>(null)
  const [gestoCanvas, setGestoCanvas] = useState(false)
  const editorAdiado = useDeferredValue(editor)
  // selecionar ou trocar de tela: o canvas responde no mesmo quadro e os painéis logo em seguida (não há
  // digitação em curso num campo do inspetor quando a seleção muda)
  const mudouSelecao = editorAdiado.estado.selecao !== estado.selecao || editorAdiado.estado.cenaId !== estado.cenaId
  /** O que os painéis mostram: durante um gesto no canvas ou uma troca de seleção, o editor adiado (ver comEditor). */
  const editorPaineis = gestoCanvas || mudouSelecao ? editorAdiado : editor
  // telas, camadas e as barras não precisam acompanhar quadro a quadro: ficam como estavam no começo do gesto e
  // atualizam ao soltar (o inspetor segue o adiado, com posição e tamanho ao vivo quando sobra tempo)
  const editorAntesDoGesto = useRef(editorPaineis)
  if (!gestoCanvas) editorAntesDoGesto.current = editorPaineis
  const editorFixo = gestoCanvas ? editorAntesDoGesto.current : editorPaineis

  // ---------- pré-visualizar / apresentar (ida e volta) ----------
  // A pré-visualização entra no histórico: Esc, X ou o Voltar do navegador fecham e voltam ao editor na tela
  // que estava sendo apresentada; o foco volta para quem abriu.
  const telaPreview = useRef(0)
  const previewNoHistorico = useRef(false)
  const focoAntesPreview = useRef<HTMLElement | null>(null)
  const irParaIndice = useCallback((i: number) => {
    const alvo = editor.estado.documento.scenes[i]
    if (alvo && alvo.id !== editor.cena?.id) acoes.irParaCena(alvo.id)
  }, [editor.estado.documento.scenes, editor.cena?.id, acoes])
  const abrirPreview = useCallback(() => {
    focoAntesPreview.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    telaPreview.current = Math.max(0, editor.indiceCena)
    window.history.pushState({ mostraPreview: true }, '')
    previewNoHistorico.current = true
    setPreview(true)
  }, [editor.indiceCena])
  const fecharPreview = useCallback((indice?: number) => {
    irParaIndice(indice ?? telaPreview.current)
    setPreview(false)
    if (previewNoHistorico.current) { previewNoHistorico.current = false; window.history.back() }
    const foco = focoAntesPreview.current
    window.setTimeout(() => foco?.isConnected && foco.focus({ preventScroll: true }), 0)
  }, [irParaIndice])
  useEffect(() => {
    if (!preview) return
    const voltou = () => { if (previewNoHistorico.current) { previewNoHistorico.current = false; fecharPreview() } }
    window.addEventListener('popstate', voltou)
    return () => window.removeEventListener('popstate', voltou)
  }, [preview, fecharPreview])
  const apresentar = useCallback((opcoes: OpcoesApresentar = {}) => {
    acoes.salvarAgora()
    const voltar = window.location.pathname
    marcarOrigem(voltar)
    if (opcoes.telaCheia) pedirTelaCheia()
    router.push(urlApresentar(projetoId, { voltar, apresentador: opcoes.apresentador, inicio: opcoes.doInicio ? 0 : Math.max(0, editor.indiceCena) }))
  }, [acoes, router, projetoId, editor.indiceCena])
  // ao voltar da apresentação, seleciona a tela que estava sendo apresentada
  const telaConsumida = useRef(false)
  useEffect(() => {
    if (telaConsumida.current || !editor.existe) return
    telaConsumida.current = true
    const id = consumirTela(projetoId)
    if (id && editor.estado.documento.scenes.some((c) => c.id === id)) {
      acoes.irParaCena(id)
      window.setTimeout(() => document.querySelector<HTMLElement>('[data-apresentar]')?.focus({ preventScroll: true }), 0)
    }
  }, [editor.existe, editor.estado.documento.scenes, projetoId, acoes])

  // avisos da sala de colaboração (lote recusado, acesso mudou, sala encerrada)
  useEffect(() => {
    const f = (ev: Event) => { const d = (ev as CustomEvent<{ texto: string; tipo: 'info' | 'erro' }>).detail; mostrar(d.texto, d.tipo) }
    window.addEventListener('mostra:aviso-sala', f)
    return () => window.removeEventListener('mostra:aviso-sala', f)
  }, [mostrar])

  // ---------- blocos ----------
  const inserirBloco = useCallback((id: string, ponto?: { x: number; y: number }) => {
    if (!cena) return
    const W = cena.size.width
    const H = cena.size.height
    const em = (w: number, h: number) => (ponto ? { x: ponto.x - w / 2, y: ponto.y - h / 2, width: w, height: h } : { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h })
    switch (id) {
      case 'texto': return acoes.criarCamada({ type: 'text', text: 'Digite seu texto' }, em(W * 0.35, W * 0.05))
      case 'titulo': return acoes.criarCamada({ type: 'text', text: 'Título', fontSize: Math.round(W / 14), fontWeight: 500, letterSpacing: -Math.round(W / 300), lineHeight: 1 }, em(W * 0.5, W / 12))
      case 'botao': return acoes.criarCamada({ type: 'text', text: 'Ver mais →', fontSize: Math.round(W / 60), fontWeight: 500, color: '#FAFAF9', background: '#171717', radius: 99, align: 'center', valign: 'middle', ariaLabel: 'Botão', interactions: [{ trigger: 'click', do: { action: 'nextScene' }, transition: { type: 'fade' } }] }, em(W * 0.16, W * 0.045))
      case 'forma': return acoes.criarCamada({ type: 'shape' }, em(W * 0.15, W * 0.15))
      case 'seta': return acoes.criarCamada({ type: 'shape', shape: 'arrow', fill: '#171717' }, em(W * 0.15, W * 0.04))
      case 'hotspot': return acoes.criarCamada({ type: 'hotspot' }, em(W * 0.2, W * 0.12))
      case 'etiqueta': return acoes.criarCamada({ type: 'text', text: 'Novo', fontFamily: 'Geist Mono', fontSize: Math.round(W / 90), transform: 'uppercase', letterSpacing: 2, background: '#D7F25C', color: '#171717', radius: 99, align: 'center', valign: 'middle' }, em(W * 0.07, W * 0.022))
      case 'citacao': return acoes.criarCamada({ type: 'text', text: '“Forma que nasce do fogo.”', fontFamily: 'Instrument Serif', fontSize: Math.round(W / 22), italic: true, lineHeight: 1.1 }, em(W * 0.55, W * 0.1))
      case 'galeria': {
        const w = W * 0.22
        const gap = W * 0.02
        const x0 = (ponto?.x ?? W / 2) - (w * 3 + gap * 2) / 2
        const y0 = (ponto?.y ?? H / 2) - (w * 1.25) / 2
        const cores = ['#B4532A', '#A7B29A', '#2B1D16']
        const ids = cores.map((fill, i) => acoes.criarCamada({ type: 'shape', fill, pattern: 'stripes', name: `galeria-${i + 1}` }, { x: x0 + i * (w + gap), y: y0, width: w, height: w * 1.25 })?.id).filter((x): x is string => !!x)
        setTimeout(() => { acoes.agrupar(ids); acoes.selecionar(ids) }, 0)
        avisar('Galeria criada. Arraste imagens da aba Arquivos para substituir os quadros.', 'info')
        return
      }
      case 'embed': return setEmbed({ ponto })
      case 'instagram': {
        // composição de apresentação: post em destaque grande + celular com perfil e grade (imagens do workspace nos posts)
        const alt = H * 0.8
        const larg = Math.round((alt * FEED.w) / FEED.h / 8) * 8
        const camadas = acimaDe(gerarFeedInstagram({ x: (ponto?.x ?? W / 2) - larg / 2, y: (ponto?.y ?? H / 2) - alt / 2, largura: larg }, { imagens: imagensMockup }, novoId('insta', cena.layers)), cena.layers)
        acoes.inserirCamadas(camadas)
        setTimeout(() => acoes.selecionar([camadas[0]!.id]), 0)
        avisar('Feed criado. Troque as fotos (perfil, destaques e posts), o nome e os números à direita, ou solte uma imagem direto num post.', 'info')
        return
      }
      case 'mockup': {
        // celular por padrão; o modelo e a cor mudam na seção Mockup do inspetor
        const larg = Math.round((W * 0.2) / 8) * 8
        const alt = (larg * MODELOS_MOCKUP[0]!.altura) / MODELOS_MOCKUP[0]!.largura
        const camadas = acimaDe(gerarMockup('celular', { x: (ponto?.x ?? W / 2) - larg / 2, y: (ponto?.y ?? H / 2) - alt / 2, largura: larg }, {}, novoId('mockup', cena.layers), imagensMockup), cena.layers)
        acoes.inserirCamadas(camadas)
        setTimeout(() => acoes.selecionar([camadas[0]!.id]), 0)
        avisar('Mockup criado. Solte uma imagem na "Tela" e troque o modelo e a cor na seção Mockup.', 'info')
        return
      }
      case 'bento': {
        // frame externo com auto layout → linhas/colunas → cartões (frames com recorte), tudo na grade de 8
        const larg = Math.round((W * 0.72) / 8) * 8
        const alt = Math.round((H * 0.6) / 8) * 8
        const x0 = Math.round(((ponto?.x ?? W / 2) - larg / 2) / 8) * 8
        const y0 = Math.round(((ponto?.y ?? H / 2) - alt / 2) / 8) * 8
        const camadas = gerarBento({ x: x0, y: y0, width: larg, height: alt }, { preset: 'classico', gap: 24, radius: 24, clip: true }, novoId('bento', cena.layers))
        acoes.inserirCamadas(camadas)
        setTimeout(() => acoes.selecionar([camadas[0]!.id]), 0)
        avisar('Bento grid criado. Arraste imagens ou textos para dentro dos cartões; formato e espaço ficam na seção Bento grid.', 'info')
        return
      }
      case 'imagem': case 'video': case 'modelo3d': case 'lottie': case 'vetor':
        pontoArquivo.current = ponto
        if (arquivoRef.current) {
          arquivoRef.current.accept = { imagem: '.png,.jpg,.jpeg,.webp,.gif,.avif', video: '.mp4,.webm,.mov', modelo3d: '.glb,.gltf', lottie: '.json', vetor: '.svg' }[id]
          arquivoRef.current.click()
        }
        return
    }
  }, [cena, acoes, avisar, imagensMockup])

  const inserirBlocoRef = useRef(inserirBloco)
  inserirBlocoRef.current = inserirBloco
  const aoBloco = useCallback((id: string) => inserirBlocoRef.current(id), [])
  const aoBlocoGaveta = useCallback((id: string) => { inserirBlocoRef.current(id); setGaveta(null) }, [])
  const aoMidia = useCallback(() => arquivoRef.current?.click(), [])
  const abrirAtalhos = useCallback(() => setAtalhos(true), [])
  const abrirConvidar = useCallback(() => setConvidar(true), [])
  const abrirCompartilhar = useCallback(() => setCompartilhar(true), [])

  useEffect(() => {
    const f = (e: Event) => { const d = (e as CustomEvent<{ bloco: string; ponto: { x: number; y: number } }>).detail; inserirBloco(d.bloco, d.ponto) }
    const m = (e: Event) => setMenu((e as CustomEvent<{ x: number; y: number }>).detail)
    const p = (e: Event) => setPreencher((e as CustomEvent<{ x: number; y: number }>).detail)
    window.addEventListener('mostra:bloco', f)
    window.addEventListener('mostra:menu', m)
    window.addEventListener(EVENTO_ABRIR, p)
    return () => { window.removeEventListener('mostra:bloco', f); window.removeEventListener('mostra:menu', m); window.removeEventListener(EVENTO_ABRIR, p) }
  }, [inserirBloco])

  // ---------- colar (Figma, Illustrator, imagens, texto, camadas) ----------
  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)) return
      if (!e.clipboardData || preview) return
      e.preventDefault()
      void importarConteudo(editor, lerDataTransfer(e.clipboardData), { avisar })
    }
    const copiar = (e: ClipboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA'].includes(alvo.tagName)) return
      if (!estado.selecao.length || !e.clipboardData) return
      const camadas = acoes.copiar(estado.selecao)
      e.clipboardData.setData('text/plain', serializarCamadas(camadas))
      const svg = camadas.length === 1 && camadas[0]!.type === 'svg' ? camadas[0]!.markup : undefined
      if (svg) e.clipboardData.setData('text/html', svg)
      e.preventDefault()
      if (e.type === 'cut') acoes.removerCamadas(estado.selecao)
    }
    window.addEventListener('paste', colar)
    window.addEventListener('copy', copiar)
    window.addEventListener('cut', copiar)
    return () => { window.removeEventListener('paste', colar); window.removeEventListener('copy', copiar); window.removeEventListener('cut', copiar) }
  }, [editor, avisar, acoes, estado.selecao, preview])

  // ---------- atalhos ----------
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      const digitando = alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && (k === 'z' || k === 'y') && preview) return // na pré-visualização não mexe no documento
      if (mod && k === 'z') { if (digitando) return; e.preventDefault(); if (e.shiftKey) acoes.refazer(); else acoes.desfazer(); return }
      if (mod && k === 'y') { if (digitando) return; e.preventDefault(); acoes.refazer(); return }
      if (mod && k === 's') {
        e.preventDefault()
        void acoes.salvarAgora().then((ok) => mostrar(ok ? 'Todas as alterações foram salvas.' : typeof navigator !== 'undefined' && !navigator.onLine ? 'Sem conexão: salvaremos assim que voltar.' : 'Não foi possível salvar agora. Veja o aviso no topo.', ok ? 'sucesso' : 'erro'))
        return
      }
      if (digitando || preview) return
      // ⌃⌥ + tecla: preencher metade/terço/quarto (como o Rectangle no macOS)
      const pre = sel.length ? atalhoPreencher(e) : null
      if (pre && !(e.code === 'KeyG' && !/Mac/i.test(navigator.platform))) { e.preventDefault(); if (!preencherSelecao(editor, pre.celulas)) mostrar('Selecione uma camada fora do auto layout.'); return }
      if (mod && e.key === 'Enter') { e.preventDefault(); abrirPreview(); return }
      if (mod && e.altKey && k === 'c' && camadasSelecionadas[0]) { e.preventDefault(); acoes.copiarEstilo(camadasSelecionadas[0]); mostrar('Estilo copiado.'); return }
      if (mod && e.altKey && k === 'v') { e.preventDefault(); acoes.colarEstilo(sel); return }
      // ⌃⇧4: mostrar/esconder todas as guias de layout (como no Figma), com aviso no rodapé
      if (ehAtalhoGuias(e)) { e.preventDefault(); alternarGuias(acoes, estado.guiasLayout, mostrar); return }
      if (mod && k === 'd' && sel.length) { e.preventDefault(); acoes.duplicarCamadas(sel); return }
      if (mod && e.altKey && e.code === 'KeyG' && sel.length) { e.preventDefault(); acoes.emoldurar(sel); return }
      if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) acoes.desagrupar(sel); else acoes.agrupar(sel); return }
      if (mod && k === 'a' && cena) { e.preventDefault(); acoes.selecionarExato(cena.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id)); return }
      if (mod && k === 'l' && sel.length) { e.preventDefault(); acoes.atualizarCamadas(sel, (l) => ({ ...l, locked: !l.locked })); return }
      if (mod && e.shiftKey && k === 'h' && sel.length) { e.preventDefault(); acoes.atualizarCamadas(sel, (l) => ({ ...l, hidden: !l.hidden })); return }
      // ⌘] / ⌘[ um passo; ⌥⌘] / ⌥⌘[ para frente / para trás (como no Figma)
      if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft') && sel[0]) { e.preventDefault(); const f = e.code === 'BracketRight'; acoes.ordem(sel[0], e.altKey ? (f ? 'frente' : 'tras') : f ? 'avancar' : 'recuar'); return }
      if (mod && e.shiftKey && k === 'c') { e.preventDefault(); window.dispatchEvent(new Event('mostra:copiar-png')); return }
      if (mod && k === '0') { e.preventDefault(); acoes.setZoom(1); return }
      // ⌘+ / ⌘− (e ⌘=): zoom pelos atalhos do sistema, sem o zoom do navegador
      if (mod && (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd')) { e.preventDefault(); acoes.setZoom(zoomMais(lerEscala())); return }
      if (mod && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) { e.preventDefault(); acoes.setZoom(zoomMenos(lerEscala())); return }
      // ⌃⌘M (Mac) / Ctrl+Alt+M: usar como máscara / remover máscara (como no Figma)
      if (e.code === 'KeyM' && e.ctrlKey && (e.metaKey || e.altKey) && sel.length) {
        e.preventDefault()
        const r = acoes.alternarMascara(sel)
        mostrar(r === 'criada' ? 'Máscara criada: a camada de baixo recorta as outras.' : r === 'removida' ? 'Máscara removida.' : 'Selecione a máscara (forma, texto, imagem ou SVG) embaixo e as camadas a recortar.')
        return
      }
      if (mod) return
      // auto layout e grade (atalhos do Figma)
      if (e.shiftKey && e.altKey && e.code === 'KeyA') { e.preventDefault(); camadasSelecionadas.filter((l) => l.type === 'frame').forEach((l) => acoes.removerAutoLayout(l.id)); return }
      if (e.shiftKey && !e.altKey && e.code === 'KeyA' && sel.length) { e.preventDefault(); acoes.adicionarAutoLayout(sel); return }
      if (e.shiftKey && e.code === 'Quote') { e.preventDefault(); acoes.ui({ grade: !estado.grade }); return }
      if (e.key === 'Enter' && camadasSelecionadas.length === 1) {
        const l = camadasSelecionadas[0]!
        e.preventDefault()
        if (e.shiftKey) acoes.selecionarPai(l.id)
        else if (l.type === 'text' && !l.locked) window.dispatchEvent(new CustomEvent('mostra:editar-texto', { detail: { id: l.id } }))
        else if (l.type === 'frame') acoes.selecionarFilhos(l.id)
        else if ((l.type === 'shape' || l.type === 'svg') && !l.locked) window.dispatchEvent(new CustomEvent('mostra:editar-vetor', { detail: { id: l.id } }))
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); acoes.removerCamadas(sel); return }
      if (e.key === 'Escape') { acoes.selecionarExato([]); acoes.setFerramenta('mover'); setMenu(null); return }
      if (e.key === '?' ) { setAtalhos(true); return }
      if (e.shiftKey && e.key === '!') { acoes.ajustar(); return }
      if (e.shiftKey && e.code === 'Digit2' && sel.length) { window.dispatchEvent(new Event('mostra:zoom-selecao')); return }
      if (e.shiftKey && e.code === 'Digit0') { e.preventDefault(); acoes.setZoom(1); return }
      if (e.key === '+' || e.key === '=') { acoes.setZoom(zoomMais(lerEscala())); return }
      if (e.key === '-') { acoes.setZoom(zoomMenos(lerEscala())); return }
      if (e.key === ']' && sel[0]) { acoes.ordem(sel[0], e.shiftKey ? 'avancar' : 'frente'); return }
      if (e.key === '[' && sel[0]) { acoes.ordem(sel[0], e.shiftKey ? 'recuar' : 'tras'); return }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        if (!sel.length) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { const prox = estado.documento.scenes[editor.indiceCena + 1]; if (prox) acoes.irParaCena(prox.id) }
          else { const ant = estado.documento.scenes[editor.indiceCena - 1]; if (ant) acoes.irParaCena(ant.id) }
          return
        }
        // filho de auto layout: a seta na direção do fluxo troca a ordem entre os irmãos (como no Figma)
        if (cena && camadasSelecionadas.length) {
          const pai = paiDe(camadasSelecionadas[0]!, mapaDe(cena.layers))
          if (pai?.type === 'frame' && temAutoLayout(pai) && camadasSelecionadas.every((l) => l.parentId === pai.id && !l.absolute)) {
            const passo = passoDaSeta(pai.layout!.direction, e.key)
            if (passo) acoes.transformarCena((c) => { const r = moverNoFluxo(c.layers, sel, passo); return r === c.layers ? c : { ...c, layers: r } })
            return
          }
        }
        // 1 px (Shift = 8 px, a regra do 8) em pixels inteiros; com a grade ligada, vai para a próxima linha da grade
        const p = e.shiftKey ? PASSO_GRANDE : 1
        const g = estado.grade ? estado.gradePasso : 0
        const caixa = camadasSelecionadas.length ? envolvente(camadasSelecionadas) : { x: 0, y: 0, width: 0, height: 0 }
        const sx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        const sy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
        const dx = sx ? deslocarComGrade(caixa.x, sx, p, g) - caixa.x : 0
        const dy = sy ? deslocarComGrade(caixa.y, sy, p, g) - caixa.y : 0
        acoes.deslocar(sel, dx, dy)
        window.dispatchEvent(new Event('mostra:empurrou'))
        return
      }
      // atalhos do Figma: ⌥A/D/W/S/H/V alinham, ⇧H/⇧V espelham, 0–9 opacidade, V F R O L ⇧L T S H ferramentas
      const at = atalhoFigma(e)
      if (!at) return
      if (at.tipo === 'ferramenta') { acoes.setFerramenta(at.ferramenta); return }
      if (!sel.length) return
      e.preventDefault()
      if (at.tipo === 'alinhar') acoes.alinhar(sel, at.modo)
      else if (at.tipo === 'espelhar') acoes.inverter(sel, at.eixo)
      else {
        const r = opacidadePorDigito(at.digito, Date.now(), digitoAnterior.current)
        digitoAnterior.current = r.memoria
        acoes.atualizarCamadas(sel, { opacity: r.opacidade }, !!r.memoria)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [acoes, sel, cena, preview, estado.documento.scenes, estado.grade, estado.gradePasso, estado.guiasLayout, editor, editor.indiceCena, camadasSelecionadas, mostrar, abrirPreview])

  if (!editor.existe || !projeto) {
    return <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-texto2">Projeto não encontrado. <Link className="ml-1 underline" href="/app">Voltar ao painel</Link></div>
  }

  const publicarAgora = async () => {
    const validacao = editor.validarAgora()
    if (!validacao.ok) { mostrar(`Corrija ${validacao.erros.length} erro(s) antes de publicar. Veja “Verificação” no painel da tela.`, 'erro'); acoes.selecionarExato([]); acoes.ui({ abaDireita: 'design' }); return }
    if (estado.salvamento === 'conflito') { mostrar('Há uma versão mais recente deste projeto. Recarregue ou mantenha a sua antes de publicar.', 'erro'); return }
    setPublicando(true)
    try {
      // publica exatamente o que está na tela: grava antes (fila do autosave) e usa a revisão devolvida
      if (!(await acoes.salvarAgora())) { mostrar('Não foi possível salvar as últimas mudanças, então nada foi publicado. Veja o aviso no topo.', 'erro'); return }
      const r = await dados.publicar(projetoId, acoes.revisaoAtual())
      mostrar(`Revisão ${r.publishedRevision} publicada. Quem tem o link já vê a versão nova.`, 'sucesso')
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível publicar.'), 'erro')
    } finally {
      setPublicando(false)
    }
  }
  const naoPublicado = projeto.revisaoPublicada == null || projeto.revisaoPublicada < estado.revisao || estado.salvamento !== 'salvo'

  return (
    <div className="flex h-dvh flex-col bg-fundo">
      <input ref={arquivoRef} type="file" multiple accept={EXTENSOES_ACEITAS} className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (arquivoRef.current) arquivoRef.current.accept = EXTENSOES_ACEITAS; void importarArquivos(editor, fs, { avisar, ponto: pontoArquivo.current }); pontoArquivo.current = undefined }} />

      <Cabecalho editor={editorFixo} ferramenta={estado.ferramenta} aba={estado.abaDireita} projetoId={projetoId} nomeProjeto={projeto.nome} aoMidia={aoMidia} aoPreview={abrirPreview} aoApresentar={apresentar} aoAtalhos={abrirAtalhos} aoConvidar={abrirConvidar} aoCompartilhar={abrirCompartilhar} />
      {estado.salvamento === 'conflito' && <AvisoConflito editor={editor} />}
      {estado.somenteLeitura && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-borda bg-superficie2 px-4 py-1.5 text-[12px] text-texto2">
          <Eye className="h-4 w-4 shrink-0" /> Você pode ver este projeto e acompanhar quem está editando, mas não pode alterá-lo.
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* painel esquerdo como cartão flutuante, igual ao de propriedades */}
        <div className="hidden w-[224px] shrink-0 bg-canvas p-2 pr-0 md:block">
          <div className="h-full overflow-hidden rounded-xl border border-borda shadow-[0_8px_24px_-14px_rgba(0,0,0,.22)]"><PainelEsquerdoM editor={editorFixo} assets={assetsLista} avisar={avisar} aoBloco={aoBloco} /></div>
        </div>
        <main className="relative min-w-0 flex-1">
          <CanvasM editor={editor} assets={assets} avisar={avisar} interagir3d={interagir3d} aoEscala={definirEscala} aoGesto={setGestoCanvas} />
          {/* ferramentas num trilho flutuante na lateral do canvas (o topo fica com os modos) */}
          <div className="absolute left-2 top-2 z-[45] hidden rounded-xl border border-borda bg-superficie p-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,.25)] lg:block">
            <BarraFerramentas vertical className="flex" ferramenta={estado.ferramenta} aoFerramenta={acoes.setFerramenta} aoMidia={aoMidia} />
          </div>
          <BarraMovel ferramenta={estado.ferramenta} aoFerramenta={acoes.setFerramenta} aoMidia={aoMidia} gaveta={gaveta} aoGaveta={setGaveta} />
        </main>
        {/* painel de propriedades como um cartão flutuante sobre o fundo do canvas */}
        <div className="hidden w-[244px] shrink-0 bg-canvas p-2 pl-0 lg:block">
          <div className="h-full overflow-hidden rounded-xl border border-borda shadow-[0_8px_24px_-14px_rgba(0,0,0,.22)]"><InspetorM editor={editorPaineis} assets={assetsLista} /></div>
        </div>
      </div>
      <Roteiro editor={editorFixo} assets={assetsLista} />
      <Gaveta lado="esquerda" aberta={gaveta === 'esquerda'} aoFechar={() => setGaveta(null)} rotulo="Adicionar e camadas">
        <PainelEsquerdoM editor={editorFixo} assets={assetsLista} avisar={avisar} aoBloco={aoBlocoGaveta} />
      </Gaveta>
      <Gaveta lado="direita" aberta={gaveta === 'direita'} aoFechar={() => setGaveta(null)} rotulo="Propriedades">
        <InspetorM editor={editorPaineis} assets={assetsLista} />
      </Gaveta>

      <Rodape editor={editorFixo} interagir3d={interagir3d} aoInteragir3d={setInteragir3d} aoAtalhos={abrirAtalhos} />

      {menu && <MenuContexto editor={editor} x={menu.x} y={menu.y} aoFechar={() => setMenu(null)} avisar={avisar} />}
      {preencher && <PainelPreencher editor={editor} x={preencher.x} y={preencher.y} aoFechar={fecharPreencher} />}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black">
          <Viewer documento={estado.documento} assets={assets} nome={projeto.nome} indiceInicial={telaPreview.current} aoMudarTela={(i) => { telaPreview.current = i }} aoSair={fecharPreview} />
        </div>
      )}

      <Modal aberto={compartilhar} aoFechar={() => setCompartilhar(false)} titulo="Compartilhar" descricao="Links privados, não listados. Atualize o projeto e o cliente vê a nova versão — sem reenviar nada." largura="lg">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-borda bg-superficie2 p-4">
          <div className="text-[12px]">
            <div className="font-medium">{naoPublicado ? 'Há mudanças não publicadas' : 'Publicado e atualizado'}</div>
            <div className="text-texto2">Rascunho na revisão {estado.revisao} · {projeto.revisaoPublicada ? `convidados veem a revisão ${projeto.revisaoPublicada}` : 'ainda não publicado'}</div>
          </div>
          <Botao variante={naoPublicado ? 'primario' : 'secundario'} carregando={publicando} onClick={publicarAgora}>Publicar</Botao>
        </div>
        <Compartilhar projetoId={projetoId} publicarFora />
      </Modal>

      <Modal aberto={convidar} aoFechar={() => setConvidar(false)} titulo="Convidar para editar" descricao="Quem entra no espaço edita este projeto com você em tempo real (e os outros projetos do espaço)." largura="lg">
        {convidar && <PainelEquipe projetoId={projetoId} aoSair={() => setConvidar(false)} />}
      </Modal>

      <Modal aberto={atalhos} aoFechar={() => setAtalhos(false)} titulo="Atalhos de teclado" largura="lg">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[12px] sm:grid-cols-2">
          {ATALHOS.map(([k, d]) => <div key={k} className="flex justify-between gap-4 border-b border-borda py-1.5"><dt className="text-texto2">{d}</dt><dd className="mono whitespace-nowrap text-[11px]">{k}</dd></div>)}
        </dl>
      </Modal>

      {mapa && <MapaExplorar editor={editor} assets={assets} aoFechar={() => setMapa(false)} />}
      <ModalEmbed aberto={!!embed} aoFechar={() => setEmbed(null)} aoConfirmar={(v) => {
        const p = embed?.ponto
        setEmbed(null)
        if (v.html && cena) {
          const w = Math.round(cena.size.width * 0.6)
          const h = Math.round((w * 9) / 16)
          acoes.criarCamada({ type: 'embed', html: v.html, ariaLabel: 'HTML incorporado' }, p ? { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h } : { x: (cena.size.width - w) / 2, y: (cena.size.height - h) / 2, width: w, height: h })
          return
        }
        void importarConteudo(editor, { arquivos: [], html: '', texto: v.url ?? '' }, { avisar, ponto: p })
      }} />
    </div>
  )
}

/** Celular/tablet: ferramentas e painéis em gavetas. */
const BarraMovel = memo(function BarraMovel({ ferramenta, aoFerramenta, aoMidia, gaveta, aoGaveta }: { ferramenta: Ferramenta; aoFerramenta: (f: Ferramenta) => void; aoMidia: () => void; gaveta: 'esquerda' | 'direita' | null; aoGaveta: (g: 'esquerda' | 'direita') => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 lg:hidden">
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-xl border border-borda bg-superficie p-1 shadow-painel">
        <BotaoIcone rotulo="Adicionar e camadas" className="md:hidden" onClick={() => aoGaveta('esquerda')}><PanelLeft className="h-4 w-4" /></BotaoIcone>
        <span className="mx-0.5 h-5 w-px bg-borda md:hidden" />
        <BarraFerramentas className="flex lg:hidden" menuAcima ferramenta={ferramenta} aoFerramenta={aoFerramenta} aoMidia={aoMidia} />
        <span className="mx-0.5 h-5 w-px bg-borda" />
        <BotaoIcone rotulo="Propriedades" ativo={gaveta === 'direita'} onClick={() => aoGaveta('direita')}><SlidersHorizontal className="h-4 w-4" /></BotaoIcone>
      </div>
    </div>
  )
})

/** Blocos → Embed: um link de serviço conhecido ou HTML próprio (iframe isolado, sem origem nem cookies). */
function ModalEmbed({ aberto, aoFechar, aoConfirmar }: { aberto: boolean; aoFechar: () => void; aoConfirmar: (v: { url?: string; html?: string }) => void }) {
  const [aba, setAba] = useState<'link' | 'html'>('link')
  const [url, setUrl] = useState('')
  const [html, setHtml] = useState('')
  const pronto = aba === 'link' ? /^https:\/\//.test(url) : html.trim().length > 0 && html.length <= MAX_HTML_EMBED
  const confirmar = () => { aoConfirmar(aba === 'link' ? { url } : { html }); setUrl(''); setHtml('') }
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Incorporar conteúdo" descricao={aba === 'link' ? 'Cole um link do YouTube, Vimeo, Figma, Loom, Spline, Sketchfab ou Spotify.' : 'Cole HTML, CSS e JavaScript. Roda isolado: sem acesso à sua conta, aos cookies nem ao resto da página.'} largura={aba === 'html' ? 'lg' : 'md'} rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao onClick={confirmar} disabled={!pronto}>Incorporar</Botao></>}>
      <div role="tablist" aria-label="Tipo de incorporação" className="mb-3 inline-flex h-9 items-center gap-1 rounded-lg bg-hover p-1 text-[12px]">
        {(['link', 'html'] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={aba === t} onClick={() => setAba(t)} className={cx('h-7 rounded-md px-3', aba === t ? 'bg-superficie shadow-sm' : 'text-texto2')}>{t === 'link' ? 'Link' : 'HTML'}</button>)}
      </div>
      {aba === 'link' ? (
        <input aria-label="Link para incorporar" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="h-11 w-full rounded-lg border border-bordaForte bg-superficie px-3.5 text-sm text-texto outline-none focus:border-acento" />
      ) : (
        <>
          <textarea aria-label="HTML para incorporar" autoFocus value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} placeholder={'<style>body{margin:0;font-family:sans-serif}</style>\n<div>Olá</div>\n<script>/* seu código */</script>'} className="mono min-h-[320px] w-full resize-y rounded-lg border border-bordaForte bg-superficie px-3.5 py-3 text-[12px] leading-5 text-texto outline-none focus:border-acento" />
          <div className="mt-2 flex justify-between text-[11px] text-texto3"><span>Imagens e fontes externas precisam de https.</span><span className="mono">{html.length.toLocaleString('pt-BR')} / {MAX_HTML_EMBED.toLocaleString('pt-BR')}</span></div>
        </>
      )}
    </Modal>
  )
}

/** 409: alguém salvou este projeto em outra aba/dispositivo. Nada se perde até a pessoa escolher. */
function AvisoConflito({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const { estado, acoes } = editor
  const { mostrar } = useToast()
  const [recarregando, setRecarregando] = useState(false)
  const recarregar = async () => {
    setRecarregando(true)
    try {
      if (await acoes.recarregarDoServidor()) mostrar('Versão mais recente aberta.', 'sucesso')
      else mostrar('Este projeto não existe mais (pode ter ido para a lixeira).', 'erro')
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível recarregar agora. Tente de novo.'), 'erro')
    } finally {
      setRecarregando(false)
    }
  }
  return (
    <div role="alert" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-aviso/40 bg-aviso/15 px-4 py-2 text-[12px] text-texto">
      <TriangleAlert className="h-4 w-4 shrink-0 text-avisoTexto" />
      <span className="min-w-0 flex-1">
        <strong className="font-medium">Este projeto mudou em outra aba ou dispositivo.</strong>{' '}
        <span className="text-texto2">Suas mudanças desta sessão não foram salvas, mas continuam aqui{estado.conflito ? ` (o servidor está na revisão ${estado.conflito.currentRevision})` : ''}. Recarregue para ver a versão mais recente ou mantenha a sua por cima dela.</span>
      </span>
      <span className="flex shrink-0 gap-2">
        <Botao tamanho="sm" carregando={recarregando} onClick={() => void recarregar()}>Recarregar</Botao>
        <Botao tamanho="sm" variante="secundario" onClick={acoes.manterMinhaVersao}>Manter a minha</Botao>
      </span>
    </div>
  )
}

/** "Maria Duarte" → "MD" (avatar do editor). */
export function iniciaisDe(nome: string): string {
  return nome.trim().split(/\s+/).filter(Boolean).map((p) => p[0]!).slice(0, 2).join('').toUpperCase() || '?'
}
