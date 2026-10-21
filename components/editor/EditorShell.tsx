'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, ChevronRight, CloudOff, Crosshair, Eye, Hand, Image as ImageIcon, Keyboard, Loader2, MonitorPlay, MousePointer2, Play, Redo2, Square, Type, Undo2, TriangleAlert, Grid3X3, Magnet, Box } from 'lucide-react'
import { useEditor, type Ferramenta } from '@/lib/editor/useEditor'
import { importarArquivos, importarConteudo, type Avisar } from '@/lib/editor/importar'
import { lerDataTransfer, serializarCamadas } from '@/lib/importar/clipboard'
import { EXTENSOES_ACEITAS } from '@/lib/importar/arquivos'
import { atualizarProjeto, ErroDemo, publicar } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { useFontesDoDocumento } from '@/components/renderer/fontes'
import { PainelEsquerdo } from './PainelEsquerdo'
import { Canvas } from './Canvas'
import { Inspetor } from './inspetor/Inspetor'
import { MenuContexto } from './MenuContexto'
import { Viewer } from '@/components/viewer/Viewer'
import { Compartilhar } from '@/components/compartilhar/Compartilhar'
import { Botao, BotaoIcone, Modal, Simbolo, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

const ATALHOS: [string, string][] = [
  ['V', 'Mover / selecionar'], ['T', 'Texto'], ['R', 'Forma'], ['H', 'Hotspot'], ['Espaço + arrastar', 'Mão (pan)'],
  ['Ctrl/⌘ + roda', 'Zoom no cursor'], ['Shift + 1', 'Ajustar à tela'], ['Ctrl/⌘ + 0', 'Zoom 100%'], ['+ / −', 'Zoom'],
  ['Ctrl/⌘ + C / X / V', 'Copiar, recortar, colar (também do Figma e Illustrator)'], ['Ctrl/⌘ + D', 'Duplicar'], ['Delete', 'Excluir'],
  ['Ctrl/⌘ + G', 'Agrupar'], ['Ctrl/⌘ + Shift + G', 'Desagrupar'], ['Ctrl/⌘ + Alt + C / V', 'Copiar / colar estilo'],
  [']  /  [', 'Trazer para frente / enviar para trás'], ['Setas', 'Mover 1 px (Shift = 10 px)'], ['Ctrl/⌘ + A', 'Selecionar tudo'],
  ['Ctrl/⌘ + Z', 'Desfazer'], ['Ctrl/⌘ + Shift + Z', 'Refazer'], ['Ctrl/⌘ + L', 'Travar / destravar'], ['Ctrl/⌘ + Shift + H', 'Ocultar / mostrar'],
  ['Alt + arrastar', 'Mover sem guias'], ['Shift + arrastar', 'Travar eixo / proporção'], ['← →', 'Telas (sem seleção)'], ['P', 'Pré-visualizar'], ['?', 'Esta lista'],
]

export function EditorShell({ projetoId }: { projetoId: string }) {
  const editor = useEditor(projetoId)
  const { estado, cena, acoes, validacao, camadasSelecionadas } = editor
  useFontesDoDocumento(estado.documento)
  const projeto = useDemo((e) => e.projetos.find((p) => p.id === projetoId))
  const assetsLista = useDemo((e) => e.assets)
  const assets = useMemo(() => Object.fromEntries(assetsLista.map((a) => [a.id, a])), [assetsLista])
  const router = useRouter()
  const { mostrar } = useToast()
  const avisar: Avisar = useCallback((t, tipo) => mostrar(t, tipo ?? 'info'), [mostrar])
  const [preview, setPreview] = useState(false)
  const [compartilhar, setCompartilhar] = useState(false)
  const [atalhos, setAtalhos] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [menuApresentar, setMenuApresentar] = useState(false)
  const [embed, setEmbed] = useState<{ ponto?: { x: number; y: number } } | null>(null)
  const [interagir3d, setInteragir3d] = useState(false)
  const [escala, setEscala] = useState(1)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const pontoArquivo = useRef<{ x: number; y: number } | undefined>(undefined)
  const sel = estado.selecao

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
      case 'imagem': case 'video': case 'modelo3d': case 'lottie': case 'vetor':
        pontoArquivo.current = ponto
        if (arquivoRef.current) {
          arquivoRef.current.accept = { imagem: '.png,.jpg,.jpeg,.webp,.gif,.avif', video: '.mp4,.webm,.mov', modelo3d: '.glb,.gltf', lottie: '.json', vetor: '.svg' }[id]
          arquivoRef.current.click()
        }
        return
    }
  }, [cena, acoes, avisar])

  useEffect(() => {
    const f = (e: Event) => { const d = (e as CustomEvent<{ bloco: string; ponto: { x: number; y: number } }>).detail; inserirBloco(d.bloco, d.ponto) }
    const m = (e: Event) => setMenu((e as CustomEvent<{ x: number; y: number }>).detail)
    window.addEventListener('mostra:bloco', f)
    window.addEventListener('mostra:menu', m)
    return () => { window.removeEventListener('mostra:bloco', f); window.removeEventListener('mostra:menu', m) }
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
      if (mod && k === 'z') { if (digitando) return; e.preventDefault(); if (e.shiftKey) acoes.refazer(); else acoes.desfazer(); return }
      if (mod && k === 'y') { e.preventDefault(); acoes.refazer(); return }
      if (mod && k === 's') { e.preventDefault(); acoes.salvarAgora(); mostrar('Todas as alterações foram salvas.', 'sucesso'); return }
      if (digitando || preview) return
      if (mod && e.altKey && k === 'c' && camadasSelecionadas[0]) { e.preventDefault(); acoes.copiarEstilo(camadasSelecionadas[0]); mostrar('Estilo copiado.'); return }
      if (mod && e.altKey && k === 'v') { e.preventDefault(); acoes.colarEstilo(sel); return }
      if (mod && k === 'd' && sel.length) { e.preventDefault(); acoes.duplicarCamadas(sel); return }
      if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) acoes.desagrupar(sel); else acoes.agrupar(sel); return }
      if (mod && k === 'a' && cena) { e.preventDefault(); acoes.selecionarExato(cena.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id)); return }
      if (mod && k === 'l' && sel.length) { e.preventDefault(); acoes.atualizarCamadas(sel, (l) => ({ ...l, locked: !l.locked })); return }
      if (mod && e.shiftKey && k === 'h' && sel.length) { e.preventDefault(); acoes.atualizarCamadas(sel, (l) => ({ ...l, hidden: !l.hidden })); return }
      if (mod && k === '0') { e.preventDefault(); acoes.setZoom(1); return }
      if (mod) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); acoes.removerCamadas(sel); return }
      if (e.key === 'Escape') { acoes.selecionarExato([]); acoes.setFerramenta('mover'); setMenu(null); return }
      if (e.key === '?' ) { setAtalhos(true); return }
      if (e.shiftKey && e.key === '!') { acoes.ajustar(); return }
      if (e.key === '+' || e.key === '=') { acoes.setZoom(Math.min(8, escala * 1.2)); return }
      if (e.key === '-') { acoes.setZoom(Math.max(0.05, escala / 1.2)); return }
      if (e.key === ']' && sel[0]) { acoes.ordem(sel[0], e.shiftKey ? 'avancar' : 'frente'); return }
      if (e.key === '[' && sel[0]) { acoes.ordem(sel[0], e.shiftKey ? 'recuar' : 'tras'); return }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        if (!sel.length) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { const prox = estado.documento.scenes[editor.indiceCena + 1]; if (prox) acoes.irParaCena(prox.id) }
          else { const ant = estado.documento.scenes[editor.indiceCena - 1]; if (ant) acoes.irParaCena(ant.id) }
          return
        }
        const p = e.shiftKey ? 10 : 1
        acoes.deslocar(sel, e.key === 'ArrowLeft' ? -p : e.key === 'ArrowRight' ? p : 0, e.key === 'ArrowUp' ? -p : e.key === 'ArrowDown' ? p : 0)
        return
      }
      const ferr: Record<string, Ferramenta> = { v: 'mover', t: 'texto', r: 'forma', h: 'hotspot' }
      if (ferr[k]) { acoes.setFerramenta(ferr[k]!); return }
      if (k === 'p') setPreview(true)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [acoes, sel, cena, preview, escala, estado.documento.scenes, editor.indiceCena, camadasSelecionadas, mostrar])

  if (!editor.existe || !projeto) {
    return <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-texto2">Projeto não encontrado. <Link className="ml-1 underline" href="/app">Voltar ao painel</Link></div>
  }

  const publicarAgora = async () => {
    acoes.salvarAgora()
    if (!validacao.ok) { mostrar(`Corrija ${validacao.erros.length} erro(s) antes de publicar. Veja “Verificação” no painel da tela.`, 'erro'); acoes.selecionarExato([]); acoes.ui({ abaDireita: 'design' }); return }
    setPublicando(true)
    try {
      await new Promise((r) => setTimeout(r, 250))
      const r = publicar(projetoId, editor.estado.revisao)
      mostrar(`Revisão ${r.publishedRevision} publicada. Quem tem o link já vê a versão nova.`, 'sucesso')
    } catch (e) {
      mostrar(e instanceof ErroDemo ? e.message : 'Não foi possível publicar.', 'erro')
    } finally {
      setPublicando(false)
    }
  }
  const total = estado.documento.scenes.length
  const naoPublicado = projeto.revisaoPublicada == null || projeto.revisaoPublicada < estado.revisao || estado.salvamento !== 'salvo'
  const ferramentas: { id: Ferramenta | 'imagem'; rotulo: string; icone: JSX.Element }[] = [
    { id: 'mover', rotulo: 'Mover (V)', icone: <MousePointer2 className="h-4 w-4" /> },
    { id: 'texto', rotulo: 'Texto (T)', icone: <Type className="h-4 w-4" /> },
    { id: 'forma', rotulo: 'Forma (R)', icone: <Square className="h-4 w-4" /> },
    { id: 'imagem', rotulo: 'Imagem, vídeo, SVG ou 3D', icone: <ImageIcon className="h-4 w-4" /> },
    { id: 'hotspot', rotulo: 'Hotspot (H)', icone: <Crosshair className="h-4 w-4" /> },
    { id: 'mao', rotulo: 'Mão (Espaço)', icone: <Hand className="h-4 w-4" /> },
  ]

  return (
    <div className="flex h-dvh flex-col bg-fundo">
      <input ref={arquivoRef} type="file" multiple accept={EXTENSOES_ACEITAS} className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (arquivoRef.current) arquivoRef.current.accept = EXTENSOES_ACEITAS; void importarArquivos(editor, fs, { avisar, ponto: pontoArquivo.current }); pontoArquivo.current = undefined }} />

      {/* barra superior */}
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-borda bg-superficie px-3">
        <Link href={`/app/projects/${projetoId}`} onClick={() => acoes.salvarAgora()} aria-label="Voltar ao projeto"><Simbolo tamanho={26} /></Link>
        <span className="text-[#D4D4D4]">/</span>
        <input aria-label="Nome do projeto" defaultValue={projeto.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== projeto.nome && atualizarProjeto(projetoId, { nome: e.target.value.trim() })} className="h-8 w-44 truncate rounded-md bg-transparent px-1.5 text-[14px] font-medium outline-none hover:bg-hover focus:bg-hover lg:w-64" />
        <EstadoSalvo editor={editor} />
        <span className="flex-1" />
        <BotaoIcone rotulo="Desfazer (Ctrl+Z)" disabled={!estado.passado.length} onClick={acoes.desfazer}><Undo2 className="h-4 w-4" /></BotaoIcone>
        <BotaoIcone rotulo="Refazer (Ctrl+Shift+Z)" disabled={!estado.futuro.length} onClick={acoes.refazer}><Redo2 className="h-4 w-4" /></BotaoIcone>
        <span className="mx-1 h-5 w-px bg-borda" />
        <div className="hidden items-center gap-0.5 md:flex" role="toolbar" aria-label="Ferramentas">
          {ferramentas.map((f) => (
            <BotaoIcone key={f.id} rotulo={f.rotulo} ativo={f.id !== 'imagem' && estado.ferramenta === f.id} onClick={() => (f.id === 'imagem' ? arquivoRef.current?.click() : acoes.setFerramenta(f.id))}>{f.icone}</BotaoIcone>
          ))}
        </div>
        <span className="flex-1" />
        <span title="Você está editando (colaboração em tempo real chega na Fase 2)" className="hidden h-7 w-7 items-center justify-center rounded-full bg-salvia text-[11px] font-semibold text-musgo lg:flex">MD</span>
        <Botao tamanho="sm" variante="fantasma" icone={<Eye className="h-4 w-4" />} onClick={() => setPreview(true)}>Pré-visualizar</Botao>
        <div className="relative hidden md:block">
          <div className="flex">
            <Botao tamanho="sm" variante="secundario" className="rounded-r-none border-r-0" icone={<Play className="h-3.5 w-3.5 fill-current" />} onClick={() => { acoes.salvarAgora(); router.push(`/app/projects/${projetoId}/apresentar`) }}>Apresentar</Botao>
            <Botao tamanho="sm" variante="secundario" className="rounded-l-none px-1.5" aria-label="Mais opções de apresentação" aria-expanded={menuApresentar} onClick={() => setMenuApresentar((v) => !v)}><ChevronDown className="h-3.5 w-3.5" /></Botao>
          </div>
          {menuApresentar && (
            <div role="menu" className="absolute right-0 z-40 mt-1 w-60 rounded-lg border border-borda bg-superficie p-1 shadow-painel" onMouseLeave={() => setMenuApresentar(false)}>
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => router.push(`/app/projects/${projetoId}/apresentar`)}><Play className="h-3.5 w-3.5" /> Apresentar em tela cheia</button>
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => { acoes.salvarAgora(); router.push(`/app/projects/${projetoId}/apresentador`) }}><MonitorPlay className="h-3.5 w-3.5" /> Visão do apresentador (notas)</button>
            </div>
          )}
        </div>
        <Botao tamanho="sm" variante="acento" onClick={() => setCompartilhar(true)}>Compartilhar</Botao>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center md:hidden">
        <p className="text-sm text-texto2">No celular você pode pré-visualizar e apresentar. Para editar, use um computador ou tablet.</p>
        <Botao onClick={() => setPreview(true)} icone={<Eye className="h-4 w-4" />}>Pré-visualizar</Botao>
      </div>

      <div className="hidden min-h-0 flex-1 md:flex">
        <div className="w-[248px] shrink-0"><PainelEsquerdo editor={editor} assets={assetsLista} avisar={avisar} aoBloco={(id) => inserirBloco(id)} /></div>
        <main className="relative min-w-0 flex-1">
          <Canvas editor={editor} assets={assets} avisar={avisar} interagir3d={interagir3d} aoEscala={setEscala} />
        </main>
        <div className="w-[288px] shrink-0"><Inspetor editor={editor} assets={assetsLista} /></div>
      </div>

      {/* barra inferior */}
      <footer className="hidden h-9 shrink-0 items-center gap-1 border-t border-borda bg-superficie px-3 text-[12px] text-texto2 md:flex">
        <button aria-label="Diminuir zoom" className="rounded px-2 py-1 hover:bg-hover hover:text-texto" onClick={() => acoes.setZoom(Math.max(0.05, escala / 1.2))}>−</button>
        <span className="mono w-11 text-center tabular-nums text-texto">{Math.round(escala * 100)}%</span>
        <button aria-label="Aumentar zoom" className="rounded px-2 py-1 hover:bg-hover hover:text-texto" onClick={() => acoes.setZoom(Math.min(8, escala * 1.2))}>+</button>
        <button className="rounded px-2 py-1 hover:bg-hover hover:text-texto" onClick={acoes.ajustar}>Ajustar</button>
        <span className="mx-1 h-4 w-px bg-borda" />
        <BotaoIcone rotulo="Grade" ativo={estado.grade} className="h-6 w-6" onClick={() => acoes.ui({ grade: !estado.grade })}><Grid3X3 className="h-3.5 w-3.5" /></BotaoIcone>
        <BotaoIcone rotulo="Guias inteligentes" ativo={estado.snap} className="h-6 w-6" onClick={() => acoes.ui({ snap: !estado.snap })}><Magnet className="h-3.5 w-3.5" /></BotaoIcone>
        <BotaoIcone rotulo="Interagir com 3D e incorporados no canvas" ativo={interagir3d} className="h-6 w-6" onClick={() => setInteragir3d((v) => !v)}><Box className="h-3.5 w-3.5" /></BotaoIcone>
        <span className="flex-1" />
        <button aria-label="Tela anterior" className="rounded p-1 hover:bg-hover disabled:opacity-30" disabled={editor.indiceCena <= 0} onClick={() => acoes.irParaCena(estado.documento.scenes[editor.indiceCena - 1]!.id)}><ChevronLeft className="h-3.5 w-3.5" /></button>
        <span className="mono tabular-nums text-texto">{String(editor.indiceCena + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        <button aria-label="Próxima tela" className="rounded p-1 hover:bg-hover disabled:opacity-30" disabled={editor.indiceCena >= total - 1} onClick={() => acoes.irParaCena(estado.documento.scenes[editor.indiceCena + 1]!.id)}><ChevronRight className="h-3.5 w-3.5" /></button>
        <span className="flex-1" />
        {!validacao.ok && <button className="mr-2 flex items-center gap-1 text-perigo hover:underline" onClick={() => { acoes.selecionarExato([]); acoes.ui({ abaDireita: 'design' }) }}><TriangleAlert className="h-3.5 w-3.5" /> {validacao.erros.length} erro(s)</button>}
        <span className="hidden gap-3 xl:flex"><span><b className="font-medium text-texto">V</b> Mover</span><span><b className="font-medium text-texto">T</b> Texto</span><span><b className="font-medium text-texto">H</b> Hotspot</span><span><b className="font-medium text-texto">⌘V</b> Colar do Figma</span><span><b className="font-medium text-texto">⌘Z</b> Desfazer</span></span>
        <BotaoIcone rotulo="Atalhos de teclado (?)" className="ml-2 h-6 w-6" onClick={() => setAtalhos(true)}><Keyboard className="h-3.5 w-3.5" /></BotaoIcone>
      </footer>

      {menu && <MenuContexto editor={editor} x={menu.x} y={menu.y} aoFechar={() => setMenu(null)} avisar={avisar} />}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black">
          <Viewer documento={estado.documento} assets={assets} nome={projeto.nome} indiceInicial={Math.max(0, editor.indiceCena)} aoSair={() => setPreview(false)} />
        </div>
      )}

      <Modal aberto={compartilhar} aoFechar={() => setCompartilhar(false)} titulo="Compartilhar" descricao="Links privados, não listados. Atualize o projeto e o cliente vê a nova versão — sem reenviar nada." largura="lg">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-borda bg-superficie2 p-4">
          <div className="text-[13px]">
            <div className="font-medium">{naoPublicado ? 'Há mudanças não publicadas' : 'Publicado e atualizado'}</div>
            <div className="text-texto2">Rascunho na revisão {estado.revisao} · {projeto.revisaoPublicada ? `convidados veem a revisão ${projeto.revisaoPublicada}` : 'ainda não publicado'}</div>
          </div>
          <Botao variante={naoPublicado ? 'primario' : 'secundario'} carregando={publicando} onClick={publicarAgora}>Publicar</Botao>
        </div>
        <Compartilhar projetoId={projetoId} />
      </Modal>

      <Modal aberto={atalhos} aoFechar={() => setAtalhos(false)} titulo="Atalhos de teclado" largura="lg">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
          {ATALHOS.map(([k, d]) => <div key={k} className="flex justify-between gap-4 border-b border-borda py-1.5"><dt className="text-texto2">{d}</dt><dd className="mono whitespace-nowrap text-[12px]">{k}</dd></div>)}
        </dl>
      </Modal>

      <ModalEmbed aberto={!!embed} aoFechar={() => setEmbed(null)} aoConfirmar={(url) => { const p = embed?.ponto; setEmbed(null); void importarConteudo(editor, { arquivos: [], html: '', texto: url }, { avisar, ponto: p }) }} />
    </div>
  )
}

function ModalEmbed({ aberto, aoFechar, aoConfirmar }: { aberto: boolean; aoFechar: () => void; aoConfirmar: (url: string) => void }) {
  const [url, setUrl] = useState('')
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Incorporar conteúdo" descricao="Cole um link do YouTube, Vimeo, Figma, Loom, Spline, Sketchfab ou Spotify." largura="md" rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao onClick={() => { aoConfirmar(url); setUrl('') }} disabled={!/^https:\/\//.test(url)}>Incorporar</Botao></>}>
      <input aria-label="Link para incorporar" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="h-11 w-full rounded-lg border border-[#E7E5E4] px-3.5 text-sm outline-none focus:border-acento" />
    </Modal>
  )
}

function EstadoSalvo({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const { estado, acoes } = editor
  const s = estado.salvamento
  if (s === 'conflito')
    return (
      <span className="ml-2 flex items-center gap-2 rounded-md bg-aviso/25 px-2 py-1 text-[12px] text-[#7a5a12]" role="alert">
        Há uma versão mais recente. Suas mudanças continuam seguras nesta sessão.
        <button className="underline" onClick={acoes.recarregarDoServidor}>Recarregar</button>
        <button className="underline" onClick={acoes.manterMinhaVersao}>Manter a minha</button>
      </span>
    )
  const mapa = {
    salvo: { cor: 'bg-sucesso', texto: 'Salvo' },
    alterado: { cor: 'bg-aviso', texto: 'Salvando…' },
    salvando: { cor: 'bg-aviso', texto: 'Salvando…' },
    offline: { cor: 'bg-perigo', texto: 'Sem conexão — salvaremos ao reconectar' },
    falha: { cor: 'bg-perigo', texto: 'Falha ao salvar' },
  } as const
  const m = mapa[s]
  return (
    <span className="ml-2 hidden items-center gap-1.5 text-[12px] text-texto3 sm:flex" role="status" aria-live="polite" title={s === 'salvo' ? 'Todas as alterações foram salvas.' : undefined}>
      {s === 'salvando' ? <Loader2 className="h-3 w-3 animate-spin" /> : s === 'offline' ? <CloudOff className="h-3 w-3 text-perigo" /> : <span className={cx('h-1.5 w-1.5 rounded-full', m.cor)} />}
      {m.texto}
      <span className="sr-only">{s === 'salvo' ? 'Todas as alterações foram salvas.' : ''}</span>
      {s === 'falha' && <button className="underline" onClick={acoes.salvarAgora}>Tentar novamente</button>}
    </span>
  )
}
