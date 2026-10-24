'use client'
/**
 * Barra superior do editor, organizada como a do Figma em três grupos:
 *  esquerda — voltar, nome do projeto, estado do salvamento (e desfazer/refazer em telas largas);
 *  centro   — ferramentas (mover, frame, forma ▾, caneta, texto, mídia, hotspot, mão) e a IA;
 *  direita  — zoom, quem está no projeto, convidar, pré-visualizar, "⋯", Apresentar ▾ e Compartilhar.
 * Os dois lados têm a mesma largura (flex-1 basis-0), então as ferramentas ficam no centro da janela.
 * Larguras: ≥ 1536 tudo com texto; 1280–1535 pré-visualizar vira ícone e o zoom sai (fica no rodapé); 1024–1279 o
 * secundário (desfazer, convidar, pré-visualizar) vai para o "⋯" e Apresentar fica só com o ícone; abaixo de
 * 1024 as ferramentas descem para a barra flutuante do canvas (BarraMovel).
 * Durante um arraste no canvas a barra não re-renderiza a cada quadro (compara o editor sem zoom/pan).
 */
import { memo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, CloudOff, Eye, Loader2, MonitorPlay, Play, Redo2, TriangleAlert, Undo2, UserPlus } from 'lucide-react'
import { mesmoEditorForaDoCanvas, type Editor } from '@/lib/editor/useEditor'
import { dados, mensagemDeErro, useDados } from '@/lib/dados'
import { Botao, BotaoIcone, Simbolo, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { BarraFerramentas } from './BarraFerramentas'
import { MenuEditor } from './MenuEditor'
import { BotaoIA } from './ia/PainelIA'
import { PresencaCabecalho } from './Presenca'
import { MenuZoom } from './Rodape'

export type OpcoesApresentar = { doInicio?: boolean; telaCheia?: boolean; apresentador?: boolean }

const comEditor = <P extends { editor: Editor }>(C: (p: P) => React.ReactNode) =>
  memo(C, (a, b) => Object.keys(b).every((k) => (k === 'editor' ? mesmoEditorForaDoCanvas(a.editor, b.editor) : a[k as keyof P] === b[k as keyof P])))
const BotaoIAM = comEditor(BotaoIA)
const MenuEditorM = comEditor(MenuEditor)

export const Cabecalho = comEditor(function Cabecalho({ editor, projetoId, nomeProjeto, aoMidia, aoPreview, aoApresentar, aoAtalhos, aoConvidar, aoCompartilhar }: { editor: Editor; projetoId: string; nomeProjeto: string; aoMidia: () => void; aoPreview: () => void; aoApresentar: (opcoes?: OpcoesApresentar) => void; aoAtalhos: () => void; aoConvidar: () => void; aoCompartilhar: () => void }) {
  const { estado, acoes } = editor
  const usuario = useDados((e) => e.usuario)
  const { mostrar } = useToast()
  const [menuApresentar, setMenuApresentar] = useState(false)
  const ap = (opcoes?: OpcoesApresentar) => { setMenuApresentar(false); aoApresentar(opcoes) }
  const renomear = (nome: string) => {
    void dados.atualizarProjeto(projetoId, { nome }).catch((e) => mostrar(mensagemDeErro(e, 'Não foi possível renomear o projeto.'), 'erro'))
  }
  const Separador = () => <span className="mx-1 hidden h-5 w-px shrink-0 bg-borda md:block" aria-hidden />
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-1 border-b border-borda bg-superficie px-2 sm:px-3">
      {/* esquerda */}
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-1">
        <Link href="/app" onClick={() => acoes.salvarAgora()} aria-label="Início" title="Voltar ao Início" className="shrink-0 rounded-md p-0.5 hover:bg-hover"><Simbolo tamanho={26} /></Link>
        <input aria-label="Nome do projeto" defaultValue={nomeProjeto} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== nomeProjeto) renomear(e.target.value.trim()) }} className="h-8 w-0 min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 text-[14px] font-medium outline-none hover:bg-hover focus:bg-hover md:max-w-44 lg:max-w-56" />
        <EstadoSalvo editor={editor} />
        <span className="hidden xl:contents">
          <Separador />
          <BotaoIcone rotulo="Desfazer (Ctrl+Z)" disabled={!estado.passado.length} onClick={acoes.desfazer}><Undo2 className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Refazer (Ctrl+Shift+Z)" disabled={!estado.futuro.length} onClick={acoes.refazer}><Redo2 className="h-4 w-4" /></BotaoIcone>
        </span>
      </div>

      {/* centro: ferramentas */}
      <div className="hidden shrink-0 items-center gap-0.5 lg:flex">
        <BarraFerramentas className="flex" ferramenta={estado.ferramenta} aoFerramenta={acoes.setFerramenta} aoMidia={aoMidia} />
        <Separador />
        <BotaoIAM editor={editor} nomeProjeto={nomeProjeto} />
      </div>

      {/* direita */}
      <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-1">
        <MenuZoom acoes={acoes} temSelecao={estado.selecao.length > 0} className="hidden 2xl:block" />
        <div className="hidden lg:block"><PresencaCabecalho sala={editor.sala} documento={estado.documento} eu={{ nome: usuario.nome || usuario.email || 'Você' }} aoIrParaCena={acoes.irParaCena} /></div>
        <BotaoIcone rotulo="Convidar pessoas para editar" className="hidden xl:inline-flex" onClick={aoConvidar}><UserPlus className="h-4 w-4" /></BotaoIcone>
        <Botao tamanho="sm" variante="fantasma" className="hidden 2xl:inline-flex" title="Pré-visualizar (Ctrl/⌘ + Enter)" icone={<Eye className="h-4 w-4" />} onClick={aoPreview}>Pré-visualizar</Botao>
        <BotaoIcone rotulo="Pré-visualizar (Ctrl/⌘ + Enter)" className="hidden xl:inline-flex 2xl:hidden" onClick={aoPreview}><Eye className="h-4 w-4" /></BotaoIcone>
        <MenuEditorM editor={editor} projetoId={projetoId} nomeProjeto={nomeProjeto} aoPreview={aoPreview} aoApresentar={aoApresentar} aoAtalhos={aoAtalhos} aoConvidar={aoConvidar} />
        <Separador />
        <BotaoIcone rotulo="Apresentar" title="Apresentar em tela cheia" className="shrink-0 lg:hidden" onClick={() => ap({ telaCheia: true })}><Play className="h-4 w-4 fill-current" /></BotaoIcone>
        <div className="relative hidden shrink-0 lg:block">
          <div className="flex">
            <Botao tamanho="sm" variante="secundario" className="rounded-r-none border-r-0 max-xl:px-2.5" title="Apresentar em tela cheia a partir desta tela" aria-label="Apresentar" icone={<Play className="h-3.5 w-3.5 fill-current" />} data-apresentar onClick={() => ap({ telaCheia: true })}><span className="hidden xl:inline">Apresentar</span></Botao>
            <Botao tamanho="sm" variante="secundario" className="rounded-l-none px-1.5" aria-label="Mais opções de apresentação" aria-haspopup="menu" aria-expanded={menuApresentar} onClick={() => setMenuApresentar((v) => !v)}><ChevronDown className="h-3.5 w-3.5" /></Botao>
          </div>
          {menuApresentar && (
            <div role="menu" aria-label="Opções de apresentação" className="absolute right-0 z-40 mt-1 w-60 rounded-lg border border-borda bg-superficie p-1 shadow-painel" onMouseLeave={() => setMenuApresentar(false)}>
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => ap({ telaCheia: true, doInicio: true })}><Play className="h-3.5 w-3.5" /> Apresentar do início</button>
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => ap()}><Eye className="h-3.5 w-3.5" /> Apresentar nesta janela</button>
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => ap({ apresentador: true })}><MonitorPlay className="h-3.5 w-3.5" /> Visão do apresentador (notas)</button>
            </div>
          )}
        </div>
        <Botao tamanho="sm" variante="acento" className="shrink-0" onClick={aoCompartilhar}>Compartilhar</Botao>
      </div>
    </header>
  )
})

function EstadoSalvo({ editor }: { editor: Editor }) {
  const { estado, acoes } = editor
  const s = estado.salvamento
  if (s === 'conflito')
    return (
      <span className="ml-1 hidden shrink-0 items-center gap-1.5 text-[12px] text-avisoTexto sm:flex" role="status" aria-live="polite">
        <TriangleAlert className="h-3 w-3" /> Não salvo: versão mais recente
      </span>
    )
  const mapa = {
    salvo: { cor: 'bg-sucesso', texto: 'Salvo' },
    alterado: { cor: 'bg-aviso', texto: 'Salvando…' },
    salvando: { cor: 'bg-aviso', texto: 'Salvando…' },
    offline: { cor: 'bg-perigo', texto: estado.conexao ? 'Sincroniza ao voltar' : 'Sem conexão — salvaremos ao reconectar' },
    falha: { cor: 'bg-perigo', texto: 'Falha ao salvar' },
  } as const
  const m = mapa[s]
  return (
    <span className="ml-1 hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-texto3 sm:flex" role="status" aria-live="polite" data-salvamento={s} title={s === 'salvo' ? 'Todas as alterações foram salvas.' : s === 'falha' && estado.falhaSala ? estado.falhaSala : undefined}>
      {s === 'salvando' ? <Loader2 className="h-3 w-3 animate-spin" /> : s === 'offline' ? <CloudOff className="h-3 w-3 text-perigo" /> : <span className={cx('h-1.5 w-1.5 rounded-full', m.cor)} />}
      {m.texto}
      <span className="sr-only">{s === 'salvo' ? 'Todas as alterações foram salvas.' : ''}</span>
      {s === 'falha' && <button className="underline" onClick={acoes.salvarAgora}>Tentar novamente</button>}
    </span>
  )
}
