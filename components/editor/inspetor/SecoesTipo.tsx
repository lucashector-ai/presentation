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
import { EnviarImagem } from './EnviarImagem'
import { PROPS_TRECHO, aplicarTrecho, ajustarTrechos, limparTrecho, valorNoIntervalo, type EstiloTrecho } from '@/lib/scene/trechos'
import { definirSelecaoTexto, useSelecaoTexto } from '@/lib/editor/selecaoTexto'
import { useTextoSvg } from '@/components/renderer/svgDoAsset'

type Set = (p: Partial<Camada>) => void

/** Download na apresentação (mídias): perto de Exportar, no fim do painel. */
export function SecaoDownloadDaMidia({ editor }: PropsSecao) {
  const { sel, set } = useCamadas(editor)
  const l = sel[0]
  if (!l || sel.length > 1 || !['image', 'video', 'svg', 'model3d', 'lottie'].includes(l.type)) return null
  return <SecaoDownload c={l as Parameters<typeof SecaoDownload>[0]['c']} set={set} editor={editor} />
}

export function SecoesDoTipo({ editor, assets = [] }: PropsSecao) {
  const { sel, set } = useCamadas(editor)
  const cenas = editor.estado.documento.scenes
  const doDocumento = useMemo(() => fontesDoDocumento({ scenes: cenas }), [cenas])
  const l = sel[0]
  if (!l || sel.length > 1) return null
  switch (l.type) {
    case 'text': return <><SecaoTexto c={l} set={set} doDocumento={doDocumento} /><SecaoFundoTexto c={l} set={set} /></>
    case 'image': return <SecaoImagem c={l} set={set} assets={assets} />
    case 'video': return <SecaoVideo c={l} set={set} assets={assets} />
    case 'svg': return <SecaoSvg c={l} set={set} assets={assets} />
    case 'model3d': return <SecaoModelo c={l} set={set} assets={assets} />
    case 'lottie': return <SecaoLottie c={l} set={set} />
    case 'shape':
      // polígono: lados; estrela: pontas e raio interno (como no Figma)
      if (l.shape !== 'polygon' && l.shape !== 'star') return null
      return (
        <Secao titulo={l.shape === 'star' ? 'Estrela' : 'Polígono'}>
          <div className="grid grid-cols-2 gap-1">
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
              <textarea aria-label="HTML incorporado" defaultValue={l.html} spellCheck={false} onBlur={(ev) => { const v = ev.target.value; if (v.trim() && v !== l.html) set({ html: v } as Partial<Camada>) }} className="mono min-h-[160px] w-full resize-y rounded-lg border border-borda bg-superficie px-2.5 py-2 text-[11px] leading-5 text-texto outline-none focus:border-acento" />
            </>
          ) : (
            <>
              <CampoTexto rotulo="URL incorporada" prefixo={<Link2 className="h-3.5 w-3.5" />} valor={l.url ?? ''} aoConfirmar={(v) => { try { if (new URL(v).protocol === 'https:') set({ url: v } as Partial<Camada>) } catch { /* inválida */ } }} />
              <p className="text-[11px] text-texto3">YouTube, Vimeo, Figma, Loom, Spline, Sketchfab, Spotify.</p>
            </>
          )}
        </Secao>
      )
    case 'hotspot':
      return (
        <Secao titulo="Hotspot">
          <input aria-label="Descrição do hotspot" placeholder="Ex.: Ver aplicações da marca" value={l.ariaLabel} onChange={(e) => set({ ariaLabel: e.target.value || 'Área clicável' } as Partial<Camada>)} className="h-6 w-full rounded-md bg-superficie2 px-2 text-[11px] outline-none ring-inset hover:ring-1 hover:ring-bordaForte focus:!ring-1 focus:!ring-acento" />
          <Linha rotulo="Dica visual"><Interruptor rotulo="Contorno ao passar o mouse" ativo={l.hint} aoMudar={(hint) => set({ hint } as Partial<Camada>)} /></Linha>
          <p className="text-[11px] text-texto3">Área invisível e clicável. A ação fica na aba Interações.</p>
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
    </Secao>
  )
}

const NOMES_PESO: Record<number, string> = { 100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' }
const PESOS_LIVRES = [300, 400, 500, 600, 700, 800]

/** Trecho selecionado neste texto (rich text) ou null: o painel aplica o estilo só nele. */
export function useTrechoAtivo(c: CamadaTexto) {
  const sel = useSelecaoTexto()
  return sel && sel.id === c.id && sel.fim <= c.text.length ? sel : null
}

function SecaoTexto({ c, set, doDocumento }: { c: CamadaTexto; set: Set; doDocumento: string[] }) {
  const trecho = useTrechoAtivo(c)
  // com um trecho selecionado, fonte, peso, itálico e sublinhado valem só para ele; o resto (tamanho, entrelinha,
  // alinhamento…) continua sendo do texto inteiro
  const s = (p: Partial<CamadaTexto>) => {
    const deTrecho = trecho && Object.keys(p).length > 0 && Object.keys(p).every((k) => (PROPS_TRECHO as readonly string[]).includes(k))
    if (deTrecho) set({ trechos: aplicarTrecho(c.trechos, trecho.inicio, trecho.fim, p as EstiloTrecho, c.text.length) } as Partial<Camada>)
    else set(p as Partial<Camada>)
  }
  // valores mostrados: os do trecho (quando iguais em todo ele), senão os do texto
  const v = trecho ? { fontFamily: valorNoIntervalo(c, trecho.inicio, trecho.fim, 'fontFamily') ?? c.fontFamily, fontWeight: valorNoIntervalo(c, trecho.inicio, trecho.fim, 'fontWeight') ?? c.fontWeight, italic: valorNoIntervalo(c, trecho.inicio, trecho.fim, 'italic') ?? c.italic, underline: valorNoIntervalo(c, trecho.inicio, trecho.fim, 'underline') ?? c.underline } : c
  // pesos e itálico que a família tem de verdade (catálogo do Google; fontes fora dele: a lista livre)
  const cat = useCatalogoFontes()
  const fonte = cat?.porNome.get(v.fontFamily)
  const pesos = fonte ? pesosDisponiveis(v.italic && fonte.italico ? fonte.italico : fonte.pesos) : PESOS_LIVRES
  const opcoesPeso = [...(pesos.includes(v.fontWeight) ? [] : [v.fontWeight]), ...pesos].map((p) => ({ id: String(p), rotulo: NOMES_PESO[p] ? `${NOMES_PESO[p]}${pesos.includes(p) ? '' : ' (indisponível)'}` : String(p) }))
  return (
    <Secao titulo="Texto">
      {trecho && (
        <div className="flex items-center gap-1 rounded-md bg-acentoSuave px-2 py-1 text-[11px] text-acento">
          <span className="min-w-0 flex-1 truncate">Só no trecho “{c.text.slice(trecho.inicio, trecho.fim)}”</span>
          <button type="button" title="Tirar o estilo próprio deste trecho" onClick={() => set({ trechos: limparTrecho(c.trechos, trecho.inicio, trecho.fim, c.text.length) } as Partial<Camada>)} className="shrink-0 rounded px-1 hover:bg-acento/10">Limpar</button>
          <button type="button" title="Voltar a editar o texto inteiro" onClick={() => definirSelecaoTexto(null)} className="shrink-0 rounded px-1 hover:bg-acento/10">Texto todo</button>
        </div>
      )}
      <textarea aria-label="Conteúdo do texto" title="Conteúdo (também dá para editar com duplo clique no texto)" rows={1} value={c.text} onChange={(e) => set({ text: e.target.value, trechos: ajustarTrechos(c.trechos, c.text, e.target.value) } as Partial<Camada>)} className="block min-h-6 w-full resize-none overflow-hidden rounded-md bg-superficie2 px-2 py-[5px] text-[11px] leading-snug outline-none ring-inset transition-[height] hover:ring-1 hover:ring-bordaForte focus:h-16 focus:overflow-auto focus:!ring-1 focus:!ring-acento" />
      <SeletorFonte rotulo="Fonte" valor={v.fontFamily} doDocumento={doDocumento} aoMudar={(fontFamily, f) => s({ fontFamily, ...(f ? { fontWeight: varianteReal(f, v.fontWeight, v.italic).peso } : {}) })} />
      <div className="grid grid-cols-2 gap-1">
        <SeletorLista rotulo="Peso" valor={String(v.fontWeight)} aoMudar={(p) => s({ fontWeight: Number(p) })} opcoes={opcoesPeso} />
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
          <BotaoGrupo rotulo="Itálico" ativo={v.italic} onClick={() => s({ italic: !v.italic, ...(fonte && !v.italic && fonte.italico ? { fontWeight: varianteReal(fonte, v.fontWeight, true).peso } : {}) })}><Italic className="h-3.5 w-3.5" /></BotaoGrupo>
          <BotaoGrupo rotulo="Sublinhado" ativo={v.underline} onClick={() => s(trecho ? { underline: !v.underline } : { underline: !v.underline, ...(!v.underline && c.strikethrough ? { strikethrough: undefined } : {}) })}><Underline className="h-3.5 w-3.5" /></BotaoGrupo>
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
          <div className="grid grid-cols-[1fr_1fr_56px] gap-1">
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

/** Botão "Adicionar imagem": envia um arquivo do computador e já o coloca na camada (troca a imagem). */
function SecaoImagem({ c, set, assets }: { c: CamadaImagem; set: Set; assets: AssetDemo[] }) {
  const s = (p: Partial<CamadaImagem>) => set(p as Partial<Camada>)
  const adj = c.adjust ?? { brightness: 1, contrast: 1, saturate: 1, grayscale: 0 }
  const crop = c.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  return (
    <>
      <Secao titulo="Imagem">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1"><SeletorAsset rotulo="Arquivo de imagem" valor={c.assetId} assets={assets.filter((a) => a.tipo === 'image' || a.tipo === 'gif' || a.tipo === 'svg')} aoMudar={(assetId) => s({ assetId })} /></div>
          <EnviarImagem aoEnviada={(assetId) => s({ assetId })} />
        </div>
        <Segmentado rotulo="Ajuste" valor={c.fit} aoMudar={(fit) => s({ fit })} opcoes={[...ENCAIXES]} />
        <Linha rotulo="Máscara"><SeletorLista rotulo="Máscara" valor={c.mask} aoMudar={(v) => s({ mask: v as CamadaImagem['mask'] })} opcoes={[{ id: 'none', rotulo: 'Nenhuma' }, { id: 'ellipse', rotulo: 'Círculo' }, { id: 'arch', rotulo: 'Arco' }, { id: 'triangle', rotulo: 'Triângulo' }]} /></Linha>
      </Secao>
      <Secao titulo="Recorte" vazia={!c.crop} aoAdicionar={!c.crop ? () => s({ crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }) : undefined} rotuloAdicionar="Recortar imagem" aoRemover={c.crop ? () => s({ crop: undefined }) : undefined} rotuloRemover="Remover recorte">
        <div className="grid grid-cols-2 gap-1">
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
function SecaoSvg({ c, set, assets }: { c: CamadaSvg; set: Set; assets: AssetDemo[] }) {
  // vetor guardado como arquivo (grande ou .svg enviado): baixa o texto para achar e trocar as cores
  const texto = useTextoSvg(c.markup ? undefined : assets.find((a) => a.id === c.assetId)?.url)
  const markup = c.markup ?? texto
  const cores = useMemo(() => (markup ? coresDoSvg(markup).slice(0, 16) : []), [markup])
  return (
    <Secao titulo="Cores do vetor" acao={Object.keys(c.recolor).length ? <button type="button" className="rounded px-1.5 py-0.5 text-[11px] text-acento hover:bg-acentoSuave" onClick={() => set({ recolor: {} } as Partial<Camada>)}>Restaurar</button> : undefined}>
      {cores.length === 0 ? <p className="text-[11px] text-texto2">{!c.markup && texto === undefined ? 'Lendo as cores do vetor…' : 'Nenhuma cor sólida encontrada (o vetor pode usar imagens ou gradientes).'}</p> : (
        <div className="space-y-2">
          {/* só a cor de destino, editável; a original fica no rótulo e na dica */}
          {cores.map((orig, i) => (
            <div key={orig} className="flex items-center gap-2" title={`Cor ${i + 1} · original ${orig.toUpperCase()}`}>
              <span className="w-[40px] shrink-0 text-[11px] text-texto2">Cor {i + 1}</span>
              <CampoCor rotulo={`Cor ${i + 1} do vetor (original ${orig.toUpperCase()})`} valor={c.recolor[orig] ?? orig.toUpperCase()} aoMudar={(nova) => nova && set({ recolor: { ...c.recolor, [orig]: nova } } as Partial<Camada>)} />
            </div>
          ))}
        </div>
      )}
      <Segmentado rotulo="Ajuste do vetor" valor={c.fit} aoMudar={(fit) => set({ fit } as Partial<Camada>)} opcoes={[{ id: 'contain', rotulo: 'Manter proporção' }, { id: 'fill', rotulo: 'Esticar' }]} />
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
        <p className="text-[11px] text-texto3">Do Blender: exportar glTF 2.0 (.glb).</p>
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
