import { createHash } from 'node:crypto'
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
const TIPOS: Record<string, string> = { wasm: 'application/wasm', js: 'text/javascript', pfb: 'application/octet-stream', ttf: 'font/ttf', gz: 'application/gzip' }

/**
 * OCR no navegador (tesseract.js): worker, núcleo wasm só LSTM (com e sem SIMD) e dados de idioma português e
 * inglês (tessdata_best em inteiros, pacotes @tesseract.js-data), servidos pelo app numa pasta com o hash do
 * conteúdo (cache imutável). O worker fica junto do núcleo: o núcleo acha o `.wasm` pelo endereço do worker.
 */
const pasta = (pacote: string) => dirname(require.resolve(`${pacote}/package.json`))
const RECURSOS_OCR: Record<string, string> = {
  'worker.min.js': join(pasta('tesseract.js'), 'dist/worker.min.js'),
  ...Object.fromEntries(['tesseract-core-simd-lstm', 'tesseract-core-lstm'].flatMap((n) => ['js', 'wasm'].map((ext) => [`${n}.${ext}`, join(pasta('tesseract.js-core'), `${n}.${ext}`)]))),
  ...Object.fromEntries(['por', 'eng'].map((l) => [`${l}.traineddata.gz`, join(pasta(`@tesseract.js-data/${l}`), '4.0.0_best_int', `${l}.traineddata.gz`)])),
}
const hashOcr = createHash('sha256')
for (const [nome, arquivo] of Object.entries(RECURSOS_OCR)) hashOcr.update(nome).update(readFileSync(arquivo))
const PREFIXO_OCR = `/_next/static/ocr/${hashOcr.digest('hex').slice(0, 12)}/`

/** Arquivos estáticos tirados de node_modules: caminho público → arquivo. */
const ESTATICOS = new Map<string, string>([
  ...RECURSOS_PDFJS.map((rel) => [`${PREFIXO_PDFJS}${rel}`, join(PDFJS, rel)] as const),
  ...Object.entries(RECURSOS_OCR).map(([nome, arquivo]) => [`${PREFIXO_OCR}${nome}`, arquivo] as const),
])

/**
 * pdf.js e tesseract.js só no navegador: no RSC e no SSR, `lib/pdf/navegador.ts` vira um stub com as mesmas
 * exportações (que lançam erro se chamadas), então o bundle do Worker não leva nenhum dos dois. No cliente, os
 * recursos que eles buscam por URL saem em `/_next/static/pdfjs/<versão>/` e `/_next/static/ocr/<hash>/` (no
 * build, como arquivos estáticos em dist/client; no dev, servidos daqui).
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
        if (!caminho.startsWith(PREFIXO_PDFJS) && !caminho.startsWith(PREFIXO_OCR)) return next()
        const arquivo = ESTATICOS.get(caminho)
        if (!arquivo) { res.statusCode = 404; res.end(); return }
        res.setHeader('content-type', TIPOS[caminho.split('.').pop()!] ?? 'application/octet-stream')
        res.end(readFileSync(arquivo))
      })
    },
    generateBundle() {
      if (this.environment.name !== 'client') return
      for (const [caminho, arquivo] of ESTATICOS) this.emitFile({ type: 'asset', fileName: caminho.slice(1), source: readFileSync(arquivo) })
    },
  }
}

// vinext (API do Next.js sobre o Vite) + plugin do Cloudflare: dev, build e preview rodam o servidor no workerd.
// O RSC é o ambiente principal do Worker; o SSR roda como ambiente filho dele.
export default defineConfig({
  define: { __BASE_OCR__: JSON.stringify(PREFIXO_OCR) },
  plugins: [pdfjsSoNoNavegador(), vinext(), cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } })],
})
