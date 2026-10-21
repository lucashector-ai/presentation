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

  comprarPacote: (creditos) => envolver(() => { store.comprarPacote(creditos) }),
  trocarPlano: (planoId) => envolver(() => store.trocarPlano(planoId)),
  atualizarPerfil: (d) => envolver(() => store.definirUsuario(d)),
  reiniciarExemplo: (opcoes) => store.reiniciarDemo(opcoes),
}
