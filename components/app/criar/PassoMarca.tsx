'use client'
/**
 * Passo "Marca": logo (paleta extraída no navegador), cores (do logo, do pedido ou paletas prontas), par de fontes
 * da biblioteca e nome. Tudo aplicado na montagem, sem IA. Kits de marca salvos no espaço para reusar.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bookmark, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { Alternador, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { carregarFontes } from '@/components/renderer/fontes'
import { dados, mensagemDeErro, type KitMarca } from '@/lib/dados'
import { sanitizarSvgNavegador } from '@/lib/editor/importar'
import { PARES_FONTES, RE_HEX } from '@/lib/ia/designSystem'
import { coresDoTexto, ordenarCoresDaMarca, paletasDoLogo, PALETAS_PRONTAS, type PaletaSugerida } from '@/lib/ia/marca'
import { paletaDoPedido } from '@/lib/ia/analisePedido'
import { pilhaFonte } from '@/lib/design-tokens'
import { analisarLogo } from './logo'
import type { MarcaEscolhida } from './estado'
import { Amostras, Secao, SeloCusto } from './ui'

const ACEITA_LOGO = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,.svg'

export function PassoMarca({ marca, aoMudar, prompt, kits, aoSalvarKit, aoExcluirKit, aplicarKit, previa }: {
  marca: MarcaEscolhida
  aoMudar: (m: MarcaEscolhida | ((m: MarcaEscolhida) => MarcaEscolhida)) => void
  prompt: string
  kits: KitMarca[]
  aoSalvarKit: () => Promise<void>
  aoExcluirKit: (k: KitMarca) => Promise<void>
  aplicarKit: (k: KitMarca) => void
  /** Prévia da capa com a marca (renderizada pelo chamador). */
  previa: ReactNode
}) {
  const { mostrar } = useToast()
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  // hex do pedido com papéis (principal, fundo escuro, claro, positivo/negativo); sem hex, os nomes de cor citados
  const paletaPedido = useMemo(() => paletaDoPedido(prompt), [prompt])
  const doPedido = useMemo(() => paletaPedido?.cores ?? coresDoTexto(prompt), [paletaPedido, prompt])
  const papeisPedido = useMemo(() => { const { claro, cartao, positivo, negativo } = paletaPedido?.papeis ?? {}; const p = { ...(claro ? { claro } : {}), ...(cartao ? { cartao } : {}), ...(positivo ? { positivo } : {}), ...(negativo ? { negativo } : {}) }; return Object.keys(p).length ? p : null }, [paletaPedido])
  const sugestoesLogo = useMemo(() => (marca.logo?.cores.length ? paletasDoLogo(ordenarCoresDaMarca(marca.logo.cores)) : []), [marca.logo])
  useEffect(() => { carregarFontes(PARES_FONTES.flatMap((p) => [p.titulo, p.texto])) }, [])
  const iguais = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c.toUpperCase() === b[i]?.toUpperCase())

  const enviarLogo = async (f: File | undefined) => {
    if (!f) return
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(f.type) && !/\.svg$/i.test(f.name)) return mostrar('Envie o logo em PNG, JPG, WebP, GIF ou SVG.', 'erro')
    setEnviando(0)
    try {
      const analise = await analisarLogo(f)
      const asset = await dados.enviarArquivo(f, (p) => setEnviando(p.progresso), { sanitizarSvg: sanitizarSvgNavegador })
      const cores = ordenarCoresDaMarca(analise.cores)
      aoMudar((m) => ({
        ...m,
        logo: { assetId: asset.id, url: asset.url, nome: f.name, largura: analise.largura, altura: analise.altura, cor: analise.media, cores },
        // sem cores ainda: a primeira paleta do logo entra direto (dá para trocar ou tirar)
        cores: m.cores.length || !cores.length ? m.cores : (paletasDoLogo(cores)[0]?.cores ?? cores).slice(0, 4),
      }))
      mostrar(cores.length ? `Logo enviado. Tiramos ${cores.length} ${cores.length === 1 ? 'cor' : 'cores'} dele.` : 'Logo enviado. Ele é neutro (preto/branco): escolha as cores abaixo.', 'sucesso')
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível enviar o logo.'), 'erro')
    } finally {
      setEnviando(null)
    }
  }

  const definirCor = (k: number, v: string) => aoMudar((m) => ({ ...m, cores: m.cores.map((x, j) => (j === k ? v.toUpperCase() : x)) }))
  const usarPaleta = (p: PaletaSugerida) => aoMudar((m) => ({ ...m, cores: p.cores.slice(0, 4), aplicarCores: true, papeis: p.id === 'pedido' ? papeisPedido : m.papeis }))
  const Paleta = ({ p, rotulo }: { p: PaletaSugerida; rotulo?: string }) => {
    const ativa = iguais(marca.cores, p.cores)
    return (
      <button type="button" aria-pressed={ativa} onClick={() => usarPaleta(p)} className={cx('flex min-w-0 items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white px-3 py-2 text-left text-[13px] transition-colors', ativa ? 'border-violeta bg-[#F4F5FE]' : 'border-[#E7E5E4] hover:border-grafite')}>
        <Amostras cores={p.cores} />
        <span className="truncate">{rotulo ?? p.nome}</span>
      </button>
    )
  }

  const kitAtual = marca.kitId ? kits.find((k) => k.id === marca.kitId) : undefined
  const temAlgo = !!(marca.logo || marca.cores.length || marca.fontes || marca.nome.trim())

  return (
    <div className="flex flex-col gap-4">
      {kits.length > 0 && (
        <Secao titulo="Kits de marca salvos" dica="Logo, cores e fontes de antes, com um clique." selo={<SeloCusto />} id="titulo-kits">
          <div className="flex flex-wrap gap-2">
            {kits.map((k) => (
              <span key={k.id} className={cx('flex items-center gap-1 rounded-full border-[1.5px] bg-white py-1 pl-1.5 pr-1 text-[13px]', marca.kitId === k.id ? 'border-violeta' : 'border-[#E7E5E4]')}>
                <button type="button" onClick={() => aplicarKit(k)} className="flex items-center gap-2 rounded-full px-1.5 py-0.5 font-medium hover:text-acento" aria-label={`Usar o kit ${k.nome}`}>
                  {k.cores.length ? <Amostras cores={k.cores} tamanho={16} /> : <Bookmark className="h-3.5 w-3.5" />}
                  {k.nome}
                </button>
                <button type="button" onClick={() => void aoExcluirKit(k)} aria-label={`Apagar o kit ${k.nome}`} className="flex h-6 w-6 items-center justify-center rounded-full text-texto3 hover:bg-[#FBF0EE] hover:text-[#C0392B]"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </Secao>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Secao titulo="Logo" dica="Entra na capa e no encerramento (e, se quiser, discreto no rodapé). As cores dele viram paletas." selo={<SeloCusto />} id="titulo-logo">
            <div className="flex flex-wrap items-center gap-3">
              {marca.logo ? (
                <>
                  <span className="flex h-16 items-center gap-1 rounded-[10px] border border-borda p-1">
                    <span className="flex h-full w-24 items-center justify-center rounded-md bg-white p-1.5"><img src={marca.logo.url} alt={`Logo ${marca.nome || ''}`.trim()} className="max-h-full max-w-full object-contain" /></span>
                    <span className="flex h-full w-24 items-center justify-center rounded-md bg-[#171717] p-1.5"><img src={marca.logo.url} alt="" className="max-h-full max-w-full object-contain" /></span>
                  </span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="block truncate font-medium">{marca.logo.nome}</span>
                    <span className="text-texto3">{marca.logo.cores.length ? <span className="inline-flex items-center gap-1.5">cores lidas <Amostras cores={marca.logo.cores.slice(0, 5)} tamanho={14} /></span> : 'logo neutro (preto/branco)'}</span>
                  </span>
                  <button type="button" onClick={() => entrada.current?.click()} className="h-9 rounded-full border-[1.5px] border-bordaForte px-3 text-[13px] font-medium hover:border-grafite">Trocar</button>
                  <button type="button" onClick={() => aoMudar((m) => ({ ...m, logo: null, logoRodape: false }))} aria-label="Remover logo" className="flex h-9 w-9 items-center justify-center rounded-full text-texto3 hover:bg-[#FBF0EE] hover:text-[#C0392B]"><Trash2 className="h-4 w-4" /></button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => entrada.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void enviarLogo(e.dataTransfer.files[0]) }}
                  disabled={enviando !== null}
                  className="flex h-20 w-full items-center justify-center gap-2.5 rounded-[12px] border-[1.5px] border-dashed border-[#D6D4D0] text-[14px] text-texto2 hover:border-grafite hover:text-texto disabled:opacity-60"
                >
                  {enviando !== null ? <><span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#E7E5E4] border-t-violeta" />Enviando o logo… {Math.round(enviando)}%</> : <><ImagePlus className="h-4 w-4" />Enviar logo · PNG, SVG, JPG ou WebP</>}
                </button>
              )}
              <input ref={entrada} type="file" accept={ACEITA_LOGO} aria-label="Arquivo do logo" className="hidden" onChange={(e) => { void enviarLogo(e.target.files?.[0]); e.target.value = '' }} />
            </div>
            {marca.logo && (
              <label className="flex items-center justify-between gap-3 text-[13px] text-texto2">
                <span>Mostrar também discreto no rodapé das telas de conteúdo</span>
                <Alternador rotulo="Logo no rodapé" ativo={marca.logoRodape} onChange={(v) => aoMudar((m) => ({ ...m, logoRodape: v }))} />
              </label>
            )}
          </Secao>

          <Secao titulo="Cores" dica={marca.cores.length ? 'A 1ª cor é o destaque; as outras entram em fundos e detalhes. Ajuste à vontade.' : 'Sem cores, a apresentação usa as do estilo. Escolha uma paleta ou crie a sua.'} selo={<SeloCusto />} id="titulo-cores">
            <div className="flex flex-wrap items-center gap-2">
              {marca.cores.map((c, k) => (
                <span key={k} className="flex items-center gap-1.5 rounded-full border border-borda bg-white py-1 pl-1 pr-2">
                  <input type="color" aria-label={`Cor da marca ${k + 1}`} value={RE_HEX.test(c) ? c : '#5965F2'} onChange={(e) => definirCor(k, e.target.value)} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0" />
                  <input aria-label={`Código da cor ${k + 1}`} value={c} maxLength={7} onChange={(e) => definirCor(k, e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)} className="mono w-[68px] bg-transparent text-[12px] uppercase outline-none" />
                  <button type="button" aria-label={`Remover cor ${k + 1}`} onClick={() => aoMudar((m) => ({ ...m, cores: m.cores.filter((_, j) => j !== k) }))} className="text-texto3 hover:text-texto"><X className="h-3 w-3" /></button>
                </span>
              ))}
              {marca.cores.length < 4 && <button type="button" onClick={() => aoMudar((m) => ({ ...m, cores: [...m.cores, (['#5965F2', '#171717', '#F2C14E', '#E4572E'] as const)[m.cores.length] ?? '#5965F2'] }))} className="flex h-9 items-center gap-1 rounded-full border border-dashed border-[#D6D4D0] px-3 text-[13px] text-texto2 hover:border-grafite hover:text-texto"><Plus className="h-3.5 w-3.5" />{marca.cores.length ? 'Cor' : 'Adicionar cor'}</button>}
            </div>
            {marca.papeis && Object.keys(marca.papeis).length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-texto2" aria-label="Papéis de cor do pedido">
                <span className="text-texto3">Do pedido:</span>
                {([['claro', 'Fundo claro'], ['cartao', 'Cartões'], ['positivo', 'Positivo'], ['negativo', 'Negativo']] as const).map(([k, nome]) => marca.papeis?.[k] ? (
                  <span key={k} className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]" style={{ background: marca.papeis[k] }} />{nome} <span className="mono uppercase text-texto3">{marca.papeis[k]}</span></span>
                ) : null)}
                <button type="button" onClick={() => aoMudar((m) => ({ ...m, papeis: null }))} className="text-texto3 underline-offset-2 hover:text-texto hover:underline">remover</button>
              </div>
            )}
            {doPedido.length > 0 && !iguais(marca.cores, doPedido) && (
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[#F4F5FE] px-3 py-2 text-[13px]">
                <span className="text-texto2">Seu pedido cita cores:</span>
                <Paleta p={{ id: 'pedido', nome: 'Usar as do pedido', cores: doPedido }} />
              </div>
            )}
            {sugestoesLogo.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="rotulo-mono">Paletas do seu logo</div>
                <div className="grid gap-2 sm:grid-cols-2">{sugestoesLogo.map((p) => <Paleta key={p.id} p={p} />)}</div>
              </div>
            )}
            {!marca.logo?.cores.length && (
              <div className="flex flex-col gap-2">
                <div className="rotulo-mono">{marca.cores.length ? 'Outras paletas prontas' : 'Paletas prontas'}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PALETAS_PRONTAS.map((p) => <Paleta key={p.id} p={p} />)}</div>
              </div>
            )}
            {marca.cores.length > 0 && (
              <label className="flex items-center justify-between gap-3 text-[13px] text-texto2">
                <span>Aplicar estas cores sobre o estilo escolhido (desligado: cores do próprio estilo)</span>
                <Alternador rotulo="Aplicar as cores da marca" ativo={marca.aplicarCores} onChange={(v) => aoMudar((m) => ({ ...m, aplicarCores: v }))} />
              </label>
            )}
          </Secao>

          <Secao titulo="Fontes" dica="Um par da biblioteca de fontes (títulos + textos). Automático = o par do estilo." selo={<SeloCusto />} id="titulo-fontes">
            <div role="radiogroup" aria-label="Par de fontes" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button type="button" role="radio" aria-checked={!marca.fontes} onClick={() => aoMudar((m) => ({ ...m, fontes: null }))} className={cx('rounded-[10px] border-[1.5px] px-3 py-2 text-left', !marca.fontes ? 'border-violeta bg-[#F4F5FE]' : 'border-[#E7E5E4] bg-white hover:border-grafite')}>
                <span className="block text-[18px] leading-tight">Aa</span>
                <span className="text-[12px] text-texto3">Do estilo (automático)</span>
              </button>
              {PARES_FONTES.map((p) => {
                const ativo = marca.fontes?.titulo === p.titulo && marca.fontes?.texto === p.texto
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={ativo} aria-label={p.nome} onClick={() => aoMudar((m) => ({ ...m, fontes: { titulo: p.titulo, texto: p.texto } }))} className={cx('min-w-0 rounded-[10px] border-[1.5px] px-3 py-2 text-left', ativo ? 'border-violeta bg-[#F4F5FE]' : 'border-[#E7E5E4] bg-white hover:border-grafite')}>
                    <span className="block truncate text-[18px] leading-tight" style={{ fontFamily: pilhaFonte(p.titulo), fontWeight: p.pesoTitulo }}>Aa Título</span>
                    <span className="block truncate text-[12px] text-texto3" style={{ fontFamily: pilhaFonte(p.texto) }}>{p.nome}</span>
                  </button>
                )
              })}
            </div>
          </Secao>
        </div>

        <aside className="flex flex-col gap-3 self-start lg:sticky lg:top-4">
          <label className="flex flex-col gap-1.5 text-[13px] text-texto2">
            Nome da marca ou do cliente
            <input aria-label="Nome da marca" value={marca.nome} maxLength={60} onChange={(e) => aoMudar((m) => ({ ...m, nome: e.target.value }))} placeholder="Ex.: Café Aurora" className="h-10 rounded-[10px] border-[1.5px] border-[#E7E5E4] bg-white px-3 text-[14px] text-texto outline-none focus:border-grafite" />
          </label>
          <div className="overflow-hidden rounded-[12px] border border-borda bg-white">
            <div className="rotulo-mono px-3 pb-1.5 pt-2.5">Prévia da capa</div>
            <div className="px-2 pb-2">{previa}</div>
          </div>
          <button type="button" disabled={!temAlgo || salvando} onClick={async () => { setSalvando(true); try { await aoSalvarKit() } finally { setSalvando(false) } }} className="flex h-10 items-center justify-center gap-2 rounded-full border-[1.5px] border-grafite bg-white text-[14px] font-medium hover:bg-[#F5F5F4] disabled:cursor-not-allowed disabled:opacity-40">
            <Bookmark className="h-4 w-4" />{salvando ? 'Salvando…' : kitAtual ? `Atualizar o kit “${kitAtual.nome}”` : 'Salvar como kit de marca'}
          </button>
          <p className="text-center text-[12px] text-texto3">O kit fica no espaço para as próximas apresentações.</p>
        </aside>
      </div>
    </div>
  )
}
