import { CriarProjetoReq, ListarProjetosQuery } from '@/lib/api/contratos'
import { auditar, autenticar, lerJson, lerQuery, responder, rota, ErroHttp, urlsDeMidia } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { gerarSlug, resumo, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { podeCriarProjeto } from '@/lib/planos'
import { FORMATOS } from '@/lib/scene/schema'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** GET /api/projects — lista só projetos do workspace; busca e paginação por offset. */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const q = lerQuery(req, ListarProjetosQuery)
  const offset = Number(q.cursor ?? 0) || 0
  const busca = q.q ? `%${q.q.replace(/[%_\\]/g, '')}%` : null
  const db = sql()
  const linhas = await db`
    select p.*,
           count(*) over () as total,
           (select count(*) from public.project_scenes s where s.project_id = p.id) as scene_count,
           (select count(*) from public.share_links l where l.project_id = p.id and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())) as active_links,
           a.metadata_json as cover_metadata
    from public.projects p
    left join public.assets a on a.id = p.cover_asset_id and a.workspace_id = p.workspace_id and a.deleted_at is null and a.status = 'ready'
    where p.workspace_id = ${ctx.workspaceId}
      and p.deleted_at is null
      and (case when ${q.status}::text = 'all' then p.status <> 'archived' else p.status::text = ${q.status}::text end)
      and (${busca}::text is null or p.name ilike ${busca}::text)
    order by p.updated_at desc
    limit ${q.limit} offset ${offset}`
  const total = Number(linhas[0]?.total ?? 0)
  const capas = urlsDeMidia(linhas.filter((l) => l.cover_metadata).map((l) => ({ id: l.cover_asset_id as string, metadata_json: l.cover_metadata })), '/api/midias')
  const lista = linhas.map((l) => {
    const p = l as unknown as LinhaProjeto
    const capa = p.cover_asset_id ? capas[p.cover_asset_id] : undefined
    return resumo(p, { sceneCount: Number(l.scene_count), activeLinks: Number(l.active_links), coverUrl: capa ? capa.thumbUrl ?? capa.url : null })
  })
  const proximo = offset + q.limit < total ? String(offset + q.limit) : null
  return responder({ items: lista, nextCursor: proximo, total: linhas.length ? total : 0 }, requestId)
})

/** POST /api/projects — cria projeto no workspace respeitando o limite do plano. */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const entrada = await lerJson(req, CriarProjetoReq)
  const { plano, uso } = await planoEUso(ctx)
  const decisao = podeCriarProjeto(plano, uso)
  if (!decisao.ok) throw new ErroHttp('limite_do_plano', decisao.motivo, { upgradePara: decisao.upgradePara })

  const size = FORMATOS[entrada.format ?? (entrada.mode === 'story' ? 'story' : 'slides169')]
  const cena = { id: 'scene-01', title: 'Capa', size, background: '#101820', backgroundFit: 'cover', layers: [] }
  const base = gerarSlug(entrada.name)
  const db = sql()
  let projeto: LinhaProjeto | null = null
  for (let tentativa = 0; tentativa < 5 && !projeto; tentativa++) {
    const slug = tentativa ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base
    // projeto + primeira cena num só comando (atômico); slug repetido no workspace não insere nada e tenta outro
    const [linha] = await db`
      with novo as (
        insert into public.projects (workspace_id, name, slug, mode) values (${ctx.workspaceId}, ${entrada.name}, ${slug}, ${entrada.mode})
        on conflict (workspace_id, slug) do nothing
        returning *
      ), cena as (
        insert into public.project_scenes (project_id, scene_key, order_index, title, width, height, background, content_json)
        select id, ${cena.id}, 0, ${cena.title}, ${size.width}, ${size.height}, ${cena.background}, ${JSON.stringify(cena)}::jsonb from novo
        returning project_id
      )
      select novo.* from novo`
    projeto = (linha as LinhaProjeto | undefined) ?? null
  }
  if (!projeto) throw new Error('Não foi possível gerar um slug único')
  await auditar(ctx, 'project.created', projeto.id, { mode: entrada.mode })
  return responder(resumo(projeto, { sceneCount: 1, activeLinks: 0, coverUrl: null }), requestId, 201)
})
