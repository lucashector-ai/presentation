import { EnviarMidiaReq } from '@/lib/api/contratos'
import { autenticar, limitar, projetoDoWorkspace, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { paraAsset, type LinhaAsset } from '@/lib/api/midiaServidor'
import { podeEnviarArquivo } from '@/lib/planos'
import { detectarMime, ehMimeTexto, extensaoPorMime, MAX_BYTES_TEXTO, tipoMidia } from '@/lib/midia/mime'
import { ErroCorpo, lerTudo, separarCabeca, validarTexto } from '@/lib/midia/upload'
import { armazenamento, chaveOriginal } from '@/lib/armazenamento'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** glTF e Lottie não passam pelo sanitizador de SVG. */
const SEM_PURIFICADOR = { sanitize: () => { throw new Error('purificador só para SVG') } }

/**
 * POST /api/assets/upload?projectId=&name=[&width=&height=&duration=] — corpo = o arquivo; Content-Type = MIME.
 * Valida sessão, projeto do workspace, cota/tamanho do plano (antes de ler o corpo), MIME REAL (bytes mágicos)
 * e, nos formatos de texto, o conteúdo inteiro (SVG é sanitizado e só a versão limpa é gravada). Grava no
 * armazenamento privado em {workspace}/{asset}/original.ext e devolve o Asset pronto.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  limitar(`upload:${ctx.userId}`, 120, 10 * 60_000)
  const url = new URL(req.url)
  const mime = (req.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  const declarado = req.headers.get('content-length')
  if (!declarado) throw new ErroHttp('entrada_invalida', 'Envie o tamanho do arquivo (Content-Length).')
  const r = EnviarMidiaReq.safeParse({ ...Object.fromEntries(url.searchParams.entries()), mime, bytes: Number(declarado) })
  if (!r.success) throw new ErroHttp('entrada_invalida', 'Arquivo inválido', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
  const entrada = r.data
  await projetoDoWorkspace(ctx, entrada.projectId)
  const { plano, uso } = await planoEUso(ctx)
  const d = podeEnviarArquivo(plano, uso, entrada.bytes)
  if (!d.ok) throw new ErroHttp(d.motivo.includes('Arquivo acima') ? 'arquivo_grande' : 'limite_do_plano', d.motivo, { upgradePara: d.upgradePara })
  if (!req.body) throw new ErroHttp('entrada_invalida', 'Arquivo vazio')

  const id = crypto.randomUUID()
  const chave = chaveOriginal(ctx.workspaceId, id, extensaoPorMime(entrada.mime))
  const db = sql()
  // registro primeiro (status processing): a cota já conta este arquivo enquanto ele é gravado
  await db`insert into public.assets (id, workspace_id, storage_key, media_type, mime, bytes, status, name, created_by)
           values (${id}, ${ctx.workspaceId}, ${chave}, ${tipoMidia(entrada.mime)}, ${entrada.mime}, ${entrada.bytes}, 'processing', ${entrada.name}, ${ctx.userId})`
  const arm = armazenamento()
  const marcarFalha = async (motivo: string) => {
    await db`update public.assets set status = 'failed', metadata_json = ${JSON.stringify({ erro: motivo })}::jsonb where id = ${id}`
    await arm.remover(chave).catch(() => {})
  }

  let bytesFinais = entrada.bytes
  try {
    if (ehMimeTexto(entrada.mime)) {
      const bytes = await lerTudo(req.body, Math.min(entrada.bytes, MAX_BYTES_TEXTO))
      if (bytes.byteLength !== entrada.bytes) throw new ErroCorpo('Tamanho do arquivo não corresponde ao declarado')
      // o sanitizador (DOMPurify + jsdom) é pesado: só carrega quando chega um SVG
      const purificador = entrada.mime === 'image/svg+xml' ? (await import('isomorphic-dompurify')).default : SEM_PURIFICADOR
      const v = validarTexto(entrada.mime, new TextDecoder().decode(bytes), purificador)
      if (!v.ok) throw new ErroCorpo(v.motivo)
      const conteudo = new TextEncoder().encode(v.conteudo)
      bytesFinais = conteudo.byteLength
      await arm.guardar(chave, conteudo, { tipo: entrada.mime })
    } else {
      const { cabeca, corpo } = await separarCabeca(req.body, 32, entrada.bytes)
      const real = detectarMime(cabeca)
      if (!real || real !== entrada.mime) {
        await corpo.cancel().catch(() => {})
        throw new ErroCorpo('O conteúdo do arquivo não corresponde ao formato declarado')
      }
      await arm.guardar(chave, corpo, { tipo: entrada.mime, tamanho: entrada.bytes })
    }
  } catch (e) {
    const motivo = e instanceof ErroCorpo ? e.message : 'Falha ao gravar o arquivo'
    await marcarFalha(motivo).catch(() => {})
    if (e instanceof ErroCorpo) throw new ErroHttp('entrada_invalida', motivo)
    throw e
  }

  const [linha] = await db`
    update public.assets set status = 'ready', bytes = ${bytesFinais}, width = ${entrada.width ?? null}, height = ${entrada.height ?? null}, duration = ${entrada.duration ?? null}
    where id = ${id} and workspace_id = ${ctx.workspaceId}
    returning *`
  return responder(paraAsset(linha as LinhaAsset), requestId, 201)
})
