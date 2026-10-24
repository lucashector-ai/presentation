'use client'
/**
 * Aba Animação sem seleção: transição da tela e linha do tempo à vista; "Animar tudo" (sequência automática),
 * profundidade (parallax) e avanço automático em seções recolhíveis com resumo.
 */
import { useState } from 'react'
import { Timer } from 'lucide-react'
import type { Editor } from '@/lib/editor/useEditor'
import { ESTILOS_TELA, ORDENS_TELA, animarTelaInteira, duracaoPrevia, removerAnimacoes, type EstiloTela, type OrdemTela } from '@/lib/scene/animacoes'
import { pararPrevia, pedirPrevia, usePreviaAnimacao } from '@/components/renderer/animacao'
import { CampoNum, Interruptor, Secao, SeletorLista } from '@/components/editor/inspetor/controles'
import { BotaoPrevia, Chips } from './ui'
import { LinhaDoTempo } from './LinhaDoTempo'
import { TransicaoTela, previaTransicao, resumoTransicao, transicaoDa } from './Transicao'
import { profundidadeAutomatica, semProfundidade } from '@/lib/scene/reativos'
import { DURACAO_SIMULACAO_MS } from '@/components/renderer/reativos'

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
  if (!cena) return null
  const tr = transicaoDa(cena)
  const anterior = estado.documento.scenes[editor.indiceCena - 1]
  const animadas = cena.layers.filter((l) => l.enterAnimation || l.loopAnimation || l.exitAnimation).length
  const def = ESTILOS_TELA.find((e) => e.id === estilo)!
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
  const segundos = cena.autoAdvance / 1000

  return (
    <div className="pb-6">
      <div className="border-b border-borda px-3 pb-2 pt-3">
        <div className="rotulo-mono">Tela {String(editor.indiceCena + 1).padStart(2, '0')}</div>
        <div className="mt-0.5 flex h-8 items-center text-[14px] font-medium">{cena.title || 'Sem título'}</div>
      </div>

      <Secao titulo="Transição de entrada" chave="tela.transicao" resumo={resumoTransicao(cena)} acao={tr.type !== 'none' ? <BotaoPrevia aoClicar={() => previaTransicao(editor)} /> : undefined}>
        <TransicaoTela editor={editor} />
      </Secao>

      <Secao titulo="Linha do tempo" chave="tela.linha" resumo={`${animadas} de ${cena.layers.length} animadas`} acao={<BotaoPreviaTela aoClicar={() => tocarTela()} />}>
        <LinhaDoTempo editor={editor} />
        {animadas > 0 && (
          <button type="button" onClick={() => acoes.atualizarCena({ layers: removerAnimacoes(cena.layers) })} className="text-[12px] text-texto2 hover:text-perigo">
            Remover animações da tela
          </button>
        )}
      </Secao>

      <Secao titulo="Animar tudo" chave="tela.sequencia" aberta={animadas === 0} resumo={def.rotulo}>
        <Chips rotulo="Estilo" valor={estilo} opcoes={ESTILOS_TELA.map((e) => ({ id: e.id, rotulo: e.rotulo }))} aoMudar={setEstilo} />
        <p className="text-[12px] text-texto3">{def.descricao} · {def.intervalo} ms entre camadas</p>
        <SeletorLista rotulo="Ordem da sequência" valor={ordem} aoMudar={(v) => setOrdem(v as OrdemTela)} opcoes={ORDENS_TELA} />
        <button type="button" onClick={animarTudo} disabled={!cena.layers.length} title="Cada camada ganha uma entrada combinando com as outras, em sequência" className="h-8 w-full rounded-md bg-acento text-[12px] font-medium text-acentoTexto transition-opacity hover:opacity-90 disabled:opacity-40">
          Animar tela inteira
        </button>
      </Secao>

      <Secao titulo="Profundidade (parallax)" chave="tela.profundidade" aberta={false} resumo={comProfundidade ? `${comProfundidade} ${comProfundidade === 1 ? 'camada' : 'camadas'}` : 'Nenhuma'} acao={comProfundidade ? <BotaoPrevia aoClicar={() => tocarProfundidade()} /> : undefined}>
        <button type="button" onClick={darProfundidade} disabled={!cena.layers.length} title="Fundo mais longe, imagens no meio, títulos à frente; reage ao mouse, à rolagem do Story e à transição" className="h-8 w-full rounded-md border border-borda text-[12px] font-medium text-texto transition-colors hover:border-bordaForte disabled:opacity-40">
          Dar profundidade à tela
        </button>
        {comProfundidade > 0 && (
          <button type="button" onClick={() => acoes.atualizarCena({ layers: semProfundidade(cena.layers) })} className="text-[12px] text-texto2 hover:text-perigo">
            Tirar a profundidade ({comProfundidade} {comProfundidade === 1 ? 'camada' : 'camadas'})
          </button>
        )}
      </Secao>

      {estado.documento.mode === 'slides' && (
        <Secao titulo="Avançar sozinha" chave="tela.avancar" aberta={cena.autoAdvance > 0} resumo={cena.autoAdvance > 0 ? `${segundos} s` : 'Desligado'} acao={<Interruptor rotulo="Avançar automaticamente" ativo={cena.autoAdvance > 0} aoMudar={(v) => acoes.atualizarCena({ autoAdvance: v ? Math.max(3000, Math.ceil((duracaoPrevia(cena.layers) + 1500) / 1000) * 1000) : 0 })} />}>
          {cena.autoAdvance > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-texto2">Vai para a próxima tela depois de</span>
              <span className="w-[96px] shrink-0"><CampoNum rotulo="Segundos até avançar" prefixo={<Timer className="h-3 w-3" />} valor={segundos} min={1} max={600} passo={0.5} casas={1} sufixo="s" aoMudar={(v) => acoes.atualizarCena({ autoAdvance: Math.round(v * 1000) })} /></span>
            </div>
          ) : (
            <p className="text-[12px] text-texto3">Desligado: a próxima tela só vem com clique.</p>
          )}
        </Secao>
      )}
    </div>
  )
}
