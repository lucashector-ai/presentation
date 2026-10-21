import { FORMATOS, SCHEMA_VERSION, novaCena, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import type { Projeto } from '@/lib/demo/tipos'
import { ErroDados, type CodigoErroDados } from './tipos'

const CODIGOS = new Set<CodigoErroDados>(['entrada_invalida', 'nao_autenticado', 'sem_permissao', 'nao_encontrado', 'conflito_revisao', 'arquivo_grande', 'muitas_tentativas', 'limite_do_plano', 'erro_interno', 'sem_conexao', 'indisponivel'])

/**
 * Converte qualquer erro (ErroDemo do store, ErroApiCliente das rotas, rede) em ErroDados. AbortError passa intacto.
 * Por formato (code + message), sem importar o store demo: o build real não leva os dados de exemplo.
 */
export function paraErroDados(e: unknown): unknown {
  if (e instanceof ErroDados) return e
  if ((e as { name?: string } | null)?.name === 'AbortError') return e
  if (e instanceof Error && typeof (e as { code?: unknown }).code === 'string') {
    const bruto = (e as unknown as { code: string }).code
    const code = CODIGOS.has(bruto as CodigoErroDados) ? (bruto as CodigoErroDados) : 'erro_interno'
    return new ErroDados(code, e.message, (e as { details?: unknown }).details)
  }
  return new ErroDados('erro_interno', e instanceof Error && e.message && e.message.length < 160 ? e.message : 'Algo deu errado. Tente novamente.')
}

/** Mensagem para toast/alerta. */
export function mensagemDeErro(e: unknown, padrao = 'Algo deu errado. Tente novamente.'): string {
  const d = paraErroDados(e)
  return d instanceof ErroDados ? d.message || padrao : padrao
}

export const ehErroDados = (e: unknown, code?: CodigoErroDados): e is ErroDados => e instanceof ErroDados && (!code || e.code === code)

/** Documento de um projeto novo em branco (o mesmo nos dois modos). */
export function documentoInicial(modo: ModoProjeto, formato?: keyof typeof FORMATOS): DocumentoProjeto {
  const size = FORMATOS[formato ?? (modo === 'story' ? 'story' : 'slides169')]
  return { schemaVersion: SCHEMA_VERSION, mode: modo, scenes: [novaCena({ id: 'tela-01', title: 'Capa', size, background: '#FAFAF9', ...(modo === 'explorar' ? { map: { x: 0, y: 0 } } : {}) })] }
}

/** Número de telas (a listagem do modo real traz só a capa e a contagem). */
export const telasDo = (p: Projeto) => p.totalTelas ?? p.documento.scenes.length
