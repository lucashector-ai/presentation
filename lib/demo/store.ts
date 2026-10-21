/**
 * "Backend" de demonstração no navegador. Implementa os mesmos contratos de lib/api/contratos.ts
 * (revisão com 409, snapshot publicado imutável, links com hash/senha/expiração/revogação, pipeline de upload),
 * persistindo em localStorage. Quando o backend real existir, os componentes trocam este módulo por chamadas HTTP
 * sem mudar a UI. Nenhum dado aqui é real.
 */
import { FORMATOS, SCHEMA_VERSION, novaCena, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import { podeGastarCreditos } from '@/lib/planos'
import { validarDocumento } from '@/lib/scene/validate'
import { estadoDoLink, gerarToken, hashSenha, hashToken, verificarSenha, avaliarTentativa, registrarFalha, type RegistroTentativas } from '@/lib/share/token'
import { PLANOS, podeCriarProjeto, podeEnviarArquivo, podeUsarSenhaNoLink } from '@/lib/planos'
import { classificar, precisaTexto } from '@/lib/importar/arquivos'
import { estadoInicial } from './dados'
import type { AssetDemo, EstadoDemo, LinkCompartilhado, Projeto } from './tipos'

const CHAVE = 'mostra.demo.v2'
const ouvintes = new Set<() => void>()
let cache: EstadoDemo | null = null
const tentativas = new Map<string, RegistroTentativas>()

export class ErroDemo extends Error {
  constructor(public code: 'entrada_invalida' | 'nao_encontrado' | 'conflito_revisao' | 'limite_do_plano' | 'muitas_tentativas' | 'sem_permissao', message: string, public details?: unknown) {
    super(message)
  }
}

function carregar(): EstadoDemo {
  if (cache) return cache
  if (typeof window !== 'undefined') {
    try {
      const bruto = localStorage.getItem(CHAVE)
      if (bruto) {
        const salvo = JSON.parse(bruto) as EstadoDemo
        if (salvo.versao === 2) cache = salvo
      }
    } catch {
      /* dados corrompidos: recomeça */
    }
  }
  if (!cache) cache = estadoInicial()
  return cache
}

function gravar(novo: EstadoDemo) {
  cache = novo
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo))
    } catch {
      /* quota: segue só em memória */
    }
  }
  ouvintes.forEach((f) => f())
}

function atualizar(fn: (e: EstadoDemo) => EstadoDemo) {
  gravar(fn(carregar()))
}

const agoraIso = () => new Date().toISOString()
const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

export function assinar(f: () => void): () => void {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}
export function estado(): EstadoDemo {
  return carregar()
}
export function reiniciarDemo() {
  gravar(estadoInicial())
}

function auditar(e: EstadoDemo, tipo: string, projectId: string | null, meta: Record<string, string | number | boolean> = {}): EstadoDemo {
  return { ...e, auditoria: [{ id: id('ev'), projectId, tipo, criadoEm: agoraIso(), meta }, ...e.auditoria].slice(0, 500) }
}

// ---------- uso / plano ----------

export function uso(e: EstadoDemo = carregar()) {
  return {
    projetosAtivos: e.projetos.filter((p) => !p.excluidoEm && p.status !== 'archived').length,
    armazenamentoBytes: e.assets.reduce((s, a) => s + a.bytes, 0),
    bandaMesBytes: 0,
  }
}
export function contextoPlano(e: EstadoDemo = carregar()) {
  return { planoId: e.workspace.planoId, estado: e.workspace.estadoAssinatura }
}
export function plano(e: EstadoDemo = carregar()) {
  return PLANOS[e.workspace.planoId]
}

// ---------- projetos ----------

export function listarProjetos(filtro: { q?: string; status?: 'all' | 'draft' | 'published' | 'archived' } = {}): Projeto[] {
  const q = (filtro.q ?? '').trim().toLowerCase()
  return carregar()
    .projetos.filter((p) => !p.excluidoEm)
    .filter((p) => (filtro.status && filtro.status !== 'all' ? p.status === filtro.status : p.status !== 'archived'))
    .filter((p) => !q || p.nome.toLowerCase().includes(q))
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
}

export function obterProjeto(idProjeto: string): Projeto | undefined {
  return carregar().projetos.find((p) => p.id === idProjeto && !p.excluidoEm)
}

export function gerarSlug(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'projeto'
}

export function criarProjeto(entrada: { nome: string; modo: ModoProjeto; formato?: keyof typeof FORMATOS; cliente?: string; descricao?: string; documento?: DocumentoProjeto }): Projeto {
  const e = carregar()
  const decisao = podeCriarProjeto(contextoPlano(e), uso(e))
  if (!decisao.ok) throw new ErroDemo('limite_do_plano', decisao.motivo, { upgradePara: decisao.upgradePara })
  const nome = entrada.nome.trim() || 'Sem título'
  const size = FORMATOS[entrada.formato ?? (entrada.modo === 'story' ? 'story' : 'slides169')]
  const documento: DocumentoProjeto = entrada.documento ?? {
    schemaVersion: SCHEMA_VERSION,
    mode: entrada.modo,
    scenes: [novaCena({ id: 'tela-01', title: 'Capa', size, background: '#FAFAF9', ...(entrada.modo === 'explorar' ? { map: { x: 0, y: 0 } } : {}) })],
  }
  const novo: Projeto = {
    id: id('pr'),
    workspaceId: e.workspace.id,
    nome,
    cliente: entrada.cliente?.trim() || undefined,
    slug: gerarSlug(nome),
    descricao: entrada.descricao?.trim() ?? '',
    modo: entrada.modo,
    status: 'draft',
    coverAssetId: null,
    revisaoAtual: 1,
    revisaoPublicada: null,
    documento,
    criadoEm: agoraIso(),
    atualizadoEm: agoraIso(),
    excluidoEm: null,
  }
  gravar(auditar({ ...e, projetos: [novo, ...e.projetos] }, 'project.created', novo.id))
  return novo
}

/** Restaura da lixeira. */
export function restaurarProjeto(idProjeto: string) {
  atualizar((e) => ({ ...e, projetos: e.projetos.map((p) => (p.id === idProjeto ? { ...p, excluidoEm: null } : p)) }))
}

export function listarLixeira(): Projeto[] {
  return carregar().projetos.filter((p) => !!p.excluidoEm)
}

/** Exclusão definitiva (só a partir da lixeira). */
export function excluirDefinitivo(idProjeto: string) {
  atualizar((e) => auditar({ ...e, projetos: e.projetos.filter((p) => p.id !== idProjeto), links: e.links.filter((l) => l.projectId !== idProjeto), snapshots: e.snapshots.filter((s) => s.projectId !== idProjeto) }, 'project.deleted', idProjeto, { definitivo: true }))
}

// ---------- créditos de IA ----------

export function saldoCreditos(): number {
  return carregar().creditos.saldo
}

/** Debita créditos de forma atômica (no backend real: transação no ledger credit_transactions). */
export function gastarCreditos(custo: number, motivo: string) {
  const e = carregar()
  const d = podeGastarCreditos(e.creditos.saldo, custo)
  if (!d.ok) throw new ErroDemo('limite_do_plano', d.motivo)
  gravar({ ...e, creditos: { saldo: e.creditos.saldo - custo, movimentos: [{ id: id('mv'), quantidade: -custo, motivo, criadoEm: agoraIso() }, ...e.creditos.movimentos].slice(0, 200) } })
}

export function adicionarCreditos(quantidade: number, motivo: string) {
  atualizar((e) => ({ ...e, creditos: { saldo: e.creditos.saldo + quantidade, movimentos: [{ id: id('mv'), quantidade, motivo, criadoEm: agoraIso() }, ...e.creditos.movimentos].slice(0, 200) } }))
}

export function duplicarProjeto(idProjeto: string): Projeto {
  const e = carregar()
  const orig = e.projetos.find((p) => p.id === idProjeto)
  if (!orig) throw new ErroDemo('nao_encontrado', 'Projeto não encontrado')
  const decisao = podeCriarProjeto(contextoPlano(e), uso(e))
  if (!decisao.ok) throw new ErroDemo('limite_do_plano', decisao.motivo, { upgradePara: decisao.upgradePara })
  const copia: Projeto = { ...structuredClone(orig), id: id('pr'), nome: `${orig.nome} (cópia)`, slug: `${orig.slug}-copia`, status: 'draft', revisaoAtual: 1, revisaoPublicada: null, criadoEm: agoraIso(), atualizadoEm: agoraIso(), excluidoEm: null }
  gravar(auditar({ ...e, projetos: [copia, ...e.projetos] }, 'project.created', copia.id, { duplicadoDe: orig.id }))
  return copia
}

export function atualizarProjeto(idProjeto: string, mudancas: Partial<Pick<Projeto, 'nome' | 'descricao' | 'coverAssetId' | 'status'>>): Projeto {
  let resultado: Projeto | undefined
  atualizar((e) => {
    const projetos = e.projetos.map((p) => {
      if (p.id !== idProjeto) return p
      resultado = { ...p, ...mudancas, atualizadoEm: agoraIso() }
      return resultado
    })
    let novo = { ...e, projetos }
    if (mudancas.status === 'archived') novo = auditar(novo, 'project.archived', idProjeto)
    return novo
  })
  if (!resultado) throw new ErroDemo('nao_encontrado', 'Projeto não encontrado')
  return resultado
}

export function excluirProjeto(idProjeto: string) {
  atualizar((e) =>
    auditar(
      { ...e, projetos: e.projetos.map((p) => (p.id === idProjeto ? { ...p, excluidoEm: agoraIso() } : p)), links: e.links.map((l) => (l.projectId === idProjeto && !l.revogadoEm ? { ...l, revogadoEm: agoraIso() } : l)) },
      'project.deleted',
      idProjeto
    )
  )
}

/** PUT /api/projects/:id/scenes — grava só se baseRevision bater; senão 409 com a revisão atual. */
export function salvarDocumento(idProjeto: string, documento: DocumentoProjeto, baseRevision: number): { revision: number; savedAt: string } {
  const e = carregar()
  const p = e.projetos.find((x) => x.id === idProjeto)
  if (!p) throw new ErroDemo('nao_encontrado', 'Projeto não encontrado')
  if (p.revisaoAtual !== baseRevision) throw new ErroDemo('conflito_revisao', 'Há uma versão mais recente. Suas mudanças continuam seguras nesta sessão.', { currentRevision: p.revisaoAtual, updatedAt: p.atualizadoEm })
  const v = validarDocumento(documento, { assetsExistentes: new Set(e.assets.map((a) => a.id)) })
  if (!v.ok || !v.documento) throw new ErroDemo('entrada_invalida', 'Documento inválido', v.erros)
  const revision = p.revisaoAtual + 1
  const savedAt = agoraIso()
  gravar({ ...e, projetos: e.projetos.map((x) => (x.id === idProjeto ? { ...x, documento: v.documento as DocumentoProjeto, revisaoAtual: revision, atualizadoEm: savedAt } : x)) })
  return { revision, savedAt }
}

/** POST /api/projects/:id/publish — snapshot imutável da revisão atual. */
export function publicar(idProjeto: string, baseRevision: number): { publishedRevision: number; publishedAt: string } {
  const e = carregar()
  const p = e.projetos.find((x) => x.id === idProjeto)
  if (!p) throw new ErroDemo('nao_encontrado', 'Projeto não encontrado')
  if (p.revisaoAtual !== baseRevision) throw new ErroDemo('conflito_revisao', 'Há uma versão mais recente. Recarregue antes de publicar.', { currentRevision: p.revisaoAtual })
  const v = validarDocumento(p.documento, { assetsExistentes: new Set(e.assets.map((a) => a.id)) })
  if (!v.ok) throw new ErroDemo('entrada_invalida', 'Corrija os erros antes de publicar', v.erros)
  const publishedAt = agoraIso()
  gravar(
    auditar(
      {
        ...e,
        snapshots: [...e.snapshots.filter((s) => !(s.projectId === idProjeto && s.revisao === p.revisaoAtual)), { projectId: idProjeto, revisao: p.revisaoAtual, documento: structuredClone(p.documento), criadoEm: publishedAt }],
        projetos: e.projetos.map((x) => (x.id === idProjeto ? { ...x, revisaoPublicada: p.revisaoAtual, status: 'published', atualizadoEm: publishedAt } : x)),
      },
      'project.published',
      idProjeto,
      { revision: p.revisaoAtual }
    )
  )
  return { publishedRevision: p.revisaoAtual, publishedAt }
}

// ---------- assets ----------

export function listarAssets(): AssetDemo[] {
  return carregar().assets.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}
export function obterAsset(idAsset: string): AssetDemo | undefined {
  return carregar().assets.find((a) => a.id === idAsset)
}
export function mapaAssets(): Record<string, AssetDemo> {
  return Object.fromEntries(carregar().assets.map((a) => [a.id, a]))
}

export type ProgressoUpload = { fase: 'validating' | 'uploading' | 'processing' | 'ready' | 'failed'; progresso: number; mensagem?: string; asset?: AssetDemo }

/**
 * Simula selected -> validating -> uploading -> processing -> ready (ou failed com mensagem acionável).
 * Aceita tudo que o editor importa: imagens, GIF, vídeo, SVG (sanitizado), GLB/GLTF (Blender) e Lottie.
 * No backend real: POST /api/assets/upload-url → PUT no storage → POST /api/assets/:id/finalize → worker.
 */
export async function enviarArquivo(arquivo: File, aoProgredir: (p: ProgressoUpload) => void, opcoes: { sanitizarSvg?: (t: string) => string } = {}): Promise<AssetDemo> {
  const e = carregar()
  aoProgredir({ fase: 'validating', progresso: 0 })
  const inicio = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer())
  const texto = precisaTexto(arquivo.name, arquivo.type) ? await arquivo.text() : undefined
  const cl = classificar(arquivo.name, arquivo.type, inicio, texto)
  if (cl.tipo === 'nao_suportado') {
    aoProgredir({ fase: 'failed', progresso: 0, mensagem: cl.dica })
    throw new ErroDemo('entrada_invalida', cl.dica ?? 'Formato não suportado')
  }
  const decisao = podeEnviarArquivo(contextoPlano(e), uso(e), arquivo.size)
  if (!decisao.ok) {
    aoProgredir({ fase: 'failed', progresso: 0, mensagem: decisao.motivo })
    throw new ErroDemo('limite_do_plano', decisao.motivo)
  }
  let blob: Blob = arquivo
  if (cl.tipo === 'svg' && texto !== undefined) {
    const limpo = opcoes.sanitizarSvg ? opcoes.sanitizarSvg(texto) : texto
    blob = new Blob([limpo], { type: 'image/svg+xml' })
  }
  const url = URL.createObjectURL(blob)
  const dims = cl.tipo === 'video' ? await dimensoesVideo(url) : cl.tipo === 'image' || cl.tipo === 'gif' || cl.tipo === 'svg' ? await dimensoesImagem(url) : cl.tipo === 'lottie' && texto ? lottieDims(texto) : { width: null, height: null }
  for (let p = 10; p <= 100; p += 30) {
    await espera(90)
    aoProgredir({ fase: 'uploading', progresso: p })
  }
  aoProgredir({ fase: 'processing', progresso: 100 })
  await espera(200)
  const asset: AssetDemo = {
    id: id('as'),
    workspaceId: e.workspace.id,
    nome: arquivo.name,
    tipo: cl.tipo,
    mime: cl.mime,
    bytes: arquivo.size,
    width: dims.width,
    height: dims.height,
    duracao: dims.duration ?? null,
    status: 'ready',
    url,
    thumbUrl: cl.tipo === 'image' || cl.tipo === 'gif' || cl.tipo === 'svg' ? url : null,
    posterUrl: null,
    criadoEm: agoraIso(),
    erro: cl.dica,
  }
  atualizar((s) => ({ ...s, assets: [asset, ...s.assets] }))
  aoProgredir({ fase: 'ready', progresso: 100, asset })
  return asset
}

function lottieDims(texto: string): { width: number | null; height: number | null; duration?: number } {
  try {
    const j = JSON.parse(texto) as { w?: number; h?: number }
    return { width: j.w ?? null, height: j.h ?? null }
  } catch {
    return { width: null, height: null }
  }
}

/** Impede quebra silenciosa: devolve os projetos que usam a mídia. */
export function projetosQueUsam(idAsset: string): Projeto[] {
  return carregar().projetos.filter((p) => !p.excluidoEm && JSON.stringify(p.documento).includes(`"${idAsset}"`))
}

export function excluirAsset(idAsset: string, forcar = false) {
  const emUso = projetosQueUsam(idAsset)
  if (emUso.length && !forcar) throw new ErroDemo('entrada_invalida', `Esta mídia é usada em ${emUso.length} projeto(s).`, { projetos: emUso.map((p) => p.nome) })
  atualizar((e) => auditar({ ...e, assets: e.assets.filter((a) => a.id !== idAsset) }, 'asset.deleted', null, { assetId: idAsset }))
}

// ---------- links ----------

export function listarLinks(idProjeto: string): LinkCompartilhado[] {
  return carregar().links.filter((l) => l.projectId === idProjeto).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

export async function criarLink(idProjeto: string, opcoes: { senha?: string; expiraEm?: string | null }): Promise<{ link: LinkCompartilhado; token: string }> {
  const e = carregar()
  const p = e.projetos.find((x) => x.id === idProjeto)
  if (!p) throw new ErroDemo('nao_encontrado', 'Projeto não encontrado')
  if (p.revisaoPublicada == null) throw new ErroDemo('entrada_invalida', 'Publique o projeto antes de criar um link.')
  if (opcoes.senha) {
    const d = podeUsarSenhaNoLink(contextoPlano(e))
    if (!d.ok) throw new ErroDemo('limite_do_plano', d.motivo, { upgradePara: d.upgradePara })
  }
  const token = gerarToken()
  const link: LinkCompartilhado = {
    id: id('lk'),
    projectId: idProjeto,
    tokenHash: await hashToken(token),
    tokenPreview: token.slice(0, 4),
    senhaHash: opcoes.senha ? await hashSenha(opcoes.senha) : null,
    expiraEm: opcoes.expiraEm ?? null,
    revogadoEm: null,
    visualizacoes: 0,
    criadoEm: agoraIso(),
    tokenDemo: token,
  }
  gravar(auditar({ ...carregar(), links: [link, ...carregar().links] }, 'share_link.created', idProjeto, { comSenha: !!opcoes.senha, expira: !!opcoes.expiraEm }))
  return { link, token }
}

export function revogarLink(idLink: string) {
  atualizar((e) => {
    const l = e.links.find((x) => x.id === idLink)
    return auditar({ ...e, links: e.links.map((x) => (x.id === idLink ? { ...x, revogadoEm: agoraIso() } : x)) }, 'share_link.revoked', l?.projectId ?? null)
  })
}

export type ResolucaoLink =
  | { state: 'unavailable' }
  | { state: 'locked'; projectName: string; linkId: string }
  | { state: 'ready'; projectName: string; documento: DocumentoProjeto; assets: Record<string, AssetDemo> }

/** GET /api/share/:token — nunca revela se o link existe, expirou ou foi revogado. */
export async function resolverToken(token: string, desbloqueados: ReadonlySet<string> = new Set()): Promise<ResolucaoLink> {
  const e = carregar()
  const hash = await hashToken(token)
  const link = e.links.find((l) => l.tokenHash === hash || l.tokenDemo === token)
  if (!link || estadoDoLink({ expiresAt: link.expiraEm, revokedAt: link.revogadoEm }) !== 'ativo') return { state: 'unavailable' }
  const p = e.projetos.find((x) => x.id === link.projectId && !x.excluidoEm)
  if (!p || p.revisaoPublicada == null) return { state: 'unavailable' }
  const snap = e.snapshots.find((s) => s.projectId === p.id && s.revisao === p.revisaoPublicada)
  if (!snap) return { state: 'unavailable' }
  if (link.senhaHash && !desbloqueados.has(link.id)) return { state: 'locked', projectName: p.nome, linkId: link.id }
  atualizar((s) => ({ ...s, links: s.links.map((l) => (l.id === link.id ? { ...l, visualizacoes: l.visualizacoes + 1 } : l)) }))
  return { state: 'ready', projectName: p.nome, documento: snap.documento, assets: mapaAssets() }
}

/** POST /api/share/:token/unlock — limite de tentativas por link. */
export async function desbloquear(token: string, senha: string): Promise<{ ok: true; linkId: string } | { ok: false; restantes: number; bloqueado: boolean }> {
  const e = carregar()
  const hash = await hashToken(token)
  const link = e.links.find((l) => l.tokenHash === hash || l.tokenDemo === token)
  if (!link || !link.senhaHash) throw new ErroDemo('nao_encontrado', 'Link indisponível')
  const av = avaliarTentativa(tentativas.get(link.id))
  if (av.bloqueado) throw new ErroDemo('muitas_tentativas', 'Muitas tentativas. Aguarde alguns minutos.')
  const certo = await verificarSenha(senha, link.senhaHash)
  if (certo) {
    tentativas.delete(link.id)
    atualizar((s) => auditar(s, 'share_link.unlocked', link.projectId))
    return { ok: true, linkId: link.id }
  }
  const reg = registrarFalha(tentativas.get(link.id))
  tentativas.set(link.id, reg)
  atualizar((s) => auditar(s, 'share_link.unlock_failed', link.projectId))
  const depois = avaliarTentativa(reg)
  return { ok: false, restantes: depois.restantes, bloqueado: depois.bloqueado }
}

// ---------- util ----------

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

function dimensoesImagem(url: string): Promise<{ width: number | null; height: number | null; duration?: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: null, height: null })
    img.src = url
  })
}
function dimensoesVideo(url: string): Promise<{ width: number | null; height: number | null; duration?: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration })
    v.onerror = () => resolve({ width: null, height: null })
    v.src = url
  })
}
