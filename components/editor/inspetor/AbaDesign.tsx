'use client'
/**
 * Aba Design (modelo do painel Design do Figma): uma lista de seções, cada uma decide sozinha se aparece
 * para a seleção atual. Para adicionar uma seção, crie `SecaoX.tsx` com `({ editor, assets }: PropsSecao)`
 * e monte-a aqui na posição certa.
 */
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { CabecalhoCamada } from './CabecalhoCamada'
import { SecaoPosicao } from './SecaoPosicao'
import { SecaoLayout } from './SecaoLayout'
import { SecaoAutoLayout } from './SecaoAutoLayout'
import { SecaoAparencia } from './SecaoAparencia'
import { SecoesDoTipo } from './SecoesTipo'
import { SecaoPreenchimento, SecaoTraco } from './SecaoPreenchimento'
import { SecaoEfeitos } from './SecaoEfeitos'
import { SecaoExportar } from './SecaoExportar'
import { SecaoAcessibilidade, SecaoResponsivo, SecoesPrototipo } from './SecoesMostra'

export { ICONE_TIPO, NOME_TIPO } from './selecao'
export { resumoInteracoes } from './SecoesMostra'

export function AbaDesign({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  if (!editor.camadasSelecionadas.length) return null
  const p = { editor, assets }
  return (
    <div className="pb-6">
      <CabecalhoCamada {...p} />
      <SecaoPosicao {...p} />
      <SecaoLayout {...p} />
      <SecaoAutoLayout {...p} />
      <SecaoAparencia {...p} />
      <SecoesDoTipo {...p} />
      <SecaoPreenchimento {...p} />
      <SecaoTraco {...p} />
      <SecaoEfeitos {...p} />
      <SecaoExportar {...p} />
      <SecoesPrototipo {...p} />
      <SecaoResponsivo {...p} />
      <SecaoAcessibilidade {...p} />
    </div>
  )
}
