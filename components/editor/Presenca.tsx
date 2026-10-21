'use client'
/**
 * Presença na sala do projeto: avatares de quem está no editor (cabeçalho), cursores e seleções das outras
 * pessoas no canvas, e em que tela cada uma está. Cada peça assina a sala sozinha, então o movimento dos cursores
 * não redesenha o editor inteiro.
 */
import { memo, useSyncExternalStore } from 'react'
import { CloudOff, Loader2 } from 'lucide-react'
import type { ConexaoSala, InstantaneoSala } from '@/lib/colab/cliente'
import type { Pessoa } from '@/lib/colab/protocolo'
import type { Camada, DocumentoProjeto } from '@/lib/scene/schema'
import { cx } from '@/components/ui'

const SEM_SALA: InstantaneoSala = { conexao: 'encerrada', eu: null, pessoas: [], papel: null, revisao: 0, salvoEm: null, pendente: false, falha: null, fim: null }
const nada = () => () => {}

export function useSala(sala: ConexaoSala | null): InstantaneoSala {
  return useSyncExternalStore(sala?.assinar ?? nada, sala?.instantaneo ?? (() => SEM_SALA), () => SEM_SALA)
}

export function iniciais(nome: string): string {
  return nome.trim().split(/\s+/).filter(Boolean).map((p) => p[0]!).slice(0, 2).join('').toUpperCase() || '?'
}

/** Uma entrada por pessoa (a mesma pessoa em duas abas aparece uma vez). */
export function pessoasUnicas(pessoas: Pessoa[], eu: Pessoa | null): Pessoa[] {
  const vistas = new Map<string, Pessoa>()
  for (const p of pessoas) if (p.userId !== eu?.userId && !vistas.has(p.userId)) vistas.set(p.userId, p)
  return [...vistas.values()]
}

function nomeDaTela(doc: DocumentoProjeto, cenaId: string | null): string {
  const i = cenaId ? doc.scenes.findIndex((s) => s.id === cenaId) : -1
  if (i < 0) return 'abrindo o projeto'
  const t = doc.scenes[i]!.title
  return `na tela ${String(i + 1).padStart(2, '0')}${t ? ` — ${t}` : ''}`
}

/** Cabeçalho: avatares (clique leva para a tela da pessoa) + estado da conexão. */
export function PresencaCabecalho({ sala, documento, eu, aoIrParaCena }: { sala: ConexaoSala | null; documento: DocumentoProjeto; eu: { nome: string }; aoIrParaCena: (id: string) => void }) {
  const s = useSala(sala)
  const outros = pessoasUnicas(s.pessoas, s.eu)
  const visiveis = outros.slice(0, 4)
  return (
    <div className="flex shrink-0 items-center gap-1.5" data-testid="presenca">
      {sala && s.conexao !== 'online' && (
        <span role="status" title={s.conexao === 'offline' || s.conexao === 'reconectando' ? 'Sem conexão com a sala: você continua editando aqui e tudo sincroniza quando a conexão voltar.' : undefined} className={cx('hidden items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] sm:flex', s.conexao === 'conectando' ? 'text-texto3' : 'bg-perigo/10 text-perigo')}>
          {s.conexao === 'conectando' || s.conexao === 'reconectando' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudOff className="h-3 w-3" />}
          {s.conexao === 'conectando' ? 'Conectando…' : s.conexao === 'reconectando' ? 'Reconectando…' : s.conexao === 'offline' ? 'Offline' : 'Desconectado'}
        </span>
      )}
      <ul className="flex -space-x-1.5" aria-label="Pessoas neste projeto">
        {visiveis.map((p) => (
          <li key={p.userId}>
            <button
              type="button"
              onClick={() => p.cenaId && aoIrParaCena(p.cenaId)}
              aria-label={`${p.nome} ${nomeDaTela(documento, p.cenaId)}${p.papel === 'viewer' ? ' (só vê)' : ''}`}
              title={`${p.nome} — ${nomeDaTela(documento, p.cenaId)}${p.papel === 'viewer' ? ' · só vê' : ''}`}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-superficie text-[10.5px] font-semibold text-white transition-transform hover:z-10 hover:scale-110"
              style={{ background: p.cor }}
            >
              {iniciais(p.nome)}
            </button>
          </li>
        ))}
        {outros.length > visiveis.length && (
          <li><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-superficie bg-superficie2 text-[10.5px] font-medium text-texto2" title={outros.slice(4).map((p) => p.nome).join(', ')}>+{outros.length - visiveis.length}</span></li>
        )}
        <li>
          <span title={`${eu.nome} (você)`} aria-label={`${eu.nome} (você)`} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-superficie bg-salvia text-[10.5px] font-semibold text-musgo" style={s.eu ? { boxShadow: `0 0 0 1.5px ${s.eu.cor}` } : undefined}>
            {iniciais(eu.nome)}
          </span>
        </li>
      </ul>
    </div>
  )
}

/** Bolinhas de quem está em cada tela (painel de telas). */
export function QuemEstaNaTela({ sala, cenaId }: { sala: ConexaoSala | null; cenaId: string }) {
  const s = useSala(sala)
  const aqui = pessoasUnicas(s.pessoas, s.eu).filter((p) => p.cenaId === cenaId)
  if (!aqui.length) return null
  return (
    <span className="pointer-events-none absolute right-1 top-1 flex -space-x-1" aria-label={`Nesta tela: ${aqui.map((p) => p.nome).join(', ')}`}>
      {aqui.slice(0, 3).map((p) => <span key={p.userId} className="h-3 w-3 rounded-full border border-white" style={{ background: p.cor }} title={p.nome} />)}
    </span>
  )
}

type Ret = { x: number; y: number; width: number; height: number }

/** Cursores e seleções das outras pessoas na tela aberta (coordenadas da cena → tela pelo `paraTela` do canvas). */
export const CamadaPresenca = memo(function CamadaPresenca({ sala, cenaId, camadas, paraTela }: { sala: ConexaoSala | null; cenaId: string; camadas: Camada[]; paraTela: (r: Ret) => Ret }) {
  const s = useSala(sala)
  if (!sala) return null
  // as outras conexões (inclusive outra aba minha) nesta tela
  const aqui = s.pessoas.filter((p) => p.cenaId === cenaId)
  if (!aqui.length) return null
  const porId = new Map(camadas.map((l) => [l.id, l]))
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden data-testid="presenca-canvas">
      {aqui.map((p) => p.selecao.map((id) => {
        const l = porId.get(id)
        if (!l) return null
        const r = paraTela(l)
        return (
          <div key={`${p.id}-${id}`} data-testid="selecao-remota" className="absolute" style={{ left: r.x, top: r.y, width: r.width, height: r.height, outline: `2px solid ${p.cor}`, transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined }}>
            <span className="absolute -top-[18px] left-[-2px] whitespace-nowrap rounded-t-[3px] px-1 text-[10px] font-medium leading-[16px] text-white" style={{ background: p.cor }}>{p.nome.split(/\s+/)[0]}</span>
          </div>
        )
      }))}
      {aqui.map((p) => {
        if (!p.cursor) return null
        const c = paraTela({ x: p.cursor.x, y: p.cursor.y, width: 0, height: 0 })
        return (
          <div key={p.id} data-testid="cursor-remoto" data-nome={p.nome} className="absolute left-0 top-0 transition-transform duration-75 ease-linear" style={{ transform: `translate(${c.x}px, ${c.y}px)` }}>
            <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]"><path d="M1.5 1.5v15.2l4.3-3.9 2.9 6.2 2.6-1.2-2.8-6.1h6z" fill={p.cor} stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            <span className="absolute left-3.5 top-[17px] whitespace-nowrap rounded-[5px] px-1.5 py-[2px] text-[11px] font-medium text-white shadow-sm" style={{ background: p.cor }}>{p.nome}</span>
          </div>
        )
      })}
    </div>
  )
})
