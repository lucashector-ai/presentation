import { llmsTxt } from '@/components/marketing/llms'

/** GET /llms.txt — resumo do produto para assistentes de IA (padrão llmstxt.org). Texto gerado dos mesmos dados da landing. */
export function GET() {
  return new Response(llmsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
