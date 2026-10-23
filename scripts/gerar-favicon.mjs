#!/usr/bin/env node
/**
 * Gera public/apple-touch-icon.png (180×180) a partir de public/favicon.svg — o símbolo da Mostra, em #5965F2,
 * sobre o fundo claro do app (o iOS não aceita transparência no ícone da tela inicial).
 *
 *   node scripts/gerar-favicon.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const TAMANHO = 180
/** fração do lado ocupada pelo quadrado do símbolo (o viewBox já tem folga própria) */
const OCUPACAO = 0.8

const simbolo = await loadImage(readFileSync(new URL('../public/favicon.svg', import.meta.url)))
const canvas = createCanvas(TAMANHO, TAMANHO)
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#FAFAF9'
ctx.fillRect(0, 0, TAMANHO, TAMANHO)
const lado = Math.round(TAMANHO * OCUPACAO)
const canto = Math.round((TAMANHO - lado) / 2)
ctx.drawImage(simbolo, canto, canto, lado, lado)
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), canvas.toBuffer('image/png'))
console.log(`public/apple-touch-icon.png (${TAMANHO}×${TAMANHO})`)
