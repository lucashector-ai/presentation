import { authConfigurado, encaminharAuth } from '@/lib/auth/servidor'

export const dynamic = 'force-dynamic'

/**
 * /api/auth/* — proxy do Neon Auth (Better Auth gerenciado): sign-up/email, sign-in/email, sign-in/social,
 * sign-out, get-session, forget-password/email-otp, email-otp/reset-password… Handler Request → Response
 * puro, sem APIs internas do Next.
 */
async function tratar(req: Request, { params }: { params: { path?: string[] } }) {
  if (!authConfigurado()) {
    return Response.json({ message: 'Login indisponível neste ambiente (modo demonstração).' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  const caminho = (params.path ?? []).map(encodeURIComponent).join('/')
  return encaminharAuth(req, caminho)
}

export { tratar as GET, tratar as POST, tratar as PUT, tratar as PATCH, tratar as DELETE }
