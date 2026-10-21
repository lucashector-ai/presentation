import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig, type Plugin } from 'vite'
import vinext from 'vinext'

const require = createRequire(import.meta.url)
const PDFJS = dirname(require.resolve('pdfjs-dist/package.json'))
const VERSAO_PDFJS = (JSON.parse(readFileSync(join(PDFJS, 'package.json'), 'utf8')) as { version: string }).version
/** Arquivos que o pdf.js busca por URL em tempo de execução (wasm de JPEG 2000/JBIG2/cores e fontes padrão). */
const RECURSOS_PDFJS = ['wasm', 'standard_fonts'].flatMap((pasta) => readdirSync(join(PDFJS, pasta)).filter((f) => !f.startsWith('LICENSE') && !/^quickjs/.test(f)).map((f) => `${pasta}/${f}`))
const PREFIXO_PDFJS = `/_next/static/pdfjs/${VERSAO_PDFJS}/`
const TIPOS: Record<string, string> = { wasm: 'application/wasm', js: 'text/javascript', pfb: 'application/octet-stream', ttf: 'font/ttf' }

/**
 * pdf.js só no navegador: no RSC e no SSR, `lib/pdf/navegador.ts` vira um stub com as mesmas exportações (que
 * lançam erro se chamadas), então o bundle do Worker não leva o pdf.js. No cliente, os recursos que ele busca
 * por URL saem em `/_next/static/pdfjs/<versão>/` (no build, como arquivos estáticos; no dev, servidos daqui).
 */
function pdfjsSoNoNavegador(): Plugin {
  return {
    name: 'mostra:pdfjs-so-no-navegador',
    enforce: 'pre',
    load(id) {
      if (this.environment.name === 'client' || !/[\\/]lib[\\/]pdf[\\/]navegador\.ts$/.test(id.split('?')[0]!)) return null
      const fonte = readFileSync(id.split('?')[0]!, 'utf8')
      const nomes = [...fonte.matchAll(/^export (?:async )?(?:function|const|class) (\w+)/gm)].map((m) => m[1]!)
      return `const so = () => { throw new Error('pdf.js só roda no navegador') }\n${nomes.map((n) => `export const ${n} = so`).join('\n')}\n`
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const caminho = (req.url ?? '').split('?')[0]!
        if (!caminho.startsWith(PREFIXO_PDFJS)) return next()
        const rel = caminho.slice(PREFIXO_PDFJS.length)
        if (!RECURSOS_PDFJS.includes(rel)) { res.statusCode = 404; res.end(); return }
        res.setHeader('content-type', TIPOS[rel.split('.').pop()!] ?? 'application/octet-stream')
        res.end(readFileSync(join(PDFJS, rel)))
      })
    },
    generateBundle() {
      if (this.environment.name !== 'client') return
      for (const rel of RECURSOS_PDFJS) this.emitFile({ type: 'asset', fileName: `${PREFIXO_PDFJS.slice(1)}${rel}`, source: readFileSync(join(PDFJS, rel)) })
    },
  }
}

// vinext (API do Next.js sobre o Vite) + plugin do Cloudflare: dev, build e preview rodam o servidor no workerd.
// O RSC é o ambiente principal do Worker; o SSR roda como ambiente filho dele.
export default defineConfig({
  plugins: [pdfjsSoNoNavegador(), vinext(), cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } })],
})
