'use client'
/**
 * Implementação real: rotas /api com a sessão no cookie HttpOnly do próprio domínio (Neon Auth). Mantém um cache
 * reativo no formato do estado demo, para as telas lerem igual nos dois modos. Cada recurso é buscado uma vez
 * (deduplicado) e atualizado localmente depois de cada mutação; o servidor continua sendo a fonte da verdade
 * (revisão com 409, limites do plano, débito de créditos, autorização).
 */
import { api } from '@/lib/api/cliente'
import { MIMES_ACEITOS, type Asset, type ProjetoResumo, type ShareLink } from '@/lib/api/contratos'
import { CenaSchema, SCHEMA_VERSION, type DocumentoProjeto } from '@/lib/scene/schema'
import { parseDocumento } from '@/lib/scene/migrar'
import { classificar, precisaTexto } from '@/lib/importar/arquivos'
import { podeEnviarArquivo } from '@/lib/planos'
import { carregarAuth, sair as sairDaSessao } from '@/lib/sessao'
import type { AssetDemo, LinkCompartilhado, Projeto } from '@/lib/demo/tipos'
import { documentoInicial, paraErroDados } from './comum'
import { ErroDados, type EstadoDados, type FonteDados, type Recurso, type Situacao } from './tipos'

const OCIOSO: Situacao = { estado: 'ocioso' }
const vazio = (): EstadoDados => ({
  usuario: { id: '', nome: '', email: '' },
  workspace: { id: '', nome: 'Meu espaço', planoId: 'free', estadoAssinatura: 'trial', membros: 1 },
  projetos: [],
  assets: [],
  links: [],
  creditos: { saldo: 0, movimentos: [] },
  uso: { projetosAtivos: 0, armazenamentoBytes: 0, bandaMesBytes: 0 },
  situacao: { conta: OCIOSO, projetos: OCIOSO, lixeira: OCIOSO, assets: OCIOSO, links: OCIOSO },
})

let atual: EstadoDados = vazio()
const ouvintes = new Set<() => void>()
const emCurso = new Map<Recurso, Promise<void>>()
/** Muda a cada sessão/limpeza: respostas atrasadas de uma sessão anterior são descartadas. */
let geracao = 0

function definir(fn: (e: EstadoDados) => EstadoDados) {
  const novo = fn(atual)
  if (novo === atual) return
  atual = novo
  ouvintes.forEach((f) => f())
}
const agoraIso = () => new Date().toISOString()
const trocarProjeto = (id: string, fn: (p: Projeto) => Projeto) => definir((e) => ({ ...e, projetos: e.projetos.map((p) => (p.id === id ? fn(p) : p)) }))
const situar = (r: Recurso, s: Situacao) => definir((e) => ({ ...e, situacao: { ...e.situacao, [r]: s } }))

/** Sessão expirada no meio do uso: volta ao login e retorna para a mesma tela depois. */
function irParaLogin() {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/app')) return
  window.location.assign(`/login?${new URLSearchParams({ proximo: `${window.location.pathname}${window.location.search}` })}`)
}

async function chamar<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const d = paraErroDados(e)
    if (d instanceof ErroDados && d.code === 'nao_autenticado') irParaLogin()
    throw d
  }
}

// ---------- conversões contrato da API → modelo da UI ----------

function documentoSeguro(doc: DocumentoProjeto): DocumentoProjeto {
  try { return parseDocumento(doc) } catch { return doc }
}

function deResumo(r: ProjetoResumo, anterior?: Projeto): Projeto {
  // documento inteiro já em cache e na mesma revisão: continua valendo
  const completo = anterior && !anterior.documentoParcial && anterior.revisaoAtual === r.currentRevision ? anterior.documento : null
  const capa = r.coverScene ? CenaSchema.safeParse(r.coverScene) : null
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    nome: r.name,
    slug: r.slug,
    descricao: anterior?.descricao ?? '',
    modo: r.mode,
    status: r.status,
    coverAssetId: anterior?.coverAssetId ?? null,
    revisaoAtual: r.currentRevision,
    revisaoPublicada: r.publishedRevision,
    documento: completo ?? { schemaVersion: SCHEMA_VERSION, mode: r.mode, scenes: capa?.success ? [capa.data] : [] },
    documentoParcial: !completo,
    totalTelas: r.sceneCount,
    criadoEm: r.createdAt,
    atualizadoEm: r.updatedAt,
    excluidoEm: r.deletedAt ?? null,
  }
}

function deAsset(a: Asset): AssetDemo {
  const visual = a.mediaType === 'image' || a.mediaType === 'gif' || a.mediaType === 'svg'
  return {
    id: a.id, workspaceId: a.workspaceId, nome: a.name, tipo: a.mediaType, mime: a.mime, bytes: a.bytes, width: a.width, height: a.height, duracao: a.duration, status: a.status,
    url: a.url ?? '', thumbUrl: a.thumbUrl ?? (visual && a.url ? a.url : null), posterUrl: null, criadoEm: a.createdAt,
  }
}

function deLink(l: ShareLink): LinkCompartilhado {
  // o hash da senha nunca sai do servidor: só sabemos SE tem senha
  return { id: l.id, projectId: l.projectId, tokenHash: '', tokenPreview: l.tokenPreview, senhaHash: l.hasPassword ? 'definida' : null, expiraEm: l.expiresAt, revogadoEm: l.revokedAt, visualizacoes: l.views, criadoEm: l.createdAt, tokenDemo: '' }
}

async function listarProjetos(status: 'all' | 'archived' | 'trash'): Promise<ProjetoResumo[]> {
  const itens: ProjetoResumo[] = []
  let cursor: string | null = null
  do {
    const r: { items: ProjetoResumo[]; nextCursor: string | null } = await api.projetos.listar({ status, limit: '100', ...(cursor ? { cursor } : {}) })
    itens.push(...r.items)
    cursor = r.nextCursor
  } while (cursor && itens.length < 2000)
  return itens
}

// ---------- carregamento ----------

async function buscar(recurso: Recurso): Promise<void> {
  const g = geracao
  const aplicar = (fn: (e: EstadoDados) => EstadoDados) => { if (g === geracao) definir(fn) }
  switch (recurso) {
    case 'conta': {
      const c = await api.conta.obter()
      return aplicar((e) => ({ ...e, usuario: c.usuario, workspace: c.workspace, creditos: c.creditos, uso: c.uso }))
    }
    case 'projetos': {
      const [ativos, arquivados] = await Promise.all([listarProjetos('all'), listarProjetos('archived')])
      return aplicar((e) => {
        const antes = new Map(e.projetos.map((p) => [p.id, p]))
        return { ...e, projetos: [...[...ativos, ...arquivados].map((r) => deResumo(r, antes.get(r.id))), ...e.projetos.filter((p) => p.excluidoEm)] }
      })
    }
    case 'lixeira': {
      const lixo = await listarProjetos('trash')
      return aplicar((e) => {
        const antes = new Map(e.projetos.map((p) => [p.id, p]))
        const ids = new Set(lixo.map((r) => r.id))
        return { ...e, projetos: [...e.projetos.filter((p) => !p.excluidoEm && !ids.has(p.id)), ...lixo.map((r) => deResumo(r, antes.get(r.id)))] }
      })
    }
    case 'assets': {
      const lista = await api.assets.listar()
      return aplicar((e) => ({ ...e, assets: lista.map(deAsset) }))
    }
    case 'links': {
      const lista = await api.links.listarTodos()
      return aplicar((e) => ({ ...e, links: lista.map(deLink) }))
    }
  }
}

function carregarUm(recurso: Recurso, forcar: boolean): Promise<void> {
  const ja = atual.situacao[recurso]
  if (!forcar && ja.estado === 'pronto') return Promise.resolve()
  const pendente = emCurso.get(recurso)
  if (pendente) return pendente
  // recarregar algo já pronto não volta a mostrar "carregando"
  if (ja.estado !== 'pronto') situar(recurso, { estado: 'carregando' })
  const g = geracao
  const p = buscar(recurso)
    .then(() => { if (g === geracao) situar(recurso, { estado: 'pronto' }) })
    .catch((e) => {
      const d = paraErroDados(e)
      if (d instanceof ErroDados && d.code === 'nao_autenticado') irParaLogin()
      if (g === geracao && atual.situacao[recurso].estado !== 'pronto') situar(recurso, { estado: 'erro', erro: d instanceof ErroDados ? d.message : 'Não foi possível carregar.' })
    })
    .finally(() => { if (emCurso.get(recurso) === p) emCurso.delete(recurso) })
  emCurso.set(recurso, p)
  return p
}

const recarregar = (...recursos: Recurso[]) => { for (const r of recursos) if (atual.situacao[r].estado !== 'ocioso') void carregarUm(r, true) }

function limpar() {
  geracao++
  emCurso.clear()
  definir(() => vazio())
}

// ---------- mídias ----------

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
function dimensoes(blob: Blob, tipo: string): Promise<{ width?: number; height?: number; duration?: number }> {
  if (tipo !== 'image' && tipo !== 'gif' && tipo !== 'svg' && tipo !== 'video') return Promise.resolve({})
  const url = URL.createObjectURL(blob)
  return new Promise<{ width?: number; height?: number; duration?: number }>((resolve) => {
    const fim = (d: { width?: number; height?: number; duration?: number }) => { URL.revokeObjectURL(url); resolve(d) }
    if (tipo === 'video') {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => fim({ width: v.videoWidth || undefined, height: v.videoHeight || undefined, duration: Number.isFinite(v.duration) && v.duration > 0 ? v.duration : undefined })
      v.onerror = () => fim({})
      v.src = url
    } else {
      const img = new Image()
      img.onload = () => fim({ width: img.naturalWidth || undefined, height: img.naturalHeight || undefined })
      img.onerror = () => fim({})
      img.src = url
    }
  }).then((d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v != null).map(([k, v]) => [k, k === 'duration' ? v : Math.round(v as number)])))
}

// ---------- a fonte ----------

export const fonteReal: FonteDados = {
  modo: 'real',
  capacidades: { creditosFicticios: false, compraSimulada: false, dadosDeExemplo: false, editarEmail: false },
  assinar(f) {
    ouvintes.add(f)
    return () => { ouvintes.delete(f) }
  },
  estado: () => atual,
  async carregar(recursos, opcoes = {}) {
    await Promise.all(recursos.map((r) => carregarUm(r, !!opcoes.forcar)))
  },
  async iniciarSessao() {
    const antes = atual.usuario.id
    const c = await chamar(() => api.conta.obter())
    if (antes && antes !== c.usuario.id) limpar()
    definir((e) => ({ ...e, usuario: c.usuario, workspace: c.workspace, creditos: c.creditos, uso: c.uso, situacao: { ...e.situacao, conta: { estado: 'pronto' } } }))
  },
  async sair() {
    await sairDaSessao()
    limpar()
  },

  // ---------- projetos ----------
  async criarProjeto(entrada) {
    const nome = entrada.nome.trim() || 'Sem título'
    const r = await chamar(() => api.projetos.criar({ name: nome.slice(0, 120), mode: entrada.modo, ...(entrada.formato && entrada.formato !== 'quadrado' ? { format: entrada.formato } : {}) }))
    // o servidor cria uma tela padrão; gravamos o documento da UI (em branco, template, IA ou arquivos) por cima
    const documento = entrada.documento ?? documentoInicial(entrada.modo, entrada.formato)
    let revisao = r.currentRevision
    let atualizadoEm = r.updatedAt
    const descricao = entrada.descricao?.trim() ?? ''
    let projeto: Projeto = { ...deResumo(r), descricao, cliente: entrada.cliente?.trim() || undefined, documento, documentoParcial: false, totalTelas: documento.scenes.length }
    definir((e) => ({ ...e, projetos: [projeto, ...e.projetos] }))
    const salvo = await chamar(() => api.projetos.salvarCenas(r.id, documento, revisao))
    revisao = salvo.revision
    atualizadoEm = salvo.savedAt
    if (descricao) {
      const m = await chamar(() => api.projetos.atualizar(r.id, { baseRevision: revisao, description: descricao.slice(0, 2000) }))
      atualizadoEm = m.updatedAt
    }
    projeto = { ...projeto, revisaoAtual: revisao, atualizadoEm }
    trocarProjeto(r.id, () => projeto)
    recarregar('conta')
    return projeto
  },
  async duplicarProjeto(id) {
    const orig = await fonteReal.abrirProjeto(id)
    if (!orig) throw new ErroDados('nao_encontrado', 'Projeto não encontrado')
    return fonteReal.criarProjeto({ nome: `${orig.nome} (cópia)`.slice(0, 120), modo: orig.modo, descricao: orig.descricao, documento: structuredClone(orig.documento) })
  },
  async atualizarProjeto(id, mudancas) {
    const enviar = (base: number) =>
      api.projetos.atualizar(id, {
        baseRevision: base,
        ...(mudancas.nome !== undefined ? { name: mudancas.nome.trim().slice(0, 120) } : {}),
        ...(mudancas.descricao !== undefined ? { description: mudancas.descricao.slice(0, 2000) } : {}),
        ...(mudancas.coverAssetId !== undefined ? { coverAssetId: mudancas.coverAssetId } : {}),
        // a API aceita draft|archived; "draft" num projeto publicado volta a "published" no servidor
        ...(mudancas.status !== undefined ? { status: mudancas.status === 'archived' ? 'archived' : 'draft' } : {}),
      })
    let base = atual.projetos.find((p) => p.id === id)?.revisaoAtual
    if (base == null) base = (await fonteReal.abrirProjeto(id))?.revisaoAtual
    if (base == null) throw new ErroDados('nao_encontrado', 'Projeto não encontrado')
    let r: ProjetoResumo
    try {
      r = await chamar(() => enviar(base!))
    } catch (e) {
      // metadados não disputam com o conteúdo: o editor pode ter salvo (revisão nova); confere e tenta uma vez
      if (!(e instanceof ErroDados && e.code === 'conflito_revisao')) throw e
      const fresco = await fonteReal.abrirProjeto(id, { forcar: true })
      if (!fresco) throw new ErroDados('nao_encontrado', 'Projeto não encontrado')
      r = await chamar(() => enviar(fresco.revisaoAtual))
    }
    let novo: Projeto | undefined
    trocarProjeto(id, (p) => (novo = { ...p, nome: r.name, slug: r.slug, status: r.status, ...(mudancas.descricao !== undefined ? { descricao: mudancas.descricao } : {}), ...(mudancas.coverAssetId !== undefined ? { coverAssetId: mudancas.coverAssetId } : {}), atualizadoEm: r.updatedAt }))
    if (mudancas.status !== undefined) recarregar('conta')
    if (!novo) throw new ErroDados('nao_encontrado', 'Projeto não encontrado')
    return novo
  },
  async excluirProjeto(id) {
    await chamar(() => api.projetos.excluir(id))
    const agora = agoraIso()
    definir((e) => ({ ...e, projetos: e.projetos.map((p) => (p.id === id ? { ...p, excluidoEm: agora } : p)), links: e.links.map((l) => (l.projectId === id && !l.revogadoEm ? { ...l, revogadoEm: agora } : l)) }))
    recarregar('conta')
  },
  async restaurarProjeto(id) {
    await chamar(() => api.projetos.restaurar(id))
    trocarProjeto(id, (p) => ({ ...p, excluidoEm: null }))
    recarregar('conta', 'projetos')
  },
  async excluirDefinitivo(id) {
    await chamar(() => api.projetos.excluirDefinitivo(id))
    definir((e) => ({ ...e, projetos: e.projetos.filter((p) => p.id !== id), links: e.links.filter((l) => l.projectId !== id) }))
  },
  async abrirProjeto(id, opcoes = {}) {
    const cache = atual.projetos.find((p) => p.id === id)
    if (!opcoes.forcar && cache && !cache.documentoParcial && !cache.excluidoEm) return cache
    let d
    try {
      d = await chamar(() => api.projetos.obter(id))
    } catch (e) {
      if (e instanceof ErroDados && e.code === 'nao_encontrado') return null
      throw e
    }
    const documento = documentoSeguro({ schemaVersion: SCHEMA_VERSION, mode: d.mode, scenes: d.scenes })
    const projeto: Projeto = { ...deResumo(d, cache), descricao: d.description, documento, documentoParcial: false, totalTelas: documento.scenes.length, cliente: cache?.cliente }
    definir((e) => ({ ...e, projetos: e.projetos.some((p) => p.id === id) ? e.projetos.map((p) => (p.id === id ? projeto : p)) : [projeto, ...e.projetos] }))
    return projeto
  },
  async salvarDocumento(id, documento, baseRevision) {
    const r = await chamar(() => api.projetos.salvarCenas(id, documento, baseRevision))
    trocarProjeto(id, (p) => ({ ...p, documento, documentoParcial: false, totalTelas: documento.scenes.length, revisaoAtual: r.revision, atualizadoEm: r.savedAt }))
    return { revision: r.revision, savedAt: r.savedAt }
  },
  async publicar(id, baseRevision) {
    try {
      const r = await chamar(() => api.projetos.publicar(id, baseRevision))
      trocarProjeto(id, (p) => ({ ...p, revisaoPublicada: r.publishedRevision, status: 'published', atualizadoEm: r.publishedAt }))
      return r
    } catch (e) {
      // revisão velha no cache (salvo em outra aba): atualiza para o próximo clique funcionar
      if (e instanceof ErroDados && e.code === 'conflito_revisao') void fonteReal.abrirProjeto(id, { forcar: true }).catch(() => {})
      throw e
    }
  },

  // ---------- mídias ----------
  async enviarArquivo(arquivo, aoProgredir, opcoes = {}) {
    aoProgredir({ fase: 'validating', progresso: 0 })
    const falhar = (mensagem: string, code: 'entrada_invalida' | 'limite_do_plano' = 'entrada_invalida'): never => {
      aoProgredir({ fase: 'failed', progresso: 0, mensagem })
      throw new ErroDados(code, mensagem)
    }
    const inicio = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer())
    const texto = precisaTexto(arquivo.name, arquivo.type) ? await arquivo.text() : undefined
    const cl = classificar(arquivo.name, arquivo.type, inicio, texto)
    if (cl.tipo === 'nao_suportado') falhar(cl.dica ?? 'Formato não suportado')
    if (!(MIMES_ACEITOS as readonly string[]).includes(cl.mime)) falhar(`${arquivo.name}: este formato ainda não é aceito no envio. Use PNG, JPG, WebP, GIF, SVG, MP4/WebM, GLB/glTF ou Lottie (JSON).`)
    const d = podeEnviarArquivo({ planoId: atual.workspace.planoId, estado: atual.workspace.estadoAssinatura }, atual.uso, arquivo.size)
    if (!d.ok && atual.situacao.conta.estado === 'pronto') falhar(d.motivo, 'limite_do_plano')
    // o tipo vai no Content-Type: usa o MIME reconhecido (o navegador não conhece .glb, por exemplo); o servidor confere os bytes
    const corpo = arquivo.type === cl.mime ? arquivo : new File([arquivo], arquivo.name, { type: cl.mime })
    const dims = cl.tipo === 'lottie' && texto ? lottieDims(texto) : await dimensoes(corpo, cl.tipo)
    aoProgredir({ fase: 'uploading', progresso: 0 })
    let bruto: Asset
    try {
      bruto = await chamar(() => api.assets.enviar(opcoes.projetoId ?? null, corpo, (p) => aoProgredir({ fase: p >= 100 ? 'processing' : 'uploading', progresso: p }), dims))
    } catch (e) {
      aoProgredir({ fase: 'failed', progresso: 0, mensagem: e instanceof ErroDados ? e.message : 'Falha no envio' })
      throw e
    }
    aoProgredir({ fase: 'processing', progresso: 100 })
    const asset: AssetDemo = { ...deAsset(bruto), erro: cl.dica }
    definir((e) => ({ ...e, assets: [asset, ...e.assets.filter((a) => a.id !== asset.id)], uso: { ...e.uso, armazenamentoBytes: e.uso.armazenamentoBytes + asset.bytes } }))
    await espera(0)
    aoProgredir({ fase: 'ready', progresso: 100, asset })
    return asset
  },
  async excluirAsset(id, forcar = false) {
    await chamar(() => api.assets.excluir(id, forcar))
    definir((e) => ({ ...e, assets: e.assets.filter((a) => a.id !== id) }))
    recarregar('conta')
  },
  projetosQueUsam(id) {
    // só sabemos com o documento inteiro de todos os projetos; a listagem traz só a capa
    const vivos = atual.projetos.filter((p) => !p.excluidoEm)
    if (vivos.some((p) => p.documentoParcial)) return null
    return vivos.filter((p) => JSON.stringify(p.documento).includes(`"${id}"`))
  },

  // ---------- links ----------
  async criarLink(projetoId, opcoes) {
    const r = await chamar(() => api.links.criar(projetoId, { ...(opcoes.senha ? { password: opcoes.senha } : {}), expiresAt: opcoes.expiraEm ?? null }))
    const link = deLink(r)
    definir((e) => ({ ...e, links: [link, ...e.links] }))
    return { link, token: r.token }
  },
  async revogarLink(id) {
    await chamar(() => api.links.revogar(id))
    const agora = agoraIso()
    definir((e) => ({ ...e, links: e.links.map((l) => (l.id === id && !l.revogadoEm ? { ...l, revogadoEm: agora } : l)) }))
  },
  async resolverToken(token) {
    const r = await chamar(() => api.share.resolver(token))
    if (r.state === 'unavailable') return r
    if (r.state === 'locked') return { state: 'locked', projectName: r.projectName }
    return { state: 'ready', projectName: r.projectName, documento: documentoSeguro(r.document), assets: r.assets, marca: r.brand }
  },
  async desbloquear(token, senha) {
    try {
      await chamar(() => api.share.desbloquear(token, senha))
      return { ok: true }
    } catch (e) {
      if (e instanceof ErroDados && e.code === 'sem_permissao') {
        const det = (e.details ?? {}) as { restantes?: number; bloqueado?: boolean }
        return { ok: false, restantes: det.restantes ?? 0, bloqueado: !!det.bloqueado }
      }
      throw e
    }
  },

  // ---------- IA: a rota confere a sessão e debita o workspace ----------
  ia: {
    roteiro: (pedido, sinal) => chamar(() => api.ia.roteiro(pedido, sinal)),
    texto: (pedido, sinal) => chamar(() => api.ia.texto(pedido, sinal)),
    tela: (pedido, sinal) => chamar(() => api.ia.tela(pedido, sinal)),
  },
  registrarUsoIa: () => recarregar('conta'),

  // ---------- conta ----------
  async comprarPacote() {
    throw new ErroDados('indisponivel', 'A compra de créditos ainda não está disponível nesta versão. Fale com a gente para recarregar o saldo.')
  },
  async trocarPlano() {
    throw new ErroDados('indisponivel', 'A troca de plano ainda não está disponível nesta versão. Fale com a gente para mudar de plano.')
  },
  async atualizarPerfil({ nome }) {
    const n = nome?.trim()
    if (!n) return
    try {
      const auth = await carregarAuth()
      const { error } = await auth.updateUser({ name: n.slice(0, 80) })
      if (error) throw new ErroDados('erro_interno', 'Não foi possível salvar o perfil. Tente de novo.')
    } catch (e) {
      throw paraErroDados(e)
    }
    definir((e) => ({ ...e, usuario: { ...e.usuario, nome: n.slice(0, 80) } }))
  },
  reiniciarExemplo() {},
}

function lottieDims(texto: string): { width?: number; height?: number } {
  try {
    const j = JSON.parse(texto) as { w?: number; h?: number }
    return { ...(j.w ? { width: Math.round(j.w) } : {}), ...(j.h ? { height: Math.round(j.h) } : {}) }
  } catch {
    return {}
  }
}
