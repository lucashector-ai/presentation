'use client'
import { useMemo } from 'react'
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround,
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Box, Code2, Copy, Crosshair, Eye, EyeOff, FlipHorizontal2, FlipVertical2, Image as ImageIcon,
  Frame, Italic, Link2, Lock, LockOpen, PenTool, RotateCw, Sparkles, Square, Trash2, Type, Underline, Video,
} from 'lucide-react'
import type { Camada, CamadaForma, CamadaImagem, CamadaLottie, CamadaModelo3d, CamadaSvg, CamadaTexto, CamadaVideo, Gradiente, Interacao, Sombra } from '@/lib/scene/schema'
import { FORMAS, MODOS_MESCLAGEM } from '@/lib/scene/schema'
import { FONTES_APRESENTACAO } from '@/lib/design-tokens'
import { coresDoSvg } from '@/lib/importar/svg'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { BotaoIcone, cx } from '@/components/ui'
import { CampoCor, CampoNum, Deslizante, Interruptor, Linha, LinhaResumo, Secao, Segmentado, SeletorLista } from './controles'
import { SecaoAutoLayout } from './SecaoAutoLayout' // auto layout (frames)

export const ICONE_TIPO: Record<Camada['type'], typeof Type> = { text: Type, shape: Square, image: ImageIcon, video: Video, hotspot: Crosshair, svg: PenTool, model3d: Box, lottie: Sparkles, embed: Code2, frame: Frame }
export const NOME_TIPO: Record<Camada['type'], string> = { text: 'Texto', shape: 'Forma', image: 'Imagem', video: 'Vídeo', hotspot: 'Hotspot', svg: 'Vetor (SVG)', model3d: 'Modelo 3D', lottie: 'Animação Lottie', embed: 'Incorporado', frame: 'Frame' }

const SOMBRAS: Record<string, Sombra | undefined> = {
  nenhuma: undefined,
  suave: { x: 0, y: 8, blur: 24, spread: -8, color: '#0000002E' },
  media: { x: 0, y: 20, blur: 50, spread: -16, color: '#00000059' },
  forte: { x: 0, y: 32, blur: 80, spread: -12, color: '#00000080' },
  carimbo: { x: 12, y: 12, blur: 0, spread: 0, color: '#171717FF' },
}
const NOMES_ANIM: Record<string, string> = { none: 'Nenhuma', fadeIn: 'Fade', fadeOut: 'Sumir', slideUp: 'Subir', slideDown: 'Descer', slideLeft: 'Deslizar ←', slideRight: 'Deslizar →', scaleIn: 'Escala', scaleOut: 'Encolher', blurIn: 'Desfoque', rotateIn: 'Girar', reveal: 'Máscara' }
const NOMES_GATILHO: Record<Interacao['trigger'], string> = { click: 'Clique', hover: 'Hover', sceneEnter: 'Automático', scrollThreshold: 'Scroll' }
const NOMES_ACAO: Record<Interacao['do']['action'], string> = { nextScene: 'Próxima tela', prevScene: 'Tela anterior', goToScene: 'Navegar para tela', openLink: 'Abrir link', toggleLayer: 'Revelar elemento', toggleVideo: 'Reproduzir vídeo', animate: 'Animar' }

export function resumoInteracoes(c: Camada): string {
  if (!c.interactions.length) return 'Nenhuma'
  const i = c.interactions[0]!
  return `${NOMES_GATILHO[i.trigger]} → ${NOMES_ACAO[i.do.action]}${c.interactions.length > 1 ? ` +${c.interactions.length - 1}` : ''}`
}

export function AbaDesign({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { camadasSelecionadas: sel, acoes, estado, cena } = editor
  const ids = sel.map((l) => l.id)
  const l = sel[0]!
  const multi = sel.length > 1
  const set = (patch: Partial<Camada>) => acoes.atualizarCamadas(ids, patch)
  const setFn = (fn: (c: Camada) => Camada) => acoes.atualizarCamadas(ids, fn)
  const Icone = ICONE_TIPO[l.type]
  const proporcional = l.type === 'svg' || l.type === 'image' || l.type === 'model3d'

  return (
    <div>
      {/* cabeçalho */}
      <div className="flex items-center gap-3 border-b border-borda px-4 py-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-acentoSuave text-acento"><Icone className="h-4 w-4" strokeWidth={1.75} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{multi ? `${sel.length} elementos` : NOME_TIPO[l.type]}</div>
          {!multi && (
            <input aria-label="Nome da camada" value={l.name ?? ''} placeholder={l.id} onChange={(e) => acoes.atualizarCamadas(ids, { name: e.target.value || undefined }, false)} onBlur={() => acoes.atualizarCamadas(ids, (c) => c)} className="mono w-full truncate bg-transparent text-[11px] text-texto3 outline-none placeholder:text-texto3 focus:text-texto" />
          )}
        </div>
        <div className="flex">
          <BotaoIcone rotulo={l.locked ? 'Destravar' : 'Travar'} onClick={() => set({ locked: !l.locked })}>{l.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}</BotaoIcone>
          <BotaoIcone rotulo={l.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => set({ hidden: !l.hidden })}>{l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</BotaoIcone>
          <BotaoIcone rotulo="Duplicar (Ctrl+D)" onClick={() => acoes.duplicarCamadas(ids)}><Copy className="h-3.5 w-3.5" /></BotaoIcone>
          <BotaoIcone rotulo="Excluir (Delete)" onClick={() => acoes.removerCamadas(ids)}><Trash2 className="h-3.5 w-3.5" /></BotaoIcone>
        </div>
      </div>

      {/* posição e dimensões */}
      <Secao titulo="Posição e dimensões">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum prefixo="X" rotulo="Posição X" valor={l.x} aoMudar={(x) => (multi ? acoes.deslocar(ids, x - l.x, 0) : set({ x }))} />
          <CampoNum prefixo="Y" rotulo="Posição Y" valor={l.y} aoMudar={(y) => (multi ? acoes.deslocar(ids, 0, y - l.y) : set({ y }))} />
          <CampoNum prefixo="W" rotulo="Largura" valor={l.width} min={1} aoMudar={(width) => setFn((c) => ({ ...c, width, height: proporcional && !multi ? Math.round((width * c.height) / c.width) : c.height }))} />
          <CampoNum prefixo="H" rotulo="Altura" valor={l.height} min={1} aoMudar={(height) => setFn((c) => ({ ...c, height, width: proporcional && !multi ? Math.round((height * c.width) / c.height) : c.width }))} />
          <CampoNum prefixo={<RotateCw className="h-3 w-3" />} rotulo="Rotação" valor={l.rotation} min={-360} max={360} sufixo="°" aoMudar={(rotation) => set({ rotation })} />
          {'radius' in l ? <CampoNum prefixo="◜" rotulo="Raio dos cantos" valor={(l as { radius: number }).radius} min={0} aoMudar={(radius) => set({ radius } as Partial<Camada>)} /> : <span />}
        </div>
        <div className="flex justify-between rounded-md border border-borda p-0.5">
          {([['esquerda', AlignStartVertical, 'Alinhar à esquerda'], ['centroH', AlignCenterVertical, 'Centralizar na horizontal'], ['direita', AlignEndVertical, 'Alinhar à direita'], ['topo', AlignStartHorizontal, 'Alinhar ao topo'], ['centroV', AlignCenterHorizontal, 'Centralizar na vertical'], ['base', AlignEndHorizontal, 'Alinhar à base']] as const).map(([m, I, r]) => (
            <BotaoIcone key={m} rotulo={r} className="h-7 w-7" onClick={() => acoes.alinhar(ids, m)}><I className="h-3.5 w-3.5" /></BotaoIcone>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex">
            <BotaoIcone rotulo="Inverter na horizontal" className="h-7 w-7" onClick={() => acoes.inverter(ids, 'x')}><FlipHorizontal2 className="h-3.5 w-3.5" /></BotaoIcone>
            <BotaoIcone rotulo="Inverter na vertical" className="h-7 w-7" onClick={() => acoes.inverter(ids, 'y')}><FlipVertical2 className="h-3.5 w-3.5" /></BotaoIcone>
            {!multi && <BotaoIcone rotulo="Trazer para frente" className="h-7 w-7" onClick={() => acoes.ordem(l.id, 'frente')}><ArrowUpToLine className="h-3.5 w-3.5" /></BotaoIcone>}
            {!multi && <BotaoIcone rotulo="Enviar para trás" className="h-7 w-7" onClick={() => acoes.ordem(l.id, 'tras')}><ArrowDownToLine className="h-3.5 w-3.5" /></BotaoIcone>}
          </div>
          {sel.length >= 3 && (
            <div className="flex">
              <BotaoIcone rotulo="Distribuir na horizontal" className="h-7 w-7" onClick={() => acoes.distribuir(ids, 'h')}><AlignHorizontalSpaceAround className="h-3.5 w-3.5" /></BotaoIcone>
              <BotaoIcone rotulo="Distribuir na vertical" className="h-7 w-7" onClick={() => acoes.distribuir(ids, 'v')}><AlignVerticalSpaceAround className="h-3.5 w-3.5" /></BotaoIcone>
            </div>
          )}
          {multi && (
            <button className="text-[12px] text-acento hover:underline" onClick={() => (sel.every((x) => x.groupId && x.groupId === l.groupId) ? acoes.desagrupar(ids) : acoes.agrupar(ids))}>
              {sel.every((x) => x.groupId && x.groupId === l.groupId) ? 'Desagrupar' : 'Agrupar (Ctrl+G)'}
            </button>
          )}
        </div>
      </Secao>

      {/* auto layout · frames · redimensionar texto */}
      <SecaoAutoLayout editor={editor} />

      {!multi && <SecaoTipo camada={l} set={set} assets={assets} />}

      {/* aparência */}
      <Secao titulo="Aparência">
        <Linha rotulo="Opacidade"><Deslizante rotulo="Opacidade" valor={Math.round(l.opacity * 100)} aoMudar={(v) => acoes.atualizarCamadas(ids, { opacity: v / 100 }, false)} formatar={(v) => `${v}%`} /></Linha>
        {(l.type === 'image' || l.type === 'video') && (
          <Linha rotulo="Ajuste"><SeletorLista rotulo="Ajuste" valor={l.fit} aoMudar={(fit) => set({ fit } as Partial<Camada>)} opcoes={[{ id: 'cover', rotulo: 'Cobrir' }, { id: 'contain', rotulo: 'Conter' }, { id: 'fill', rotulo: 'Esticar' }]} /></Linha>
        )}
        <Linha rotulo="Sombra">
          <SeletorLista rotulo="Sombra" valor={nomeSombra(l.effects?.shadow)} aoMudar={(v) => setFn((c) => ({ ...c, effects: { blur: 0, backdropBlur: 0, blend: 'normal', ...c.effects, shadow: v === 'personalizada' ? (c.effects?.shadow ?? SOMBRAS.media) : SOMBRAS[v] } }))} opcoes={[{ id: 'nenhuma', rotulo: 'Nenhuma' }, { id: 'suave', rotulo: 'Suave' }, { id: 'media', rotulo: 'Média' }, { id: 'forte', rotulo: 'Forte' }, { id: 'carimbo', rotulo: 'Carimbo' }, { id: 'personalizada', rotulo: 'Personalizada' }]} />
        </Linha>
        {l.effects?.shadow && nomeSombra(l.effects.shadow) === 'personalizada' && (
          <div className="grid grid-cols-2 gap-2">
            <CampoNum prefixo="X" rotulo="Sombra X" valor={l.effects.shadow.x} aoMudar={(x) => setFn((c) => ({ ...c, effects: { ...c.effects!, shadow: { ...c.effects!.shadow!, x } } }))} />
            <CampoNum prefixo="Y" rotulo="Sombra Y" valor={l.effects.shadow.y} aoMudar={(y) => setFn((c) => ({ ...c, effects: { ...c.effects!, shadow: { ...c.effects!.shadow!, y } } }))} />
            <CampoNum prefixo="B" rotulo="Desfoque da sombra" valor={l.effects.shadow.blur} min={0} aoMudar={(blur) => setFn((c) => ({ ...c, effects: { ...c.effects!, shadow: { ...c.effects!.shadow!, blur } } }))} />
            <CampoCor rotulo="Cor da sombra" valor={l.effects.shadow.color} aoMudar={(color) => color && setFn((c) => ({ ...c, effects: { ...c.effects!, shadow: { ...c.effects!.shadow!, color } } }))} />
          </div>
        )}
        <Linha rotulo="Desfoque"><Deslizante rotulo="Desfoque" valor={l.effects?.blur ?? 0} max={40} aoMudar={(blur) => acoes.atualizarCamadas(ids, (c) => ({ ...c, effects: { backdropBlur: 0, blend: 'normal', ...c.effects, blur } }), false)} formatar={(v) => `${v}px`} /></Linha>
        <Linha rotulo="Vidro"><Deslizante rotulo="Desfoque do fundo (vidro)" valor={l.effects?.backdropBlur ?? 0} max={40} aoMudar={(backdropBlur) => acoes.atualizarCamadas(ids, (c) => ({ ...c, effects: { blur: 0, blend: 'normal', ...c.effects, backdropBlur } }), false)} formatar={(v) => `${v}px`} /></Linha>
        <Linha rotulo="Mesclagem">
          <SeletorLista rotulo="Modo de mesclagem" valor={l.effects?.blend ?? 'normal'} aoMudar={(blend) => setFn((c) => ({ ...c, effects: { blur: 0, backdropBlur: 0, ...c.effects, blend: blend as (typeof MODOS_MESCLAGEM)[number] } }))} opcoes={MODOS_MESCLAGEM.map((m) => ({ id: m, rotulo: { normal: 'Normal', multiply: 'Multiplicar', screen: 'Tela', overlay: 'Sobrepor', darken: 'Escurecer', lighten: 'Clarear', 'color-dodge': 'Subexpor cor', difference: 'Diferença', luminosity: 'Luminosidade' }[m] }))} />
        </Linha>
      </Secao>

      {!multi && (
        <>
          <LinhaResumo titulo="Animação" valor={l.enterAnimation && l.enterAnimation.type !== 'none' ? `${NOMES_ANIM[l.enterAnimation.type]} · ${l.enterAnimation.duration}ms` : 'Nenhuma'} aoClicar={() => acoes.ui({ abaDireita: 'animacao' })} />
          <LinhaResumo titulo="Interações" valor={resumoInteracoes(l)} destaque={l.interactions.length > 0} aoClicar={() => acoes.ui({ abaDireita: 'interacoes' })} />
          <LinkRapido camada={l} editor={editor} />
        </>
      )}

      <Secao titulo="Responsivo">
        <p className="text-[12px] text-texto2">A tela escala proporcionalmente em qualquer dispositivo. Ajustes para celular:</p>
        <Linha rotulo="Ocultar no celular"><Interruptor rotulo="Ocultar no celular" ativo={!!l.mobile?.hidden} aoMudar={(v) => set({ mobile: { ...l.mobile, hidden: v } })} /></Linha>
        {(l.type === 'image' || l.type === 'video') && (
          <Linha rotulo="Ajuste no celular">
            <SeletorLista rotulo="Ajuste no celular" valor={l.mobile?.fit ?? ''} aoMudar={(v) => set({ mobile: { ...l.mobile, fit: (v || undefined) as 'contain' | 'cover' | undefined } })} opcoes={[{ id: '', rotulo: 'Igual ao desktop' }, { id: 'contain', rotulo: 'Conter' }, { id: 'cover', rotulo: 'Cobrir' }]} />
          </Linha>
        )}
      </Secao>

      {!multi && l.type !== 'hotspot' && (
        <Secao titulo="Acessibilidade">
          <input aria-label="Descrição para leitores de tela" placeholder="Descrição para leitores de tela" value={l.ariaLabel ?? ''} onChange={(e) => acoes.atualizarCamadas(ids, { ariaLabel: e.target.value || undefined }, false)} onBlur={() => acoes.atualizarCamadas(ids, (c) => c)} className="h-7 w-full rounded-md bg-superficie2 px-2 text-[13px] outline-none focus:ring-1 focus:ring-acento" />
          {l.interactions.length > 0 && !l.ariaLabel && l.type !== 'text' && <p className="text-[11px] text-perigo">Elemento interativo precisa de descrição.</p>}
        </Secao>
      )}
      <span className="sr-only">{estado.salvamento}{cena?.id}</span>
    </div>
  )
}

function nomeSombra(s: Sombra | undefined): string {
  if (!s) return 'nenhuma'
  const achada = Object.entries(SOMBRAS).find(([, v]) => v && v.x === s.x && v.y === s.y && v.blur === s.blur && v.spread === s.spread && v.color === s.color)
  return achada?.[0] ?? 'personalizada'
}

/** Campo "Link" do design: https://… ou nome/número de uma tela. Cria/edita a interação de clique. */
function LinkRapido({ camada, editor }: { camada: Camada; editor: Editor }) {
  const it = camada.interactions.find((i) => i.trigger === 'click' && (i.do.action === 'openLink' || i.do.action === 'goToScene'))
  const telas = editor.estado.documento.scenes
  const valor = it?.do.action === 'openLink' ? it.do.url : it?.do.action === 'goToScene' ? `→ ${telas.find((t) => it.do.action === 'goToScene' && t.id === it.do.targetSceneId)?.title ?? ''}` : ''
  const aplicar = (texto: string) => {
    const t = texto.trim()
    const sem = camada.interactions.filter((i) => i !== it)
    if (!t) return editor.acoes.atualizarCamadas([camada.id], { interactions: sem } as Partial<Camada>)
    let nova: Interacao | null = null
    if (/^https?:\/\//i.test(t)) nova = { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'openLink', url: t, newTab: true } }
    else {
      const busca = t.replace(/^→\s*/, '').toLowerCase()
      const n = Number(busca)
      const tela = Number.isInteger(n) && n >= 1 ? telas[n - 1] : telas.find((s) => s.title.toLowerCase() === busca)
      if (tela) nova = { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: tela.id } }
    }
    if (nova) editor.acoes.atualizarCamadas([camada.id], { interactions: [...sem, nova] } as Partial<Camada>)
  }
  return (
    <Secao titulo="Link">
      <div className="flex h-8 items-center gap-2 rounded-md border border-borda px-2 focus-within:border-acento">
        <Link2 className="h-3.5 w-3.5 text-texto3" />
        <input key={valor} aria-label="Link" list="mostra-telas" defaultValue={valor} placeholder="https:// ou escolha uma tela" onBlur={(e) => e.target.value !== valor && aplicar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-texto3" />
        <datalist id="mostra-telas">{telas.map((t, i) => <option key={t.id} value={`→ ${t.title || `Tela ${i + 1}`}`} />)}</datalist>
      </div>
    </Secao>
  )
}

function SecaoTipo({ camada: l, set, assets }: { camada: Camada; set: (p: Partial<Camada>) => void; assets: AssetDemo[] }) {
  switch (l.type) {
    case 'text':
      return <SecaoTexto c={l} set={set} />
    case 'shape':
      return <SecaoForma c={l} set={set} />
    case 'image':
      return <SecaoImagem c={l} set={set} assets={assets} />
    case 'video':
      return <SecaoVideo c={l} set={set} assets={assets} />
    case 'svg':
      return <SecaoSvg c={l} set={set} />
    case 'model3d':
      return <SecaoModelo c={l} set={set} assets={assets} />
    case 'lottie':
      return <SecaoLottie c={l} set={set} />
    case 'embed':
      return (
        <Secao titulo="Incorporado">
          <input aria-label="URL incorporada" defaultValue={l.url} onBlur={(e) => { try { if (new URL(e.target.value).protocol === 'https:') set({ url: e.target.value } as Partial<Camada>) } catch { /* inválida */ } }} className="h-7 w-full rounded-md bg-superficie2 px-2 text-[12px] outline-none focus:ring-1 focus:ring-acento" />
          <p className="text-[11px] text-texto2">YouTube, Vimeo, Figma, Loom, Spline, Sketchfab ou Spotify. Roda isolado (sandbox) na apresentação.</p>
        </Secao>
      )
    case 'hotspot':
      return (
        <Secao titulo="Hotspot">
          <input aria-label="Descrição do hotspot" placeholder="Ex.: Ver aplicações da marca" value={l.ariaLabel} onChange={(e) => set({ ariaLabel: e.target.value || 'Área clicável' } as Partial<Camada>)} className="h-7 w-full rounded-md bg-superficie2 px-2 text-[13px] outline-none focus:ring-1 focus:ring-acento" />
          <Linha rotulo="Dica visual"><Interruptor rotulo="Contorno ao passar o mouse" ativo={l.hint} aoMudar={(hint) => set({ hint } as Partial<Camada>)} /></Linha>
          <p className="text-[11px] text-texto2">Invisível na apresentação. Configure o que acontece na aba Interações.</p>
        </Secao>
      )
  }
}

function SecaoTexto({ c, set }: { c: CamadaTexto; set: (p: Partial<Camada>) => void }) {
  const s = (p: Partial<CamadaTexto>) => set(p as Partial<Camada>)
  return (
    <Secao titulo="Texto">
      <textarea aria-label="Conteúdo do texto" rows={3} value={c.text} onChange={(e) => s({ text: e.target.value })} className="w-full resize-y rounded-md bg-superficie2 px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-acento" />
      <SeletorLista rotulo="Fonte" valor={c.fontFamily} aoMudar={(fontFamily) => s({ fontFamily })} opcoes={FONTES_APRESENTACAO.map((f) => ({ id: f, rotulo: f }))} />
      <div className="grid grid-cols-2 gap-2">
        <SeletorLista rotulo="Peso" valor={String(c.fontWeight)} aoMudar={(v) => s({ fontWeight: Number(v) })} opcoes={[[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold']].map(([v, r]) => ({ id: String(v), rotulo: String(r) }))} />
        <CampoNum prefixo="Aa" rotulo="Tamanho da fonte" valor={c.fontSize} min={6} max={800} aoMudar={(fontSize) => s({ fontSize })} />
        <CampoNum prefixo="↕" rotulo="Entrelinha" valor={c.lineHeight} min={0.6} max={3} passo={0.05} casas={2} aoMudar={(lineHeight) => s({ lineHeight })} />
        <CampoNum prefixo="↔" rotulo="Espaçamento entre letras" valor={c.letterSpacing} min={-100} max={100} passo={0.5} casas={1} aoMudar={(letterSpacing) => s({ letterSpacing })} />
      </div>
      <Linha rotulo="Cor"><CampoCor rotulo="Cor do texto" valor={c.color} aoMudar={(color) => color && s({ color })} /></Linha>
      <div className="flex gap-2">
        <Segmentado rotulo="Alinhamento" icones valor={c.align} aoMudar={(align) => s({ align })} opcoes={[{ id: 'left', rotulo: 'Esquerda', icone: <AlignLeft className="h-3.5 w-3.5" /> }, { id: 'center', rotulo: 'Centro', icone: <AlignCenter className="h-3.5 w-3.5" /> }, { id: 'right', rotulo: 'Direita', icone: <AlignRight className="h-3.5 w-3.5" /> }, { id: 'justify', rotulo: 'Justificado', icone: <AlignJustify className="h-3.5 w-3.5" /> }]} />
        <div className="flex rounded-md bg-superficie2 p-[3px]">
          <button type="button" aria-label="Itálico" aria-pressed={c.italic} onClick={() => s({ italic: !c.italic })} className={cx('flex h-6 w-7 items-center justify-center rounded-[5px]', c.italic && 'bg-superficie shadow-sm')}><Italic className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Sublinhado" aria-pressed={c.underline} onClick={() => s({ underline: !c.underline })} className={cx('flex h-6 w-7 items-center justify-center rounded-[5px]', c.underline && 'bg-superficie shadow-sm')}><Underline className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <Segmentado rotulo="Alinhamento vertical" valor={c.valign} aoMudar={(valign) => s({ valign })} opcoes={[{ id: 'top', rotulo: 'Topo' }, { id: 'middle', rotulo: 'Meio' }, { id: 'bottom', rotulo: 'Base' }]} />
      <Segmentado rotulo="Caixa" valor={c.transform} aoMudar={(transform) => s({ transform })} opcoes={[{ id: 'none', rotulo: 'Aa' }, { id: 'uppercase', rotulo: 'AA' }, { id: 'lowercase', rotulo: 'aa' }]} />
      <Linha rotulo="Fundo"><CampoCor rotulo="Fundo do texto" permitirVazio valor={c.background} aoMudar={(background) => s({ background })} /></Linha>
      {c.background && <Linha rotulo="Respiro"><CampoNum rotulo="Respiro interno" valor={c.padding} min={0} max={200} aoMudar={(padding) => s({ padding })} /></Linha>}
      <EditorGradiente valor={c.gradient} aoMudar={(gradient) => s({ gradient })} rotulo="Gradiente nas letras" />
    </Secao>
  )
}

function SecaoForma({ c, set }: { c: CamadaForma; set: (p: Partial<Camada>) => void }) {
  const s = (p: Partial<CamadaForma>) => set(p as Partial<Camada>)
  const nomes: Record<string, string> = { rect: 'Retângulo', ellipse: 'Elipse', triangle: 'Triângulo', semicircle: 'Semicírculo', line: 'Linha', star: 'Estrela', arrow: 'Seta' }
  return (
    <Secao titulo="Preenchimento">
      <SeletorLista rotulo="Forma" valor={c.shape} aoMudar={(v) => s({ shape: v as CamadaForma['shape'] })} opcoes={FORMAS.map((f) => ({ id: f, rotulo: nomes[f] ?? f }))} />
      <Linha rotulo="Cor"><CampoCor rotulo="Cor de preenchimento" valor={c.fill} aoMudar={(fill) => fill && s({ fill })} /></Linha>
      <EditorGradiente valor={c.gradient} aoMudar={(gradient) => s({ gradient })} rotulo="Gradiente" />
      <Linha rotulo="Contorno"><CampoCor rotulo="Cor do contorno" permitirVazio valor={c.stroke} aoMudar={(stroke) => s({ stroke, strokeWidth: stroke && !c.strokeWidth ? 2 : c.strokeWidth })} /></Linha>
      {c.stroke && (
        <div className="grid grid-cols-2 gap-2">
          <CampoNum prefixo="Esp" rotulo="Espessura do contorno" valor={c.strokeWidth} min={0} max={100} aoMudar={(strokeWidth) => s({ strokeWidth })} />
          <CampoNum prefixo="- -" rotulo="Tracejado" valor={c.dash} min={0} max={100} aoMudar={(dash) => s({ dash })} />
        </div>
      )}
      <Linha rotulo="Textura"><SeletorLista rotulo="Textura" valor={c.pattern} aoMudar={(v) => s({ pattern: v as CamadaForma['pattern'] })} opcoes={[{ id: 'none', rotulo: 'Nenhuma' }, { id: 'stripes', rotulo: 'Listras (foto)' }, { id: 'dots', rotulo: 'Pontos' }, { id: 'grid', rotulo: 'Grade' }]} /></Linha>
    </Secao>
  )
}

function EditorGradiente({ valor, aoMudar, rotulo }: { valor: Gradiente | undefined; aoMudar: (g: Gradiente | undefined) => void; rotulo: string }) {
  if (!valor) return <button type="button" className="text-[12px] text-acento hover:underline" onClick={() => aoMudar({ type: 'linear', angle: 135, stops: [{ color: '#5965F2', pos: 0 }, { color: '#D7F25C', pos: 100 }] })}>+ {rotulo}</button>
  return (
    <div className="space-y-2 rounded-md border border-borda p-2">
      <div className="h-5 rounded" style={{ background: `linear-gradient(90deg, ${valor.stops.map((s) => `${s.color} ${s.pos}%`).join(', ')})` }} />
      <div className="flex gap-2">
        <Segmentado rotulo="Tipo de gradiente" valor={valor.type} aoMudar={(type) => aoMudar({ ...valor, type })} opcoes={[{ id: 'linear', rotulo: 'Linear' }, { id: 'radial', rotulo: 'Radial' }]} />
        {valor.type === 'linear' && <CampoNum prefixo="∠" rotulo="Ângulo do gradiente" valor={valor.angle} min={0} max={360} sufixo="°" aoMudar={(angle) => aoMudar({ ...valor, angle })} />}
      </div>
      {valor.stops.map((st, i) => (
        <div key={i} className="flex gap-2">
          <CampoCor rotulo={`Cor ${i + 1} do gradiente`} valor={st.color} aoMudar={(color) => color && aoMudar({ ...valor, stops: valor.stops.map((x, j) => (j === i ? { ...x, color } : x)) })} />
          <span className="w-16"><CampoNum rotulo={`Posição ${i + 1}`} valor={st.pos} min={0} max={100} sufixo="%" aoMudar={(pos) => aoMudar({ ...valor, stops: valor.stops.map((x, j) => (j === i ? { ...x, pos } : x)) })} /></span>
        </div>
      ))}
      <div className="flex justify-between text-[12px]">
        {valor.stops.length < 8 && <button type="button" className="text-acento hover:underline" onClick={() => aoMudar({ ...valor, stops: [...valor.stops, { color: '#FFFFFF', pos: 50 }] })}>+ cor</button>}
        <button type="button" className="text-texto2 hover:underline" onClick={() => aoMudar(undefined)}>Remover gradiente</button>
      </div>
    </div>
  )
}

function SeletorAsset({ valor, assets, aoMudar, rotulo }: { valor: string; assets: AssetDemo[]; aoMudar: (id: string) => void; rotulo: string }) {
  return <SeletorLista rotulo={rotulo} valor={valor} aoMudar={aoMudar} opcoes={[...(!assets.some((a) => a.id === valor) ? [{ id: valor, rotulo: '(arquivo removido)' }] : []), ...assets.map((a) => ({ id: a.id, rotulo: a.nome }))]} />
}

function SecaoImagem({ c, set, assets }: { c: CamadaImagem; set: (p: Partial<Camada>) => void; assets: AssetDemo[] }) {
  const s = (p: Partial<CamadaImagem>) => set(p as Partial<Camada>)
  const adj = c.adjust ?? { brightness: 1, contrast: 1, saturate: 1, grayscale: 0 }
  const crop = c.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  return (
    <Secao titulo="Imagem">
      <SeletorAsset rotulo="Arquivo de imagem" valor={c.assetId} assets={assets.filter((a) => a.tipo === 'image' || a.tipo === 'gif' || a.tipo === 'svg')} aoMudar={(assetId) => s({ assetId })} />
      <Linha rotulo="Máscara"><SeletorLista rotulo="Máscara" valor={c.mask} aoMudar={(v) => s({ mask: v as CamadaImagem['mask'] })} opcoes={[{ id: 'none', rotulo: 'Nenhuma' }, { id: 'ellipse', rotulo: 'Círculo' }, { id: 'arch', rotulo: 'Arco' }, { id: 'triangle', rotulo: 'Triângulo' }]} /></Linha>
      <div className="rotulo-mono pt-1">Recorte</div>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum prefixo="X" rotulo="Recorte X (%)" valor={Math.round(crop.x * 100)} min={0} max={99} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, x: v / 100, w: Math.min(crop.w, 1 - v / 100) } })} />
        <CampoNum prefixo="Y" rotulo="Recorte Y (%)" valor={Math.round(crop.y * 100)} min={0} max={99} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, y: v / 100, h: Math.min(crop.h, 1 - v / 100) } })} />
        <CampoNum prefixo="W" rotulo="Recorte largura (%)" valor={Math.round(crop.w * 100)} min={1} max={100} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, w: Math.min(v / 100, 1 - crop.x) } })} />
        <CampoNum prefixo="H" rotulo="Recorte altura (%)" valor={Math.round(crop.h * 100)} min={1} max={100} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, h: Math.min(v / 100, 1 - crop.y) } })} />
      </div>
      {c.crop && <button type="button" className="text-[12px] text-texto2 hover:underline" onClick={() => s({ crop: undefined })}>Remover recorte</button>}
      <div className="rotulo-mono pt-1">Ajustes</div>
      <Linha rotulo="Brilho"><Deslizante rotulo="Brilho" valor={Math.round(adj.brightness * 100)} max={200} aoMudar={(v) => s({ adjust: { ...adj, brightness: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
      <Linha rotulo="Contraste"><Deslizante rotulo="Contraste" valor={Math.round(adj.contrast * 100)} max={200} aoMudar={(v) => s({ adjust: { ...adj, contrast: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
      <Linha rotulo="Saturação"><Deslizante rotulo="Saturação" valor={Math.round(adj.saturate * 100)} max={200} aoMudar={(v) => s({ adjust: { ...adj, saturate: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
      <Linha rotulo="P&B"><Deslizante rotulo="Preto e branco" valor={Math.round(adj.grayscale * 100)} aoMudar={(v) => s({ adjust: { ...adj, grayscale: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
    </Secao>
  )
}

function SecaoVideo({ c, set, assets }: { c: CamadaVideo; set: (p: Partial<Camada>) => void; assets: AssetDemo[] }) {
  const s = (p: Partial<CamadaVideo>) => set(p as Partial<Camada>)
  return (
    <Secao titulo="Vídeo">
      <SeletorAsset rotulo="Arquivo de vídeo" valor={c.assetId} assets={assets.filter((a) => a.tipo === 'video')} aoMudar={(assetId) => s({ assetId })} />
      <Linha rotulo="Autoplay"><Interruptor rotulo="Reproduzir automaticamente (mudo)" ativo={c.autoplay} aoMudar={(autoplay) => s({ autoplay, muted: autoplay ? true : c.muted })} /></Linha>
      <Linha rotulo="Repetir"><Interruptor rotulo="Repetir" ativo={c.loop} aoMudar={(loop) => s({ loop })} /></Linha>
      <Linha rotulo="Mudo"><Interruptor rotulo="Mudo" ativo={c.muted} aoMudar={(muted) => s({ muted })} /></Linha>
      <Linha rotulo="Controles"><Interruptor rotulo="Mostrar controles" ativo={c.controls} aoMudar={(controls) => s({ controls })} /></Linha>
    </Secao>
  )
}

/** Vetor colado do Figma/Illustrator: troca de cores sem voltar ao programa de origem. */
function SecaoSvg({ c, set }: { c: CamadaSvg; set: (p: Partial<Camada>) => void }) {
  const cores = useMemo(() => (c.markup ? coresDoSvg(c.markup).slice(0, 16) : []), [c.markup])
  return (
    <Secao titulo="Cores do vetor" acao={Object.keys(c.recolor).length ? <button type="button" className="text-[12px] text-acento hover:underline" onClick={() => set({ recolor: {} } as Partial<Camada>)}>Restaurar</button> : undefined}>
      {cores.length === 0 ? <p className="text-[12px] text-texto2">Nenhuma cor sólida encontrada (o vetor pode usar imagens ou gradientes).</p> : (
        <div className="space-y-1.5">
          {cores.map((orig) => (
            <div key={orig} className="flex items-center gap-2">
              <span className="h-[18px] w-[18px] shrink-0 rounded-[4px] border border-black/10" style={{ background: orig }} title={`Original ${orig}`} />
              <span className="text-texto3">→</span>
              <CampoCor rotulo={`Substituir ${orig}`} valor={c.recolor[orig] ?? orig.toUpperCase()} aoMudar={(nova) => nova && set({ recolor: { ...c.recolor, [orig]: nova } } as Partial<Camada>)} />
            </div>
          ))}
        </div>
      )}
      <Linha rotulo="Ajuste"><SeletorLista rotulo="Ajuste do vetor" valor={c.fit} aoMudar={(v) => set({ fit: v as 'contain' | 'fill' } as Partial<Camada>)} opcoes={[{ id: 'contain', rotulo: 'Manter proporção' }, { id: 'fill', rotulo: 'Esticar' }]} /></Linha>
      <p className="text-[11px] text-texto2">Vetor nítido em qualquer zoom. Código ativo foi removido na importação.</p>
    </Secao>
  )
}

function SecaoModelo({ c, set, assets }: { c: CamadaModelo3d; set: (p: Partial<Camada>) => void; assets: AssetDemo[] }) {
  const s = (p: Partial<CamadaModelo3d>) => set(p as Partial<Camada>)
  return (
    <Secao titulo="Modelo 3D">
      <SeletorAsset rotulo="Arquivo 3D" valor={c.assetId} assets={assets.filter((a) => a.tipo === 'model3d')} aoMudar={(assetId) => s({ assetId })} />
      <Linha rotulo="Girar sozinho"><Interruptor rotulo="Girar automaticamente" ativo={c.autoRotate} aoMudar={(autoRotate) => s({ autoRotate })} /></Linha>
      {c.autoRotate && <Linha rotulo="Velocidade"><Deslizante rotulo="Velocidade de rotação" valor={c.rotationSpeed} max={180} aoMudar={(rotationSpeed) => s({ rotationSpeed })} formatar={(v) => `${v}°/s`} /></Linha>}
      <Linha rotulo="Convidado gira"><Interruptor rotulo="Convidado pode girar e dar zoom" ativo={c.cameraControls} aoMudar={(cameraControls) => s({ cameraControls })} /></Linha>
      <Linha rotulo="Órbita"><input aria-label="Órbita inicial da câmera" defaultValue={c.cameraOrbit} onBlur={(e) => s({ cameraOrbit: e.target.value || '0deg 75deg 105%' })} className="mono h-7 w-full rounded-md bg-superficie2 px-2 text-[12px] outline-none focus:ring-1 focus:ring-acento" /></Linha>
      <Linha rotulo="Campo de visão"><Deslizante rotulo="Campo de visão" valor={c.fieldOfView} min={10} max={90} aoMudar={(fieldOfView) => s({ fieldOfView })} formatar={(v) => `${v}°`} /></Linha>
      <Linha rotulo="Exposição"><Deslizante rotulo="Exposição" valor={Math.round(c.exposure * 100)} max={300} aoMudar={(v) => s({ exposure: v / 100 })} formatar={(v) => (v / 100).toFixed(1)} /></Linha>
      <Linha rotulo="Sombra"><Deslizante rotulo="Intensidade da sombra" valor={Math.round(c.shadowIntensity * 100)} max={200} aoMudar={(v) => s({ shadowIntensity: v / 100 })} formatar={(v) => (v / 100).toFixed(1)} /></Linha>
      <Linha rotulo="Luz"><SeletorLista rotulo="Iluminação" valor={c.environment} aoMudar={(v) => s({ environment: v as CamadaModelo3d['environment'] })} opcoes={[{ id: 'neutral', rotulo: 'Estúdio neutro' }, { id: 'legacy', rotulo: 'Clássica' }, { id: 'none', rotulo: 'Sem ambiente' }]} /></Linha>
      <Linha rotulo="Fundo"><CampoCor rotulo="Fundo do 3D" permitirVazio valor={c.background} aoMudar={(background) => s({ background })} /></Linha>
      <Linha rotulo="Animação"><input aria-label="Nome da animação do GLB" placeholder="nome do clip (opcional)" defaultValue={c.animation ?? ''} onBlur={(e) => s({ animation: e.target.value || undefined })} className="h-7 w-full rounded-md bg-superficie2 px-2 text-[12px] outline-none focus:ring-1 focus:ring-acento" /></Linha>
      <Linha rotulo="Realidade aumentada"><Interruptor rotulo="Ver em realidade aumentada no celular" ativo={c.ar} aoMudar={(ar) => s({ ar })} /></Linha>
      <Linha rotulo="Capa"><SeletorLista rotulo="Imagem de capa do 3D" valor={c.posterAssetId ?? ''} aoMudar={(v) => s({ posterAssetId: v || undefined })} opcoes={[{ id: '', rotulo: 'Nenhuma' }, ...assets.filter((a) => a.tipo === 'image').map((a) => ({ id: a.id, rotulo: a.nome }))]} /></Linha>
      <p className="text-[11px] text-texto2">Do Blender: Arquivo › Exportar › glTF 2.0 (.glb). Clique em “Interagir” na barra inferior para testar a câmera aqui.</p>
    </Secao>
  )
}

function SecaoLottie({ c, set }: { c: CamadaLottie; set: (p: Partial<Camada>) => void }) {
  const s = (p: Partial<CamadaLottie>) => set(p as Partial<Camada>)
  return (
    <Secao titulo="Animação Lottie">
      <Linha rotulo="Repetir"><Interruptor rotulo="Repetir animação" ativo={c.loop} aoMudar={(loop) => s({ loop })} /></Linha>
      <Linha rotulo="Iniciar sozinha"><Interruptor rotulo="Iniciar automaticamente" ativo={c.autoplay} aoMudar={(autoplay) => s({ autoplay })} /></Linha>
      <Linha rotulo="Velocidade"><Deslizante rotulo="Velocidade" valor={Math.round(c.speed * 100)} min={10} max={300} aoMudar={(v) => s({ speed: v / 100 })} formatar={(v) => `${(v / 100).toFixed(1)}×`} /></Linha>
    </Secao>
  )
}
