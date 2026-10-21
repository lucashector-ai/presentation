'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, CloudOff, Eye, Grid3X3, Images, Loader2, Magnet, PanelLeft, PanelRight, Play, Redo2, Send, Share2, Square, Type, Undo2, Crosshair, TriangleAlert } from 'lucide-react'
import { useEditor } from '@/lib/editor/useEditor'
import { atualizarProjeto, ErroDemo, publicar } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import type { AssetDemo } from '@/lib/demo/tipos'
import { PainelCenas } from './PainelCenas'
import { Canvas } from './Canvas'
import { Inspetor } from './Inspetor'
import { BibliotecaMidias } from './BibliotecaMidias'
import { Viewer } from '@/components/viewer/Viewer'
import { Compartilhar } from '@/components/compartilhar/Compartilhar'
import { Botao, BotaoIcone, Modal, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

export function EditorShell({ projetoId }: { projetoId: string }) {
  const editor = useEditor(projetoId)
  const { estado, cena, acoes, validacao } = editor
  const projeto = useDemo((e) => e.projetos.find((p) => p.id === projetoId))
  const assetsLista = useDemo((e) => e.assets)
  const assets = useMemo(() => Object.fromEntries(assetsLista.map((a) => [a.id, a])), [assetsLista])
  const router = useRouter()
  const { mostrar } = useToast()
  const [preview, setPreview] = useState(false)
  const [biblioteca, setBiblioteca] = useState(false)
  const [compartilhar, setCompartilhar] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [mostrarErros, setMostrarErros] = useState(false)
  const [painelEsq, setPainelEsq] = useState(true)
  const [painelDir, setPainelDir] = useState(true)

  // ---------- atalhos ----------
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      const digitando = alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) acoes.refazer(); else acoes.desfazer(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); acoes.refazer(); return }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); acoes.salvarAgora(); return }
      if (digitando || preview) return
      const sel = estado.selecao
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); acoes.removerCamadas(sel) }
      if (mod && e.key.toLowerCase() === 'd' && sel.length) { e.preventDefault(); acoes.duplicarCamadas(sel) }
      if (mod && e.key.toLowerCase() === 'a' && cena) { e.preventDefault(); acoes.selecionar(cena.layers.map((l) => l.id)) }
      if (e.key === 'Escape') acoes.selecionar([])
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && sel.length) {
        e.preventDefault()
        const passo = e.shiftKey ? 10 : 1
        acoes.deslocar(sel, e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0, e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0)
      }
      if (e.key === 'p' && !mod) setPreview(true)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [acoes, estado.selecao, cena, preview])

  const escolherAsset = useCallback((a: AssetDemo) => { acoes.adicionarCamada({ type: a.tipo === 'video' ? 'video' : 'image' }, a); mostrar(`${a.nome} adicionada à cena.`) }, [acoes, mostrar])

  if (!editor.existe || !projeto) {
    return <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-texto2">Projeto não encontrado. <Link className="ml-1 underline" href="/app">Voltar ao painel</Link></div>
  }

  const publicarAgora = async () => {
    acoes.salvarAgora()
    if (!validacao.ok) { setMostrarErros(true); return }
    setPublicando(true)
    try {
      await new Promise((r) => setTimeout(r, 300))
      const r = publicar(projetoId, estado.revisao)
      mostrar(`Revisão ${r.publishedRevision} publicada.`, 'sucesso', { rotulo: 'Compartilhar', aoClicar: () => setCompartilhar(true) })
    } catch (e) {
      mostrar(e instanceof ErroDemo ? e.message : 'Não foi possível publicar.', 'erro')
    } finally {
      setPublicando(false)
    }
  }

  const naoPublicado = projeto.revisaoPublicada == null || projeto.revisaoPublicada < estado.revisao || estado.salvamento !== 'salvo'

  return (
    <div className="flex h-dvh flex-col bg-fundo">
      {/* barra superior */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-superficie px-2">
        <BotaoIcone rotulo="Voltar ao projeto" onClick={() => { acoes.salvarAgora(); router.push(`/app/projects/${projetoId}`) }}><ArrowLeft className="h-4 w-4" /></BotaoIcone>
        <input aria-label="Nome do projeto" defaultValue={projeto.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== projeto.nome && atualizarProjeto(projetoId, { nome: e.target.value.trim() })} className="h-8 w-40 truncate rounded-lg bg-transparent px-2 text-sm font-medium hover:bg-superficie2 focus:bg-superficie2 sm:w-64" />
        <EstadoSalvo editor={editor} />
        <span className="flex-1" />
        <BotaoIcone rotulo="Desfazer (Ctrl+Z)" disabled={!estado.passado.length} onClick={acoes.desfazer}><Undo2 className="h-4 w-4" /></BotaoIcone>
        <BotaoIcone rotulo="Refazer (Ctrl+Shift+Z)" disabled={!estado.futuro.length} onClick={acoes.refazer}><Redo2 className="h-4 w-4" /></BotaoIcone>
        <span className="mx-1 hidden h-5 w-px bg-borda sm:block" />
        <BotaoIcone rotulo="Painel de cenas" ativo={painelEsq} onClick={() => setPainelEsq((v) => !v)} className="hidden lg:inline-flex"><PanelLeft className="h-4 w-4" /></BotaoIcone>
        <BotaoIcone rotulo="Propriedades" ativo={painelDir} onClick={() => setPainelDir((v) => !v)} className="hidden lg:inline-flex"><PanelRight className="h-4 w-4" /></BotaoIcone>
        <Botao tamanho="sm" variante="secundario" icone={<Eye className="h-3.5 w-3.5" />} onClick={() => setPreview(true)}>Pré-visualizar</Botao>
        <Botao tamanho="sm" variante="secundario" icone={<Play className="h-3.5 w-3.5" />} onClick={() => { acoes.salvarAgora(); router.push(`/app/projects/${projetoId}/apresentar`) }} className="hidden md:inline-flex">Apresentar</Botao>
        <Botao tamanho="sm" variante={naoPublicado ? 'primario' : 'secundario'} icone={publicando ? undefined : <Send className="h-3.5 w-3.5" />} carregando={publicando} onClick={publicarAgora}>Publicar</Botao>
        <Botao tamanho="sm" variante="fantasma" icone={<Share2 className="h-3.5 w-3.5" />} onClick={() => setCompartilhar(true)}>Compartilhar</Botao>
      </header>

      {/* aviso de celular: MVP prioriza consumo, não edição */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center md:hidden">
        <p className="text-sm text-texto2">No celular você pode pré-visualizar e apresentar. Para editar, use um computador ou tablet.</p>
        <Botao onClick={() => setPreview(true)} icone={<Eye className="h-4 w-4" />}>Pré-visualizar</Botao>
      </div>

      <div className="hidden flex-1 overflow-hidden md:flex">
        <div className={cx('w-56 shrink-0 transition-all lg:w-60', !painelEsq && 'hidden')}><PainelCenas editor={editor} assets={assets} /></div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1"><Canvas editor={editor} assets={assets} /></div>
          {biblioteca && <div className="h-48 shrink-0"><BibliotecaMidias assets={assetsLista} aoEscolher={escolherAsset} aoCriarCenas={(as) => { acoes.cenasDeAssets(as); setBiblioteca(false) }} aoFechar={() => setBiblioteca(false)} /></div>}
          {/* barra inferior */}
          <div className="flex h-11 shrink-0 items-center gap-1 border-t bg-superficie px-2 text-xs">
            <Botao tamanho="sm" variante={biblioteca ? 'secundario' : 'fantasma'} icone={<Images className="h-3.5 w-3.5" />} onClick={() => setBiblioteca((v) => !v)}>Mídias</Botao>
            <span className="mx-1 h-5 w-px bg-borda" />
            <Botao tamanho="sm" variante="fantasma" icone={<Type className="h-3.5 w-3.5" />} onClick={() => acoes.adicionarCamada({ type: 'text' })}>Texto</Botao>
            <Botao tamanho="sm" variante="fantasma" icone={<Square className="h-3.5 w-3.5" />} onClick={() => acoes.adicionarCamada({ type: 'shape' })}>Forma</Botao>
            <Botao tamanho="sm" variante="fantasma" icone={<Crosshair className="h-3.5 w-3.5" />} onClick={() => acoes.adicionarCamada({ type: 'hotspot' })}>Hotspot</Botao>
            <span className="flex-1" />
            {!validacao.ok && <button onClick={() => setMostrarErros(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-perigo hover:bg-superficie2"><TriangleAlert className="h-3.5 w-3.5" /> {validacao.erros.length} erro(s)</button>}
            <BotaoIcone rotulo="Grade" ativo={estado.grade} onClick={() => acoes.setGrade(!estado.grade)}><Grid3X3 className="h-4 w-4" /></BotaoIcone>
            <BotaoIcone rotulo="Encaixe (snap)" ativo={estado.snap} onClick={() => acoes.setSnap(!estado.snap)}><Magnet className="h-4 w-4" /></BotaoIcone>
          </div>
        </div>
        <div className={cx('w-72 shrink-0 lg:w-80', !painelDir && 'hidden')}><Inspetor editor={editor} assets={assetsLista} /></div>
      </div>

      {/* preview: mesmo renderizador e motor do visualizador */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black">
          <Viewer documento={estado.documento} assets={assets} nome={projeto.nome} indiceInicial={Math.max(0, editor.indiceCena)} aoSair={() => setPreview(false)} />
        </div>
      )}

      <Modal aberto={compartilhar} aoFechar={() => setCompartilhar(false)} titulo="Compartilhar" descricao="Links privados, não listados. Só quem tem o link acessa." largura="lg">
        <Compartilhar projetoId={projetoId} />
      </Modal>

      <Modal aberto={mostrarErros} aoFechar={() => setMostrarErros(false)} titulo="Corrija antes de publicar" descricao="Clique em um item para ir até ele." largura="md"
        rodape={<Botao variante="secundario" onClick={() => setMostrarErros(false)}>Fechar</Botao>}>
        <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {validacao.erros.map((p, i) => (
            <li key={i}><button className="w-full rounded-lg px-2 py-1.5 text-left text-perigo hover:bg-superficie2" onClick={() => { if (p.sceneId) acoes.irParaCena(p.sceneId); if (p.layerId) setTimeout(() => acoes.selecionar([p.layerId!]), 0); setMostrarErros(false) }}>{p.mensagem}</button></li>
          ))}
          {validacao.avisos.map((p, i) => <li key={`a${i}`} className="px-2 py-1 text-texto2">Aviso: {p.mensagem}</li>)}
        </ul>
      </Modal>
    </div>
  )
}

function EstadoSalvo({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const { estado, acoes } = editor
  const s = estado.salvamento
  if (s === 'conflito')
    return (
      <span className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-2 py-1 text-xs text-amber-800 dark:text-amber-200" role="alert">
        Há uma versão mais recente. Suas mudanças continuam seguras nesta sessão.
        <button className="underline" onClick={acoes.recarregarDoServidor}>Recarregar</button>
        <button className="underline" onClick={acoes.manterMinhaVersao}>Manter a minha</button>
      </span>
    )
  const mapa = {
    salvo: { icone: <Check className="h-3.5 w-3.5 text-sucesso" />, texto: 'Todas as alterações foram salvas.' },
    alterado: { icone: <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />, texto: 'Salvando…' },
    salvando: { icone: <Loader2 className="h-3.5 w-3.5 animate-spin" />, texto: 'Salvando…' },
    offline: { icone: <CloudOff className="h-3.5 w-3.5 text-perigo" />, texto: 'Sem conexão. Salvaremos ao reconectar.' },
    falha: { icone: <TriangleAlert className="h-3.5 w-3.5 text-perigo" />, texto: 'Falha ao salvar.' },
  } as const
  const m = mapa[s]
  return (
    <span className="hidden items-center gap-1.5 text-xs text-texto2 sm:flex" role="status" aria-live="polite">
      {m.icone} {m.texto}
      {s === 'falha' && <button className="underline" onClick={acoes.salvarAgora}>Tentar novamente</button>}
    </span>
  )
}
