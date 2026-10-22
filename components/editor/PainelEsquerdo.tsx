'use client'
import { useRef, useState, type JSX } from 'react'
import { Box, ChevronDown, ChevronRight, Code2, Copy, Crosshair, Eye, EyeOff, Film, GalleryHorizontal, Image as ImageIcon, Lock, LockOpen, MousePointerClick, PenTool, Quote, Sparkles, Square, Tag, Trash2, Type, Upload, Video, ArrowRight } from 'lucide-react'
import { IconeAutoLayout, IconeMascara } from './inspetor/icones'
import type { Camada } from '@/lib/scene/schema'
import { mapaDe, paiDe } from '@/lib/scene/arvore'
import type { Editor, AbaEsquerda } from '@/lib/editor/useEditor'
import { dados, ehErroDados, mensagemDeErro, type AssetDemo, type ProgressoUpload } from '@/lib/dados'
import { formatarBytes } from '@/lib/planos'
import { EXTENSOES_ACEITAS } from '@/lib/importar/arquivos'
import { importarArquivos, type Avisar } from '@/lib/editor/importar'
import { MiniaturaCena } from './MiniaturaCena'
import { QuemEstaNaTela } from './Presenca'
import { ICONE_TIPO } from './inspetor/AbaDesign'
import { Botao, BotaoIcone, Modal, cx } from '@/components/ui'

export function PainelEsquerdo({ editor, assets, avisar, aoBloco }: { editor: Editor; assets: AssetDemo[]; avisar: Avisar; aoBloco: (id: string) => void }) {
  const { estado, acoes } = editor
  const abas: { id: AbaEsquerda; rotulo: string }[] = [{ id: 'telas', rotulo: 'Telas' }, { id: 'camadas', rotulo: 'Camadas' }, { id: 'arquivos', rotulo: 'Arquivos' }, { id: 'blocos', rotulo: 'Blocos' }]
  return (
    <aside aria-label="Painel esquerdo" className="flex h-full flex-col border-r border-borda bg-superficie">
      <div role="tablist" aria-label="Painel esquerdo" className="flex shrink-0 gap-0.5 border-b border-borda p-2">
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={estado.abaEsquerda === a.id} onClick={() => acoes.ui({ abaEsquerda: a.id })} className={cx('flex-1 rounded-md px-1.5 py-1.5 text-[13px] transition-colors', estado.abaEsquerda === a.id ? 'bg-canvas font-medium text-texto' : 'text-texto2 hover:text-texto')}>
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto">
        {estado.abaEsquerda === 'telas' && <Telas editor={editor} assets={assets} />}
        {estado.abaEsquerda === 'camadas' && <Camadas editor={editor} />}
        {estado.abaEsquerda === 'arquivos' && <Arquivos editor={editor} assets={assets} avisar={avisar} />}
        {estado.abaEsquerda === 'blocos' && <Blocos aoBloco={aoBloco} />}
      </div>
    </aside>
  )
}

function Telas({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { estado, acoes } = editor
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)
  const mapa = Object.fromEntries(assets.map((a) => [a.id, a]))
  const cenas = estado.documento.scenes
  return (
    <div className="p-3">
      <ol role="listbox" aria-label="Telas" className="space-y-3">
        {cenas.map((c, i) => {
          const ativa = c.id === estado.cenaId
          return (
            <li
              key={c.id}
              role="option"
              aria-selected={ativa}
              tabIndex={0}
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setArrastando(i) }}
              onDragOver={(e) => { e.preventDefault(); setSobre(i) }}
              onDrop={(e) => { e.preventDefault(); if (arrastando != null && arrastando !== i) acoes.moverCena(arrastando, i); setArrastando(null); setSobre(null) }}
              onDragEnd={() => { setArrastando(null); setSobre(null) }}
              onClick={() => acoes.irParaCena(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') acoes.irParaCena(c.id)
                if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); acoes.moverCena(i, i - 1) }
                if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); acoes.moverCena(i, i + 1) }
              }}
              className={cx('group relative flex cursor-pointer gap-2 outline-none', arrastando === i && 'opacity-40')}
            >
              {sobre === i && arrastando !== null && arrastando !== i && <span className="absolute -top-2 left-6 right-0 h-0.5 rounded bg-acento" />}
              <span className="mono w-4 pt-1 text-[10px] text-texto3">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className={cx('relative overflow-hidden rounded-[7px] outline outline-[1.5px] outline-offset-2', ativa ? 'outline-acento' : 'outline-transparent group-hover:outline-borda')}>
                  {/* fora da área visível do painel, a miniatura não é pintada nem composta (content-visibility): numa
                      apresentação longa elas eram metade dos elementos da página, refeitos a cada quadro de animação */}
                  <MiniaturaCena cena={c} assets={mapa} largura={186} className="rounded-[6px] border-0 [content-visibility:auto]" />
                  <QuemEstaNaTela sala={editor.sala} cenaId={c.id} />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="truncate text-[13px]">{c.title || 'Sem título'}</span>
                  {c.notes && <span className="rotulo-mono !text-[9px]" title="Tem notas do apresentador">notas</span>}
                </div>
              </div>
              <div className="absolute right-0 top-0 hidden gap-0.5 rounded-md bg-superficie/95 p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
                <BotaoIcone rotulo="Duplicar tela" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); acoes.duplicarCena(c.id) }}><Copy className="h-3 w-3" /></BotaoIcone>
                <BotaoIcone rotulo="Apagar tela" className="h-6 w-6" disabled={cenas.length <= 1} onClick={(e) => { e.stopPropagation(); acoes.removerCena(c.id) }}><Trash2 className="h-3 w-3" /></BotaoIcone>
              </div>
            </li>
          )
        })}
      </ol>
      <button type="button" onClick={() => acoes.adicionarCena(editor.indiceCena)} className="mt-4 h-9 w-full rounded-lg border border-dashed border-[#D4D4D4] text-[13px] text-texto2 hover:border-acento hover:text-acento">+ Nova tela</button>
    </div>
  )
}

function nomeCamada(l: Camada) {
  return l.name || (l.type === 'text' ? l.text.slice(0, 28) || 'Texto' : l.type === 'svg' ? 'Vetor' : l.type === 'model3d' ? 'Modelo 3D' : l.type === 'frame' ? (l.layout ? 'Auto layout' : 'Frame') : l.id)
}

/**
 * Camadas em árvore (como no Figma): frames expansíveis com os filhos recuados.
 * Arrastar: metade de cima/baixo da linha = acima/abaixo (mesmo pai); meio de um frame = dentro.
 */
function Camadas({ editor }: { editor: Editor }) {
  const { cena, estado, acoes } = editor
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [destino, setDestino] = useState<{ id: string; onde: 'acima' | 'abaixo' | 'dentro' } | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [fechados, setFechados] = useState<ReadonlySet<string>>(new Set())
  if (!cena) return null
  if (!cena.layers.length) return <p className="p-4 text-[13px] text-texto2">Esta tela ainda não tem camadas. Cole algo (Ctrl+V), arraste arquivos ou use a aba Blocos.</p>
  const mapa = mapaDe(cena.layers)
  const filhos = new Map<string | undefined, Camada[]>()
  for (const l of cena.layers) {
    const p = paiDe(l, mapa)?.id
    filhos.set(p, [...(filhos.get(p) ?? []), l])
  }
  for (const lista of filhos.values()) lista.sort((a, b) => b.z - a.z)
  const alternar = (id: string) => setFechados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const linha = (l: Camada, nivel: number, vistos: Set<string>): JSX.Element | null => {
    if (vistos.has(l.id)) return null
    vistos.add(l.id)
    const Icone = ICONE_TIPO[l.type]
    const sel = estado.selecao.includes(l.id)
    const sub = filhos.get(l.id) ?? []
    const ehFrame = l.type === 'frame'
    const aberto = ehFrame && !fechados.has(l.id)
    const alvo = destino?.id === l.id && arrastando && arrastando !== l.id ? destino.onde : null
    return (
      <li key={l.id} role="treeitem" aria-label={nomeCamada(l)} aria-selected={sel} aria-level={nivel + 1} aria-expanded={ehFrame ? aberto : undefined}>
        <div
          draggable
          onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setArrastando(l.id) }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            const f = (e.clientY - r.top) / r.height
            const onde = ehFrame && f > 0.3 && f < 0.7 ? 'dentro' : f < 0.5 ? 'acima' : 'abaixo'
            if (destino?.id !== l.id || destino.onde !== onde) setDestino({ id: l.id, onde })
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (arrastando && arrastando !== l.id && destino) acoes.moverNaLista(arrastando, l.id, destino.onde)
            setArrastando(null)
            setDestino(null)
          }}
          onDragEnd={() => { setArrastando(null); setDestino(null) }}
          onClick={(e) => (e.shiftKey ? acoes.selecionarExato(sel ? estado.selecao.filter((x) => x !== l.id) : [...estado.selecao, l.id]) : acoes.selecionarExato([l.id]))}
          onDoubleClick={() => setRenomeando(l.id)}
          style={{ paddingLeft: 8 + nivel * 14 }}
          className={cx(
            'group relative flex h-8 cursor-default items-center gap-1.5 rounded-md pr-2 text-[13px]',
            sel ? 'bg-acentoSuave text-texto' : 'hover:bg-hover',
            l.hidden && 'opacity-50',
            l.groupId && !ehFrame && 'pl-5',
            alvo === 'dentro' && 'ring-[1.5px] ring-inset ring-acento',
            arrastando === l.id && 'opacity-40'
          )}
        >
          {alvo === 'acima' && <span className="pointer-events-none absolute -top-px right-1 h-0.5 rounded bg-acento" style={{ left: 8 + nivel * 14 }} />}
          {alvo === 'abaixo' && <span className="pointer-events-none absolute -bottom-px right-1 h-0.5 rounded bg-acento" style={{ left: 8 + nivel * 14 }} />}
          {ehFrame ? (
            <button type="button" aria-label={aberto ? 'Recolher frame' : 'Expandir frame'} onClick={(e) => { e.stopPropagation(); alternar(l.id) }} className="-ml-1 flex h-4 w-4 shrink-0 items-center justify-center text-texto3 hover:text-texto">
              <ChevronRight className={cx('h-3 w-3 transition-transform', aberto && 'rotate-90')} />
            </button>
          ) : nivel > 0 ? <span className="w-3 shrink-0" /> : null}
          {ehFrame && l.layout ? (
            <span title={`Auto layout ${l.layout.direction === 'vertical' ? 'vertical' : l.layout.direction === 'wrap' ? 'com quebra' : 'horizontal'}`} className={cx('flex shrink-0', sel ? 'text-acento' : 'text-texto3')}><IconeAutoLayout direcao={l.layout.direction} /></span>
          ) : l.type === 'shape' && l.isMask ? (
            <span title="Máscara" className={cx('flex shrink-0', sel ? 'text-acento' : 'text-texto3')}><IconeMascara /></span>
          ) : (
            <Icone className={cx('h-3.5 w-3.5 shrink-0', sel ? 'text-acento' : 'text-texto3')} strokeWidth={1.75} />
          )}
          {renomeando === l.id ? (
            <input autoFocus aria-label="Renomear camada" defaultValue={l.name ?? ''} placeholder={nomeCamada(l)} onBlur={(e) => { acoes.atualizarCamadas([l.id], { name: e.target.value || undefined }); setRenomeando(null) }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }} className="h-6 min-w-0 flex-1 rounded bg-superficie px-1 outline-none ring-1 ring-acento" />
          ) : (
            <span className="min-w-0 flex-1 truncate">{nomeCamada(l)}</span>
          )}
          {l.interactions.length > 0 && <MousePointerClick className="h-3 w-3 shrink-0 text-acento" aria-label="Tem interação" />}
          <button type="button" aria-label={l.locked ? 'Destravar' : 'Travar'} onClick={(e) => { e.stopPropagation(); acoes.atualizarCamadas([l.id], { locked: !l.locked }) }} className={cx('shrink-0 text-texto3 hover:text-texto', !l.locked && 'opacity-0 group-hover:opacity-100')}>{l.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}</button>
          <button type="button" aria-label={l.hidden ? 'Mostrar' : 'Ocultar'} onClick={(e) => { e.stopPropagation(); acoes.atualizarCamadas([l.id], { hidden: !l.hidden }) }} className={cx('shrink-0 text-texto3 hover:text-texto', !l.hidden && 'opacity-0 group-hover:opacity-100')}>{l.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
        </div>
        {aberto && sub.length > 0 && <ul role="group">{sub.map((f) => linha(f, nivel + 1, vistos))}</ul>}
      </li>
    )
  }
  const vistos = new Set<string>()
  return (
    <ul role="tree" aria-label="Camadas da tela" className="p-2" onDragLeave={(e) => { if (e.currentTarget === e.target) setDestino(null) }}>
      {(filhos.get(undefined) ?? []).map((l) => linha(l, 0, vistos))}
    </ul>
  )
}

type Filtro = 'tudo' | 'image' | 'svg' | 'model3d' | 'video' | 'lottie'

function Arquivos({ editor, assets, avisar }: { editor: Editor; assets: AssetDemo[]; avisar: Avisar }) {
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [enviando, setEnviando] = useState<Record<string, ProgressoUpload>>({})
  const [excluindo, setExcluindo] = useState<{ asset: AssetDemo; usos: string[] | null } | null>(null)
  const [apagando, setApagando] = useState(false)
  const apagar = async () => {
    if (!excluindo) return
    setApagando(true)
    try {
      // sem a lista de usos (modo real), o servidor recusa mídia em uso e devolve os projetos: pergunta de novo
      await dados.excluirAsset(excluindo.asset.id, excluindo.usos != null)
      setExcluindo(null)
      avisar('Arquivo excluído.')
    } catch (e) {
      const usos = ehErroDados(e, 'entrada_invalida') ? (e.details as { projetos?: string[] } | undefined)?.projetos : undefined
      if (usos?.length) setExcluindo({ asset: excluindo.asset, usos })
      else { setExcluindo(null); avisar(mensagemDeErro(e, 'Não foi possível excluir.'), 'erro') }
    } finally {
      setApagando(false)
    }
  }
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const lista = assets.filter((a) => filtro === 'tudo' || a.tipo === filtro || (filtro === 'image' && a.tipo === 'gif'))
  const enviar = async (arquivos: File[]) => {
    if (!arquivos.length) return
    const prontos = await importarArquivos(editor, arquivos, { avisar, aoProgredir: (nome, p) => setEnviando((s) => ({ ...s, [nome]: p })) })
    setTimeout(() => setEnviando({}), 1200)
    if (prontos.length > 1) avisar(`${prontos.length} arquivos importados. Dica: em Telas, use “Uma tela por arquivo”.`, 'info')
  }
  const filtros: { id: Filtro; rotulo: string }[] = [{ id: 'tudo', rotulo: 'Tudo' }, { id: 'image', rotulo: 'Imagens' }, { id: 'svg', rotulo: 'Vetores' }, { id: 'model3d', rotulo: '3D' }, { id: 'video', rotulo: 'Vídeo' }, { id: 'lottie', rotulo: 'Lottie' }]
  return (
    <div className="p-3" onDragOver={(e) => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)} onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) void enviar(Array.from(e.dataTransfer.files)) }}>
      <input ref={entrada} type="file" multiple accept={EXTENSOES_ACEITAS} className="hidden" onChange={(e) => { void enviar(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      <button type="button" onClick={() => entrada.current?.click()} className={cx('flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center text-[12px] text-texto2 hover:border-acento hover:text-acento', arrastando ? 'border-acento bg-acentoSuave text-acento' : 'border-[#D4D4D4]')}>
        <Upload className="h-4 w-4" />
        <span className="font-medium">Enviar ou soltar arquivos</span>
        <span className="text-[11px] text-texto3">PNG, JPG, SVG, MP4, GLB (Blender), Lottie</span>
      </button>
      {Object.entries(enviando).map(([nome, p]) => (
        <div key={nome} className="mt-2 rounded-md bg-superficie2 px-2 py-1.5 text-[11px]">
          <div className="flex justify-between"><span className="truncate">{nome}</span><span className={p.fase === 'failed' ? 'text-perigo' : 'text-texto2'}>{{ validating: 'Validando', uploading: 'Enviando', processing: 'Processando', ready: 'Pronto', failed: 'Falhou' }[p.fase]}</span></div>
          <div className="mt-1 h-0.5 overflow-hidden rounded bg-borda"><div className="h-full bg-acento transition-all" style={{ width: `${p.progresso}%` }} /></div>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap gap-1">
        {filtros.map((f) => <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)} className={cx('rounded-full px-2.5 py-1 text-[11px]', filtro === f.id ? 'bg-grafite text-white' : 'bg-superficie2 text-texto2 hover:text-texto')}>{f.rotulo}</button>)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {lista.map((a) => (
          <li key={a.id} className="group relative">
            <button type="button" draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-mostra-asset', a.id); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => editor.acoes.adicionarAsset(a)} title={`Adicionar ${a.nome} à tela`} className="w-full text-left">
              <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-borda bg-superficie2">
                {a.thumbUrl ? <img src={a.thumbUrl} alt="" className={cx('h-full w-full', a.tipo === 'svg' ? 'object-contain p-2' : 'object-cover')} /> : <IconeAsset tipo={a.tipo} />}
              </span>
              <span className="mt-1 block truncate text-[11px]">{a.nome}</span>
              <span className="block text-[10px] text-texto3">{{ image: 'Imagem', gif: 'GIF', svg: 'Vetor', model3d: '3D · GLB', video: 'Vídeo', lottie: 'Lottie' }[a.tipo]} · {formatarBytes(a.bytes)}</span>
            </button>
            <BotaoIcone rotulo={`Excluir ${a.nome}`} className="absolute right-1 top-1 hidden h-6 w-6 bg-superficie/95 group-hover:inline-flex" onClick={() => setExcluindo({ asset: a, usos: dados.projetosQueUsam(a.id)?.map((p) => p.nome) ?? null })}><Trash2 className="h-3 w-3" /></BotaoIcone>
          </li>
        ))}
      </ul>
      {!lista.length && <p className="mt-4 text-center text-[12px] text-texto2">Nada aqui ainda.</p>}
      {assets.length > 1 && filtro !== 'model3d' && filtro !== 'lottie' && (
        <button type="button" onClick={() => editor.acoes.cenasDeAssets(lista.filter((a) => a.tipo === 'image' || a.tipo === 'svg').slice(0, 30))} className="mt-4 h-8 w-full rounded-md border border-borda text-[12px] hover:border-[#D4D4D4]">Uma tela por imagem ({lista.filter((a) => a.tipo === 'image' || a.tipo === 'svg').length})</button>
      )}
      {excluindo && (
        <Modal aberto aoFechar={() => setExcluindo(null)} titulo="Excluir arquivo?" largura="sm" descricao={excluindo.asset.nome} rodape={<><Botao variante="secundario" onClick={() => setExcluindo(null)}>Cancelar</Botao><Botao variante="perigo" carregando={apagando} onClick={() => void apagar()}>{excluindo.usos == null || excluindo.usos.length ? 'Excluir mesmo assim' : 'Excluir'}</Botao></>}>
          {excluindo.usos == null ? <p className="text-sm text-texto2">Se algum projeto usar este arquivo, avisamos antes de excluir.</p> : excluindo.usos.length ? <p className="text-sm text-perigo">Usado em: {excluindo.usos.join(', ')}. As telas mostrarão “mídia indisponível”.</p> : <p className="text-sm text-texto2">Nenhum projeto usa este arquivo.</p>}
        </Modal>
      )}
    </div>
  )
}

function IconeAsset({ tipo }: { tipo: AssetDemo['tipo'] }) {
  const I = tipo === 'model3d' ? Box : tipo === 'video' ? Film : tipo === 'lottie' ? Sparkles : tipo === 'svg' ? PenTool : ImageIcon
  return <I className="h-6 w-6 text-texto3" strokeWidth={1.25} />
}

export const BLOCOS = [
  { id: 'texto', rotulo: 'Texto', icone: Type },
  { id: 'titulo', rotulo: 'Título', icone: Type },
  { id: 'imagem', rotulo: 'Imagem', icone: ImageIcon },
  { id: 'video', rotulo: 'Vídeo', icone: Video },
  { id: 'botao', rotulo: 'Botão', icone: MousePointerClick },
  { id: 'forma', rotulo: 'Forma', icone: Square },
  { id: 'hotspot', rotulo: 'Hotspot', icone: Crosshair },
  { id: 'galeria', rotulo: 'Galeria', icone: GalleryHorizontal },
  { id: 'embed', rotulo: 'Embed', icone: Code2 },
  { id: 'modelo3d', rotulo: 'Modelo 3D', icone: Box },
  { id: 'lottie', rotulo: 'Lottie', icone: Sparkles },
  { id: 'vetor', rotulo: 'Vetor SVG', icone: PenTool },
  { id: 'etiqueta', rotulo: 'Etiqueta', icone: Tag },
  { id: 'citacao', rotulo: 'Citação', icone: Quote },
  { id: 'seta', rotulo: 'Seta', icone: ArrowRight },
] as const

function Blocos({ aoBloco }: { aoBloco: (id: string) => void }) {
  return (
    <div className="p-3">
      <ul className="grid grid-cols-3 gap-2">
        {BLOCOS.map((b) => (
          <li key={b.id}>
            <button type="button" draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-mostra-bloco', b.id); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => aoBloco(b.id)} className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-borda text-[12px] text-[#525252] hover:border-acento hover:text-acento">
              <b.icone className="h-4 w-4" strokeWidth={1.6} />
              {b.rotulo}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-lg bg-superficie2 p-3 text-[12px] leading-relaxed text-texto2">
        <div className="mb-1 flex items-center gap-1 font-medium text-texto"><ChevronDown className="h-3 w-3" /> Colar de outros programas</div>
        <p><b>Figma:</b> botão direito › Copiar como › SVG (ou PNG) e Ctrl+V aqui.</p>
        <p><b>Illustrator:</b> selecione e Ctrl+C (com Clipboard SVG ativo) e cole.</p>
        <p><b>Blender:</b> exporte glTF 2.0 (.glb) e arraste o arquivo.</p>
        <p><b>After Effects:</b> exporte Lottie (JSON) e arraste.</p>
      </div>
    </div>
  )
}
