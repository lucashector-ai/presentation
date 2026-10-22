import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guarda do grid do painel: nas telas de components/app, margens, paddings, gaps e alturas de controle saem da escala
 * de 8 (4 só dentro de componentes). Ver components/app/Layout.tsx e lib/design-tokens.ts › T.layout.
 * Arquivo novo entra na checagem automaticamente; a lista abaixo é a dívida que ainda não passou pelo grid.
 */
const AINDA_FORA: Record<string, string> = {
  'CriarComIA.tsx': 'só o invólucro de layout foi migrado; o conteúdo dos passos muda junto com o manual da marca',
  'FormAuth.tsx': 'telas de entrada e cadastro, fora do painel',
  'LeituraPdf.tsx': 'peça interna do Criar com IA (progresso de leitura do PDF)',
  'Apresentar.tsx': 'tela cheia da apresentação, fora do painel',
}

/** Classes de espaçamento fora da escala: 2, 6, 10, 12, 14, 20, 28, 36 e 44 px. */
const FORA_DA_ESCALA = /(?<![\w-])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(?:0\.5|1\.5|2\.5|3|3\.5|5|7|9|11)(?![\w.-])/g
/** Alturas e larguras de controle fora da escala (28, 36 e 44 px). */
const CONTROLE_FORA = /(?<![\w-])(?:h|w)-(?:7|9|11)(?![\w.-])/g
/** Espaçamento arbitrário em px (p-[18px], gap-[200px]…): sempre fora, use a escala. */
const ESPACO_ARBITRARIO = /(?<![\w-])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\[\d+(?:\.\d+)?px\]/g
/** Altura arbitrária de controle/bloco (h-[60px], min-h-[76px]): só múltiplos de 8. Linhas finas (< 8 px) passam. */
const ALTURA_ARBITRARIA = /(?<![\w-])(?:h|min-h)-\[(\d+)px\]/g

const pasta = join(process.cwd(), 'components/app')
const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.tsx') && !(f in AINDA_FORA))

function problemas(fonte: string): string[] {
  const achados = [...fonte.matchAll(FORA_DA_ESCALA), ...fonte.matchAll(CONTROLE_FORA), ...fonte.matchAll(ESPACO_ARBITRARIO)].map((m) => m[0].trim())
  for (const m of fonte.matchAll(ALTURA_ARBITRARIA)) {
    const px = Number(m[1])
    if (px >= 8 && px % 8 !== 0) achados.push(m[0])
  }
  return achados
}

describe('espaçamento do painel na escala de 8', () => {
  it('confere ao menos as telas principais', () => {
    for (const f of ['Dashboard.tsx', 'Shell.tsx', 'Paginas.tsx', 'Configuracoes.tsx', 'Layout.tsx', 'NovoProjeto.tsx']) expect(arquivos).toContain(f)
  })

  it.each(arquivos)('%s', (arquivo) => {
    expect(problemas(readFileSync(join(pasta, arquivo), 'utf8'))).toEqual([])
  })

  it('a regra pega o que deveria', () => {
    expect(problemas('className="mt-2.5 gap-3 p-5 h-11 px-[18px] h-[60px] -mx-3"')).toEqual(['mt-2.5', 'gap-3', 'p-5', '-mx-3', 'h-11', 'px-[18px]', 'h-[60px]'])
    expect(problemas('className="mt-2 gap-4 p-6 h-10 h-[3px] min-h-[72px] h-3.5 w-3.5 -translate-y-0.5 top-2.5"')).toEqual([])
  })
})
