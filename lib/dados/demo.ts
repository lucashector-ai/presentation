'use client'
/**
 * Implementação de demonstração: o "backend" no navegador (lib/demo/store.ts), sem mudar o comportamento.
 * Só adapta as chamadas síncronas do store ao contrato assíncrono e converte ErroDemo em ErroDados.
 */
import * as store from '@/lib/demo/store'
import type { EstadoDemo } from '@/lib/demo/tipos'
import { api } from '@/lib/api/cliente'
import { sair as sairDaSessao } from '@/lib/sessao'
import { paraErroDados } from './comum'
import { PLANOS } from '@/lib/planos'
import { ErroDados } from './tipos'
import type { EstadoDados, FonteDados, Recurso, Situacao } from './tipos'

const PRONTO: Record<Recurso, Situacao> = { conta: { estado: 'pronto' }, projetos: { estado: 'pronto' }, lixeira: { estado: 'pronto' }, assets: { estado: 'pronto' }, links: { estado: 'pronto' } }

let origem: EstadoDemo | null = null
let instantaneo: EstadoDados | null = null
/** Referência estável enquanto o estado do store não muda (useSyncExternalStore exige). */
function estado(): EstadoDados {
  const e = store.estado()
  if (e !== origem || !instantaneo) {
    origem = e
    instantaneo = { usuario: e.usuario, workspace: e.workspace, projetos: e.projetos, assets: e.assets, links: e.links, creditos: e.creditos, uso: store.uso(e), situacao: PRONTO }
  }
  return instantaneo
}

async function envolver<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw paraErroDados(e)
  }
}

const SEM_EQUIPE = new ErroDados('indisponivel', 'No modo demonstração não há equipe nem edição em tempo real: elas usam o servidor. Crie uma conta para convidar pessoas.')

/** Links com senha já liberados nesta aba (o "grant" do modo demo). */
const liberados = new Set<string>()

export const fonteDemo: FonteDados = {
  modo: 'demo',
  capacidades: { creditosFicticios: true, compraSimulada: true, dadosDeExemplo: true, editarEmail: true },
  assinar: store.assinar,
  estado,
  carregar: async () => {},
  iniciarSessao: async () => {},
  sair: () => sairDaSessao(),

  criarProjeto: (entrada) => envolver(() => store.criarProjeto(entrada)),
  duplicarProjeto: (id) => envolver(() => store.duplicarProjeto(id)),
  atualizarProjeto: (id, mudancas) => envolver(() => store.atualizarProjeto(id, mudancas)),
  excluirProjeto: (id) => envolver(() => store.excluirProjeto(id)),
  restaurarProjeto: (id) => envolver(() => store.restaurarProjeto(id)),
  excluirDefinitivo: (id) => envolver(() => store.excluirDefinitivo(id)),
  abrirProjeto: (id) => envolver(() => store.obterProjeto(id) ?? null),
  salvarDocumento: (id, documento, base) => envolver(() => store.salvarDocumento(id, documento, base)),
  publicar: (id, base) => envolver(() => store.publicar(id, base)),

  enviarArquivo: (arquivo, aoProgredir, opcoes = {}) => envolver(() => store.enviarArquivo(arquivo, aoProgredir, { sanitizarSvg: opcoes.sanitizarSvg })),
  excluirAsset: (id, forcar) => envolver(() => store.excluirAsset(id, forcar)),
  projetosQueUsam: (id) => store.projetosQueUsam(id),

  criarLink: (projetoId, opcoes) => envolver(() => store.criarLink(projetoId, opcoes)),
  revogarLink: (id) => envolver(() => store.revogarLink(id)),
  resolverToken: (token) =>
    envolver(async () => {
      const r = await store.resolverToken(token, liberados)
      return r.state === 'locked' ? { state: 'locked' as const, projectName: r.projectName } : r.state === 'ready' ? { state: 'ready' as const, projectName: r.projectName, documento: r.documento, assets: r.assets, marca: r.marca } : r
    }),
  desbloquear: (token, senha) =>
    envolver(async () => {
      const r = await store.desbloquear(token, senha)
      if (!r.ok) return r
      liberados.add(r.linkId)
      return { ok: true as const }
    }),

  // no modo demonstração a rota de IA não exige sessão nem debita: o saldo fictício é debitado em registrarUsoIa
  ia: {
    roteiro: (pedido, sinal) => envolver(() => api.ia.roteiro(pedido, sinal)),
    texto: (pedido, sinal) => envolver(() => api.ia.texto(pedido, sinal)),
    tela: (pedido, sinal) => envolver(() => api.ia.tela(pedido, sinal)),
    pdf: (pdf, paginas, sinal) => envolver(() => api.ia.pdf(pdf, paginas, sinal)),
  },
  registrarUsoIa: ({ custo, motivo, gerador, houveResultado }) => {
    if (gerador === 'claude' || houveResultado) {
      try { store.gastarCreditos(custo, motivo) } catch { /* saldo conferido antes da chamada */ }
    }
  },

  // sem servidor não há colaboração: a equipe é só você
  equipe: {
    obter: async () => {
      const e = store.estado()
      return {
        workspace: { id: e.workspace.id, nome: e.workspace.nome },
        meuPapel: 'owner',
        limite: PLANOS[e.workspace.planoId].limites.membros,
        membros: [{ userId: e.usuario.id, nome: e.usuario.nome, email: e.usuario.email, papel: 'owner', desde: new Date(0).toISOString(), voce: true }],
        convites: [],
      }
    },
    convidar: async () => { throw SEM_EQUIPE },
    revogarConvite: async () => { throw SEM_EQUIPE },
    alterarPapel: async () => { throw SEM_EQUIPE },
    remover: async () => { throw SEM_EQUIPE },
  },
  convites: {
    obter: async () => ({ estado: 'invalido' }),
    aceitar: async () => { throw SEM_EQUIPE },
  },
  espacos: {
    listar: async () => {
      const e = store.estado()
      return [{ id: e.workspace.id, nome: e.workspace.nome, dono: e.usuario.nome, papel: 'owner', proprio: true, ativo: true }]
    },
    ativar: async () => {},
  },
  marcas: {
    listar: () => envolver(() => store.listarMarcas()),
    salvar: (kit) => envolver(() => store.salvarMarca(kit)),
    excluir: (id) => envolver(() => store.excluirMarca(id)),
  },

  comprarPacote: (creditos) => envolver(() => { store.comprarPacote(creditos) }),
  trocarPlano: (planoId) => envolver(() => store.trocarPlano(planoId)),
  atualizarPerfil: (d) => envolver(() => store.definirUsuario(d)),
  reiniciarExemplo: (opcoes) => store.reiniciarDemo(opcoes),
}
