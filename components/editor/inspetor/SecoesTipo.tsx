'use client'
/**
 * Seções que só aparecem para um tipo de camada (uma camada selecionada):
 * Texto (tipografia + fundo da caixa), Imagem (+ Recorte e Ajustes recolhidos), Vídeo, Vetor, Modelo 3D
 * (+ Câmera e Luz recolhidas), Lottie, Incorporado e Hotspot.
 */
import { useMemo } from 'react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, Italic, Link2, Minus, Underline } from 'lucide-react'
import type { Camada, CamadaImagem, CamadaLottie, CamadaModelo3d, CamadaSvg, CamadaTexto, CamadaVideo } from '@/lib/scene/schema'
import { SeletorFonte, useCatalogoFontes } from '@/components/fontes/SeletorFonte'
import { fontesDoDocumento } from '@/components/renderer/fontes'
import { pesosDisponiveis, varianteReal } from '@/lib/fontes/catalogo'
import { coresDoSvg } from '@/lib/importar/svg'
import type { AssetDemo } from '@/lib/demo/tipos'
import { BotaoMini, CampoCor, CampoNum, CampoTexto, Deslizante, Interruptor, Linha, Secao, Segmentado, SeletorLista } from './controles'
import { LinhaPintura } from './CampoCor'
import { BotaoOpcoesTexto } from './OpcoesTexto'
import { BotaoGrupo, GrupoBotoes } from './SecaoPosicao'
import { IconeEntrelinha, IconeEspacamento, IconeTamanho } from './icones'
import { useCamadas, type PropsSecao } from './selecao'

type Set = (p: Partial<Camada>) => void

export function SecoesDoTipo({ editor, assets = [] }: PropsSecao) {
  const { sel, set } = useCamadas(editor)
  const cenas = editor.estado.documento.scenes
  const doDocumento = useMemo(() => fontesDoDocumento({ scenes: cenas }), [cenas])
  const l = sel[0]
  if (!l || sel.length > 1) return null
  switch (l.type) {
    case 'text': return <><SecaoTexto c={l} set={set} doDocumento={doDocumento} /><SecaoFundoTexto c={l} set={set} /></>
    case 'image': return <><SecaoImagem c={l} set={set} assets={assets} /><SecaoDownload c={l} set={set} editor={editor} /></>
    case 'video': return <><SecaoVideo c={l} set={set} assets={assets} /><SecaoDownload c={l} set={set} editor={editor} /></>
    case 'svg': return <><SecaoSvg c={l} set={set} /><SecaoDownload c={l} set={set} editor={editor} /></>
    case 'model3d': return <><SecaoModelo c={l} set={set} assets={assets} /><SecaoDownload c={l} set={set} editor={editor} /></>
    case 'lottie': return <><SecaoLottie c={l} set={set} /><SecaoDownload c={l} set={set} editor={editor} /></>
    case 'shape':
      // polígono: lados; estrela: pontas e raio interno (como no Figma)
      if (l.shape !== 'polygon' && l.shape !== 'star') return null
      return (
        <Secao titulo={l.shape === 'star' ? 'Estrela' : 'Polígono'}>
          <div className="grid grid-cols-2 gap-1.5">
            <CampoNum prefixo={l.shape === 'star' ? '✦' : '⬡'} rotulo={l.shape === 'star' ? 'Pontas' : 'Lados'} titulo={l.shape === 'star' ? 'Número de pontas' : 'Número de lados'} valor={l.count ?? (l.shape === 'star' ? 5 : 3)} min={3} max={60} aoMudar={(v) => set({ count: Math.round(v) } as Partial<Camada>)} />
            {l.shape === 'star' && <CampoNum prefixo="◎" rotulo="Raio interno" titulo="Raio interno (% do externo)" valor={Math.round((l.ratio ?? 0.4) * 100)} min={5} max={100} sufixo="%" aoMudar={(v) => set({ ratio: v / 100 } as Partial<Camada>)} />}
          </div>
        </Secao>
      )
    case 'embed':
      return (
        <Secao titulo="Incorporado">
          {l.html != null ? (
            <>
              <textarea aria-label="HTML incorporado" defaultValue={l.html} spellCheck={false} onBlur={(ev) => { const v = ev.target.value; if (v.trim() && v !== l.html) set({ html: v } as Partial<Camada>) }} className="mono min-h-[160px] w-full resize-y rounded-lg border border-borda bg-superficie px-2.5 py-2 text-[12px] leading-5 text-texto outline-none focus:border-acento" />
              <p className="text-[11px] leading-relaxed text-texto2">HTML próprio. Roda num iframe isolado: sem cookies, sem acesso à página. Salva ao sair do campo.</p>
            </>
          ) : (
            <>
              <CampoTexto rotulo="URL incorporada" prefixo={<Link2 className="h-3.5 w-3.5" />} valor={l.url ?? ''} aoConfirmar={(v) => { try { if (new URL(v).protocol === 'https:') set({ url: v } as Partial<Camada>) } catch { /* inválida */ } }} />
              <p className="text-[11px] leading-relaxed text-texto2">YouTube, Vimeo, Figma, Loom, Spline, Sketchfab ou Spotify. Roda isolado (sandbox) na apresentação.</p>
            </>
          )}
        </Secao>
      )
    case 'hotspot':
      return (
        <Secao titulo="Hotspot">
          <input aria-label="Descrição do hotspot" placeholder="Ex.: Ver aplicações da marca" value={l.ariaLabel} onChange={(e) => set({ ariaLabel: e.target.value || 'Área clicável' } as Partial<Camada>)} className="h-8 w-full rounded-md bg-superficie2 px-2 text-[12px] outline-none ring-inset hover:ring-1 hover:ring-bordaForte focus:!ring-1 focus:!ring-acento" />
          <Linha rotulo="Dica visual"><Interruptor rotulo="Contorno ao passar o mouse" ativo={l.hint} aoMudar={(hint) => set({ hint } as Partial<Camada>)} /></Linha>
          <div className="space-y-1.5 text-[11px] leading-relaxed text-texto2">
            <p><strong className="font-medium text-texto">Como funciona:</strong> o hotspot é uma área invisível por cima de qualquer coisa (foto, botão desenhado, trecho do mapa). Quem assiste clica nela e acontece o que você definir na aba <strong className="font-medium text-texto">Interações</strong>: ir para outra tela, abrir um link, mostrar ou esconder camadas.</p>
            <p><strong className="font-medium text-texto">Organização:</strong> dê um nome claro ao hotspot (ele aparece no painel Camadas e na navegação por teclado), posicione um por destino e, no modo Explorar, use-os para ligar as telas do mapa entre si.</p>
          </div>
        </Secao>
      )
    default: return null
  }
}

/** Download na apresentação: marca a mídia e, se preciso, liga o recurso no documento (botão e página final). */
function SecaoDownload({ c, set, editor }: { c: Camada; set: Set; editor: PropsSecao['editor'] }) {
  const cfg = editor.estado.documento.downloads
  return (
    <Secao titulo="Download">
      <Linha rotulo="Na apresentação"><Interruptor rotulo="Disponível para download" ativo={!!c.download} aoMudar={(v) => { set({ download: v || undefined } as Partial<Camada>); if (v && !cfg?.ativo) editor.acoes.atualizarDocumento({ downloads: { ativo: true, paginaFinal: cfg?.paginaFinal ?? false } }) }} /></Linha>
      {c.download && <Linha rotulo="Página no final"><Interruptor rotulo="Página de downloads no final da apresentação" ativo={!!cfg?.paginaFinal} aoMudar={(v) => editor.acoes.atualizarDocumento({ downloads: { ativo: true, paginaFinal: v } })} /></Linha>}
      <p className="text-[11px] leading-relaxed text-texto2">Quem assiste vê um botão de arquivos na barra da apresentação{cfg?.paginaFinal ? ' e a lista abre sozinha na última tela' : ''}.</p>
    </Secao>
  )
}

const NOMES_PESO: Record<number, string> = { 100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' }
const PESOS_LIVRES = [300, 400, 500, 600, 700, 800]

function SecaoTexto({ c, set, doDocumento }: { c: CamadaTexto; set: Set; doDocumento: string[] }) {
  const s = (p: Partial<CamadaTexto>) => set(p as Partial<Camada>)
  // pesos e itálico que a família tem de verdade (catálogo do Google; fontes fora dele: a lista livre)
  const cat = useCatalogoFontes()
  const fonte = cat?.porNome.get(c.fontFamily)
  const pesos = fonte ? pesosDisponiveis(c.italic && fonte.italico ? fonte.italico : fonte.pesos) : PESOS_LIVRES
  const opcoesPeso = [...(pesos.includes(c.fontWeight) ? [] : [c.fontWeight]), ...pesos].map((v) => ({ id: String(v), rotulo: NOMES_PESO[v] ? `${NOMES_PESO[v]}${pesos.includes(v) ? '' : ' (indisponível)'}` : String(v) }))
  return (
    <Secao titulo="Texto">
      <textarea aria-label="Conteúdo do texto" title="Conteúdo (também dá para editar com duplo clique no texto)" rows={1} value={c.text} onChange={(e) => s({ text: e.target.value })} className="block h-7 w-full resize-none overflow-hidden rounded-md bg-superficie2 px-2 py-[5px] text-[12px] leading-snug outline-none ring-inset transition-[height] hover:ring-1 hover:ring-bordaForte focus:h-16 focus:overflow-auto focus:!ring-1 focus:!ring-acento" />
      <SeletorFonte rotulo="Fonte" valor={c.fontFamily} doDocumento={doDocumento} aoMudar={(fontFamily, f) => s({ fontFamily, ...(f ? { fontWeight: varianteReal(f, c.fontWeight, c.italic).peso } : {}) })} />
      <div className="grid grid-cols-2 gap-1.5">
        <SeletorLista rotulo="Peso" valor={String(c.fontWeight)} aoMudar={(v) => s({ fontWeight: Number(v) })} opcoes={opcoesPeso} />
        <CampoNum prefixo={<IconeTamanho />} rotulo="Tamanho da fonte" valor={c.fontSize} min={6} max={800} aoMudar={(fontSize) => s({ fontSize })} />
        <CampoNum prefixo={<IconeEntrelinha />} rotulo="Entrelinha" titulo="Entrelinha (× tamanho)" valor={c.lineHeight} min={0.6} max={3} passo={0.05} casas={2} aoMudar={(lineHeight) => s({ lineHeight })} />
        <CampoNum prefixo={<IconeEspacamento />} rotulo="Espaçamento entre letras" valor={c.letterSpacing} min={-100} max={100} passo={0.5} casas={1} aoMudar={(letterSpacing) => s({ letterSpacing })} />
      </div>
      <div className="flex gap-2">
        <Segmentado rotulo="Alinhamento" icones valor={c.align} aoMudar={(align) => s({ align })} opcoes={[{ id: 'left', rotulo: 'Esquerda', icone: <AlignLeft className="h-3.5 w-3.5" /> }, { id: 'center', rotulo: 'Centro', icone: <AlignCenter className="h-3.5 w-3.5" /> }, { id: 'right', rotulo: 'Direita', icone: <AlignRight className="h-3.5 w-3.5" /> }, { id: 'justify', rotulo: 'Justificado', icone: <AlignJustify className="h-3.5 w-3.5" /> }]} />
        <div className="w-[96px] shrink-0">
          <Segmentado rotulo="Alinhamento vertical" icones valor={c.valign} aoMudar={(valign) => s({ valign })} opcoes={[{ id: 'top', rotulo: 'Topo', icone: <AlignVerticalJustifyStart className="h-3.5 w-3.5" /> }, { id: 'middle', rotulo: 'Meio', icone: <AlignVerticalJustifyCenter className="h-3.5 w-3.5" /> }, { id: 'bottom', rotulo: 'Base', icone: <AlignVerticalJustifyEnd className="h-3.5 w-3.5" /> }]} />
        </div>
      </div>
      <div className="flex gap-2">
        <GrupoBotoes className="!flex-none w-[72px]">
          <BotaoGrupo rotulo="Itálico" ativo={c.italic} onClick={() => s({ italic: !c.italic, ...(fonte && !c.italic && fonte.italico ? { fontWeight: varianteReal(fonte, c.fontWeight, true).peso } : {}) })}><Italic className="h-3.5 w-3.5" /></BotaoGrupo>
          <BotaoGrupo rotulo="Sublinhado" ativo={c.underline} onClick={() => s({ underline: !c.underline, ...(!c.underline && c.strikethrough ? { strikethrough: undefined } : {}) })}><Underline className="h-3.5 w-3.5" /></BotaoGrupo>
        </GrupoBotoes>
        <Segmentado rotulo="Caixa" valor={c.transform} aoMudar={(transform) => s({ transform })} opcoes={[{ id: 'none', rotulo: 'Aa' }, { id: 'uppercase', rotulo: 'AA' }, { id: 'lowercase', rotulo: 'aa' }]} />
        {/* como o "Type settings" do Figma: decoração, caixa, corte vertical, listas, truncar, quebra */}
        <BotaoOpcoesTexto c={c} set={s} />
      </div>
    </Secao>
  )
}

function SecaoFundoTexto({ c, set }: { c: CamadaTexto; set: Set }) {
  const s = (p: Partial<CamadaTexto>) => set(p as Partial<Camada>)
  return (
    <Secao titulo="Fundo da caixa" vazia={!c.background} aoAdicionar={!c.background ? () => s({ background: '#F5F5F4', padding: c.padding || Math.round(c.fontSize * 0.4) }) : undefined} rotuloAdicionar="Adicionar fundo ao texto">
      {c.background && (
        <>
          <LinhaPintura rotulo="Fundo do texto" valor={{ tipo: 'solido', cor: c.background }} aoMudar={(p) => p.tipo === 'solido' && s({ background: p.cor })} acoes={<BotaoMini rotulo="Remover fundo do texto" onClick={() => s({ background: undefined })}><Minus className="h-3.5 w-3.5" /></BotaoMini>} />
          <div className="grid grid-cols-[1fr_1fr_56px] gap-2">
            <CampoNum prefixo={<span className="text-[10px]">⬚</span>} rotulo="Respiro interno" valor={c.padding} min={0} max={200} aoMudar={(padding) => s({ padding })} />
          </div>
        </>
      )}
    </Secao>
  )
}

function SeletorAsset({ valor, assets, aoMudar, rotulo }: { valor: string; assets: AssetDemo[]; aoMudar: (id: string) => void; rotulo: string }) {
  return <SeletorLista rotulo={rotulo} valor={valor} aoMudar={aoMudar} opcoes={[...(!assets.some((a) => a.id === valor) ? [{ id: valor, rotulo: '(arquivo removido)' }] : []), ...assets.map((a) => ({ id: a.id, rotulo: a.nome }))]} />
}

const ENCAIXES = [{ id: 'cover', rotulo: 'Cobrir' }, { id: 'contain', rotulo: 'Conter' }, { id: 'fill', rotulo: 'Esticar' }] as const

function SecaoImagem({ c, set, assets }: { c: CamadaImagem; set: Set; assets: AssetDemo[] }) {
  const s = (p: Partial<CamadaImagem>) => set(p as Partial<Camada>)
  const adj = c.adjust ?? { brightness: 1, contrast: 1, saturate: 1, grayscale: 0 }
  const crop = c.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  return (
    <>
      <Secao titulo="Imagem">
        <SeletorAsset rotulo="Arquivo de imagem" valor={c.assetId} assets={assets.filter((a) => a.tipo === 'image' || a.tipo === 'gif' || a.tipo === 'svg')} aoMudar={(assetId) => s({ assetId })} />
        <Segmentado rotulo="Ajuste" valor={c.fit} aoMudar={(fit) => s({ fit })} opcoes={[...ENCAIXES]} />
        <Linha rotulo="Máscara"><SeletorLista rotulo="Máscara" valor={c.mask} aoMudar={(v) => s({ mask: v as CamadaImagem['mask'] })} opcoes={[{ id: 'none', rotulo: 'Nenhuma' }, { id: 'ellipse', rotulo: 'Círculo' }, { id: 'arch', rotulo: 'Arco' }, { id: 'triangle', rotulo: 'Triângulo' }]} /></Linha>
      </Secao>
      <Secao titulo="Recorte" vazia={!c.crop} aoAdicionar={!c.crop ? () => s({ crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }) : undefined} rotuloAdicionar="Recortar imagem" aoRemover={c.crop ? () => s({ crop: undefined }) : undefined} rotuloRemover="Remover recorte">
        <div className="grid grid-cols-2 gap-1.5">
          <CampoNum prefixo="X" rotulo="Recorte X (%)" valor={Math.round(crop.x * 100)} min={0} max={99} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, x: v / 100, w: Math.min(crop.w, 1 - v / 100) } })} />
          <CampoNum prefixo="Y" rotulo="Recorte Y (%)" valor={Math.round(crop.y * 100)} min={0} max={99} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, y: v / 100, h: Math.min(crop.h, 1 - v / 100) } })} />
          <CampoNum prefixo="W" rotulo="Recorte largura (%)" valor={Math.round(crop.w * 100)} min={1} max={100} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, w: Math.min(v / 100, 1 - crop.x) } })} />
          <CampoNum prefixo="H" rotulo="Recorte altura (%)" valor={Math.round(crop.h * 100)} min={1} max={100} sufixo="%" aoMudar={(v) => s({ crop: { ...crop, h: Math.min(v / 100, 1 - crop.y) } })} />
        </div>
      </Secao>
      <Secao titulo="Ajustes de imagem" vazia={!c.adjust} aoAdicionar={!c.adjust ? () => s({ adjust: adj }) : undefined} rotuloAdicionar="Adicionar ajustes de imagem" aoRemover={c.adjust ? () => s({ adjust: undefined }) : undefined} rotuloRemover="Restaurar imagem original">
        <Linha rotulo="Brilho"><Deslizante rotulo="Brilho" valor={Math.round(adj.brightness * 100)} max={200} aoMudar={(v) => s({ adjust: { ...adj, brightness: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
        <Linha rotulo="Contraste"><Deslizante rotulo="Contraste" valor={Math.round(adj.contrast * 100)} max={200} aoMudar={(v) => s({ adjust: { ...adj, contrast: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
        <Linha rotulo="Saturação"><Deslizante rotulo="Saturação" valor={Math.round(adj.saturate * 100)} max={200} aoMudar={(v) => s({ adjust: { ...adj, saturate: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
        <Linha rotulo="P&B"><Deslizante rotulo="Preto e branco" valor={Math.round(adj.grayscale * 100)} aoMudar={(v) => s({ adjust: { ...adj, grayscale: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>
      </Secao>
    </>
  )
}

function SecaoVideo({ c, set, assets }: { c: CamadaVideo; set: Set; assets: AssetDemo[] }) {
  const s = (p: Partial<CamadaVideo>) => set(p as Partial<Camada>)
  return (
    <Secao titulo="Vídeo">
      <SeletorAsset rotulo="Arquivo de vídeo" valor={c.assetId} assets={assets.filter((a) => a.tipo === 'video')} aoMudar={(assetId) => s({ assetId })} />
      <Segmentado rotulo="Ajuste" valor={c.fit} aoMudar={(fit) => s({ fit })} opcoes={[...ENCAIXES]} />
      <Linha rotulo="Autoplay"><Interruptor rotulo="Reproduzir automaticamente (mudo)" ativo={c.autoplay} aoMudar={(autoplay) => s({ autoplay, muted: autoplay ? true : c.muted })} /></Linha>
      <Linha rotulo="Repetir"><Interruptor rotulo="Repetir" ativo={c.loop} aoMudar={(loop) => s({ loop })} /></Linha>
      <Linha rotulo="Mudo"><Interruptor rotulo="Mudo" ativo={c.muted} aoMudar={(muted) => s({ muted })} /></Linha>
      <Linha rotulo="Controles"><Interruptor rotulo="Mostrar controles" ativo={c.controls} aoMudar={(controls) => s({ controls })} /></Linha>
      <Linha rotulo="Capa"><SeletorLista rotulo="Imagem de capa do vídeo" valor={c.posterAssetId ?? ''} aoMudar={(v) => s({ posterAssetId: v || undefined })} opcoes={[{ id: '', rotulo: 'Primeiro quadro' }, ...assets.filter((a) => a.tipo === 'image').map((a) => ({ id: a.id, rotulo: a.nome }))]} /></Linha>
    </Secao>
  )
}

/** Vetor colado do Figma/Illustrator: troca de cores sem voltar ao programa de origem. */
function SecaoSvg({ c, set }: { c: CamadaSvg; set: Set }) {
  const cores = useMemo(() => (c.markup ? coresDoSvg(c.markup).slice(0, 16) : []), [c.markup])
  return (
    <Secao titulo="Cores do vetor" acao={Object.keys(c.recolor).length ? <button type="button" className="rounded px-1.5 py-0.5 text-[11px] text-acento hover:bg-acentoSuave" onClick={() => set({ recolor: {} } as Partial<Camada>)}>Restaurar</button> : undefined}>
      {cores.length === 0 ? <p className="text-[12px] text-texto2">Nenhuma cor sólida encontrada (o vetor pode usar imagens ou gradientes).</p> : (
        <div className="space-y-1.5">
          {cores.map((orig) => (
            <div key={orig} className="flex items-center gap-1.5">
              <span className="h-5 w-5 shrink-0 rounded-[4px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]" style={{ background: orig }} title={`Original ${orig}`} />
              <span className="text-[11px] text-texto3" aria-hidden>→</span>
              <CampoCor rotulo={`Substituir ${orig}`} valor={c.recolor[orig] ?? orig.toUpperCase()} aoMudar={(nova) => nova && set({ recolor: { ...c.recolor, [orig]: nova } } as Partial<Camada>)} />
            </div>
          ))}
        </div>
      )}
      <Segmentado rotulo="Ajuste do vetor" valor={c.fit} aoMudar={(fit) => set({ fit } as Partial<Camada>)} opcoes={[{ id: 'contain', rotulo: 'Manter proporção' }, { id: 'fill', rotulo: 'Esticar' }]} />
      <p className="text-[11px] leading-relaxed text-texto2">Vetor nítido em qualquer zoom. Código ativo foi removido na importação.</p>
    </Secao>
  )
}

function SecaoModelo({ c, set, assets }: { c: CamadaModelo3d; set: Set; assets: AssetDemo[] }) {
  const s = (p: Partial<CamadaModelo3d>) => set(p as Partial<Camada>)
  return (
    <>
      <Secao titulo="Modelo 3D">
        <SeletorAsset rotulo="Arquivo 3D" valor={c.assetId} assets={assets.filter((a) => a.tipo === 'model3d')} aoMudar={(assetId) => s({ assetId })} />
        <Linha rotulo="Girar sozinho"><Interruptor rotulo="Girar automaticamente" ativo={c.autoRotate} aoMudar={(autoRotate) => s({ autoRotate })} /></Linha>
        {c.autoRotate && <Linha rotulo="Velocidade"><Deslizante rotulo="Velocidade de rotação" valor={c.rotationSpeed} max={180} aoMudar={(rotationSpeed) => s({ rotationSpeed })} formatar={(v) => `${v}°/s`} /></Linha>}
        <Linha rotulo="Convidado gira"><Interruptor rotulo="Convidado pode girar e dar zoom" ativo={c.cameraControls} aoMudar={(cameraControls) => s({ cameraControls })} /></Linha>
        <Linha rotulo="Realidade aum."><Interruptor rotulo="Ver em realidade aumentada no celular" ativo={c.ar} aoMudar={(ar) => s({ ar })} /></Linha>
        <p className="text-[11px] leading-relaxed text-texto2">Do Blender: Arquivo › Exportar › glTF 2.0 (.glb). Use “Interagir” na barra inferior para testar a câmera aqui.</p>
      </Secao>
      <Secao titulo="Câmera" recolhivel aberta={false}>
        <Linha rotulo="Órbita"><CampoTexto mono rotulo="Órbita inicial da câmera" valor={c.cameraOrbit} aoConfirmar={(v) => s({ cameraOrbit: v || '0deg 75deg 105%' })} /></Linha>
        <Linha rotulo="Campo de visão"><Deslizante rotulo="Campo de visão" valor={c.fieldOfView} min={10} max={90} aoMudar={(fieldOfView) => s({ fieldOfView })} formatar={(v) => `${v}°`} /></Linha>
        <Linha rotulo="Animação"><CampoTexto rotulo="Nome da animação do GLB" placeholder="clip (opcional)" valor={c.animation ?? ''} aoConfirmar={(v) => s({ animation: v || undefined })} /></Linha>
        <Linha rotulo="Capa"><SeletorLista rotulo="Imagem de capa do 3D" valor={c.posterAssetId ?? ''} aoMudar={(v) => s({ posterAssetId: v || undefined })} opcoes={[{ id: '', rotulo: 'Nenhuma' }, ...assets.filter((a) => a.tipo === 'image').map((a) => ({ id: a.id, rotulo: a.nome }))]} /></Linha>
      </Secao>
      <Secao titulo="Luz e fundo" recolhivel aberta={false}>
        <Linha rotulo="Iluminação"><SeletorLista rotulo="Iluminação" valor={c.environment} aoMudar={(v) => s({ environment: v as CamadaModelo3d['environment'] })} opcoes={[{ id: 'neutral', rotulo: 'Estúdio neutro' }, { id: 'legacy', rotulo: 'Clássica' }, { id: 'none', rotulo: 'Sem ambiente' }]} /></Linha>
        <Linha rotulo="Exposição"><Deslizante rotulo="Exposição" valor={Math.round(c.exposure * 100)} max={300} aoMudar={(v) => s({ exposure: v / 100 })} formatar={(v) => (v / 100).toFixed(1)} /></Linha>
        <Linha rotulo="Sombra"><Deslizante rotulo="Intensidade da sombra" valor={Math.round(c.shadowIntensity * 100)} max={200} aoMudar={(v) => s({ shadowIntensity: v / 100 })} formatar={(v) => (v / 100).toFixed(1)} /></Linha>
        <Linha rotulo="Suavidade"><Deslizante rotulo="Suavidade da sombra" valor={Math.round(c.shadowSoftness * 100)} max={100} aoMudar={(v) => s({ shadowSoftness: v / 100 })} formatar={(v) => `${v}%`} /></Linha>
        <CampoCor rotulo="Fundo do 3D" permitirVazio valor={c.background} aoMudar={(background) => s({ background })} />
      </Secao>
    </>
  )
}

function SecaoLottie({ c, set }: { c: CamadaLottie; set: Set }) {
  const s = (p: Partial<CamadaLottie>) => set(p as Partial<Camada>)
  return (
    <Secao titulo="Animação Lottie">
      <Linha rotulo="Repetir"><Interruptor rotulo="Repetir animação" ativo={c.loop} aoMudar={(loop) => s({ loop })} /></Linha>
      <Linha rotulo="Iniciar sozinha"><Interruptor rotulo="Iniciar automaticamente" ativo={c.autoplay} aoMudar={(autoplay) => s({ autoplay })} /></Linha>
      <Linha rotulo="Velocidade"><Deslizante rotulo="Velocidade" valor={Math.round(c.speed * 100)} min={10} max={300} aoMudar={(v) => s({ speed: v / 100 })} formatar={(v) => `${(v / 100).toFixed(1)}×`} /></Linha>
    </Secao>
  )
}
