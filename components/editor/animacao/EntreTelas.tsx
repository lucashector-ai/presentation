'use client'
/**
 * "Entre telas" (Magic Move por objeto): mostra em que outras telas este mesmo objeto aparece (mesmo ID, ou
 * mesmo nome único: lib/scene/morph.ts) e liga/desliga o movimento dele NESTA tela. Desligado, ele entra e sai
 * desta tela parado, sem andar desde a posição da tela vizinha — útil para reaproveitar o objeto sem animação.
 */
import type { Camada } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { telasComObjeto, TRANSICAO_PADRAO } from '@/lib/scene/morph'
import { Interruptor, Secao } from '@/components/editor/inspetor/controles'

const TIPOS_COM_MOVIMENTO = new Set(['auto', 'morph'])

export function EntreTelas({ editor, sel }: { editor: Editor; sel: Camada[] }) {
  const { cena, acoes } = editor
  const doc = editor.estado.documento
  if (!cena || !sel.length) return null
  const ids = sel.map((c) => c.id)
  const anima = sel.every((c) => c.morph !== false)
  const outras = [...new Map(sel.flatMap((c) => telasComObjeto(doc, cena.id, c)).map((s) => [s.id, s])).values()].sort((a, b) => doc.scenes.indexOf(a) - doc.scenes.indexOf(b))
  const numero = (id: string) => String(doc.scenes.findIndex((s) => s.id === id) + 1).padStart(2, '0')
  // telas vizinhas (logo depois desta) que têm o objeto mas não animam (fade, slide…): oferece trocar para Automática
  const indice = doc.scenes.findIndex((s) => s.id === cena.id)
  const proxima = doc.scenes[indice + 1]
  const proximaSemMovimento = anima && proxima && outras.some((s) => s.id === proxima.id) && !TIPOS_COM_MOVIMENTO.has((proxima.transition ?? TRANSICAO_PADRAO).type) ? proxima : undefined
  const definir = (v: boolean) => acoes.atualizarCamadas(ids, (l) => { const { morph: _m, ...resto } = l; return (v ? resto : { ...resto, morph: false }) as Camada })

  return (
    <Secao titulo="Entre telas" chave="anim.entreTelas" resumo={outras.length ? `${outras.length} ${outras.length === 1 ? 'tela' : 'telas'}` : 'Só nesta tela'} acao={<Interruptor rotulo="Animar entre telas" ativo={anima} aoMudar={definir} />}>
      {outras.length ? (
        <>
          <p className="text-[11px] leading-snug text-texto2">
            {anima ? 'O mesmo objeto está em outras telas: ao passar de uma para a outra, ele anda até a nova posição, tamanho e cor.' : 'Nesta tela ele aparece parado, sem andar desde a tela vizinha (nas outras telas continua animando).'}
          </p>
          <div className="flex flex-wrap gap-1">
            {outras.map((s) => (
              <button key={s.id} type="button" onClick={() => acoes.irParaCena(s.id)} title={`Ir para a tela ${numero(s.id)}`} className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-superficie2 px-2 text-[11px] text-texto2 transition-colors hover:bg-hover hover:text-texto">
                <span className="tabular-nums text-texto3">{numero(s.id)}</span>
                <span className="truncate">{s.title || 'Sem título'}</span>
              </button>
            ))}
          </div>
          {proximaSemMovimento && (
            <button type="button" onClick={() => acoes.transformarDocumento((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === proximaSemMovimento.id ? { ...s, transition: { ...(s.transition ?? TRANSICAO_PADRAO), type: 'auto' } } : s)) }))} className="w-full rounded-md bg-acentoSuave px-2.5 py-2 text-left text-[11px] leading-snug text-acento transition-colors hover:bg-acento/15">
              A tela {numero(proximaSemMovimento.id)} entra com outra transição, então ele não anda. <strong className="font-medium">Usar Automática</strong>
            </button>
          )}
        </>
      ) : (
        <p className="text-[11px] leading-snug text-texto2">Para animar este objeto entre telas, copie (⌘C) e cole (⌘V) em outra tela, ou duplique a tela. Ele vira o mesmo objeto: mude a posição, o tamanho ou a cor lá e ele anda sozinho na apresentação.</p>
      )}
    </Secao>
  )
}
