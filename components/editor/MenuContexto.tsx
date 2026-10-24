'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Editor } from '@/lib/editor/useEditor'
import type { Avisar } from '@/lib/editor/importar'
import { importarConteudo } from '@/lib/editor/importar'
import { serializarCamadas } from '@/lib/importar/clipboard'
import { CUSTO_CREDITOS } from '@/lib/planos'
import { abrirIA } from './ia/PainelIA'
import { abrirPreencher } from './PreencherGrade'
import { serveDeMascara } from '@/lib/scene/mascara'

interface Item { rotulo: string; atalho?: string; acao: () => void; desativado?: boolean; perigo?: boolean }

export function MenuContexto({ editor, x, y, aoFechar, avisar }: { editor: Editor; x: number; y: number; aoFechar: () => void; avisar: Avisar }) {
  const ref = useRef<HTMLDivElement>(null)
  const { acoes, estado, camadasSelecionadas: sel } = editor
  const ids = sel.map((l) => l.id)
  const tem = ids.length > 0
  const agrupado = tem && sel.every((l) => l.groupId && l.groupId === sel[0]!.groupId)
  const temTexto = !!editor.cena?.layers.some((l) => l.type === 'text' && l.text.trim())
  const textoSelecionado = sel.some((l) => l.type === 'text')

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) aoFechar() }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aoFechar])

  const colar = async () => {
    try {
      const itens = await navigator.clipboard.read()
      const arquivos: File[] = []
      let texto = ''
      let html = ''
      for (const it of itens) {
        for (const tipo of it.types) {
          const blob = await it.getType(tipo)
          if (tipo.startsWith('image/')) arquivos.push(new File([blob], `colado.${tipo.split('/')[1]}`, { type: tipo }))
          else if (tipo === 'text/plain') texto = await blob.text()
          else if (tipo === 'text/html') html = await blob.text()
        }
      }
      await importarConteudo(editor, { arquivos, texto, html }, { avisar })
    } catch {
      acoes.colarCamadas()
    }
  }

  const grupos: Item[][] = [
    [
      { rotulo: 'Copiar', atalho: '⌘C', desativado: !tem, acao: () => { const c = acoes.copiar(ids); void navigator.clipboard?.writeText(serializarCamadas(c)).catch(() => undefined) } },
      { rotulo: 'Recortar', atalho: '⌘X', desativado: !tem, acao: () => { const c = acoes.copiar(ids); void navigator.clipboard?.writeText(serializarCamadas(c)).catch(() => undefined); acoes.removerCamadas(ids) } },
      { rotulo: 'Colar', atalho: '⌘V', acao: () => void colar() },
      { rotulo: 'Duplicar', atalho: '⌘D', desativado: !tem, acao: () => acoes.duplicarCamadas(ids) },
    ],
    [
      { rotulo: 'Preencher…', atalho: '⌃⌥', desativado: !tem, acao: () => abrirPreencher(x, y) },
      { rotulo: 'Editar vetor', atalho: '↵', desativado: !(sel.length === 1 && (sel[0]!.type === 'shape' || sel[0]!.type === 'svg') && !sel[0]!.locked), acao: () => window.dispatchEvent(new CustomEvent('mostra:editar-vetor', { detail: { id: ids[0] } })) },
      { rotulo: sel.some((l) => l.isMask || l.maskId) ? 'Remover máscara' : 'Usar como máscara', atalho: '⌃⌘M', desativado: !(sel.some((l) => l.isMask || l.maskId) || (sel.length >= 2 && sel.some(serveDeMascara))), acao: () => acoes.alternarMascara(ids) },
    ],
    [
      { rotulo: textoSelecionado ? '✦ Reescrever texto com IA' : '✦ Reescrever textos da tela', atalho: `${CUSTO_CREDITOS.reescrever} cr`, desativado: !temTexto, acao: () => abrirIA('texto') },
      { rotulo: '✦ Refazer tela com IA', atalho: `${CUSTO_CREDITOS.refazerTela} cr`, acao: () => abrirIA('tela') },
    ],
    [
      { rotulo: 'Copiar estilo', atalho: '⌥⌘C', desativado: ids.length !== 1, acao: () => sel[0] && acoes.copiarEstilo(sel[0]) },
      { rotulo: 'Colar estilo', atalho: '⌥⌘V', desativado: !tem || !acoes.temEstiloCopiado(), acao: () => acoes.colarEstilo(ids) },
    ],
    [
      { rotulo: 'Trazer para frente', atalho: ']', desativado: ids.length !== 1, acao: () => acoes.ordem(ids[0]!, 'frente') },
      { rotulo: 'Enviar para trás', atalho: '[', desativado: ids.length !== 1, acao: () => acoes.ordem(ids[0]!, 'tras') },
      agrupado ? { rotulo: 'Desagrupar', atalho: '⇧⌘G', acao: () => acoes.desagrupar(ids) } : { rotulo: 'Agrupar', atalho: '⌘G', desativado: ids.length < 2, acao: () => acoes.agrupar(ids) },
    ],
    [
      { rotulo: sel.every((l) => l.locked) && tem ? 'Destravar' : 'Travar', atalho: '⌘L', desativado: !tem, acao: () => acoes.atualizarCamadas(ids, (l) => ({ ...l, locked: !sel.every((s) => s.locked) })) },
      { rotulo: sel.every((l) => l.hidden) && tem ? 'Mostrar' : 'Ocultar', atalho: '⇧⌘H', desativado: !tem, acao: () => acoes.atualizarCamadas(ids, (l) => ({ ...l, hidden: !sel.every((s) => s.hidden) })) },
      { rotulo: 'Adicionar interação', desativado: ids.length !== 1, acao: () => acoes.ui({ abaDireita: 'interacoes' }) },
    ],
    [
      { rotulo: 'Ajustar espaçamento (8 px)', desativado: !editor.cena?.layers.length, acao: () => acoes.ajustarEspacamento('tela') },
    ],
    [
      { rotulo: 'Selecionar tudo', atalho: '⌘A', acao: () => editor.cena && acoes.selecionarExato(editor.cena.layers.filter((l) => !l.locked).map((l) => l.id)) },
      { rotulo: 'Excluir', atalho: '⌫', desativado: !tem, perigo: true, acao: () => acoes.removerCamadas(ids) },
    ],
  ]
  const larg = 232
  const left = Math.min(x, window.innerWidth - larg - 8)
  // o menu inteiro na janela: sobe o que for preciso (pela altura medida) e, numa janela baixa, rola
  const [altura, setAltura] = useState(640)
  useLayoutEffect(() => { if (ref.current) setAltura(ref.current.offsetHeight) }, [])
  const top = Math.max(8, Math.min(y, window.innerHeight - altura - 8))
  return (
    <div ref={ref} role="menu" aria-label="Ações" className="fixed z-50 max-h-[calc(100dvh-16px)] overflow-y-auto rounded-lg border border-borda bg-superficie p-1 text-[12px] shadow-painel" style={{ left, top, width: larg }}>
      {grupos.map((g, i) => (
        <div key={i} className={i ? 'mt-1 border-t border-borda pt-1' : ''}>
          {g.map((it) => (
            <button key={it.rotulo} role="menuitem" disabled={it.desativado} onClick={() => { it.acao(); aoFechar() }} className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left hover:bg-hover disabled:pointer-events-none disabled:opacity-35 ${it.perigo ? 'text-perigo' : ''}`}>
              {it.rotulo}
              {it.atalho && <span className="mono text-[11px] text-texto3">{it.atalho}</span>}
            </button>
          ))}
        </div>
      ))}
      <span className="sr-only">{estado.selecao.length} selecionado(s)</span>
    </div>
  )
}
