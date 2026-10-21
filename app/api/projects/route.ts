import { CriarProjetoReq, ListarProjetosQuery } from '@/lib/api/contratos'
import { auditar, autenticar, lerJson, lerQuery, responder, rota, ErroHttp, urlsAssinadas } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { gerarSlug, resumo, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { podeCriarProjeto } from '@/lib/planos'
import { FORMATOS } from '@/lib/scene/schema'

export const dynamic = 'force-dynamic'

/** GET /api/projects — lista só projetos do workspace; busca e paginação por offset. */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const q = lerQuery(req, ListarProjetosQuery)
  const offset = Number(q.cursor ?? 0) || 0
  let consulta = ctx.sb.from('projects').select('*', { count: 'exact' }).eq('workspace_id', ctx.workspaceId).is('deleted_at', null).order('updated_at', { ascending: false }).range(offset, offset + q.limit - 1)
  if (q.status !== 'all') consulta = consulta.eq('status', q.status)
  else consulta = consulta.neq('status', 'archived')
  if (q.q) consulta = consulta.ilike('name', `%${q.q.replace(/[%_]/g, '')}%`)
  const { data, count, error } = await consulta
  if (error) throw error
  const projetos = (data ?? []) as LinhaProjeto[]
  const ids = projetos.map((p) => p.id)
  const [{ data: cenas }, { data: links }, { data: capas }] = await Promise.all([
    ids.length ? ctx.sb.from('project_scenes').select('project_id').in('project_id', ids) : Promise.resolve({ data: [] as { project_id: string }[] }),
    ids.length ? ctx.sb.from('share_links').select('project_id, expires_at, revoked_at').in('project_id', ids).is('revoked_at', null) : Promise.resolve({ data: [] as { project_id: string; expires_at: string | null; revoked_at: string | null }[] }),
    ctx.sb.from('assets').select('id, storage_key, metadata_json').in('id', projetos.map((p) => p.cover_asset_id).filter((x): x is string => !!x)),
  ])
  const urls = await urlsAssinadas(ctx.sb, (capas ?? []) as { id: string; storage_key: string; metadata_json: { thumb_key?: string } }[])
  const agora = Date.now()
  const lista = projetos.map((p) =>
    resumo(p, {
      sceneCount: (cenas ?? []).filter((c) => c.project_id === p.id).length,
      activeLinks: (links ?? []).filter((l) => l.project_id === p.id && (!l.expires_at || new Date(l.expires_at).getTime() > agora)).length,
      coverUrl: p.cover_asset_id ? urls[p.cover_asset_id]?.thumbUrl ?? urls[p.cover_asset_id]?.url ?? null : null,
    })
  )
  const proximo = count != null && offset + q.limit < count ? String(offset + q.limit) : null
  return responder({ items: lista, nextCursor: proximo, total: count ?? lista.length }, requestId)
})

/** POST /api/projects — cria projeto no workspace respeitando o limite do plano. */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const entrada = await lerJson(req, CriarProjetoReq)
  const { plano, uso } = await planoEUso(ctx)
  const decisao = podeCriarProjeto(plano, uso)
  if (!decisao.ok) throw new ErroHttp('limite_do_plano', decisao.motivo, { upgradePara: decisao.upgradePara })

  const size = FORMATOS[entrada.format ?? (entrada.mode === 'story' ? 'story' : 'slides169')]
  const base = gerarSlug(entrada.name)
  let projeto: LinhaProjeto | null = null
  for (let tentativa = 0; tentativa < 5 && !projeto; tentativa++) {
    const slug = tentativa ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base
    const { data, error } = await ctx.sb.from('projects').insert({ workspace_id: ctx.workspaceId, name: entrada.name, slug, mode: entrada.mode }).select('*').single()
    if (error && error.code !== '23505') throw error
    if (data) projeto = data as LinhaProjeto
  }
  if (!projeto) throw new Error('Não foi possível gerar um slug único')

  const cena = { id: 'scene-01', title: 'Capa', size, background: '#101820', backgroundFit: 'cover', layers: [] }
  const { error: erroCena } = await ctx.sb.from('project_scenes').insert({ project_id: projeto.id, scene_key: cena.id, order_index: 0, title: cena.title, width: size.width, height: size.height, background: cena.background, content_json: cena })
  if (erroCena) throw erroCena
  await auditar(ctx, 'project.created', projeto.id, { mode: entrada.mode })
  return responder(resumo(projeto, { sceneCount: 1, activeLinks: 0, coverUrl: null }), requestId, 201)
})
