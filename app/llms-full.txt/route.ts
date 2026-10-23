import { llmsFullTxt } from '@/components/marketing/llms'

/** GET /llms-full.txt — descrição completa (planos, custos, recursos, comparativo e FAQ) para assistentes de IA. */
export function GET() {
  return new Response(llmsFullTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
