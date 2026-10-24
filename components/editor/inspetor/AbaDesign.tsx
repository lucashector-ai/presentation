'use client'
/**
 * Aba Design (modelo do painel Design do Figma): uma lista de seções, cada uma decide sozinha se aparece
 * para a seleção atual. Ordem do Figma — Posição, Layout (+ auto layout e restrições), Aparência, o tipo
 * (Texto, Imagem…), Preenchimento, Traço, Efeitos, Exportar — e depois o que é da Mostra (IA, protótipo,
 * link, responsivo, acessibilidade). Para adicionar uma seção, crie `SecaoX.tsx` com `({ editor, assets }: PropsSecao)`
 * e monte-a aqui na posição certa.
 */
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { CabecalhoCamada } from './CabecalhoCamada'
import { SecaoPosicao } from './SecaoPosicao'
import { SecaoLayout } from './SecaoLayout'
import { SecaoAutoLayout } from './SecaoAutoLayout'
import { SecaoBento } from './SecaoBento'
import { SecaoMockup } from './SecaoMockup'
import { SecaoAparencia } from './SecaoAparencia'
import { SecaoMascara } from './SecaoMascara'
import { SecoesDoTipo } from './SecoesTipo'
import { SecaoPreenchimento } from './SecaoPreenchimento'
import { SecaoTraco } from './SecaoTraco'
import { SecaoEfeitos } from './SecaoEfeitos'
import { SecaoExportar } from './SecaoExportar'
import { SecaoAcessibilidade, SecoesPrototipo } from './SecoesMostra'
import { SecaoIA } from '../ia/SecaoIA'
import { SecaoGuiasFrame } from '../guias/SecaoGuias'

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
      <SecaoBento {...p} />
      <SecaoMockup {...p} />
      {/* Restrições e Responsivo ficaram fora da interface (a resolução de restrições continua valendo por baixo). */}
      <SecaoAparencia {...p} />
      <SecaoMascara {...p} />
      <SecoesDoTipo {...p} />
      <SecaoPreenchimento {...p} />
      <SecaoTraco {...p} />
      <SecaoEfeitos {...p} />
      <SecaoGuiasFrame editor={editor} />
      <SecaoExportar {...p} />
      <SecaoIA editor={editor} />
      <SecoesPrototipo {...p} />
      <SecaoAcessibilidade {...p} />
    </div>
  )
}
