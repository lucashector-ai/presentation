'use client'
/** Propriedades da tela atual (nada selecionado), no mesmo visual do painel Design. */
import { Minus, TriangleAlert, CircleCheck } from 'lucide-react'
import { FORMATOS, FORMATOS_INFO, type Cena, type Tamanho, type Transicao } from '@/lib/scene/schema'
import { converterFormato } from '@/lib/scene/restricoes'
import { TRANSICAO_PADRAO } from '@/lib/scene/morph'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { cx } from '@/components/ui'
import { BotaoMini, CampoNum, Deslizante, Linha, Secao, SeletorLista } from './controles'
import { LinhaPintura } from './CampoCor'
import type { Pintura } from './SeletorCor'
import { useHistorico } from './contexto'
import { SecaoGuiasTela } from '../guias/SecaoGuias'

/** Grupos da lista de formatos, na ordem do Mostra: apresentação, PDF/documento e redes sociais. */
const GRUPOS_FORMATO = { apresentacao: 'Apresentação', pdf: 'PDF · documento', social: 'Redes sociais' } as const
const ORDEM_GRUPO = ['apresentacao', 'pdf', 'social'] as const
const OPCOES_FORMATO = ORDEM_GRUPO.flatMap((g) =>
  (Object.keys(FORMATOS) as (keyof typeof FORMATOS)[])
    .filter((id) => FORMATOS_INFO[id].grupo === g)
    .map((id) => ({ id: id as string, grupo: GRUPOS_FORMATO[g], rotulo: `${FORMATOS_INFO[id].nome.replace(/^PDF |^Apresentação /, '')} · ${FORMATOS[id].width}×${FORMATOS[id].height}` }))
)

export function InspetorTela({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { cena, acoes, estado } = editor
  const historico = useHistorico()
  if (!cena) return null
  const set = (p: Partial<Cena>) => acoes.atualizarCena(p, historico())
  const formato = (Object.entries(FORMATOS).find(([, s]) => s.width === cena.size.width && s.height === cena.size.height)?.[0] ?? 'personalizado') as string
  const tr: Transicao = cena.transition ?? TRANSICAO_PADRAO
  const imagens = assets.filter((a) => a.tipo === 'image' || a.tipo === 'svg' || a.tipo === 'gif')
  const base: Pintura = cena.backgroundGradient ? { tipo: 'gradiente', gradiente: cena.backgroundGradient } : { tipo: 'solido', cor: cena.background }
  const aplicarBase = (p: Pintura) => {
    if (p.tipo === 'solido') set({ background: p.cor, backgroundGradient: undefined })
    else if (p.tipo === 'gradiente') set({ backgroundGradient: p.gradiente })
  }
  /** Novo tamanho: camadas com restrições acompanham a tela (as demais ficam onde estão, como antes). */
  const redimensionar = (size: Tamanho) => acoes.transformarCena((c) => ({ ...c, size, layers: c.layers.some((l) => l.constraints) ? converterFormato(c.layers, c.size, size, 'manter') : c.layers }), historico())
  const tamanho = (w: number, h: number) => redimensionar({ width: Math.round(Math.max(16, Math.min(8192, w))), height: Math.round(Math.max(16, Math.min(8192, h))) })
  return (
    <div className="pb-6">
      <div className="border-b border-borda px-3 pb-2 pt-3">
        <div className="rotulo-mono">Tela {String(editor.indiceCena + 1).padStart(2, '0')}</div>
        <input aria-label="Título da tela" value={cena.title} placeholder="Sem título" onChange={(e) => acoes.atualizarCena({ title: e.target.value }, false)} onBlur={() => acoes.atualizarCena({})} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="-mx-1 mt-0.5 h-8 w-[calc(100%+8px)] rounded-[5px] bg-transparent px-1 text-[13px] font-medium outline-none placeholder:text-texto3 hover:bg-hover/60 focus:bg-superficie2" />
      </div>

      <Secao titulo="Formato">
        <SeletorLista rotulo="Formato da tela" valor={formato} aoMudar={(v) => { const f = FORMATOS[v as keyof typeof FORMATOS]; if (f) redimensionar({ ...f }) }} opcoes={[...OPCOES_FORMATO, ...(formato === 'personalizado' ? [{ id: 'personalizado', grupo: 'Personalizado', rotulo: `Personalizado · ${cena.size.width}×${cena.size.height}` }] : [])]} />
        <div className="grid grid-cols-2 gap-1">
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

      <SecaoGuiasTela editor={editor} />

      <Secao titulo="Transição de entrada">
        <SeletorLista rotulo="Transição da tela" valor={tr.type} aoMudar={(type) => set({ transition: { ...tr, type: type as Transicao['type'] } })} opcoes={[{ id: 'auto', rotulo: 'Automática (mesmo objeto anda)' }, { id: 'none', rotulo: 'Instantânea' }, { id: 'fade', rotulo: 'Fade' }, { id: 'slide', rotulo: 'Slide' }, { id: 'scale', rotulo: 'Scale' }, { id: 'morph', rotulo: 'Morph (Magic Move)' }, { id: 'push', rotulo: 'Empurrar' }]} />
        {tr.type !== 'none' && <Linha rotulo="Duração"><Deslizante rotulo="Duração da transição" valor={tr.duration} min={100} max={2000} passo={50} aoMudar={(duration) => set({ transition: { ...tr, duration } })} formatar={(v) => `${v}ms`} /></Linha>}
        {estado.documento.mode === 'slides' && (
          <Linha rotulo="Auto-avanço">
            <span className="w-[96px]"><CampoNum rotulo="Avançar automaticamente após (segundos, 0 = manual)" valor={cena.autoAdvance / 1000} min={0} max={600} casas={1} sufixo="s" aoMudar={(v) => set({ autoAdvance: Math.round(v * 1000) })} /></span>
          </Linha>
        )}
      </Secao>

      {estado.documento.mode === 'explorar' && (
        <Secao titulo="Posição no mapa">
          <div className="grid grid-cols-2 gap-1">
            <CampoNum prefixo="X" rotulo="Mapa X" valor={cena.map?.x ?? 0} aoMudar={(x) => set({ map: { x, y: cena.map?.y ?? 0 } })} />
            <CampoNum prefixo="Y" rotulo="Mapa Y" valor={cena.map?.y ?? 0} aoMudar={(y) => set({ map: { x: cena.map?.x ?? 0, y } })} />
          </div>
          <button type="button" onClick={() => window.dispatchEvent(new Event('mostra:abrir-mapa'))} className="h-6 w-full rounded-md bg-superficie2 text-[11px] font-medium text-texto transition-colors hover:bg-hover">Abrir mapa das telas</button>
        </Secao>
      )}

      <Secao titulo="Notas do apresentador">
        <textarea aria-label="Notas do apresentador" rows={5} value={cena.notes} placeholder="O que falar nesta tela. Só você vê, na visão do apresentador." onChange={(e) => acoes.atualizarCena({ notes: e.target.value }, false)} onBlur={() => acoes.atualizarCena({})} className="block w-full resize-y rounded-md bg-superficie2 px-2 py-1.5 text-[11px] leading-relaxed outline-none ring-inset placeholder:text-texto3 hover:ring-1 hover:ring-bordaForte focus:!ring-1 focus:!ring-acento" />
      </Secao>
      <Problemas editor={editor} />
    </div>
  )
}

export function Problemas({ editor }: { editor: Editor }) {
  const { validacao, acoes, estado } = editor
  const lista = [...validacao.erros, ...validacao.avisos]
  if (!lista.length) return <Secao titulo="Verificação"><p className="flex items-center gap-1.5 text-[11px] text-sucesso"><CircleCheck className="h-3.5 w-3.5" /> Tudo certo para publicar.</p></Secao>
  return (
    <Secao titulo="Verificação" acao={<span className={cx('rounded-full px-1.5 py-0.5 text-[11px] tabular-nums', validacao.erros.length ? 'bg-perigo/10 text-perigo' : 'bg-aviso/20 text-texto2')}>{validacao.erros.length ? `${validacao.erros.length} erro(s)` : `${validacao.avisos.length} aviso(s)`}</span>}>
      <ul className="-mx-1.5 space-y-0.5">
        {lista.slice(0, 30).map((p, i) => (
          <li key={i}>
            <button type="button" onClick={() => { if (p.sceneId && p.sceneId !== estado.cenaId) acoes.irParaCena(p.sceneId); if (p.layerId) setTimeout(() => acoes.selecionarExato([p.layerId!]), 0) }} className={cx('flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-hover', p.gravidade === 'erro' ? 'text-perigo' : 'text-texto2')}>
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {p.mensagem}
            </button>
          </li>
        ))}
      </ul>
    </Secao>
  )
}
