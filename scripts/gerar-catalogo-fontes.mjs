#!/usr/bin/env node
/**
 * Gera lib/fontes/catalogo-google.json — o catálogo do Google Fonts que o app usa (seletor de fonte, kit de marca,
 * mapeamento do colar do Figma/SVG e o proxy de fontes do Worker).
 *
 * Fonte dos metadados: o pacote npm `google-font-metadata` (Fontsource), numa versão FIXA — o mesmo comando gera
 * sempre o mesmo arquivo. Ele traz a resposta da API pública do Google Fonts (família, categoria, variantes,
 * subconjuntos) e os eixos das fontes variáveis. Sem chave de API, nem aqui nem no cliente.
 *
 *   node scripts/gerar-catalogo-fontes.mjs            # usa a versão fixada abaixo
 *   VERSAO=6.0.9 node scripts/gerar-catalogo-fontes.mjs
 *
 * Só entram famílias com o subconjunto `latin` (cobre o português: á, ã, ç, é, õ…). Formato (compacto, ~120 KB, ~30 KB com gzip):
 *   { versao, origem, subconjuntos: [...], familias: [[nome, categoria, pesos, pesosItalico, [índices em subconjuntos]], ...] }
 *   categoria: 0 sem serifa, 1 serifa, 2 display, 3 manuscrita, 4 mono
 *   pesos: "100..900" (variável, faixa contínua) ou "300,400,700" (estática); "" = sem itálico
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const VERSAO = process.env.VERSAO || '6.0.8'
const DESTINO = new URL('../lib/fontes/catalogo-google.json', import.meta.url).pathname
const CATEGORIAS = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace']

const pasta = mkdtempSync(join(tmpdir(), 'catalogo-fontes-'))
try {
  execFileSync('npm', ['pack', `google-font-metadata@${VERSAO}`, '--silent', '--pack-destination', pasta], { stdio: ['ignore', 'pipe', 'inherit'] })
  const tgz = `google-font-metadata-${VERSAO}.tgz`
  execFileSync('tar', ['xzf', join(pasta, tgz), '-C', pasta, 'package/data/api-response.json', 'package/data/variable.json'])
  const api = JSON.parse(readFileSync(join(pasta, 'package/data/api-response.json'), 'utf8'))
  const variaveis = JSON.parse(readFileSync(join(pasta, 'package/data/variable.json'), 'utf8'))
  const eixoPeso = new Map(Object.values(variaveis).filter((v) => v.axes?.wght).map((v) => [v.family, v.axes.wght]))

  const comLatin = api.filter((f) => f.subsets.includes('latin'))
  const subconjuntos = [...new Set(comLatin.flatMap((f) => f.subsets))].sort((a, b) => (a === 'latin' ? -1 : b === 'latin' ? 1 : a === 'latin-ext' ? -1 : b === 'latin-ext' ? 1 : a.localeCompare(b)))

  const familias = comLatin
    .map((f) => {
      const cat = CATEGORIAS.indexOf(f.category)
      if (cat < 0) throw new Error(`categoria desconhecida: ${f.category} (${f.family})`)
      const normais = []
      const italicos = []
      for (const v of f.variants) {
        const m = /^(\d{3})?(regular|italic)?$/.exec(v)
        if (!m) continue
        const peso = Number(m[1] ?? 400)
        if (v === 'italic' || v.endsWith('italic')) italicos.push(peso)
        else normais.push(peso)
      }
      const eixo = eixoPeso.get(f.family)
      const faixa = eixo ? `${Number(eixo.min)}..${Number(eixo.max)}` : null
      const pesos = faixa && normais.length ? faixa : [...new Set(normais)].sort((a, b) => a - b).join(',')
      const pesosIt = faixa && italicos.length ? faixa : [...new Set(italicos)].sort((a, b) => a - b).join(',')
      const subs = f.subsets.map((s) => subconjuntos.indexOf(s)).sort((a, b) => a - b)
      return [f.family, cat, pesos, pesosIt, subs]
    })
    // só itálico (raríssimo): o itálico vira o "normal" do seletor
    .map((f) => (f[2] ? f : [f[0], f[1], f[3], f[3], f[4]]))
    .sort((a, b) => a[0].localeCompare(b[0], 'en'))

  const saida = { versao: 1, origem: `google-font-metadata@${VERSAO}`, subconjuntos, familias }
  writeFileSync(DESTINO, `${JSON.stringify(saida).replace(/\],\[/g, '],\n[')}\n`)
  const porCat = CATEGORIAS.map((c, i) => `${c}: ${familias.filter((f) => f[1] === i).length}`).join(', ')
  console.log(`${familias.length} famílias (de ${api.length}; ${api.length - comLatin.length} sem latin ficaram de fora) → ${DESTINO}\n${porCat}`)
} finally {
  rmSync(pasta, { recursive: true, force: true })
}
