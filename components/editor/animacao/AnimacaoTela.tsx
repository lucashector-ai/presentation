'use client'
/** Aba Animação sem seleção: transição da tela, "Animar tela inteira", linha do tempo e avanço automático. */
import { useState } from 'react'
import { Layers3, Sparkles, Timer, Trash2 } from 'lucide-react'
import type { Cena, Transicao } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { ESTILOS_TELA, ORDENS_TELA, animarTelaInteira, duracaoPrevia, removerAnimacoes, type EstiloTela, type OrdemTela } from '@/lib/scene/animacoes'
import { pararPrevia, pedirPrevia, usePreviaAnimacao } from '@/components/renderer/animacao'
import { CampoNum, Deslizante, Interruptor, Secao, SeletorLista } from '@/components/editor/inspetor/controles'
import { BotaoPrevia, CartaoPreset, Chips, GradeCartoesPreset, MiniTransicao, Rotulo } from './ui'
import { LinhaDoTempo } from './LinhaDoTempo'
import { profundidadeAutomatica, semProfundidade } from '@/lib/scene/reativos'
import { DURACAO_SIMULACAO_MS } from '@/components/renderer/reativos'

const TRANSICOES: { id: Transicao['type']; rotulo: string }[] = [
  { id: 'none', rotulo: 'Nenhuma' },
  { id: 'fade', rotulo: 'Fade' },
  { id: 'slide', rotulo: 'Deslizar' },
  { id: 'scale', rotulo: 'Zoom' },
  { id: 'morph', rotulo: 'Morph' },
  { id: 'push', rotulo: 'Empurrar' },
]
const DURACOES_TRANSICAO = [
  { id: 'rapida', rotulo: 'Rápida', ms: 300 },
  { id: 'normal', rotulo: 'Normal', ms: 500 },
  { id: 'lenta', rotulo: 'Lenta', ms: 900 },
] as const
const CURVAS_TRANSICAO: { id: Transicao['easing']; rotulo: string }[] = [
  { id: 'easeInOut', rotulo: 'Suave' },
  { id: 'easeOut', rotulo: 'Rápida' },
  { id: 'spring', rotulo: 'Elástica' },
  { id: 'linear', rotulo: 'Linear' },
]

/**
 * Botão Prévia/Parar da linha do tempo: só ele acompanha a prévia tocando (o painel inteiro não re-renderiza no
 * começo e no fim de cada prévia, justo quando o canvas monta a tela animada).
 */
function BotaoPreviaTela({ aoClicar }: { aoClicar: () => void }) {
  const previa = usePreviaAnimacao(true)
  return <BotaoPrevia aoClicar={aoClicar} tocando={!!previa && !previa.semAtraso} aoParar={pararPrevia} />
}

export function AnimacaoTela({ editor }: { editor: Editor }) {
  const { cena, acoes, estado } = editor
  const [estilo, setEstilo] = useState<EstiloTela>('suave')
  const [ordem, setOrdem] = useState<OrdemTela>('leitura')
  const [avancado, setAvancado] = useState(false)
  if (!cena) return null
  const tr: Transicao = cena.transition ?? { type: 'fade', duration: 500, easing: 'easeInOut' }
  const anterior: Cena | undefined = estado.documento.scenes[editor.indiceCena - 1]
  const animadas = cena.layers.filter((l) => l.enterAnimation || l.loopAnimation || l.exitAnimation).length
  const duracaoChip = DURACOES_TRANSICAO.find((d) => d.ms === tr.duration)?.id ?? null
  const def = ESTILOS_TELA.find((e) => e.id === estilo)!

  const previaTransicao = (t: Transicao) => {
    if (t.type === 'none') return
    pedirPrevia({ transicao: t, morphDe: anterior, duracao: t.duration + 100 })
  }
  const setTr = (patch: Partial<Transicao>, tocar = true) => {
    const nova = { ...tr, ...patch }
    acoes.atualizarCena({ transition: nova })
    if (tocar) setTimeout(() => previaTransicao(nova), 30)
  }
  const tocarTela = (camadas = cena.layers) => {
    const t = tr.type !== 'none' && (tr.type !== 'morph' || anterior) ? tr : undefined
    pedirPrevia({ transicao: t, morphDe: anterior, duracao: Math.max(duracaoPrevia(camadas), t?.duration ?? 0) + 200 })
  }
  const comProfundidade = cena.layers.filter((l) => l.interactiveEffects?.parallax?.depth).length
  const tocarProfundidade = (layers = cena.layers) => pedirPrevia({ ids: layers.filter((l) => l.interactiveEffects?.parallax?.depth).map((l) => l.id), interativo: true, duracao: DURACAO_SIMULACAO_MS + 150 })
  const darProfundidade = () => {
    const layers = profundidadeAutomatica(cena)
    acoes.atualizarCena({ layers })
    setTimeout(() => tocarProfundidade(layers), 40)
  }
  const animarTudo = () => {
    const layers = animarTelaInteira(cena, estilo, ordem)
    acoes.atualizarCena({ layers })
    setTimeout(() => tocarTela(layers), 40)
  }

  return (
    <div>
      <div className="border-b border-borda px-4 py-4">
        <div className="rotulo-mono mb-1">Tela {String(editor.indiceCena + 1).padStart(2, '0')} · animação</div>
        <p className="text-[12px] leading-snug text-texto2">Animações da tela inteira. Selecione uma camada para animar só ela.</p>
      </div>

      <Secao titulo="Transição de entrada" acao={tr.type !== 'none' ? <BotaoPrevia aoClicar={() => previaTransicao(tr)} /> : undefined}>
        <GradeCartoesPreset rotulo="Transição de entrada da tela">
          {TRANSICOES.map((t) => (
            <CartaoPreset key={t.id} rotulo={t.rotulo} selecionado={tr.type === t.id} aoClicar={() => setTr({ type: t.id })}>
              {(tocando) => <MiniTransicao tipo={t.id} tocando={tocando} duracao={Math.max(400, tr.duration)} />}
            </CartaoPreset>
          ))}
        </GradeCartoesPreset>
        {tr.type === 'morph' && (
          <p className="rounded-md bg-acentoSuave px-2.5 py-2 text-[12px] leading-snug text-acento">
            Camadas com o <strong className="font-medium">mesmo nome</strong> nas duas telas se transformam (posição, tamanho, cor) de uma tela para a outra.
            {!anterior && ' Esta é a primeira tela: o morph acontece ao chegar nela por um link.'}
          </p>
        )}
        {tr.type !== 'none' && (
          <>
            <Rotulo acao={<button type="button" onClick={() => setAvancado((v) => !v)} className="text-[12px] text-texto2 hover:text-texto" aria-expanded={avancado}>{avancado ? 'Menos' : 'Avançado'}</button>}>Duração</Rotulo>
            <Chips rotulo="Duração da transição" cheio valor={duracaoChip} opcoes={DURACOES_TRANSICAO.map((d) => ({ id: d.id, rotulo: d.rotulo, titulo: `${d.ms} ms` }))} aoMudar={(id) => setTr({ duration: DURACOES_TRANSICAO.find((d) => d.id === id)!.ms })} />
            {avancado && (
              <div className="space-y-2 pt-1">
                <Deslizante rotulo="Duração da transição em milissegundos" valor={tr.duration} min={100} max={2000} passo={50} aoMudar={(duration) => setTr({ duration }, false)} formatar={(v) => `${v}ms`} />
                <Chips rotulo="Curva da transição" valor={tr.easing} opcoes={CURVAS_TRANSICAO} aoMudar={(easing) => setTr({ easing })} />
              </div>
            )}
          </>
        )}
      </Secao>

      <Secao titulo="Sequência automática">
        <p className="text-[12px] leading-snug text-texto2">Um clique: cada camada ganha uma entrada combinando com as outras, em sequência.</p>
        <Chips rotulo="Estilo" valor={estilo} opcoes={ESTILOS_TELA.map((e) => ({ id: e.id, rotulo: e.rotulo }))} aoMudar={setEstilo} />
        <p className="text-[11px] text-texto3">{def.descricao} · intervalo de {def.intervalo} ms</p>
        <SeletorLista rotulo="Ordem da sequência" valor={ordem} aoMudar={(v) => setOrdem(v as OrdemTela)} opcoes={ORDENS_TELA} />
        <button type="button" onClick={animarTudo} disabled={!cena.layers.length} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-acento text-[13px] font-medium text-acentoTexto transition-opacity hover:opacity-90 disabled:opacity-40">
          <Sparkles className="h-3.5 w-3.5" /> Animar tela inteira
        </button>
      </Secao>

      <Secao titulo="Profundidade (parallax)" acao={comProfundidade ? <BotaoPrevia aoClicar={() => tocarProfundidade()} /> : undefined}>
        <p className="text-[12px] leading-snug text-texto2">Um clique: fundo mais longe, imagens no meio, títulos à frente. Mexe com o mouse, com a rolagem do Story e na transição entre telas.</p>
        <button type="button" onClick={darProfundidade} disabled={!cena.layers.length} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-borda text-[13px] font-medium text-texto transition-colors hover:border-bordaForte disabled:opacity-40">
          <Layers3 className="h-3.5 w-3.5" /> Dar profundidade à tela
        </button>
        {comProfundidade > 0 && (
          <button type="button" onClick={() => acoes.atualizarCena({ layers: semProfundidade(cena.layers) })} className="mt-1 flex items-center gap-1.5 text-[12px] text-texto2 hover:text-perigo">
            <Trash2 className="h-3 w-3" /> Tirar a profundidade ({comProfundidade} {comProfundidade === 1 ? 'camada' : 'camadas'})
          </button>
        )}
      </Secao>

      <Secao titulo="Linha do tempo" acao={<BotaoPreviaTela aoClicar={() => tocarTela()} />}>
        <LinhaDoTempo editor={editor} />
        {animadas > 0 && (
          <button type="button" onClick={() => acoes.atualizarCena({ layers: removerAnimacoes(cena.layers) })} className="mt-1 flex items-center gap-1.5 text-[12px] text-texto2 hover:text-perigo">
            <Trash2 className="h-3 w-3" /> Remover animações da tela
          </button>
        )}
      </Secao>

      {estado.documento.mode === 'slides' && (
        <Secao titulo="Avançar sozinha">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-texto2">Vai para a próxima tela depois de</span>
            <Interruptor rotulo="Avançar automaticamente" ativo={cena.autoAdvance > 0} aoMudar={(v) => acoes.atualizarCena({ autoAdvance: v ? Math.max(3000, Math.ceil((duracaoPrevia(cena.layers) + 1500) / 1000) * 1000) : 0 })} />
          </div>
          {cena.autoAdvance > 0 && (
            <div className="flex items-center gap-2">
              <CampoNum rotulo="Segundos até avançar" prefixo={<Timer className="h-3 w-3" />} valor={cena.autoAdvance / 1000} min={1} max={600} passo={0.5} casas={1} sufixo="s" aoMudar={(v) => acoes.atualizarCena({ autoAdvance: Math.round(v * 1000) })} />
            </div>
          )}
        </Secao>
      )}
    </div>
  )
}
