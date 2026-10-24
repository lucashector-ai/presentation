'use client'
/**
 * "Ajustar" da animação escolhida: quando toca (entrar na tela, em cadeia, clique, hover) e os parâmetros do
 * preset (distância, direção, escala, giro, desfoque, opacidade, origem; no texto: divisão, ordem, intervalo,
 * cor e palavras do destaque). Só aparecem os controles que valem para o tipo (lib/scene/parametros.ts).
 * Galeria com busca, sugestões para a camada e uma categoria por vez.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Search } from 'lucide-react'
import type { Animacao, Camada } from '@/lib/scene/schema'
import { aplicarIntensidade, definicao, intensidadeDe, parametros, temIntensidade, CATEGORIAS, INTENSIDADES, type Categoria, type Direcao, type Origem, type Parametro } from '@/lib/scene/parametros'
import { categoriaDoPreset, chavePreset, ehNumeroDestaque, nomeCamada, presetSelecionado, type PresetEntrada } from '@/lib/scene/animacoes'
import { TRECHO_ROLAGEM_PADRAO } from '@/components/renderer/plano'
import { CampoNum, Deslizante, SeletorLista } from '@/components/editor/inspetor/controles'
import { cx } from '@/components/ui'
import { CartaoPreset, Chips, Finos, GradeCartoesPreset, MiniPrevia, Rotulo } from './ui'
import { BotaoCor } from '../inspetor/CampoCor'

// ---------- galeria ----------

/** Sugestões pelo conteúdo da camada: texto → máscara/linhas/cascata, número → contador, imagem → cortina/zoom… */
export function sugestoesPara(c: Camada): string[] {
  switch (c.type) {
    case 'text':
      if (ehNumeroDestaque(c.text)) return ['counter', 'cascade', 'pop']
      if (c.text.length > 60 || c.text.includes('\n')) return ['lines', 'fade-mov', 'words']
      return c.fontSize >= 60 ? ['words', 'mask', 'cascade', 'lines'] : ['mask', 'fade-mov', 'words']
    case 'image':
    case 'video':
    case 'svg':
    case 'embed':
      return ['reveal', 'zoomIn', 'mask', 'fade-blur']
    case 'shape':
      if (Math.min(c.width, c.height) <= 8) return ['draw', 'reveal', 'expand']
      if (c.shape !== 'rect' && c.shape !== 'ellipse') return ['draw', 'pop', 'iris']
      return c.width * c.height > 300_000 ? ['reveal', 'iris', 'unfold'] : ['pop', 'barra', 'iris']
    case 'frame':
      return ['mask', 'reveal', 'unfold']
    case 'model3d':
    case 'lottie':
      return ['zoomIn', 'fade-blur', 'pop']
    default:
      return ['fadeIn']
  }
}

/**
 * Galeria de efeitos: sugestões para a camada no topo e uma categoria por vez (chips), para o painel não virar
 * uma lista de 40 cartões. A busca procura em todas as categorias.
 */
export function Galeria({ presets, atual, textoPermitido, saida, sugestoes = [], aoEscolher, rotulo, extra }: {
  presets: PresetEntrada[]
  atual?: Animacao
  textoPermitido: boolean
  saida?: boolean
  sugestoes?: string[]
  aoEscolher: (p: PresetEntrada) => void
  rotulo: string
  /** Cartão "Nenhuma" (vem antes de tudo). */
  extra?: ReactNode
}) {
  const [busca, setBusca] = useState('')
  const norm = (t: string) => t.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const termo = norm(busca.trim())
  const permitidos = presets.filter((p) => textoPermitido || !p.soTexto)
  const visiveis = permitidos.filter((p) => !termo || norm(p.rotulo).includes(termo) || norm(CATEGORIAS.find((c) => c.id === categoriaDoPreset(p))?.rotulo ?? '').includes(termo))
  const categorias = CATEGORIAS.filter((c) => permitidos.some((p) => categoriaDoPreset(p) === c.id))
  const doAtual = permitidos.find((p) => presetSelecionado(p, atual, presets))
  const [escolhida, setEscolhida] = useState<Categoria | null>(null)
  const categoria = escolhida && categorias.some((c) => c.id === escolhida) ? escolhida : doAtual ? categoriaDoPreset(doAtual) : (categorias[0]?.id ?? 'basicas')
  const cartao = (p: PresetEntrada) => (
    <CartaoPreset key={chavePreset(p)} duasLinhas={p.rotulo.length > 12} rotulo={p.rotulo} selecionado={presetSelecionado(p, atual, presets)} aoClicar={() => aoEscolher(p)}>
      {(t) => <MiniPrevia preset={p} saida={saida} texto={p.soTexto} tocando={t} />}
    </CartaoPreset>
  )
  const sugeridos = termo ? [] : sugestoes.map((k) => permitidos.find((p) => chavePreset(p) === k)).filter((p): p is PresetEntrada => !!p)
  return (
    <div className="space-y-2">
      <label className="flex h-8 items-center gap-2 rounded-md bg-superficie2 px-2 text-texto3 focus-within:ring-1 focus-within:ring-acento">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar efeito" aria-label={`Buscar em ${rotulo}`} className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-texto outline-none placeholder:text-texto3" />
      </label>
      {termo ? (
        <>
          {CATEGORIAS.map((cat) => {
            const lista = visiveis.filter((p) => categoriaDoPreset(p) === cat.id)
            if (!lista.length) return null
            return (
              <div key={cat.id} className="space-y-1.5">
                <Rotulo>{cat.rotulo}</Rotulo>
                <GradeCartoesPreset rotulo={`${rotulo}: ${cat.rotulo}`}>{lista.map(cartao)}</GradeCartoesPreset>
              </div>
            )
          })}
          {!visiveis.length && <p className="py-2 text-center text-[12px] text-texto3">Nenhum efeito com “{busca}”.</p>}
        </>
      ) : (
        <>
          {sugeridos.length > 0 && (
            <>
              <Rotulo>Sugestões para esta camada</Rotulo>
              <GradeCartoesPreset rotulo="Sugestões para esta camada">{extra}{sugeridos.map(cartao)}</GradeCartoesPreset>
            </>
          )}
          <Rotulo>{sugeridos.length ? 'Todos os efeitos' : 'Efeitos'}</Rotulo>
          <Chips rotulo={`Categorias de ${rotulo}`} valor={categoria} opcoes={categorias.map((c) => ({ id: c.id, rotulo: c.rotulo }))} aoMudar={setEscolhida} />
          <GradeCartoesPreset rotulo={`${rotulo}: ${CATEGORIAS.find((c) => c.id === categoria)?.rotulo ?? ''}`}>
            {!sugeridos.length && extra}
            {permitidos.filter((p) => categoriaDoPreset(p) === categoria).map(cartao)}
          </GradeCartoesPreset>
        </>
      )}
    </div>
  )
}

// ---------- ajustes ----------

const SETAS: { id: Direcao; icone: ReactNode; rotulo: string }[] = [
  { id: 'up-left', icone: <ArrowUpLeft className="h-3.5 w-3.5" />, rotulo: 'Para cima e à esquerda' },
  { id: 'up', icone: <ArrowUp className="h-3.5 w-3.5" />, rotulo: 'Para cima' },
  { id: 'up-right', icone: <ArrowUpRight className="h-3.5 w-3.5" />, rotulo: 'Para cima e à direita' },
  { id: 'left', icone: <ArrowLeft className="h-3.5 w-3.5" />, rotulo: 'Para a esquerda' },
  { id: 'right', icone: <ArrowRight className="h-3.5 w-3.5" />, rotulo: 'Para a direita' },
  { id: 'down-left', icone: <ArrowDownLeft className="h-3.5 w-3.5" />, rotulo: 'Para baixo e à esquerda' },
  { id: 'down', icone: <ArrowDown className="h-3.5 w-3.5" />, rotulo: 'Para baixo' },
  { id: 'down-right', icone: <ArrowDownRight className="h-3.5 w-3.5" />, rotulo: 'Para baixo e à direita' },
]
const ORIGENS_GRADE: { id: Origem; rotulo: string }[] = [
  { id: 'top-left', rotulo: 'Canto superior esquerdo' }, { id: 'top', rotulo: 'Topo' }, { id: 'top-right', rotulo: 'Canto superior direito' },
  { id: 'left', rotulo: 'Esquerda' }, { id: 'center', rotulo: 'Centro' }, { id: 'right', rotulo: 'Direita' },
  { id: 'bottom-left', rotulo: 'Canto inferior esquerdo' }, { id: 'bottom', rotulo: 'Base' }, { id: 'bottom-right', rotulo: 'Canto inferior direito' },
]
const DISTANCIAS = [{ id: '20', rotulo: 'Sutil' }, { id: '80', rotulo: 'Evidente' }, { id: '200', rotulo: 'Dramático' }]
/** Entrada "ao rolar": em que ponto da passagem pela janela o efeito termina (% da passagem inteira). */
const TRECHOS: { id: string; rotulo: string; titulo: string; v: [number, number] }[] = [
  { id: 'cedo', rotulo: 'Cedo', titulo: 'Termina logo que a camada aparece', v: [0, 25] },
  { id: 'meio', rotulo: 'No meio', titulo: 'Termina antes do meio da tela', v: [0, 40] },
  { id: 'tarde', rotulo: 'Tarde', titulo: 'Acompanha quase toda a passagem', v: [5, 65] },
]
const INDICADORES = [{ id: 'none', rotulo: 'Nenhum' }, { id: 'circle', rotulo: 'Círculo' }, { id: 'bar', rotulo: 'Barra' }] as const

/** Grade 3×3 (direção ou origem). */
function Grade3({ rotulo, itens, valor, aoMudar }: { rotulo: string; itens: { id: string; rotulo: string; icone?: ReactNode; desativado?: boolean }[]; valor: string; aoMudar: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid w-[96px] grid-cols-3 gap-1">
      {itens.map((i, k) =>
        i.id === '' ? <span key={`v${k}`} className="h-7 w-7" /> : (
          <button key={i.id} type="button" role="radio" aria-checked={valor === i.id} aria-label={i.rotulo} title={i.rotulo} disabled={i.desativado} onClick={() => aoMudar(i.id)}
            className={cx('flex h-7 w-7 items-center justify-center rounded-md border text-[12px] transition-colors disabled:opacity-25', valor === i.id ? 'border-acento bg-acentoSuave text-acento' : 'border-borda bg-superficie text-texto2 hover:border-bordaForte hover:text-texto')}>
            {i.icone ?? <span className={cx('block h-1.5 w-1.5 rounded-full', valor === i.id ? 'bg-acento' : 'bg-texto3')} />}
          </button>
        )
      )}
    </div>
  )
}

const CAMPOS_AJUSTE = ['distance', 'direction', 'scale', 'rotate', 'blur', 'opacity', 'origin', 'split', 'order', 'stagger', 'color', 'range'] as const

/**
 * Painel "Ajustar". Em cima, o que se resolve com um clique (quando, direção, distância, intensidade e, no
 * texto, divisão e ordem); embaixo, recolhido, os ajustes finos (tempo e curva vêm de quem chama em `tempo`,
 * mais deslizadores de distância, escala, giro, desfoque, opacidade, origem e intervalo).
 * `aoMudar` grava (sem histórico durante o arraste do controle deslizante, que tem gesto próprio) e a prévia
 * no canvas toca 250 ms depois do último ajuste.
 */
export function PainelAjustes({ anim, camada, camadasDaTela, saida, aoMudar, aoPrevia, tempo, resumoTempo }: {
  anim: Animacao
  camada: Camada
  camadasDaTela: Camada[]
  saida?: boolean
  aoMudar: (patch: Partial<Animacao>, remover?: (keyof Animacao)[]) => void
  aoPrevia: () => void
  /** Atraso, duração e curva (ficam dentro de "Ajustes finos"). */
  tempo?: ReactNode
  /** Resumo mostrado ao lado de "Ajustes finos" quando recolhido. */
  resumoTempo?: string
}) {
  const d = definicao(anim.type)
  const p = parametros(anim)
  const tem = (k: Parametro) => d.controles.includes(k)
  const temporizador = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(temporizador.current), [])
  const mudar = (patch: Partial<Animacao>, remover?: (keyof Animacao)[]) => {
    aoMudar(patch, remover)
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(aoPrevia, 250)
  }
  const ajustado = CAMPOS_AJUSTE.some((k) => anim[k] !== undefined)
  // ajustes finos começam abertos se já houver algum valor que só se mexe lá
  const finos = (['scale', 'rotate', 'blur', 'opacity', 'origin', 'stagger'] as const).some((k) => anim[k] !== undefined) || (anim.distance !== undefined && !DISTANCIAS.some((x) => Number(x.id) === anim.distance))
  const palavras = useMemo(() => (camada.type === 'text' ? camada.text.trim().split(/\s+/).filter(Boolean) : []), [camada])
  const outras = camadasDaTela.filter((c) => c.id !== camada.id && c.type !== 'hotspot')
  const quando = anim.trigger ?? 'enter'
  const intensidade = !tem('distance') && temIntensidade(anim.type)
  const ehTextoDividido = d.familia === 'texto'
  const temFinos = !!tempo || tem('distance') || tem('scale') || tem('rotate') || tem('blur') || tem('opacity') || tem('origin') || tem('stagger')

  return (
    <div className="space-y-2">
      {!saida && (
        <>
          <Rotulo>Quando</Rotulo>
          <SeletorLista
            rotulo="Quando a animação toca"
            valor={quando}
            aoMudar={(v) => {
              if (v === 'enter') return mudar({}, ['trigger', 'after', 'on', 'scrollRange'])
              if (v === 'after') return mudar({ trigger: 'after', after: anim.after ?? outras.find((o) => o.enterAnimation)?.id ?? outras[0]?.id }, ['on', 'scrollRange'])
              if (v === 'scroll') return mudar({ trigger: 'scroll' }, ['after', 'on', 'repeat'])
              mudar({ trigger: v as 'click' | 'hover' }, ['after', 'scrollRange'])
            }}
            opcoes={[
              { id: 'enter', rotulo: 'Ao entrar na tela' },
              { id: 'after', rotulo: 'Depois de outra camada' },
              { id: 'click', rotulo: 'Ao clicar' },
              { id: 'hover', rotulo: 'Ao passar o mouse' },
              { id: 'scroll', rotulo: 'Acompanhando a rolagem' },
            ]}
          />
          {quando === 'after' && (
            <SeletorLista rotulo="Depois de qual camada" valor={anim.after ?? ''} aoMudar={(v) => mudar({ after: v })} opcoes={outras.map((o) => ({ id: o.id, rotulo: `${nomeCamada(o)}${o.enterAnimation ? '' : ' (sem entrada)'}` }))} />
          )}
          {(quando === 'click' || quando === 'hover') && (
            <SeletorLista rotulo={quando === 'click' ? 'Clique em' : 'Mouse sobre'} valor={anim.on ?? camada.id} aoMudar={(v) => (v === camada.id ? mudar({}, ['on']) : mudar({ on: v }))} opcoes={[{ id: camada.id, rotulo: 'Nesta camada' }, ...outras.map((o) => ({ id: o.id, rotulo: nomeCamada(o) }))]} />
          )}
          {quando === 'scroll' && (
            <>
              <Rotulo>Termina</Rotulo>
              <Chips rotulo="Trecho da rolagem" cheio valor={TRECHOS.find((t) => t.v[0] === (anim.scrollRange ?? TRECHO_ROLAGEM_PADRAO)[0] && t.v[1] === (anim.scrollRange ?? TRECHO_ROLAGEM_PADRAO)[1])?.id ?? null} opcoes={TRECHOS.map((t) => ({ id: t.id, rotulo: t.rotulo, titulo: t.titulo }))} aoMudar={(id) => { const t = TRECHOS.find((x) => x.id === id)!; return t.id === 'meio' ? mudar({}, ['scrollRange']) : mudar({ scrollRange: t.v }) }} />
            </>
          )}
          {quando !== 'enter' && (
            <p className="text-[12px] text-texto3">
              {quando === 'after' && 'Começa quando a entrada da outra camada termina (mais o atraso).'}
              {(quando === 'click' || quando === 'hover') && 'A camada espera escondida até o público agir. Na prévia do editor ela toca direto.'}
              {quando === 'scroll' && 'No Story, o efeito avança e volta junto com a rolagem. Nos slides e no Explorar, toca ao entrar na tela.'}
            </p>
          )}
        </>
      )}

      {tem('direction') && (
        <div className="space-y-1 pt-1">
          <Rotulo>{d.familia === 'reveal' ? 'Sentido' : saida ? 'Para onde vai' : 'De onde vem'}</Rotulo>
          <Grade3 rotulo="Direção do movimento" valor={p.direction} aoMudar={(v) => mudar({ direction: v as Direcao })}
            itens={[...SETAS.slice(0, 4), { id: '', rotulo: '' }, ...SETAS.slice(4)].map((s) => ({ ...s, desativado: !d.diagonais && s.id.includes('-') }))} />
        </div>
      )}

      {tem('distance') && (
        <>
          <Rotulo>{ehTextoDividido ? 'Distância de cada parte' : 'Distância'}</Rotulo>
          <Chips rotulo="Distância" cheio valor={DISTANCIAS.find((x) => Number(x.id) === anim.distance)?.id ?? null} opcoes={DISTANCIAS.map((x) => ({ ...x, titulo: `${x.id} px` }))} aoMudar={(v) => mudar({ distance: Number(v) })} />
        </>
      )}
      {intensidade && (
        <>
          <Rotulo>Intensidade</Rotulo>
          <Chips rotulo="Intensidade" cheio valor={intensidadeDe(anim)} opcoes={INTENSIDADES.map((i) => ({ id: i.id, rotulo: i.rotulo }))} aoMudar={(id) => { const r = aplicarIntensidade(anim.type, id); mudar(r.patch, r.remover) }} />
        </>
      )}

      {tem('split') && (
        <>
          <Rotulo>Dividir por</Rotulo>
          <Chips rotulo="Dividir texto por" cheio valor={p.split} opcoes={[{ id: 'line', rotulo: 'Linha' }, { id: 'word', rotulo: 'Palavra' }, { id: 'letter', rotulo: 'Letra' }]} aoMudar={(v) => mudar({ split: v })} />
        </>
      )}
      {tem('order') && (
        <>
          <Rotulo>Ordem</Rotulo>
          <Chips rotulo="Ordem das partes" valor={p.order} opcoes={[{ id: 'start', rotulo: 'Início' }, { id: 'end', rotulo: 'Fim' }, { id: 'center', rotulo: 'Do centro' }, { id: 'edges', rotulo: 'Das bordas' }, { id: 'random', rotulo: 'Aleatória' }]} aoMudar={(v) => mudar({ order: v })} />
        </>
      )}
      {anim.type === 'counter' && !saida && (
        <>
          <Rotulo>Indicador</Rotulo>
          <Chips rotulo="Indicador de progresso do contador" cheio valor={anim.progress ?? 'none'} opcoes={[...INDICADORES]} aoMudar={(v) => (v === 'none' ? mudar({}, ['progress', 'progressColor', 'progressMax', 'progressWidth']) : mudar({ progress: v }))} />
          {anim.progress && (
            <>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[12px] text-texto2">Cor do indicador</span>
                <BotaoCor rotulo="Cor do indicador" cor={anim.progressColor ?? (camada.type === 'text' ? camada.color : '#5965F2')} aoMudar={(progressColor) => mudar({ progressColor })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Rotulo>Cheio em</Rotulo>
                  <CampoNum rotulo="Valor que enche o indicador" valor={anim.progressMax ?? null} vazio="Auto" min={0.01} passo={1} casas={2} aoMudar={(v) => (v > 0 ? mudar({ progressMax: v }) : mudar({}, ['progressMax']))} aoLimpar={() => mudar({}, ['progressMax'])} />
                </div>
                <div className="space-y-1">
                  <Rotulo>Espessura</Rotulo>
                  <CampoNum rotulo="Espessura do indicador em px" valor={anim.progressWidth ?? null} vazio="Auto" min={1} max={80} passo={1} sufixo="px" aoMudar={(v) => mudar({ progressWidth: v })} aoLimpar={() => mudar({}, ['progressWidth'])} />
                </div>
              </div>
              <p className="text-[12px] text-texto3">Enche junto com o número. “Auto”: 100 quando o texto tem %, senão o próprio número.</p>
            </>
          )}
        </>
      )}
      {tem('color') && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[12px] text-texto2">{anim.type === 'highlight' ? 'Cor do marcador' : 'Cor da linha'}</span>
          <BotaoCor rotulo={anim.type === 'highlight' ? 'Cor do marcador' : 'Cor da linha'} cor={anim.color ?? (anim.type === 'highlight' ? '#FFD60A' : camada.type === 'text' ? camada.color : '#171717')} aoMudar={(color) => mudar({ color: anim.type === 'highlight' ? `${color}8C` : color })} />
        </div>
      )}
      {tem('range') && palavras.length > 1 && (
        <>
          <Rotulo>Palavras marcadas</Rotulo>
          <div className="grid grid-cols-2 gap-2">
            <CampoNum prefixo="De" rotulo="Da palavra" valor={(anim.range?.[0] ?? 0) + 1} min={1} max={palavras.length} passo={1} aoMudar={(v) => mudar({ range: [v - 1, Math.max(v - 1, anim.range?.[1] ?? palavras.length - 1)] })} />
            <CampoNum prefixo="Até" rotulo="Até a palavra" valor={(anim.range?.[1] ?? palavras.length - 1) + 1} min={1} max={palavras.length} passo={1} aoMudar={(v) => mudar({ range: [Math.min(anim.range?.[0] ?? 0, v - 1), v - 1] })} />
          </div>
          <p className="truncate text-[12px] text-texto3">“{palavras.slice(anim.range?.[0] ?? 0, (anim.range?.[1] ?? palavras.length - 1) + 1).join(' ')}”</p>
        </>
      )}

      {temFinos && (
        <Finos aberto={finos} resumo={resumoTempo} aoPadrao={ajustado ? () => mudar({}, [...CAMPOS_AJUSTE]) : undefined}>
          {tempo}
              {quando === 'scroll' && !saida && (() => {
                const [ini, fim] = anim.scrollRange ?? TRECHO_ROLAGEM_PADRAO
                return (
                  <>
                    <Rotulo>Começa (% da passagem pela tela)</Rotulo>
                    <Deslizante rotulo="Começa em porcentagem da passagem pela tela" valor={ini} min={0} max={Math.max(0, fim - 5)} passo={5} aoMudar={(v) => mudar({ scrollRange: [v, fim] })} formatar={(v) => `${v}%`} />
                    <Rotulo>Termina (% da passagem pela tela)</Rotulo>
                    <Deslizante rotulo="Termina em porcentagem da passagem pela tela" valor={fim} min={Math.min(100, ini + 5)} max={100} passo={5} aoMudar={(v) => mudar({ scrollRange: [ini, v] })} formatar={(v) => `${v}%`} />
                  </>
                )
              })()}
              {tem('distance') && (
                <>
                  <Rotulo>Distância em px</Rotulo>
                  <Deslizante rotulo="Distância em px" valor={anim.distance ?? (ehTextoDividido ? 0 : p.distance)} min={0} max={400} passo={2} aoMudar={(v) => mudar({ distance: v })} formatar={(v) => `${v}px`} />
                </>
              )}
              {tem('scale') && (
                <>
                  <Rotulo>{saida ? 'Escala final' : 'Escala inicial'}</Rotulo>
                  <Deslizante rotulo="Escala" valor={Math.round(p.scale * 100)} min={0} max={150} passo={5} aoMudar={(v) => mudar({ scale: v / 100 })} formatar={(v) => `${v}%`} />
                </>
              )}
              {tem('rotate') && (
                <>
                  <Rotulo>{d.familia === 'flip' ? 'Ângulo do giro 3D' : saida ? 'Rotação final' : 'Rotação inicial'}</Rotulo>
                  <Deslizante rotulo="Rotação em graus" valor={p.rotate} min={d.familia === 'flip' ? 0 : -180} max={180} passo={1} aoMudar={(v) => mudar({ rotate: v })} formatar={(v) => `${v}°`} />
                </>
              )}
              {tem('blur') && (
                <>
                  <Rotulo>{saida ? 'Desfoque final' : 'Desfoque inicial'}</Rotulo>
                  <Deslizante rotulo="Desfoque em px" valor={anim.blur ?? (ehTextoDividido ? 0 : p.blur)} min={0} max={40} passo={1} aoMudar={(v) => mudar({ blur: v })} formatar={(v) => `${v}px`} />
                </>
              )}
              {tem('opacity') && (
                <>
                  <Rotulo>{saida ? 'Opacidade final' : 'Opacidade inicial'}</Rotulo>
                  <Deslizante rotulo="Opacidade" valor={Math.round(p.opacity * 100)} min={0} max={100} passo={5} aoMudar={(v) => mudar({ opacity: v / 100 })} formatar={(v) => `${v}%`} />
                </>
              )}
              {tem('origin') && <OrigemCampo valor={p.origin} aoMudar={(o) => mudar({ origin: o })} />}
              {tem('stagger') && (
                <>
                  <Rotulo acao={<button type="button" onClick={() => (anim.stagger === undefined ? mudar({ stagger: 80 }) : mudar({}, ['stagger']))} className="text-[11px] text-texto2 hover:text-texto">{anim.stagger === undefined ? 'Definir' : 'Automático'}</button>}>Intervalo entre partes</Rotulo>
                  {anim.stagger === undefined
                    ? <p className="text-[12px] text-texto3">Automático: as partes se distribuem pela duração.</p>
                    : <Deslizante rotulo="Intervalo entre partes em ms" valor={anim.stagger} min={0} max={300} passo={5} aoMudar={(v) => mudar({ stagger: v })} formatar={(v) => `${v}ms`} />}
                </>
              )}
        </Finos>
      )}
    </div>
  )
}

function OrigemCampo({ valor, aoMudar }: { valor: Origem; aoMudar: (o: Origem) => void }) {
  return (
    <div className="space-y-1">
      <Rotulo>Origem</Rotulo>
      <Grade3 rotulo="Origem da transformação" valor={valor} aoMudar={(v) => aoMudar(v as Origem)} itens={ORIGENS_GRADE} />
    </div>
  )
}
