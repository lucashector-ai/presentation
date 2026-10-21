'use client'
/**
 * Efeitos (como no Figma): lista com "+" — Sombra projetada, Desfoque da camada, Desfoque do fundo.
 * Cada linha: [ajustes] [tipo ▾] [valor] [−]. A sombra abre os detalhes (predefinição, X, Y, desfoque, expansão, cor).
 */
import { useState } from 'react'
import { Minus } from 'lucide-react'
import type { Camada, Efeitos, Sombra } from '@/lib/scene/schema'
import { BotaoMini, CampoCor, CampoNum, Secao, SeletorLista } from './controles'
import { IconeAjustes, IconeDesfoque, IconeSombra, IconeVidro } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { MISTO } from './campos'

export const SOMBRAS: Record<string, Sombra | undefined> = {
  suave: { x: 0, y: 8, blur: 24, spread: -8, color: '#0000002E' },
  media: { x: 0, y: 20, blur: 50, spread: -16, color: '#00000059' },
  forte: { x: 0, y: 32, blur: 80, spread: -12, color: '#00000080' },
  carimbo: { x: 12, y: 12, blur: 0, spread: 0, color: '#171717FF' },
}
const NOMES_SOMBRA: Record<string, string> = { suave: 'Suave', media: 'Média', forte: 'Forte', carimbo: 'Carimbo', personalizada: 'Personalizada' }

function nomeSombra(s: Sombra): string {
  const achada = Object.entries(SOMBRAS).find(([, v]) => v && v.x === s.x && v.y === s.y && v.blur === s.blur && v.spread === s.spread && v.color.toUpperCase() === s.color.toUpperCase())
  return achada?.[0] ?? 'personalizada'
}

type TipoEfeito = 'sombra' | 'desfoque' | 'vidro'
const TIPOS_EFEITO: { id: TipoEfeito; rotulo: string }[] = [{ id: 'sombra', rotulo: 'Sombra projetada' }, { id: 'desfoque', rotulo: 'Desfoque' }, { id: 'vidro', rotulo: 'Vidro (fundo)' }]
const BASE: Efeitos = { blur: 0, backdropBlur: 0, blend: 'normal' }
const temEfeito = (e: Efeitos | undefined, t: TipoEfeito) => (t === 'sombra' ? !!e?.shadow : t === 'desfoque' ? !!e?.blur : !!e?.backdropBlur)

/** Liga/desliga um tipo de efeito, preservando os outros. */
function comEfeito(e: Efeitos | undefined, t: TipoEfeito, ligar: boolean, valor?: number): Efeitos {
  const b = { ...BASE, ...e }
  if (t === 'sombra') return { ...b, shadow: ligar ? (b.shadow ?? SOMBRAS.media) : undefined }
  if (t === 'desfoque') return { ...b, blur: ligar ? (valor ?? (b.blur || 8)) : 0 }
  return { ...b, backdropBlur: ligar ? (valor ?? (b.backdropBlur || 16)) : 0 }
}

export function SecaoEfeitos({ editor }: PropsSecao) {
  const { sel, setFn } = useCamadas(editor)
  const [aberto, setAberto] = useState<TipoEfeito | null>(null)
  const l = sel[0]
  if (!l || sel.every((c) => c.type === 'hotspot')) return null
  const misto = comum(sel, (c) => c.effects ?? null) === MISTO
  const e = l.effects
  const presentes = TIPOS_EFEITO.filter((t) => temEfeito(e, t.id)).map((t) => t.id)
  const faltando = TIPOS_EFEITO.filter((t) => !presentes.includes(t.id)).map((t) => t.id)
  const ef = (fn: (e: Efeitos | undefined, c: Camada) => Efeitos) => setFn((c) => ({ ...c, effects: fn(c.effects, c) }))
  const adicionar = () => {
    const t = faltando[0]
    if (!t) return
    ef((x) => comEfeito(x, t, true))
    if (t === 'sombra') setAberto('sombra')
  }
  const trocar = (de: TipoEfeito, para: TipoEfeito) => {
    if (de === para) return
    const v = de === 'desfoque' ? e?.blur : de === 'vidro' ? e?.backdropBlur : undefined
    ef((x) => comEfeito(comEfeito(x, de, false), para, true, para !== 'sombra' ? v || undefined : undefined))
    if (para === 'sombra') setAberto('sombra')
  }
  return (
    <Secao titulo="Efeitos" vazia={!presentes.length} aoAdicionar={faltando.length ? adicionar : undefined} rotuloAdicionar="Adicionar efeito">
      {misto && <p className="text-[11px] text-texto2">Efeitos diferentes na seleção — editar aplica a todos.</p>}
      {presentes.map((t) => {
        const Icone = t === 'sombra' ? IconeSombra : t === 'desfoque' ? IconeDesfoque : IconeVidro
        const opcoes = TIPOS_EFEITO.filter((o) => o.id === t || !presentes.includes(o.id))
        return (
          <div key={t} className="space-y-2">
            <div className="flex items-center gap-1">
              {t === 'sombra' ? (
                <BotaoMini rotulo="Ajustes da sombra" ativo={aberto === 'sombra'} aria-expanded={aberto === 'sombra'} className="h-8 w-8" onClick={() => setAberto(aberto === 'sombra' ? null : 'sombra')}><IconeAjustes /></BotaoMini>
              ) : <span className="flex h-8 w-8 shrink-0 items-center justify-center text-texto3"><Icone /></span>}
              <div className="min-w-0 flex-1"><SeletorLista rotulo={`Tipo do efeito: ${TIPOS_EFEITO.find((o) => o.id === t)?.rotulo}`} valor={t} aoMudar={(v) => trocar(t, v as TipoEfeito)} opcoes={opcoes} /></div>
              {t === 'desfoque' && <CampoNum prefixo={<IconeDesfoque />} rotulo="Desfoque" valor={e?.blur ?? 0} min={0} max={100} className="w-[64px] !flex-none" aoMudar={(blur) => ef((x) => ({ ...BASE, ...x, blur }))} />}
              {t === 'vidro' && <CampoNum prefixo={<IconeVidro />} rotulo="Desfoque do fundo (vidro)" valor={e?.backdropBlur ?? 0} min={0} max={100} className="w-[64px] !flex-none" aoMudar={(backdropBlur) => ef((x) => ({ ...BASE, ...x, backdropBlur }))} />}
              <BotaoMini rotulo={`Remover ${TIPOS_EFEITO.find((o) => o.id === t)?.rotulo.toLowerCase()}`} onClick={() => { ef((x) => comEfeito(x, t, false)); if (aberto === t) setAberto(null) }}><Minus className="h-3.5 w-3.5" /></BotaoMini>
            </div>
            {t === 'sombra' && aberto === 'sombra' && e?.shadow && <DetalhesSombra sombra={e.shadow} aoMudar={(f) => ef((x) => ({ ...BASE, ...x, shadow: f(x?.shadow ?? SOMBRAS.media!) }))} />}
          </div>
        )
      })}
    </Secao>
  )
}

function DetalhesSombra({ sombra, aoMudar }: { sombra: Sombra; aoMudar: (f: (s: Sombra) => Sombra) => void }) {
  const nome = nomeSombra(sombra)
  return (
    <div className="space-y-2 rounded-lg border border-borda p-2">
      <SeletorLista rotulo="Sombra" valor={nome} aoMudar={(v) => { const p = SOMBRAS[v]; if (p) aoMudar(() => p) }} opcoes={Object.keys(NOMES_SOMBRA).filter((k) => k !== 'personalizada' || nome === 'personalizada').map((k) => ({ id: k, rotulo: NOMES_SOMBRA[k]! }))} />
      <div className="grid grid-cols-2 gap-1.5">
        <CampoNum prefixo="X" rotulo="Sombra X" valor={sombra.x} min={-200} max={200} aoMudar={(x) => aoMudar((s) => ({ ...s, x }))} />
        <CampoNum prefixo="Y" rotulo="Sombra Y" valor={sombra.y} min={-200} max={200} aoMudar={(y) => aoMudar((s) => ({ ...s, y }))} />
        <CampoNum prefixo={<IconeDesfoque />} rotulo="Desfoque da sombra" valor={sombra.blur} min={0} max={300} aoMudar={(blur) => aoMudar((s) => ({ ...s, blur }))} />
        <CampoNum prefixo={<IconeSombra />} rotulo="Expansão da sombra" valor={sombra.spread} min={-100} max={100} aoMudar={(spread) => aoMudar((s) => ({ ...s, spread }))} />
      </div>
      <CampoCor rotulo="Cor da sombra" valor={sombra.color} aoMudar={(color) => color && aoMudar((s) => ({ ...s, color }))} />
    </div>
  )
}
