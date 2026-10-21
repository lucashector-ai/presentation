'use client'
import { TriangleAlert } from 'lucide-react'
import { FORMATOS, type Cena, type Transicao } from '@/lib/scene/schema'
import { PALETA } from '@/lib/design-tokens'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { cx } from '@/components/ui'
import { CampoCor, CampoNum, Deslizante, Linha, Secao, SeletorLista } from './controles'

/** Propriedades da tela atual (nada selecionado). */
export function InspetorTela({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { cena, acoes, estado } = editor
  if (!cena) return null
  const set = (p: Partial<Cena>) => acoes.atualizarCena(p)
  const formato = (Object.entries(FORMATOS).find(([, s]) => s.width === cena.size.width && s.height === cena.size.height)?.[0] ?? 'personalizado') as string
  const tr: Transicao = cena.transition ?? { type: 'fade', duration: 500, easing: 'easeInOut' }
  return (
    <div>
      <div className="border-b border-borda px-4 py-4">
        <div className="rotulo-mono mb-1">Tela {String(editor.indiceCena + 1).padStart(2, '0')}</div>
        <input aria-label="Título da tela" value={cena.title} placeholder="Sem título" onChange={(e) => acoes.atualizarCena({ title: e.target.value }, false)} onBlur={() => acoes.atualizarCena({})} className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-texto3" />
      </div>
      <Secao titulo="Formato">
        <SeletorLista rotulo="Formato da tela" valor={formato} aoMudar={(v) => { const f = FORMATOS[v as keyof typeof FORMATOS]; if (f) set({ size: f }) }} opcoes={[{ id: 'slides169', rotulo: 'Slides 16:9 · 1920×1080' }, { id: 'slides43', rotulo: 'Slides 4:3 · 1600×1200' }, { id: 'story', rotulo: 'Story 9:16 · 1080×1920' }, { id: 'quadrado', rotulo: 'Quadrado · 1080×1080' }, ...(formato === 'personalizado' ? [{ id: 'personalizado', rotulo: `${cena.size.width}×${cena.size.height}` }] : [])]} />
      </Secao>
      <Secao titulo="Fundo">
        <Linha rotulo="Cor"><CampoCor rotulo="Cor de fundo" valor={cena.background} aoMudar={(background) => background && set({ background })} /></Linha>
        <div className="grid grid-cols-8 gap-1.5 pt-1">
          {PALETA.map((p) => <button key={p.id} type="button" title={p.nome} aria-label={`Fundo ${p.nome}`} onClick={() => set({ background: p.fundo })} className={cx('h-6 rounded-[5px] border border-black/10', cena.background.toLowerCase() === p.fundo.toLowerCase() && 'ring-2 ring-acento ring-offset-1')} style={{ background: p.fundo }} />)}
        </div>
        <Linha rotulo="Imagem">
          <SeletorLista rotulo="Imagem de fundo" valor={cena.backgroundAssetId ?? ''} aoMudar={(v) => set({ backgroundAssetId: v || undefined })} opcoes={[{ id: '', rotulo: 'Nenhuma' }, ...assets.filter((a) => a.tipo === 'image' || a.tipo === 'svg' || a.tipo === 'gif').map((a) => ({ id: a.id, rotulo: a.nome }))]} />
        </Linha>
        {cena.backgroundGradient ? (
          <button type="button" className="text-[12px] text-texto2 hover:underline" onClick={() => set({ backgroundGradient: undefined })}>Remover gradiente de fundo</button>
        ) : (
          <button type="button" className="text-[12px] text-acento hover:underline" onClick={() => set({ backgroundGradient: { type: 'linear', angle: 160, stops: [{ color: cena.background, pos: 0 }, { color: '#171717', pos: 100 }] } })}>+ Gradiente de fundo</button>
        )}
      </Secao>
      <Secao titulo="Transição de entrada">
        <SeletorLista rotulo="Transição da tela" valor={tr.type} aoMudar={(type) => set({ transition: { ...tr, type: type as Transicao['type'] } })} opcoes={[{ id: 'none', rotulo: 'Instantânea' }, { id: 'fade', rotulo: 'Fade' }, { id: 'slide', rotulo: 'Slide' }, { id: 'scale', rotulo: 'Scale' }, { id: 'morph', rotulo: 'Morph (Magic Move)' }]} />
        <Linha rotulo="Duração"><Deslizante rotulo="Duração da transição" valor={tr.duration} min={100} max={2000} passo={50} aoMudar={(duration) => set({ transition: { ...tr, duration } })} formatar={(v) => `${v}ms`} /></Linha>
        {estado.documento.mode === 'slides' && <Linha rotulo="Avançar sozinha"><CampoNum rotulo="Avançar automaticamente após (segundos, 0 = manual)" valor={cena.autoAdvance / 1000} min={0} max={600} sufixo="s" aoMudar={(v) => set({ autoAdvance: Math.round(v * 1000) })} /></Linha>}
      </Secao>
      {estado.documento.mode === 'explorar' && (
        <Secao titulo="Posição no mapa">
          <div className="grid grid-cols-2 gap-2">
            <CampoNum prefixo="X" rotulo="Mapa X" valor={cena.map?.x ?? 0} aoMudar={(x) => set({ map: { x, y: cena.map?.y ?? 0 } })} />
            <CampoNum prefixo="Y" rotulo="Mapa Y" valor={cena.map?.y ?? 0} aoMudar={(y) => set({ map: { x: cena.map?.x ?? 0, y } })} />
          </div>
        </Secao>
      )}
      <Secao titulo="Notas do apresentador">
        <textarea aria-label="Notas do apresentador" rows={6} value={cena.notes} placeholder="O que falar nesta tela. Só você vê, na visão do apresentador." onChange={(e) => acoes.atualizarCena({ notes: e.target.value }, false)} onBlur={() => acoes.atualizarCena({})} className="w-full resize-y rounded-md bg-superficie2 px-2.5 py-2 text-[13px] leading-relaxed outline-none placeholder:text-texto3 focus:ring-1 focus:ring-acento" />
      </Secao>
      <Problemas editor={editor} />
    </div>
  )
}

export function Problemas({ editor }: { editor: Editor }) {
  const { validacao, acoes, estado } = editor
  const lista = [...validacao.erros, ...validacao.avisos]
  if (!lista.length) return <Secao titulo="Verificação"><p className="text-[12px] text-sucesso">Tudo certo para publicar.</p></Secao>
  return (
    <Secao titulo={`Verificação · ${validacao.erros.length} erro(s), ${validacao.avisos.length} aviso(s)`}>
      <ul className="space-y-0.5">
        {lista.slice(0, 30).map((p, i) => (
          <li key={i}>
            <button type="button" onClick={() => { if (p.sceneId && p.sceneId !== estado.cenaId) acoes.irParaCena(p.sceneId); if (p.layerId) setTimeout(() => acoes.selecionarExato([p.layerId!]), 0) }} className={cx('flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-hover', p.gravidade === 'erro' ? 'text-perigo' : 'text-texto2')}>
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {p.mensagem}
            </button>
          </li>
        ))}
      </ul>
    </Secao>
  )
}
