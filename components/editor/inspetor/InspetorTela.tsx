'use client'
/** Propriedades da tela atual (nada selecionado), no mesmo visual do painel Design. */
import { Minus, TriangleAlert, CircleCheck } from 'lucide-react'
import { FORMATOS, type Cena, type Transicao } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { cx } from '@/components/ui'
import { BotaoMini, CampoNum, Deslizante, Linha, Secao, SeletorLista } from './controles'
import { LinhaPintura } from './CampoCor'
import type { Pintura } from './SeletorCor'
import { useHistorico } from './contexto'

const NOMES_FORMATO: Record<string, string> = { slides169: 'Slides 16:9', slides43: 'Slides 4:3', story: 'Story 9:16', quadrado: 'Quadrado 1:1' }

export function InspetorTela({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { cena, acoes, estado } = editor
  const historico = useHistorico()
  if (!cena) return null
  const set = (p: Partial<Cena>) => acoes.atualizarCena(p, historico())
  const formato = (Object.entries(FORMATOS).find(([, s]) => s.width === cena.size.width && s.height === cena.size.height)?.[0] ?? 'personalizado') as string
  const tr: Transicao = cena.transition ?? { type: 'fade', duration: 500, easing: 'easeInOut' }
  const imagens = assets.filter((a) => a.tipo === 'image' || a.tipo === 'svg' || a.tipo === 'gif')
  const base: Pintura = cena.backgroundGradient ? { tipo: 'gradiente', gradiente: cena.backgroundGradient } : { tipo: 'solido', cor: cena.background }
  const aplicarBase = (p: Pintura) => {
    if (p.tipo === 'solido') set({ background: p.cor, backgroundGradient: undefined })
    else if (p.tipo === 'gradiente') set({ backgroundGradient: p.gradiente })
  }
  const tamanho = (w: number, h: number) => set({ size: { width: Math.round(Math.max(16, Math.min(8192, w))), height: Math.round(Math.max(16, Math.min(8192, h))) } })
  return (
    <div className="pb-6">
      <div className="border-b border-borda px-3 pb-2 pt-3">
        <div className="rotulo-mono">Tela {String(editor.indiceCena + 1).padStart(2, '0')}</div>
        <input aria-label="Título da tela" value={cena.title} placeholder="Sem título" onChange={(e) => acoes.atualizarCena({ title: e.target.value }, false)} onBlur={() => acoes.atualizarCena({})} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="-mx-1 mt-0.5 h-8 w-[calc(100%+8px)] rounded-[5px] bg-transparent px-1 text-[14px] font-medium outline-none placeholder:text-texto3 hover:bg-hover/60 focus:bg-superficie2" />
      </div>

      <Secao titulo="Formato">
        <SeletorLista rotulo="Formato da tela" valor={formato} aoMudar={(v) => { const f = FORMATOS[v as keyof typeof FORMATOS]; if (f) set({ size: f }) }} opcoes={[...Object.entries(FORMATOS).map(([id, s]) => ({ id, rotulo: `${NOMES_FORMATO[id]} · ${s.width}×${s.height}` })), ...(formato === 'personalizado' ? [{ id: 'personalizado', rotulo: `Personalizado · ${cena.size.width}×${cena.size.height}` }] : [])]} />
        <div className="grid grid-cols-[1fr_1fr_32px] gap-2">
          <CampoNum prefixo="W" rotulo="Largura da tela" valor={cena.size.width} min={16} max={8192} aoMudar={(w) => tamanho(w, cena.size.height)} />
          <CampoNum prefixo="H" rotulo="Altura da tela" valor={cena.size.height} min={16} max={8192} aoMudar={(h) => tamanho(cena.size.width, h)} />
        </div>
      </Secao>

      <Secao titulo="Preenchimento" aoAdicionar={!cena.backgroundAssetId && imagens[0] ? () => set({ backgroundAssetId: imagens[0]!.id }) : undefined} rotuloAdicionar="Adicionar imagem de fundo">
        {cena.backgroundAssetId && (
          <LinhaPintura
            rotulo="Imagem de fundo"
            valor={{ tipo: 'imagem', assetId: cena.backgroundAssetId, encaixe: cena.backgroundFit }}
            tipos={['imagem']}
            aoMudar={(p) => p.tipo === 'imagem' && set({ backgroundAssetId: p.assetId, backgroundFit: p.encaixe ?? 'cover' })}
            acoes={<BotaoMini rotulo="Remover imagem de fundo" onClick={() => set({ backgroundAssetId: undefined })}><Minus className="h-3.5 w-3.5" /></BotaoMini>}
          />
        )}
        <LinhaPintura
          rotulo="Cor de fundo"
          valor={base}
          tipos={['solido', 'linear', 'radial']}
          aoMudar={aplicarBase}
          acoes={cena.backgroundGradient ? <BotaoMini rotulo="Remover gradiente de fundo" onClick={() => set({ backgroundGradient: undefined })}><Minus className="h-3.5 w-3.5" /></BotaoMini> : <span className="w-6" aria-hidden />}
        />
      </Secao>

      <Secao titulo="Transição de entrada">
        <SeletorLista rotulo="Transição da tela" valor={tr.type} aoMudar={(type) => set({ transition: { ...tr, type: type as Transicao['type'] } })} opcoes={[{ id: 'none', rotulo: 'Instantânea' }, { id: 'fade', rotulo: 'Fade' }, { id: 'slide', rotulo: 'Slide' }, { id: 'scale', rotulo: 'Scale' }, { id: 'morph', rotulo: 'Morph (Magic Move)' }]} />
        {tr.type !== 'none' && <Linha rotulo="Duração"><Deslizante rotulo="Duração da transição" valor={tr.duration} min={100} max={2000} passo={50} aoMudar={(duration) => set({ transition: { ...tr, duration } })} formatar={(v) => `${v}ms`} /></Linha>}
        {estado.documento.mode === 'slides' && (
          <Linha rotulo="Auto-avanço">
            <span className="w-[96px]"><CampoNum rotulo="Avançar automaticamente após (segundos, 0 = manual)" valor={cena.autoAdvance / 1000} min={0} max={600} casas={1} sufixo="s" aoMudar={(v) => set({ autoAdvance: Math.round(v * 1000) })} /></span>
          </Linha>
        )}
      </Secao>

      {estado.documento.mode === 'explorar' && (
        <Secao titulo="Posição no mapa">
          <div className="grid grid-cols-[1fr_1fr_32px] gap-2">
            <CampoNum prefixo="X" rotulo="Mapa X" valor={cena.map?.x ?? 0} aoMudar={(x) => set({ map: { x, y: cena.map?.y ?? 0 } })} />
            <CampoNum prefixo="Y" rotulo="Mapa Y" valor={cena.map?.y ?? 0} aoMudar={(y) => set({ map: { x: cena.map?.x ?? 0, y } })} />
          </div>
        </Secao>
      )}

      <Secao titulo="Notas do apresentador">
        <textarea aria-label="Notas do apresentador" rows={5} value={cena.notes} placeholder="O que falar nesta tela. Só você vê, na visão do apresentador." onChange={(e) => acoes.atualizarCena({ notes: e.target.value }, false)} onBlur={() => acoes.atualizarCena({})} className="block w-full resize-y rounded-md bg-superficie2 px-2 py-1.5 text-[12px] leading-relaxed outline-none ring-inset placeholder:text-texto3 hover:ring-1 hover:ring-bordaForte focus:!ring-1 focus:!ring-acento" />
      </Secao>
      <Problemas editor={editor} />
    </div>
  )
}

export function Problemas({ editor }: { editor: Editor }) {
  const { validacao, acoes, estado } = editor
  const lista = [...validacao.erros, ...validacao.avisos]
  if (!lista.length) return <Secao titulo="Verificação"><p className="flex items-center gap-1.5 text-[12px] text-sucesso"><CircleCheck className="h-3.5 w-3.5" /> Tudo certo para publicar.</p></Secao>
  return (
    <Secao titulo="Verificação" acao={<span className={cx('rounded-full px-1.5 py-0.5 text-[11px] tabular-nums', validacao.erros.length ? 'bg-perigo/10 text-perigo' : 'bg-aviso/20 text-texto2')}>{validacao.erros.length ? `${validacao.erros.length} erro(s)` : `${validacao.avisos.length} aviso(s)`}</span>}>
      <ul className="-mx-1.5 space-y-0.5">
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
