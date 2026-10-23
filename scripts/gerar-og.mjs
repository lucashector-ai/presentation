#!/usr/bin/env node
/**
 * Gera public/og.png (1200×630), a imagem de compartilhamento (Open Graph e Twitter) de todas as páginas públicas:
 * o wordmark da Mostra (o "m" de components/ui/Logo.tsx + "ostra" em Geist), a proposta de valor e as formas da
 * marca sobre o fundo claro do app. A Geist vem do mesmo pacote @fontsource que o site usa.
 *
 *   node scripts/gerar-og.mjs
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { GlobalFonts, Path2D, createCanvas } from '@napi-rs/canvas'

const require = createRequire(import.meta.url)
GlobalFonts.registerFromPath(require.resolve('@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'), 'Geist')

const L = 1200, A = 630
const GRAFITE = '#171717', FUNDO = '#FAFAF9', VIOLETA = '#5965F2', CORAL = '#E4572E', LIMA = '#D7F25C', IPE = '#F2C14E', MARE = '#1F3B4D'

const canvas = createCanvas(L, A)
const ctx = canvas.getContext('2d')
ctx.fillStyle = FUNDO
ctx.fillRect(0, 0, L, A)

// moldura de 2 px como os cartões da landing
ctx.strokeStyle = GRAFITE
ctx.lineWidth = 4
ctx.strokeRect(2, 2, L - 4, A - 4)

// ---------- formas da marca (direita) ----------
const forma = (cor, desenhar) => { ctx.fillStyle = cor; ctx.beginPath(); desenhar(); ctx.closePath(); ctx.fill(); ctx.stroke() }
ctx.lineWidth = 3
forma(CORAL, () => ctx.arc(905, 215, 110, 0, Math.PI * 2))
ctx.save(); ctx.translate(1060, 150); ctx.rotate((16 * Math.PI) / 180); forma(VIOLETA, () => ctx.rect(-55, -55, 110, 110)); ctx.restore()
ctx.save(); ctx.translate(1015, 395); ctx.rotate((-10 * Math.PI) / 180); ctx.lineWidth = 0; ctx.strokeStyle = 'transparent'; forma(LIMA, () => { ctx.moveTo(0, -95); ctx.lineTo(95, 70); ctx.lineTo(-95, 70) }); ctx.restore()
ctx.strokeStyle = GRAFITE; ctx.lineWidth = 3
forma(IPE, () => ctx.arc(905, 600, 95, Math.PI, 0)) // semicírculo apoiado na borda inferior
forma(MARE, () => ctx.rect(1070, 470, 90, 90))
// pontos
ctx.fillStyle = GRAFITE
for (let x = 770; x < 860; x += 14) for (let y = 345; y < 415; y += 14) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill() }

// ---------- wordmark ----------
// o "m" é o traço de Logo.tsx (viewBox -4 0 160 100, stroke 22.5) escalado para a altura da caixa-x do "ostra"
const TAMANHO = 112
const xMarca = 72, yBase = 190
const escala = (TAMANHO * 0.53) / 100
ctx.save()
ctx.translate(xMarca, yBase - TAMANHO * 0.53)
ctx.scale(escala, escala)
ctx.translate(4, 0) // o viewBox começa em x = -4
ctx.beginPath()
ctx.rect(-30, -40, 220, 140)
ctx.clip()
ctx.strokeStyle = GRAFITE
ctx.lineWidth = 22.5
ctx.lineJoin = 'miter'
ctx.miterLimit = 10
ctx.stroke(new Path2D('M4 112 L42 -6 C50 16 93 40 93 66 C93 81 84 89 72 89 C60 89 51 81 51 66 C51 40 74 11 104 11 C129 11 141 26 141 44 V112'))
ctx.restore()
ctx.fillStyle = GRAFITE
ctx.font = `600 ${TAMANHO}px Geist`
ctx.letterSpacing = `${-0.04 * TAMANHO}px`
ctx.fillText('ostra', xMarca + TAMANHO * 0.848 + 2, yBase)

// ---------- proposta de valor ----------
ctx.letterSpacing = '-3px'
ctx.font = '600 64px Geist'
ctx.fillText('Apresentações com', 72, 318)
ctx.fillText('para quem cria.', 72, 388)
// destaque violeta na palavra "IA", como o "PDF." do hero (caixa levemente inclinada)
const xIA = 72 + ctx.measureText('Apresentações com').width + 30
const largIA = ctx.measureText('IA').width
ctx.fillStyle = VIOLETA
ctx.save(); ctx.translate(xIA + largIA / 2, 318 - 22); ctx.rotate((-2 * Math.PI) / 180); ctx.fillRect(-largIA / 2 - 10, -34, largIA + 20, 72); ctx.restore()
ctx.fillStyle = FUNDO
ctx.fillText('IA', xIA, 318)

ctx.fillStyle = '#3F3F3F'
ctx.letterSpacing = '0px'
ctx.font = '400 26px Geist'
ctx.fillText('Editor de nível profissional, animações, Figma e links privados.', 72, 440)

// rodapé: domínio + selo
ctx.fillStyle = GRAFITE
ctx.font = '500 24px Geist'
ctx.fillText('mostra.page', 72, 548)
ctx.font = '500 16px Geist'
ctx.letterSpacing = '1px'
ctx.fillStyle = '#737373'
ctx.fillText('FEITO NO BRASIL · GRÁTIS PARA COMEÇAR', 232, 547)

writeFileSync(new URL('../public/og.png', import.meta.url), canvas.toBuffer('image/png'))
console.log(`public/og.png (${L}×${A})`)
