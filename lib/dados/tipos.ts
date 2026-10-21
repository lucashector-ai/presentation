/**
 * Camada de dados do cliente: UM contrato, duas implementações.
 *  - demo (NEXT_PUBLIC_DEMO=1): lib/demo/store.ts no navegador (localStorage `mostra.demo.v2`), como sempre foi.
 *  - real: rotas /api (sessão por cookie HttpOnly do próprio domínio) com um cache reativo em memória.
 * As telas só falam com `dados` (lib/dados/index.ts) e leem o estado com `useDados`; nenhuma decide sozinha se
 * está no modo demo. O formato do estado é o mesmo nas duas (os tipos de domínio vêm de lib/demo/tipos.ts).
 */
import type { DocumentoProjeto, ModoProjeto, FORMATOS } from '@/lib/scene/schema'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import type { PlanoId, UsoWorkspace } from '@/lib/planos'
import type { AssetDemo, LinkCompartilhado, MovimentoCredito, Projeto, Usuario, Workspace } from '@/lib/demo/tipos'
import type { PedidoRoteiro, RespostaRoteiro } from '@/lib/ia/pedido'
import type { PedidoTextoSchema, RespostaTexto } from '@/lib/ia/texto'
import type { PedidoTelaSchema, RespostaTela } from '@/lib/ia/tela'
import type { z } from 'zod'

export type { AssetDemo as Midia, AssetDemo, LinkCompartilhado, MovimentoCredito, Projeto, Usuario, Workspace }

/** Partes do estado que o modo real busca no servidor (no demo estão sempre prontas). */
export type Recurso = 'conta' | 'projetos' | 'lixeira' | 'assets' | 'links'
export interface Situacao {
  estado: 'ocioso' | 'carregando' | 'pronto' | 'erro'
  erro?: string
}

export interface EstadoDados {
  usuario: Usuario
  workspace: Workspace
  /** Ativos, arquivados e os da lixeira (`excluidoEm` preenchido). */
  projetos: Projeto[]
  assets: AssetDemo[]
  links: LinkCompartilhado[]
  creditos: { saldo: number; movimentos: MovimentoCredito[] }
  uso: UsoWorkspace
  situacao: Record<Recurso, Situacao>
}

export type CodigoErroDados =
  | 'entrada_invalida' | 'nao_autenticado' | 'sem_permissao' | 'nao_encontrado' | 'conflito_revisao' | 'arquivo_grande'
  | 'muitas_tentativas' | 'limite_do_plano' | 'erro_interno' | 'sem_conexao' | 'indisponivel'

/** Erro único que as telas tratam (vem do store demo ou das rotas). `message` já é texto para o usuário. */
export class ErroDados extends Error {
  constructor(public code: CodigoErroDados, message: string, public details?: unknown) {
    super(message)
    this.name = 'ErroDados'
  }
}

export type ProgressoUpload = { fase: 'validating' | 'uploading' | 'processing' | 'ready' | 'failed'; progresso: number; mensagem?: string; asset?: AssetDemo }

export type ResolucaoLink =
  | { state: 'unavailable' }
  | { state: 'locked'; projectName: string }
  /** `marca`: mostra o selo "Feito com Mostra" (planos com `marcaDaPlataforma`, ex.: Free). */
  | { state: 'ready'; projectName: string; documento: DocumentoProjeto; assets: AssetsResolvidos; marca: boolean }

export interface NovoProjeto {
  nome: string
  modo: ModoProjeto
  formato?: keyof typeof FORMATOS
  cliente?: string
  descricao?: string
  documento?: DocumentoProjeto
}

export type MudancasProjeto = Partial<Pick<Projeto, 'nome' | 'descricao' | 'coverAssetId' | 'status'>>

export interface FonteDados {
  readonly modo: 'demo' | 'real'
  /** O que muda no texto da interface (não nos dados): créditos fictícios, compra simulada, dados de exemplo. */
  readonly capacidades: { creditosFicticios: boolean; compraSimulada: boolean; dadosDeExemplo: boolean; editarEmail: boolean }

  assinar(f: () => void): () => void
  estado(): EstadoDados
  /** Garante que os recursos foram buscados (com `forcar`, busca de novo). Erros ficam em `estado().situacao`. */
  carregar(recursos: Recurso[], opcoes?: { forcar?: boolean }): Promise<void>
  /** Depois do login: confere de quem é a sessão e descarta o cache de outra conta. */
  iniciarSessao(): Promise<void>
  sair(): Promise<void>

  // projetos
  criarProjeto(entrada: NovoProjeto): Promise<Projeto>
  duplicarProjeto(id: string): Promise<Projeto>
  atualizarProjeto(id: string, mudancas: MudancasProjeto): Promise<Projeto>
  excluirProjeto(id: string): Promise<void>
  restaurarProjeto(id: string): Promise<void>
  excluirDefinitivo(id: string): Promise<void>
  /** Projeto com o documento inteiro (busca no servidor no modo real); null se não existe ou está na lixeira. */
  abrirProjeto(id: string, opcoes?: { forcar?: boolean }): Promise<Projeto | null>
  /** PUT das cenas com revisão base; conflito → ErroDados('conflito_revisao', …, { currentRevision }). */
  salvarDocumento(id: string, documento: DocumentoProjeto, baseRevision: number): Promise<{ revision: number; savedAt: string }>
  publicar(id: string, baseRevision: number): Promise<{ publishedRevision: number; publishedAt: string }>

  // mídias
  enviarArquivo(arquivo: File, aoProgredir: (p: ProgressoUpload) => void, opcoes?: { sanitizarSvg?: (t: string) => string; projetoId?: string }): Promise<AssetDemo>
  /** Sem `forcar`, recusa mídia em uso (ErroDados entrada_invalida com details.projetos). */
  excluirAsset(id: string, forcar?: boolean): Promise<void>
  /** Projetos que usam a mídia, quando dá para saber no cliente (null = desconhecido). */
  projetosQueUsam(id: string): Projeto[] | null

  // links
  criarLink(projetoId: string, opcoes: { senha?: string; expiraEm?: string | null }): Promise<{ link: LinkCompartilhado; token: string }>
  revogarLink(id: string): Promise<void>
  resolverToken(token: string): Promise<ResolucaoLink>
  desbloquear(token: string, senha: string): Promise<{ ok: true } | { ok: false; restantes: number; bloqueado: boolean }>

  // IA (as rotas debitam no modo real; no demo o saldo fictício é debitado aqui)
  ia: {
    roteiro(pedido: Partial<PedidoRoteiro>, sinal?: AbortSignal): Promise<RespostaRoteiro>
    texto(pedido: z.input<typeof PedidoTextoSchema>, sinal?: AbortSignal): Promise<RespostaTexto>
    tela(pedido: z.input<typeof PedidoTelaSchema>, sinal?: AbortSignal): Promise<RespostaTela>
  }
  /** Depois de uma resposta da IA: demo debita o saldo fictício; real relê o saldo que a rota já debitou. */
  registrarUsoIa(uso: { custo: number; motivo: string; gerador: 'claude' | 'local'; houveResultado: boolean }): void

  // conta, plano e créditos
  comprarPacote(creditos: number): Promise<void>
  trocarPlano(planoId: PlanoId): Promise<void>
  atualizarPerfil(dados: { nome?: string; email?: string }): Promise<void>
  /** Só com `capacidades.dadosDeExemplo`. */
  reiniciarExemplo(opcoes?: { vazio?: boolean }): void
}
