'use client'
/**
 * Restrições (constraints do Figma): como a camada acompanha o pai — frame sem auto layout ou a própria tela —
 * quando ele muda de tamanho. Diagrama clicável (bordas e centro, ⇧ soma o lado oposto) + dois menus.
 * Não aparece para itens no fluxo de um auto layout (o layout manda neles).
 */
import type { Camada, Restricoes } from '@/lib/scene/schema'
import { mapaDe, paiDe, temAutoLayout } from '@/lib/scene/arvore'
import { RESTRICAO_PADRAO } from '@/lib/scene/restricoes'
import { cx } from '@/components/ui'
import { MISTO, Secao, SeletorLista } from './controles'
import { comum, useCamadas, type PropsSecao } from './selecao'

const NOMES_H: Record<Restricoes['h'], string> = { left: 'Esquerda', right: 'Direita', leftRight: 'Esquerda e direita', center: 'Centro', scale: 'Escala' }
const NOMES_V: Record<Restricoes['v'], string> = { top: 'Topo', bottom: 'Base', topBottom: 'Topo e base', center: 'Centro', scale: 'Escala' }

const gravar = (c: Camada, r: Restricoes): Camada => ({ ...c, constraints: r.h === 'left' && r.v === 'top' ? undefined : r }) as Camada

export function SecaoRestricoes({ editor }: PropsSecao) {
  const { sel, setFn } = useCamadas(editor)
  const cena = editor.cena
  if (!cena || !sel.length) return null
  const mapa = mapaDe(cena.layers)
  // itens no fluxo do auto layout não têm restrições
  if (sel.some((c) => { const p = paiDe(c, mapa); return temAutoLayout(p) && !c.absolute })) return null
  const h = comum(sel, (c) => (c.constraints ?? RESTRICAO_PADRAO).h)
  const v = comum(sel, (c) => (c.constraints ?? RESTRICAO_PADRAO).v)
  const setH = (x: Restricoes['h']) => setFn((c) => gravar(c, { ...(c.constraints ?? RESTRICAO_PADRAO), h: x }))
  const setV = (y: Restricoes['v']) => setFn((c) => gravar(c, { ...(c.constraints ?? RESTRICAO_PADRAO), v: y }))
  // diagrama: clique numa borda escolhe aquele lado; ⇧ soma o oposto (esquerda e direita / topo e base)
  const lado = (eixo: 'h' | 'v', alvo: 'ini' | 'fim' | 'centro', shift: boolean) => {
    if (eixo === 'h') {
      const atual = h === MISTO ? 'left' : h
      if (alvo === 'centro') return setH('center')
      if (shift && (atual === 'left' || atual === 'right') && atual !== (alvo === 'ini' ? 'left' : 'right')) return setH('leftRight')
      return setH(alvo === 'ini' ? 'left' : 'right')
    }
    const atual = v === MISTO ? 'top' : v
    if (alvo === 'centro') return setV('center')
    if (shift && (atual === 'top' || atual === 'bottom') && atual !== (alvo === 'ini' ? 'top' : 'bottom')) return setV('topBottom')
    return setV(alvo === 'ini' ? 'top' : 'bottom')
  }
  const ativoH = (k: 'ini' | 'fim' | 'centro') => (k === 'centro' ? h === 'center' : k === 'ini' ? h === 'left' || h === 'leftRight' : h === 'right' || h === 'leftRight')
  const ativoV = (k: 'ini' | 'fim' | 'centro') => (k === 'centro' ? v === 'center' : k === 'ini' ? v === 'top' || v === 'topBottom' : v === 'bottom' || v === 'topBottom')
  const barra = (ativo: boolean) => cx('rounded-full transition-colors', ativo ? 'bg-acento' : 'bg-texto3/40 group-hover:bg-texto2')
  const pai = sel.length === 1 ? paiDe(sel[0]!, mapa) : undefined
  return (
    <Secao titulo="Restrições" recolhivel aberta={sel.some((c) => !!c.constraints)}>
      <div className="flex gap-3">
        <div className="relative h-[68px] w-[68px] shrink-0 rounded-md bg-superficie2" role="group" aria-label="Restrições (diagrama)">
          <div className="absolute inset-[20px] rounded-[3px] border border-bordaForte" aria-hidden />
          <button type="button" title="Topo (⇧ soma a base)" aria-label="Restrição: topo" aria-pressed={ativoV('ini')} onClick={(e) => lado('v', 'ini', e.shiftKey)} className="group absolute left-[26px] top-[4px] flex h-[14px] w-[16px] items-center justify-center"><span className={cx('h-[10px] w-[2px]', barra(ativoV('ini')))} /></button>
          <button type="button" title="Base (⇧ soma o topo)" aria-label="Restrição: base" aria-pressed={ativoV('fim')} onClick={(e) => lado('v', 'fim', e.shiftKey)} className="group absolute bottom-[4px] left-[26px] flex h-[14px] w-[16px] items-center justify-center"><span className={cx('h-[10px] w-[2px]', barra(ativoV('fim')))} /></button>
          <button type="button" title="Esquerda (⇧ soma a direita)" aria-label="Restrição: esquerda" aria-pressed={ativoH('ini')} onClick={(e) => lado('h', 'ini', e.shiftKey)} className="group absolute left-[4px] top-[26px] flex h-[16px] w-[14px] items-center justify-center"><span className={cx('h-[2px] w-[10px]', barra(ativoH('ini')))} /></button>
          <button type="button" title="Direita (⇧ soma a esquerda)" aria-label="Restrição: direita" aria-pressed={ativoH('fim')} onClick={(e) => lado('h', 'fim', e.shiftKey)} className="group absolute right-[4px] top-[26px] flex h-[16px] w-[14px] items-center justify-center"><span className={cx('h-[2px] w-[10px]', barra(ativoH('fim')))} /></button>
          <button type="button" title="Centro horizontal" aria-label="Restrição: centro horizontal" aria-pressed={ativoH('centro')} onClick={() => lado('h', 'centro', false)} className="group absolute left-[24px] top-[30px] flex h-[8px] w-[20px] items-center justify-center"><span className={cx('h-[2px] w-[12px]', barra(ativoH('centro')))} /></button>
          <button type="button" title="Centro vertical" aria-label="Restrição: centro vertical" aria-pressed={ativoV('centro')} onClick={() => lado('v', 'centro', false)} className="group absolute left-[30px] top-[24px] flex h-[20px] w-[8px] items-center justify-center"><span className={cx('h-[12px] w-[2px]', barra(ativoV('centro')))} /></button>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <SeletorLista rotulo="Restrição horizontal" prefixo={<span className="text-[11px]">↔</span>} valor={h === MISTO ? '' : h} aoMudar={(x) => x && setH(x as Restricoes['h'])} opcoes={[...(h === MISTO ? [{ id: '', rotulo: 'Misto' }] : []), ...Object.entries(NOMES_H).map(([id, rotulo]) => ({ id, rotulo }))]} />
          <SeletorLista rotulo="Restrição vertical" prefixo={<span className="text-[11px]">↕</span>} valor={v === MISTO ? '' : v} aoMudar={(y) => y && setV(y as Restricoes['v'])} opcoes={[...(v === MISTO ? [{ id: '', rotulo: 'Misto' }] : []), ...Object.entries(NOMES_V).map(([id, rotulo]) => ({ id, rotulo }))]} />
          <p className="text-[11px] leading-snug text-texto3">{pai ? 'Ao redimensionar o frame pai.' : 'Ao mudar o formato da tela.'}</p>
        </div>
      </div>
    </Secao>
  )
}
