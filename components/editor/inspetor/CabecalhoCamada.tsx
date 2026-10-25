'use client'
/** Cabeçalho do painel Design: tipo da camada (forma troca por aqui, como "Retângulo ▾" no Figma), nome e ações. */
import { ArrowDownToLine, ArrowUpToLine, Copy, Group, Layers, Lock, Trash2, Ungroup } from 'lucide-react'
import type { CamadaForma } from '@/lib/scene/schema'
import { FORMAS } from '@/lib/scene/schema'
import { BotaoMini } from './controles'
import { MenuSuspenso } from '@/components/ui/MenuSuspenso'
import { ICONE_TIPO, NOME_FORMA, NOME_TIPO, comum, useCamadas, type PropsSecao } from './selecao'

export function CabecalhoCamada({ editor }: PropsSecao) {
  const { acoes } = editor
  const { sel, ids, multi, set } = useCamadas(editor)
  const l = sel[0]
  if (!l) return null
  const travada = comum(sel, (c) => c.locked) === true
  const mesmoTipo = sel.every((c) => c.type === l.type)
  const Icone = mesmoTipo ? ICONE_TIPO[l.type] : Layers
  const agrupado = multi && sel.every((x) => x.groupId && x.groupId === l.groupId)
  const formas = mesmoTipo && l.type === 'shape'
  const forma = formas ? comum(sel, (c) => (c as CamadaForma).shape) : null
  const titulo = multi ? `${sel.length} elementos` : formas && typeof forma === 'string' ? NOME_FORMA[forma] ?? 'Forma' : NOME_TIPO[l.type]
  return (
    <div className="border-b border-borda px-2.5 pb-1.5 pt-2">
      <div className="flex h-7 items-center gap-1">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] bg-acentoSuave text-acento"><Icone className="h-3.5 w-3.5" strokeWidth={1.75} /></span>
        {formas ? (
          <MenuSuspenso
            aparencia="texto"
            rotulo="Forma"
            className="-ml-0.5 min-w-0 !text-[12px]"
            valor={typeof forma === 'string' ? forma : ''}
            aoMudar={(v) => v && set({ shape: v as CamadaForma['shape'], vetor: undefined } as Partial<CamadaForma>)}
            opcoes={[...(typeof forma !== 'string' ? [{ id: '', rotulo: 'Misto' }] : []), ...FORMAS.filter((f) => f !== 'path' || forma === 'path').map((f) => ({ id: f, rotulo: NOME_FORMA[f] ?? f }))]}
          >
            {titulo}
          </MenuSuspenso>
        ) : (
          <span className="min-w-0 truncate text-[12px] font-medium">{titulo}</span>
        )}
        {travada && <button type="button" aria-label="Destravar" title="Travada — clique para destravar (Ctrl+L)" onClick={() => set({ locked: false })} className="shrink-0 text-texto3 hover:text-texto"><Lock className="h-3 w-3" /></button>}
        <span className="flex-1" />
        {multi ? (
          <BotaoMini rotulo={agrupado ? 'Desagrupar (Ctrl+Shift+G)' : 'Agrupar (Ctrl+G)'} onClick={() => (agrupado ? acoes.desagrupar(ids) : acoes.agrupar(ids))}>{agrupado ? <Ungroup className="h-3.5 w-3.5" /> : <Group className="h-3.5 w-3.5" />}</BotaoMini>
        ) : (
          null
        )}
        <BotaoMini rotulo="Duplicar (Ctrl+D)" onClick={() => acoes.duplicarCamadas(ids)}><Copy className="h-3.5 w-3.5" /></BotaoMini>
        <BotaoMini rotulo="Excluir (Delete)" onClick={() => acoes.removerCamadas(ids)}><Trash2 className="h-3.5 w-3.5" /></BotaoMini>
      </div>
      {!multi && (
        <input aria-label="Nome da camada" value={l.name ?? ''} placeholder={l.id} onChange={(e) => acoes.atualizarCamadas(ids, { name: e.target.value || undefined }, false)} onBlur={() => acoes.atualizarCamadas(ids, (c) => c)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="mono -mx-1 mt-0.5 h-6 w-[calc(100%+8px)] truncate rounded-[5px] bg-transparent px-1 text-[11px] text-texto3 outline-none placeholder:text-texto3 hover:bg-hover/60 focus:bg-superficie2 focus:text-texto" />
      )}
    </div>
  )
}
