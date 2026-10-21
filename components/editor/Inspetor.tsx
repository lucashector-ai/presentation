'use client'
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Copy, Eye, EyeOff, Lock, LockOpen, Trash2, TriangleAlert } from 'lucide-react'
import { ACOES_POR_TRIGGER, EASINGS, FORMATOS, TIPOS_ANIMACAO, TRIGGERS, type Acao, type Animacao, type Camada, type Interacao, type Trigger } from '@/lib/scene/schema'
import { FONTES_APRESENTACAO } from '@/lib/design-tokens'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { Alternador, AreaTexto, BotaoIcone, CampoInspetor, Entrada, EntradaNumero, Selecao, Selo, cx } from '@/components/ui'

const NOMES_TRIGGER: Record<Trigger, string> = { click: 'Ao clicar / tocar', sceneEnter: 'Ao entrar na cena', hover: 'Ao passar o mouse', scrollThreshold: 'Ao rolar até aqui' }
const NOMES_ACAO: Record<Acao['action'], string> = { nextScene: 'Próxima cena', prevScene: 'Cena anterior', goToScene: 'Ir para cena', openLink: 'Abrir link', toggleLayer: 'Mostrar / ocultar camada', toggleVideo: 'Tocar / pausar vídeo', animate: 'Animar camada' }
const NOMES_ANIM: Record<Animacao['type'], string> = { none: 'Nenhuma', fadeIn: 'Aparecer', fadeOut: 'Desaparecer', slideUp: 'Deslizar para cima', slideDown: 'Deslizar para baixo', slideLeft: 'Deslizar para a esquerda', slideRight: 'Deslizar para a direita', scaleIn: 'Crescer', scaleOut: 'Encolher', reveal: 'Revelar' }
const NOMES_EASING: Record<Animacao['easing'], string> = { linear: 'Linear', ease: 'Suave', easeIn: 'Acelerar', easeOut: 'Desacelerar', easeInOut: 'Acelerar e desacelerar' }

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-3 py-3">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-texto2">{titulo}</h3>
      {children}
    </section>
  )
}

export function Inspetor({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { cena, camadasSelecionadas, acoes, estado, validacao } = editor
  if (!cena) return null
  if (camadasSelecionadas.length === 0) return <InspetorCena editor={editor} assets={assets} />
  const ids = camadasSelecionadas.map((l) => l.id)
  const l = camadasSelecionadas[0]!
  const multi = camadasSelecionadas.length > 1
  const set = (patch: Partial<Camada>) => acoes.atualizarCamadas(ids, patch)

  return (
    <aside aria-label="Propriedades" className="rolagem-fina flex h-full w-full flex-col overflow-y-auto border-l bg-superficie text-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        {multi ? <span className="text-xs text-texto2">{camadasSelecionadas.length} camadas</span> : <Entrada aria-label="Nome da camada" value={l.name ?? ''} placeholder={rotuloTipo(l)} onChange={(e) => set({ name: e.target.value })} className="h-8 text-xs" />}
        <div className="flex shrink-0">
          <BotaoIcone rotulo={l.locked ? 'Destravar' : 'Travar'} onClick={() => set({ locked: !l.locked })}>{l.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}</BotaoIcone>
          <BotaoIcone rotulo={l.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => set({ hidden: !l.hidden })}>{l.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</BotaoIcone>
          <BotaoIcone rotulo="Duplicar" onClick={() => acoes.duplicarCamadas(ids)}><Copy className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Apagar" onClick={() => acoes.removerCamadas(ids)}><Trash2 className="h-4 w-4" /></BotaoIcone>
        </div>
      </div>

      <Secao titulo="Layout">
        <div className="grid grid-cols-2 gap-x-2">
          <CampoInspetor rotulo="X"><EntradaNumero rotulo="Posição X" value={l.x} onChange={(x) => set({ x })} /></CampoInspetor>
          <CampoInspetor rotulo="Y"><EntradaNumero rotulo="Posição Y" value={l.y} onChange={(y) => set({ y })} /></CampoInspetor>
          <CampoInspetor rotulo="Largura"><EntradaNumero rotulo="Largura" value={l.width} min={8} onChange={(width) => set({ width })} /></CampoInspetor>
          <CampoInspetor rotulo="Altura"><EntradaNumero rotulo="Altura" value={l.height} min={8} onChange={(height) => set({ height })} /></CampoInspetor>
          <CampoInspetor rotulo="Rotação"><EntradaNumero rotulo="Rotação" value={l.rotation} min={-360} max={360} sufixo="°" onChange={(rotation) => set({ rotation })} /></CampoInspetor>
          <CampoInspetor rotulo="Opacidade"><EntradaNumero rotulo="Opacidade" value={Math.round(l.opacity * 100)} min={0} max={100} sufixo="%" onChange={(v) => set({ opacity: Math.max(0, Math.min(1, v / 100)) })} /></CampoInspetor>
        </div>
        <div className="mt-2 flex flex-wrap gap-0.5">
          <BotaoIcone rotulo="Alinhar à esquerda" className="h-8 w-8" onClick={() => acoes.alinhar(ids, 'esquerda')}><AlignStartVertical className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Centralizar horizontalmente" className="h-8 w-8" onClick={() => acoes.alinhar(ids, 'centroH')}><AlignCenterVertical className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Alinhar à direita" className="h-8 w-8" onClick={() => acoes.alinhar(ids, 'direita')}><AlignEndVertical className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Alinhar ao topo" className="h-8 w-8" onClick={() => acoes.alinhar(ids, 'topo')}><AlignStartHorizontal className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Centralizar verticalmente" className="h-8 w-8" onClick={() => acoes.alinhar(ids, 'centroV')}><AlignCenterHorizontal className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Alinhar à base" className="h-8 w-8" onClick={() => acoes.alinhar(ids, 'base')}><AlignEndHorizontal className="h-4 w-4" /></BotaoIcone>
          {!multi && (
            <>
              <span className="mx-1 w-px bg-borda" />
              <BotaoIcone rotulo="Trazer para frente" className="h-8 w-8" onClick={() => acoes.ordem(l.id, 'frente')}><ArrowUpToLine className="h-4 w-4" /></BotaoIcone>
              <BotaoIcone rotulo="Avançar" className="h-8 w-8" onClick={() => acoes.ordem(l.id, 'avancar')}><ArrowUp className="h-4 w-4" /></BotaoIcone>
              <BotaoIcone rotulo="Recuar" className="h-8 w-8" onClick={() => acoes.ordem(l.id, 'recuar')}><ArrowDown className="h-4 w-4" /></BotaoIcone>
              <BotaoIcone rotulo="Enviar para trás" className="h-8 w-8" onClick={() => acoes.ordem(l.id, 'tras')}><ArrowDownToLine className="h-4 w-4" /></BotaoIcone>
            </>
          )}
        </div>
      </Secao>

      {!multi && <PropriedadesDoTipo camada={l} set={set} assets={assets} />}

      {!multi && (
        <Secao titulo="Ações e triggers">
          <EditorInteracao camada={l} editor={editor} onChange={(interaction) => acoes.atualizarCamadas([l.id], (c) => { const { interaction: _, ...resto } = c; return (interaction ? { ...resto, interaction } : resto) as Camada })} />
        </Secao>
      )}

      {!multi && (
        <Secao titulo="Animação de entrada">
          <EditorAnimacao valor={l.enterAnimation} onChange={(enterAnimation) => acoes.atualizarCamadas([l.id], (c) => { const { enterAnimation: _, ...resto } = c; return (enterAnimation ? { ...resto, enterAnimation } : resto) as Camada })} />
        </Secao>
      )}

      {!multi && (l.type === 'image' || l.type === 'video' || true) && (
        <Secao titulo="Responsividade">
          <CampoInspetor rotulo="Ocultar no celular"><Alternador rotulo="Ocultar no celular" ativo={!!l.mobile?.hidden} onChange={(v) => set({ mobile: { ...l.mobile, hidden: v } })} /></CampoInspetor>
          {(l.type === 'image' || l.type === 'video') && (
            <CampoInspetor rotulo="Enquadrar no celular">
              <Selecao className="h-8 text-xs" value={l.mobile?.fit ?? ''} onChange={(e) => set({ mobile: { ...l.mobile, fit: (e.target.value || undefined) as 'contain' | 'cover' | undefined } })}>
                <option value="">Igual ao desktop</option>
                <option value="contain">Conter</option>
                <option value="cover">Cobrir</option>
              </Selecao>
            </CampoInspetor>
          )}
          <p className="mt-1 text-[11px] text-texto2">O visualizador escala a cena proporcionalmente. Layouts diferentes por tela chegam na Fase 2.</p>
        </Secao>
      )}

      {!multi && l.type !== 'hotspot' && (
        <Secao titulo="Acessibilidade">
          <Entrada aria-label="Descrição para leitores de tela" placeholder="Descrição para leitores de tela" value={l.ariaLabel ?? ''} onChange={(e) => set({ ariaLabel: e.target.value || undefined })} className="h-8 text-xs" />
          {l.interaction && !l.ariaLabel && l.type !== 'text' && <p className="mt-1 flex items-center gap-1 text-[11px] text-perigo"><TriangleAlert className="h-3 w-3" /> Elemento clicável precisa de descrição.</p>}
        </Secao>
      )}
      {validacao && <Problemas editor={editor} apenasCamada={l.id} />}
      <span className="sr-only">{estado.salvamento}</span>
    </aside>
  )
}

function rotuloTipo(l: Camada) {
  return { image: 'Imagem', video: 'Vídeo', text: 'Texto', shape: 'Forma', hotspot: 'Hotspot' }[l.type]
}

function PropriedadesDoTipo({ camada: l, set, assets }: { camada: Camada; set: (p: Partial<Camada>) => void; assets: AssetDemo[] }) {
  switch (l.type) {
    case 'text':
      return (
        <Secao titulo="Texto">
          <AreaTexto aria-label="Conteúdo do texto" rows={3} value={l.text} onChange={(e) => set({ text: e.target.value } as Partial<Camada>)} className="mb-2 text-xs" />
          <CampoInspetor rotulo="Fonte">
            <Selecao className="h-8 text-xs" value={l.fontFamily} onChange={(e) => set({ fontFamily: e.target.value } as Partial<Camada>)}>
              {FONTES_APRESENTACAO.map((f) => <option key={f} value={f}>{f}</option>)}
            </Selecao>
          </CampoInspetor>
          <div className="grid grid-cols-2 gap-x-2">
            <CampoInspetor rotulo="Tamanho"><EntradaNumero rotulo="Tamanho da fonte" value={l.fontSize} min={6} max={600} onChange={(fontSize) => set({ fontSize } as Partial<Camada>)} /></CampoInspetor>
            <CampoInspetor rotulo="Peso"><EntradaNumero rotulo="Peso da fonte" value={l.fontWeight} min={100} max={900} step={100} onChange={(fontWeight) => set({ fontWeight } as Partial<Camada>)} /></CampoInspetor>
            <CampoInspetor rotulo="Entrelinha"><EntradaNumero rotulo="Entrelinha" value={l.lineHeight} min={0.6} max={3} step={0.05} onChange={(lineHeight) => set({ lineHeight } as Partial<Camada>)} /></CampoInspetor>
            <CampoInspetor rotulo="Espaçamento"><EntradaNumero rotulo="Espaçamento entre letras" value={l.letterSpacing} min={-10} max={50} step={0.5} onChange={(letterSpacing) => set({ letterSpacing } as Partial<Camada>)} /></CampoInspetor>
          </div>
          <CampoInspetor rotulo="Cor"><Cor valor={l.color} onChange={(color) => set({ color } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Alinhar">
            <Selecao className="h-8 text-xs" value={l.align} onChange={(e) => set({ align: e.target.value } as Partial<Camada>)}>
              <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
            </Selecao>
          </CampoInspetor>
        </Secao>
      )
    case 'image':
      return (
        <Secao titulo="Imagem">
          <CampoInspetor rotulo="Mídia"><SeletorAsset valor={l.assetId} assets={assets.filter((a) => a.tipo !== 'video')} onChange={(assetId) => set({ assetId } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Enquadrar"><Selecao className="h-8 text-xs" value={l.fit} onChange={(e) => set({ fit: e.target.value } as Partial<Camada>)}><option value="contain">Conter</option><option value="cover">Cobrir (corta)</option></Selecao></CampoInspetor>
          <CampoInspetor rotulo="Cantos"><EntradaNumero rotulo="Raio dos cantos" value={l.radius} min={0} onChange={(radius) => set({ radius } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Sombra"><Alternador rotulo="Sombra leve" ativo={l.shadow} onChange={(shadow) => set({ shadow } as Partial<Camada>)} /></CampoInspetor>
        </Secao>
      )
    case 'video':
      return (
        <Secao titulo="Vídeo">
          <CampoInspetor rotulo="Mídia"><SeletorAsset valor={l.assetId} assets={assets.filter((a) => a.tipo === 'video')} onChange={(assetId) => set({ assetId } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Enquadrar"><Selecao className="h-8 text-xs" value={l.fit} onChange={(e) => set({ fit: e.target.value } as Partial<Camada>)}><option value="contain">Conter</option><option value="cover">Cobrir</option></Selecao></CampoInspetor>
          <CampoInspetor rotulo="Autoplay"><Alternador rotulo="Reproduzir automaticamente (mudo)" ativo={l.autoplay} onChange={(autoplay) => set({ autoplay, muted: autoplay ? true : l.muted } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Repetir"><Alternador rotulo="Repetir" ativo={l.loop} onChange={(loop) => set({ loop } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Mudo"><Alternador rotulo="Mudo" ativo={l.muted} onChange={(muted) => set({ muted } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Controles"><Alternador rotulo="Mostrar controles" ativo={l.controls} onChange={(controls) => set({ controls } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Cantos"><EntradaNumero rotulo="Raio dos cantos" value={l.radius} min={0} onChange={(radius) => set({ radius } as Partial<Camada>)} /></CampoInspetor>
        </Secao>
      )
    case 'shape':
      return (
        <Secao titulo="Forma">
          <CampoInspetor rotulo="Tipo"><Selecao className="h-8 text-xs" value={l.shape} onChange={(e) => set({ shape: e.target.value } as Partial<Camada>)}><option value="rect">Retângulo</option><option value="ellipse">Elipse</option></Selecao></CampoInspetor>
          <CampoInspetor rotulo="Preenchimento"><Cor valor={l.fill} onChange={(fill) => set({ fill } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Contorno"><Cor valor={l.stroke ?? '#000000'} onChange={(stroke) => set({ stroke } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Espessura"><EntradaNumero rotulo="Espessura do contorno" value={l.strokeWidth} min={0} max={100} onChange={(strokeWidth) => set({ strokeWidth } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Cantos"><EntradaNumero rotulo="Raio dos cantos" value={l.radius} min={0} onChange={(radius) => set({ radius } as Partial<Camada>)} /></CampoInspetor>
          <CampoInspetor rotulo="Sombra"><Alternador rotulo="Sombra leve" ativo={l.shadow} onChange={(shadow) => set({ shadow } as Partial<Camada>)} /></CampoInspetor>
        </Secao>
      )
    case 'hotspot':
      return (
        <Secao titulo="Hotspot">
          <Entrada aria-label="Descrição para leitores de tela" placeholder="Ex.: Ver aplicações da marca" value={l.ariaLabel} onChange={(e) => set({ ariaLabel: e.target.value } as Partial<Camada>)} className="mb-2 h-8 text-xs" />
          <CampoInspetor rotulo="Dica visual"><Alternador rotulo="Mostrar contorno ao passar o mouse" ativo={l.hint} onChange={(hint) => set({ hint } as Partial<Camada>)} /></CampoInspetor>
          <p className="mt-1 text-[11px] text-texto2">Invisível na apresentação. Configure a ação abaixo.</p>
        </Secao>
      )
  }
}

function Cor({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const hex6 = valor.length === 9 ? valor.slice(0, 7) : valor.length === 4 ? `#${valor[1]}${valor[1]}${valor[2]}${valor[2]}${valor[3]}${valor[3]}` : valor
  return (
    <span className="flex w-full items-center gap-1">
      <input type="color" aria-label="Escolher cor" value={hex6} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 cursor-pointer rounded-lg border bg-transparent p-0.5" />
      <Entrada aria-label="Cor em hexadecimal" value={valor} onChange={(e) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(e.target.value) && onChange(e.target.value)} className="h-8 text-xs" />
    </span>
  )
}

function SeletorAsset({ valor, assets, onChange }: { valor: string; assets: AssetDemo[]; onChange: (id: string) => void }) {
  return (
    <Selecao aria-label="Escolher mídia" className="h-8 text-xs" value={valor} onChange={(e) => onChange(e.target.value)}>
      {!assets.some((a) => a.id === valor) && <option value={valor}>(mídia removida)</option>}
      {assets.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
    </Selecao>
  )
}

// ---------- Interação ----------

function acaoPadrao(action: Acao['action'], editor: Editor, camadaId: string): Acao {
  const outraCena = editor.estado.documento.scenes.find((s) => s.id !== editor.estado.cenaId) ?? editor.estado.documento.scenes[0]!
  const outraCamada = editor.cena?.layers.find((l) => l.id !== camadaId) ?? editor.cena?.layers[0]
  switch (action) {
    case 'nextScene': return { action }
    case 'prevScene': return { action }
    case 'goToScene': return { action, targetSceneId: outraCena.id }
    case 'openLink': return { action, url: 'https://', newTab: true }
    case 'toggleLayer': return { action, targetLayerId: outraCamada?.id ?? camadaId, mode: 'toggle' }
    case 'toggleVideo': return { action, targetLayerId: editor.cena?.layers.find((l) => l.type === 'video')?.id ?? camadaId, mode: 'toggle' }
    case 'animate': return { action, targetLayerId: camadaId, animation: { type: 'fadeIn', duration: 400, delay: 0, easing: 'easeOut' } }
  }
}

function EditorInteracao({ camada, editor, onChange }: { camada: Camada; editor: Editor; onChange: (i: Interacao | undefined) => void }) {
  const i = camada.interaction
  const story = editor.estado.documento.mode === 'story'
  const triggers = TRIGGERS.filter((t) => t !== 'scrollThreshold' || story)
  const setTrigger = (trigger: Trigger | '') => {
    if (!trigger) return onChange(undefined)
    const permitidas = ACOES_POR_TRIGGER[trigger]
    const acaoAtual = i?.do.action
    const acao = acaoAtual && permitidas.includes(acaoAtual) ? i!.do : acaoPadrao(permitidas[0]!, editor, camada.id)
    onChange({ trigger, conditions: i?.conditions ?? { once: false, threshold: 0.5 }, do: acao, transition: i?.transition })
  }
  const setAcao = (patch: Partial<Acao> | Acao) => i && onChange({ ...i, do: { ...i.do, ...patch } as Acao })
  return (
    <div className="space-y-1">
      <CampoInspetor rotulo="Quando">
        <Selecao className="h-8 text-xs" value={i?.trigger ?? ''} onChange={(e) => setTrigger(e.target.value as Trigger | '')}>
          <option value="">Sem ação</option>
          {triggers.map((t) => <option key={t} value={t}>{NOMES_TRIGGER[t]}</option>)}
        </Selecao>
      </CampoInspetor>
      {i && (
        <>
          <CampoInspetor rotulo="Fazer">
            <Selecao className="h-8 text-xs" value={i.do.action} onChange={(e) => onChange({ ...i, do: acaoPadrao(e.target.value as Acao['action'], editor, camada.id) })}>
              {ACOES_POR_TRIGGER[i.trigger].map((a) => <option key={a} value={a}>{NOMES_ACAO[a]}</option>)}
            </Selecao>
          </CampoInspetor>
          {i.do.action === 'goToScene' && (
            <CampoInspetor rotulo="Cena">
              <Selecao className="h-8 text-xs" value={i.do.targetSceneId} onChange={(e) => setAcao({ targetSceneId: e.target.value })}>
                {editor.estado.documento.scenes.map((s, n) => <option key={s.id} value={s.id}>{String(n + 1).padStart(2, '0')} {s.title || 'Sem título'}</option>)}
              </Selecao>
            </CampoInspetor>
          )}
          {i.do.action === 'openLink' && (
            <>
              <Entrada aria-label="URL" type="url" placeholder="https://…" value={i.do.url} onChange={(e) => setAcao({ url: e.target.value })} className="h-8 text-xs" />
              {!/^https?:\/\/.+/.test(i.do.url) && <p className="text-[11px] text-perigo">Use um endereço começando com http:// ou https://</p>}
              <CampoInspetor rotulo="Nova aba"><Alternador rotulo="Abrir em nova aba" ativo={i.do.newTab} onChange={(newTab) => setAcao({ newTab })} /></CampoInspetor>
            </>
          )}
          {(i.do.action === 'toggleLayer' || i.do.action === 'toggleVideo' || i.do.action === 'animate') && (
            <CampoInspetor rotulo="Camada">
              <Selecao className="h-8 text-xs" value={i.do.targetLayerId} onChange={(e) => setAcao({ targetLayerId: e.target.value })}>
                {(editor.cena?.layers ?? []).filter((l) => i.do.action !== 'toggleVideo' || l.type === 'video').map((l) => <option key={l.id} value={l.id}>{l.name || `${rotuloTipo(l)} ${l.id}`}</option>)}
              </Selecao>
            </CampoInspetor>
          )}
          {i.do.action === 'toggleLayer' && (
            <CampoInspetor rotulo="Modo"><Selecao className="h-8 text-xs" value={i.do.mode} onChange={(e) => setAcao({ mode: e.target.value as 'show' | 'hide' | 'toggle' })}><option value="toggle">Alternar</option><option value="show">Mostrar</option><option value="hide">Ocultar</option></Selecao></CampoInspetor>
          )}
          {i.do.action === 'toggleVideo' && (
            <CampoInspetor rotulo="Modo"><Selecao className="h-8 text-xs" value={i.do.mode} onChange={(e) => setAcao({ mode: e.target.value as 'play' | 'pause' | 'toggle' })}><option value="toggle">Alternar</option><option value="play">Tocar</option><option value="pause">Pausar</option></Selecao></CampoInspetor>
          )}
          {i.do.action === 'animate' && <EditorAnimacao valor={i.do.animation} onChange={(animation) => animation && setAcao({ animation })} semNenhuma />}
          {['nextScene', 'prevScene', 'goToScene'].includes(i.do.action) && (
            <CampoInspetor rotulo="Transição">
              <Selecao className="h-8 text-xs" value={i.transition?.type ?? ''} onChange={(e) => onChange({ ...i, transition: e.target.value ? { type: e.target.value as 'fade' | 'slide' | 'zoom' | 'none', duration: i.transition?.duration ?? 350 } : undefined })}>
                <option value="">Padrão da cena</option><option value="none">Instantânea</option><option value="fade">Fade</option><option value="slide">Deslizar</option><option value="zoom">Zoom</option>
              </Selecao>
            </CampoInspetor>
          )}
          {i.trigger === 'scrollThreshold' && <CampoInspetor rotulo="Visível"><EntradaNumero rotulo="Fração visível" value={Math.round(i.conditions.threshold * 100)} min={0} max={100} sufixo="%" onChange={(v) => onChange({ ...i, conditions: { ...i.conditions, threshold: v / 100 } })} /></CampoInspetor>}
          <CampoInspetor rotulo="Só uma vez"><Alternador rotulo="Disparar só uma vez" ativo={i.conditions.once} onChange={(once) => onChange({ ...i, conditions: { ...i.conditions, once } })} /></CampoInspetor>
          {i.trigger === 'hover' && <p className="text-[11px] text-texto2">No celular, vira toque.</p>}
        </>
      )}
    </div>
  )
}

function EditorAnimacao({ valor, onChange, semNenhuma }: { valor: Animacao | undefined; onChange: (a: Animacao | undefined) => void; semNenhuma?: boolean }) {
  const a = valor ?? { type: 'none' as const, duration: 400, delay: 0, easing: 'easeOut' as const }
  const set = (patch: Partial<Animacao>) => {
    const novo = { ...a, ...patch }
    onChange(novo.type === 'none' && !semNenhuma ? undefined : novo)
  }
  return (
    <div>
      <CampoInspetor rotulo="Efeito">
        <Selecao className="h-8 text-xs" value={a.type} onChange={(e) => set({ type: e.target.value as Animacao['type'] })}>
          {TIPOS_ANIMACAO.filter((t) => !(semNenhuma && t === 'none')).map((t) => <option key={t} value={t}>{NOMES_ANIM[t]}</option>)}
        </Selecao>
      </CampoInspetor>
      {a.type !== 'none' && (
        <>
          <div className="grid grid-cols-2 gap-x-2">
            <CampoInspetor rotulo="Duração"><EntradaNumero rotulo="Duração" value={a.duration} min={150} max={1200} step={50} sufixo="ms" onChange={(duration) => set({ duration: Math.max(150, Math.min(1200, duration)) })} /></CampoInspetor>
            <CampoInspetor rotulo="Atraso"><EntradaNumero rotulo="Atraso" value={a.delay} min={0} max={3000} step={50} sufixo="ms" onChange={(delay) => set({ delay: Math.max(0, Math.min(3000, delay)) })} /></CampoInspetor>
          </div>
          <CampoInspetor rotulo="Curva">
            <Selecao className="h-8 text-xs" value={a.easing} onChange={(e) => set({ easing: e.target.value as Animacao['easing'] })}>{EASINGS.map((e) => <option key={e} value={e}>{NOMES_EASING[e]}</option>)}</Selecao>
          </CampoInspetor>
        </>
      )}
    </div>
  )
}

// ---------- Cena ----------

function InspetorCena({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { cena, acoes, estado } = editor
  if (!cena) return null
  const formatoAtual = (Object.entries(FORMATOS).find(([, s]) => s.width === cena.size.width && s.height === cena.size.height)?.[0] ?? 'personalizado') as keyof typeof FORMATOS | 'personalizado'
  return (
    <aside aria-label="Propriedades da cena" className="rolagem-fina flex h-full w-full flex-col overflow-y-auto border-l bg-superficie text-sm">
      <div className="px-3 py-2"><Entrada aria-label="Título da cena" value={cena.title} placeholder="Título da cena" onChange={(e) => acoes.atualizarCena({ title: e.target.value })} className="h-8 text-xs" /></div>
      <Secao titulo="Cena">
        <CampoInspetor rotulo="Formato">
          <Selecao className="h-8 text-xs" value={formatoAtual} onChange={(e) => { const f = FORMATOS[e.target.value as keyof typeof FORMATOS]; if (f) acoes.atualizarCena({ size: f }) }}>
            {estado.documento.mode === 'slides' ? <><option value="slides169">Slides 16:9</option><option value="slides43">Slides 4:3</option></> : <option value="story">Story vertical</option>}
            {formatoAtual === 'personalizado' && <option value="personalizado">Personalizado</option>}
          </Selecao>
        </CampoInspetor>
        <CampoInspetor rotulo="Fundo"><Cor valor={cena.background} onChange={(background) => acoes.atualizarCena({ background })} /></CampoInspetor>
        <CampoInspetor rotulo="Imagem">
          <Selecao className="h-8 text-xs" value={cena.backgroundAssetId ?? ''} onChange={(e) => acoes.atualizarCena({ backgroundAssetId: e.target.value || undefined })}>
            <option value="">Sem imagem</option>
            {assets.filter((a) => a.tipo !== 'video').map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Selecao>
        </CampoInspetor>
        {cena.backgroundAssetId && <CampoInspetor rotulo="Enquadrar"><Selecao className="h-8 text-xs" value={cena.backgroundFit} onChange={(e) => acoes.atualizarCena({ backgroundFit: e.target.value as 'cover' | 'contain' })}><option value="cover">Cobrir</option><option value="contain">Conter</option></Selecao></CampoInspetor>}
        <CampoInspetor rotulo="Transição">
          <Selecao className="h-8 text-xs" value={cena.transition?.type ?? ''} onChange={(e) => acoes.atualizarCena({ transition: e.target.value ? { type: e.target.value as 'fade' | 'slide' | 'zoom' | 'none', duration: 350 } : undefined })}>
            <option value="">Padrão (fade)</option><option value="none">Instantânea</option><option value="fade">Fade</option><option value="slide">Deslizar</option><option value="zoom">Zoom</option>
          </Selecao>
        </CampoInspetor>
      </Secao>
      <Secao titulo="Camadas">
        {cena.layers.length === 0 && <p className="text-xs text-texto2">Nenhuma camada. Use a barra inferior para adicionar texto, forma, hotspot ou mídia.</p>}
        <ul className="space-y-0.5">
          {[...cena.layers].sort((a, b) => b.z - a.z).map((l) => (
            <li key={l.id}>
              <button onClick={() => acoes.selecionar([l.id])} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-superficie2">
                <span className="flex-1 truncate">{l.name || rotuloTipo(l)}{l.type === 'text' ? ` · ${l.text.slice(0, 18)}` : ''}</span>
                {l.interaction && <Selo tom="destaque">ação</Selo>}
                {l.hidden && <EyeOff className="h-3 w-3 text-texto2" />}
                {l.locked && <Lock className="h-3 w-3 text-texto2" />}
              </button>
            </li>
          ))}
        </ul>
      </Secao>
      <Problemas editor={editor} />
    </aside>
  )
}

export function Problemas({ editor, apenasCamada }: { editor: Editor; apenasCamada?: string }) {
  const { validacao, acoes, estado } = editor
  const lista = [...validacao.erros, ...validacao.avisos].filter((p) => !apenasCamada || p.layerId === apenasCamada)
  if (!lista.length) return apenasCamada ? null : <Secao titulo="Verificação"><p className="text-xs text-sucesso">Tudo certo para publicar.</p></Secao>
  return (
    <Secao titulo={apenasCamada ? 'Avisos desta camada' : `Verificação · ${validacao.erros.length} erro(s), ${validacao.avisos.length} aviso(s)`}>
      <ul className="space-y-1">
        {lista.slice(0, 30).map((p, i) => (
          <li key={i}>
            <button
              onClick={() => { if (p.sceneId && p.sceneId !== estado.cenaId) acoes.irParaCena(p.sceneId); if (p.layerId) setTimeout(() => acoes.selecionar([p.layerId!]), 0) }}
              className={cx('flex w-full items-start gap-1.5 rounded-lg px-2 py-1 text-left text-[11px] hover:bg-superficie2', p.gravidade === 'erro' ? 'text-perigo' : 'text-texto2')}
            >
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {p.mensagem}
            </button>
          </li>
        ))}
      </ul>
    </Secao>
  )
}
