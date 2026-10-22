import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'

/**
 * Medição de fluidez das animações (quadros, long tasks, layout e recálculo de estilo) com e sem
 * CPU throttling (CDP Emulation.setCPUThrottlingRate). Usa o modo demonstração: troca os documentos de
 * três projetos de exemplo por apresentações carregadas de efeitos (entradas, texto animado, loops, saídas,
 * morph, Story e Explorar) e mede cada cenário no /apresentar e no editor (prévia da galeria e da linha do tempo).
 *
 * Rodar com o app no ar em modo demo (NEXT_PUBLIC_DEMO=1):
 *   E2E_BASE_URL=http://localhost:8800 node e2e/desempenho.mjs
 * Variáveis: DESEMPENHO_TAXAS=1,4 (throttling), DESEMPENHO_P95=20 (limite em ms do p95 com 4×),
 * DESEMPENHO_CENARIOS=texto,morph (só alguns; os "efeito-*" de diagnóstico só rodam assim),
 * DESEMPENHO_REPETICOES=3 (a tabela mostra a mediana), DESEMPENHO_JSON=arquivo.json (grava os números).
 * Diagnóstico: DESEMPENHO_PERFIL=1 (funções JS mais caras), DESEMPENHO_RASTRO=1 (animações fora da GPU e o que há
 * dentro das tarefas longas), DESEMPENHO_CAMADAS=1 (camadas compostas no fim de cada cenário).
 * Sai com código 1 se algum cenário principal passar do limite com 4× (mediana do p95).
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
const TAXAS = (process.env.DESEMPENHO_TAXAS || '1,4').split(',').map(Number)
const LIMITE_P95 = Number(process.env.DESEMPENHO_P95 || 20)
const SO = process.env.DESEMPENHO_CENARIOS ? new Set(process.env.DESEMPENHO_CENARIOS.split(',')) : null
const JSON_SAIDA = process.env.DESEMPENHO_JSON
const REPETICOES = Math.max(1, Number(process.env.DESEMPENHO_REPETICOES || 3))

// ---------- documentos de teste (montados no navegador a partir de camadas reais do demo) ----------

/** Roda no navegador: recebe camadas-modelo já completas (todos os defaults do schema) e devolve os documentos. */
function montarDocumentos({ texto, forma, svg }) {
  const EFEITOS_TEXTO = ['letters', 'words', 'lines', 'cascade', 'typewriter', 'scramble', 'counter', 'highlight', 'words-semblur', 'letters-curto']
  const limpo = (m) => { const c = { ...m, interactions: [] }; delete c.enterAnimation; delete c.exitAnimation; delete c.loopAnimation; delete c.name; delete c.hidden; return c }
  const T = (o) => ({ ...limpo(texto), background: undefined, radius: 0, align: 'left', valign: 'top', transform: 'none', letterSpacing: 0, fontFamily: 'Geist', fontWeight: 500, lineHeight: 1.15, ...o })
  const F = (o) => ({ ...limpo(forma), pattern: undefined, radius: 24, ...o })
  const S = (o) => ({ ...limpo(svg), ...o })
  const a = (type, duration = 700, delay = 0, extra = {}) => ({ type, duration, delay, easing: 'easeOut', ...extra })
  const loop = (type, duration = 2400) => ({ type, duration, intensity: 1 })
  const tam = { width: 1920, height: 1080 }
  const vert = { width: 1080, height: 1920 }
  const lorem = 'A identidade nasce do forno: argila crua, terracota queimada e o carvão que fica depois do fogo. Cada peça passa por mil e duzentos graus e sai diferente.'
  const lorem2 = 'Menos força, mais precisão. Movimento curto e elegante, ritmo com boa cadência, hierarquia clara: título, depois subtítulo, depois imagem e os detalhes por último. Máscara é mais sofisticada do que simplesmente aparecer.'
  const cartoes = ['scaleIn', 'zoomIn', 'reveal', 'mask', 'iris', 'flip', 'pop', 'elastic', 'bounce', 'slideBlur', 'spinIn', 'unfold']
  const cores = ['#B4532A', '#5965F2', '#22A06B', '#F2C14E', '#E4572E', '#2B1D16']
  const slides = {
    schemaVersion: 2, mode: 'slides', theme: { palette: 'argila', fontTitle: 'Geist', fontBody: 'Geist' },
    scenes: [
      { id: 'p-inicio', title: 'Início', size: tam, background: '#EEE7DB', layers: [T({ id: 'i1', text: 'Desempenho', x: 120, y: 400, width: 1600, height: 220, fontSize: 180, color: '#2B1D16' })] },
      {
        id: 'p-entradas', title: 'Entradas', size: tam, background: '#F4F1EC', transition: { type: 'fade', duration: 500, easing: 'easeInOut' },
        layers: [
          T({ id: 'e-t', name: 'Título entradas', text: 'Entradas', x: 120, y: 80, width: 1200, height: 180, fontSize: 160, color: '#2B1D16', enterAnimation: a('slideUp', 800, 0, { easing: 'spring' }) }),
          T({ id: 'e-s', text: 'Desfocar, escala, revelar, 3D e ênfase.', x: 120, y: 270, width: 1500, height: 90, fontSize: 64, color: '#5B4335', enterAnimation: a('blurIn', 900, 100) }),
          ...cartoes.map((tipo, i) => F({ id: `e-c${i}`, x: 120 + (i % 6) * 290, y: 420 + Math.floor(i / 6) * 320, width: 250, height: 280, fill: cores[i % cores.length], effects: { blur: 0, backdropBlur: 0, blend: 'normal', shadow: { x: 0, y: 24, blur: 60, spread: -12, color: '#00000059' } }, enterAnimation: a(tipo, 800, 150 + i * 80) })),
        ],
      },
      // texto: oito efeitos de texto na mesma tela, com textos do tamanho de um slide de verdade
      {
        id: 'p-texto', title: 'Texto', size: tam, background: '#171717', transition: { type: 'slide', duration: 500, easing: 'easeInOut' },
        layers: [
          T({ id: 't-cascata', name: 'Título cascata', text: 'Texto animado', x: 100, y: 40, width: 1100, height: 150, fontSize: 130, color: '#FAFAF9', enterAnimation: a('cascade', 1200, 0) }),
          T({ id: 't-letras', name: 'Subtítulo letras', text: 'Forma que nasce do fogo e do tempo.', x: 100, y: 220, width: 850, height: 120, fontSize: 52, fontWeight: 400, lineHeight: 1.2, color: '#E7E5E1', enterAnimation: a('letters', 1200, 100) }),
          T({ id: 't-palavras', name: 'Parágrafo palavras', text: 'Menos força, mais precisão. Movimento curto e elegante, ritmo com boa cadência e hierarquia clara: título, depois subtítulo, depois imagem.', x: 1000, y: 220, width: 820, height: 300, fontSize: 38, fontWeight: 400, lineHeight: 1.3, color: '#E7E5E1', enterAnimation: a('words', 1400, 200) }),
          T({ id: 't-linhas', name: 'Linhas', text: 'Linha por linha\ncom máscara\nque sobe de trás\nda própria borda', x: 100, y: 520, width: 850, height: 300, fontSize: 56, color: '#D7F25C', enterAnimation: a('lines', 1000, 300) }),
          T({ id: 't-maquina', name: 'Máquina', text: 'Máquina de escrever: cada letra aparece no tempo certo, com cursor piscando no fim da frase.', x: 1000, y: 560, width: 820, height: 150, fontSize: 34, fontWeight: 400, color: '#A3A3A3', enterAnimation: a('typewriter', 2000, 300) }),
          T({ id: 't-decod', name: 'Decodificar', text: 'DECODIFICANDO SINAL 2026', x: 1000, y: 740, width: 820, height: 60, fontSize: 40, fontFamily: 'Geist Mono', color: '#5965F2', enterAnimation: a('scramble', 1400, 300) }),
          T({ id: 't-contador', name: 'Contador', text: 'R$ 2,4 mi', x: 100, y: 860, width: 600, height: 160, fontSize: 130, color: '#FAFAF9', enterAnimation: a('counter', 1600, 300) }),
          T({ id: 't-destaque', name: 'Destaque', text: 'Cada conteúdo pede um efeito próprio.', x: 1000, y: 860, width: 820, height: 70, fontSize: 44, color: '#FAFAF9', enterAnimation: a('highlight', 900, 600) }),
        ],
      },
      {
        id: 'p-loops', title: 'Loops', size: tam, background: '#EEEFFD', transition: { type: 'scale', duration: 500, easing: 'easeInOut' },
        layers: [
          ...['float', 'pulse', 'glow', 'spin', 'drift', 'wiggle', 'shake'].map((l, i) => F({ id: `l-${l}`, shape: i % 2 ? 'ellipse' : 'rect', x: 120 + i * 250, y: 380, width: 200, height: 200, fill: cores[i % cores.length], enterAnimation: a('fadeIn', 500, i * 60), loopAnimation: loop(l, 1800 + i * 200), exitAnimation: a(['fadeOut', 'blurOut', 'slideOutUp', 'maskOut', 'wipeOut', 'irisOut', 'flipOut'][i], 500, 0, { easing: 'easeIn' }) })),
          T({ id: 'l-t', text: 'Loops e saídas', x: 120, y: 120, width: 1400, height: 160, fontSize: 130, color: '#171717', loopAnimation: loop('float', 3000), exitAnimation: a('zoomAway', 600, 0, { easing: 'easeIn' }) }),
          S({ id: 'l-svg', x: 1500, y: 700, width: 220, height: 220, loopAnimation: loop('spin', 6000), exitAnimation: a('scaleOut', 500, 0, { easing: 'easeIn' }) }),
        ],
      },
      {
        id: 'p-morph-a', title: 'Morph A', size: tam, background: '#2B1D16', transition: { type: 'fade', duration: 500, easing: 'easeInOut' },
        layers: [
          T({ id: 'ma-t', name: 'titulo', text: 'Morph', x: 120, y: 330, width: 1100, height: 420, fontSize: 380, letterSpacing: -20, lineHeight: 1, color: '#EEE7DB', enterAnimation: a('fadeIn', 500) }),
          F({ id: 'ma-f', name: 'foto', x: 1310, y: 150, width: 490, height: 790, fill: '#B4532A', radius: 8, enterAnimation: a('fadeIn', 500, 100) }),
          F({ id: 'ma-c', name: 'circulo', shape: 'ellipse', x: 120, y: 820, width: 140, height: 140, fill: '#F2C14E', radius: 0 }),
          T({ id: 'ma-r', name: 'rotulo', text: 'Forma, fogo e tempo.', x: 120, y: 790, width: 900, height: 70, fontSize: 52, fontWeight: 400, color: '#A88B76' }),
        ],
      },
      {
        id: 'p-morph-b', title: 'Morph B', size: tam, background: '#EEE7DB', transition: { type: 'morph', duration: 800, easing: 'easeInOut' },
        layers: [
          T({ id: 'mb-t', name: 'titulo', text: 'Morph', x: 120, y: 160, width: 600, height: 170, fontSize: 160, letterSpacing: -8, lineHeight: 1, color: '#2B1D16' }),
          F({ id: 'mb-f', name: 'foto', x: 120, y: 420, width: 640, height: 520, fill: '#5965F2', radius: 40 }),
          F({ id: 'mb-c', name: 'circulo', shape: 'ellipse', x: 1500, y: 160, width: 300, height: 300, fill: '#E4572E', radius: 0 }),
          T({ id: 'mb-r', name: 'rotulo', text: 'Forma, fogo e tempo.', x: 900, y: 600, width: 900, height: 120, fontSize: 96, fontWeight: 500, color: '#2B1D16' }),
          T({ id: 'mb-n', text: 'Camada nova entra depois', x: 900, y: 760, width: 900, height: 60, fontSize: 40, color: '#5B4335', enterAnimation: a('words', 800) }),
        ],
      },
      // texto pesado (diagnóstico): a mesma tela com dois parágrafos longos (150 letras por letra, 39 palavras)
      {
        id: 'p-texto-pesado', title: 'Texto pesado', size: tam, background: '#171717', transition: { type: 'slide', duration: 500, easing: 'easeInOut' },
        layers: [
          T({ id: 'tp-cascata', name: 'Título cascata', text: 'Texto animado', x: 100, y: 40, width: 1100, height: 150, fontSize: 130, color: '#FAFAF9', enterAnimation: a('cascade', 1200, 0) }),
          T({ id: 'tp-letras', name: 'Parágrafo letras', text: lorem, x: 100, y: 220, width: 850, height: 260, fontSize: 40, fontWeight: 400, lineHeight: 1.3, color: '#E7E5E1', enterAnimation: a('letters', 1400, 100) }),
          T({ id: 'tp-palavras', name: 'Parágrafo palavras', text: lorem2, x: 1000, y: 220, width: 820, height: 300, fontSize: 38, fontWeight: 400, lineHeight: 1.3, color: '#E7E5E1', enterAnimation: a('words', 1400, 200) }),
          T({ id: 'tp-linhas', name: 'Linhas', text: 'Linha por linha\ncom máscara\nque sobe de trás\nda própria borda', x: 100, y: 520, width: 850, height: 300, fontSize: 56, color: '#D7F25C', enterAnimation: a('lines', 1000, 300) }),
          T({ id: 'tp-maquina', name: 'Máquina', text: 'Máquina de escrever: cada letra aparece no tempo certo, com cursor piscando no fim da frase.', x: 1000, y: 560, width: 820, height: 150, fontSize: 34, fontWeight: 400, color: '#A3A3A3', enterAnimation: a('typewriter', 2000, 300) }),
          T({ id: 'tp-decod', name: 'Decodificar', text: 'DECODIFICANDO SINAL 2026', x: 1000, y: 740, width: 820, height: 60, fontSize: 40, fontFamily: 'Geist Mono', color: '#5965F2', enterAnimation: a('scramble', 1400, 300) }),
          T({ id: 'tp-contador', name: 'Contador', text: 'R$ 2,4 mi', x: 100, y: 860, width: 600, height: 160, fontSize: 130, color: '#FAFAF9', enterAnimation: a('counter', 1600, 300) }),
          T({ id: 'tp-destaque', name: 'Destaque', text: 'Cada conteúdo pede um efeito próprio.', x: 1000, y: 860, width: 820, height: 70, fontSize: 44, color: '#FAFAF9', enterAnimation: a('highlight', 900, 600) }),
        ],
      },
      // diagnóstico: um efeito de texto por tela, com um parágrafo longo (cenários "efeito-*")
      ...EFEITOS_TEXTO.map((nome) => [nome, nome.split('-')[0]]).map(([nome, tipo]) => ({
        id: `p-ef-${nome}`, title: nome, size: tam, background: '#171717', transition: { type: 'fade', duration: 300, easing: 'easeInOut' },
        layers: [T({ id: `ef-${nome}`, text: tipo === 'counter' ? 'R$ 2,4 mi' : nome === 'letters-curto' ? 'Forma que nasce do fogo e do tempo.' : `${lorem} ${lorem2}`, x: 100, y: 100, width: 1700, height: 880, fontSize: tipo === 'counter' ? 200 : 44, fontWeight: 400, lineHeight: 1.3, color: '#E7E5E1', enterAnimation: a(tipo, tipo === 'typewriter' ? 2400 : 1400, 0, nome === 'words-semblur' ? { blur: 0 } : {}) })],
      })),
      // efeitos interativos: parallax (mouse e transição "empurrar"), tilt 3D, luz e lanterna, contador com círculo
      {
        id: 'p-interativo', title: 'Interativo', size: tam, background: '#10131F', transition: { type: 'push', duration: 700, easing: 'easeInOut' },
        layers: [
          F({ id: 'pi-fundo', x: -40, y: -40, width: 2000, height: 1160, fill: '#1B2140', radius: 0, interactiveEffects: { parallax: { depth: -40 } } }),
          F({ id: 'pi-orbe', shape: 'ellipse', x: 1420, y: 90, width: 380, height: 380, fill: '#5965F2', radius: 0, interactiveEffects: { parallax: { depth: 80 } } }),
          T({ id: 'pi-t', name: 'Título interativo', text: 'Profundidade', x: 120, y: 110, width: 1150, height: 170, fontSize: 150, color: '#F4F1EC', interactiveEffects: { parallax: { depth: 45 } }, enterAnimation: a('words', 900) }),
          T({ id: 'pi-n', name: 'Contador com círculo', text: '72%', x: 1440, y: 110, width: 340, height: 340, fontSize: 96, align: 'center', valign: 'middle', color: '#F4F1EC', interactiveEffects: { parallax: { depth: 60 } }, enterAnimation: a('counter', 1400, 200, { progress: 'circle' }) }),
          ...[0, 1, 2].map((i) => F({ id: `pi-c${i}`, x: 120 + i * 580, y: 500, width: 520, height: 440, fill: cores[i], interactiveEffects: { tilt: { angle: 10 }, spotlight: { mode: i === 1 ? 'dark' : 'light' }, parallax: { depth: 15 } }, enterAnimation: a('slideUp', 700, 200 + i * 90) })),
        ],
      },
    ],
  }
  const secao = (id, fundo, camadas) => ({ id, title: id, size: vert, background: fundo, layers: camadas })
  const story = {
    schemaVersion: 2, mode: 'story',
    scenes: [
      secao('s-1', '#1F3B4D', [
        T({ id: 's1-t', text: 'Maré', x: 80, y: 1200, width: 920, height: 300, fontSize: 280, letterSpacing: -14, color: '#F2E9D8', enterAnimation: a('lines', 900) }),
        T({ id: 's1-p', text: lorem, x: 80, y: 1540, width: 920, height: 260, fontSize: 44, fontWeight: 400, lineHeight: 1.3, color: '#F2E9D8', enterAnimation: a('words', 1200, 200) }),
        F({ id: 's1-f', shape: 'ellipse', x: 560, y: 260, width: 400, height: 400, fill: '#E4572E', enterAnimation: a('scaleIn', 900, 0, { easing: 'spring' }), loopAnimation: loop('float', 3000), interactiveEffects: { parallax: { depth: 70 } } }),
      ]),
      secao('s-2', '#F2E9D8', [
        T({ id: 's2-t', text: 'Três estampas, uma estação.', x: 100, y: 200, width: 880, height: 220, fontSize: 84, color: '#1F3B4D', enterAnimation: a('letters', 1200) }),
        // entradas que acompanham a rolagem (scroll-driven) e profundidades diferentes
        ...[0, 1, 2].map((i) => F({ id: `s2-c${i}`, x: 100 + i * 300, y: 600, width: 260, height: 700, fill: cores[i], enterAnimation: a(['reveal', 'mask', 'zoomIn'][i], 900, 150 + i * 120, { trigger: 'scroll' }), exitAnimation: a('fadeOut', 400, 0, { easing: 'easeIn' }), interactiveEffects: { parallax: { depth: [-30, 20, 60][i] } } })),
        T({ id: 's2-p', text: lorem2, x: 100, y: 1400, width: 880, height: 400, fontSize: 44, fontWeight: 400, lineHeight: 1.3, color: '#1F3B4D', enterAnimation: a('words', 1200, 300) }),
      ]),
      secao('s-3', '#E4572E', [
        T({ id: 's3-n', text: '+38%', x: 100, y: 600, width: 880, height: 300, fontSize: 260, color: '#FFF4EC', enterAnimation: a('counter', 1400, 0, { progress: 'bar' }) }),
        T({ id: 's3-t', text: 'Lançamento 21.12', x: 100, y: 1000, width: 880, height: 140, fontSize: 96, color: '#FFF4EC', enterAnimation: a('cascade', 1200, 200), interactiveEffects: { parallax: { depth: 35 } } }),
        T({ id: 's3-p', text: lorem, x: 100, y: 1250, width: 880, height: 300, fontSize: 44, fontWeight: 400, lineHeight: 1.3, color: '#FFF4EC', enterAnimation: a('blurIn', 900, 300) }),
      ]),
      secao('s-4', '#171717', [
        T({ id: 's4-t', text: 'Obrigado.', x: 100, y: 800, width: 880, height: 200, fontSize: 160, color: '#FAFAF9', enterAnimation: a('slideUp', 800), loopAnimation: { ...loop('float', 3000), until: 'offscreen' } }),
        T({ id: 's4-p', text: lorem2, x: 100, y: 1100, width: 880, height: 400, fontSize: 40, fontWeight: 400, lineHeight: 1.3, color: '#A3A3A3', enterAnimation: a('letters', 1400, 200) }),
      ]),
    ],
  }
  const explorar = {
    schemaVersion: 2, mode: 'explorar',
    scenes: [
      { id: 'x-1', title: 'Linha 4', size: tam, background: '#E9E9EB', map: { x: 0, y: 0 }, layers: [T({ id: 'x1-t', text: 'Linha 4', x: 120, y: 360, width: 1600, height: 300, fontSize: 260, color: '#171717', enterAnimation: a('slideUp', 800) }), F({ id: 'x1-f', shape: 'ellipse', x: 1400, y: 160, width: 400, height: 400, fill: '#5965F2', loopAnimation: loop('pulse', 2400) })] },
      { id: 'x-2', title: 'História', size: tam, background: '#171717', map: { x: 2400, y: -600 }, layers: [T({ id: 'x2-t', text: 'História', x: 100, y: 300, width: 1500, height: 260, fontSize: 220, color: '#FAFAF9', enterAnimation: a('blurIn', 900), interactiveEffects: { parallax: { depth: 60 } } }), T({ id: 'x2-p', text: lorem2, x: 100, y: 620, width: 1500, height: 300, fontSize: 48, fontWeight: 400, lineHeight: 1.3, color: '#A3A3A3', enterAnimation: a('words', 1200, 200), interactiveEffects: { parallax: { depth: 20 } } })], exitAnimationDummy: undefined },
      { id: 'x-3', title: 'Números', size: tam, background: '#5965F2', map: { x: 2400, y: 900 }, layers: [T({ id: 'x3-t', text: '+38% passageiros', x: 100, y: 400, width: 1700, height: 260, fontSize: 200, color: '#FFFFFF', enterAnimation: a('letters', 1200) })] },
      { id: 'x-4', title: 'Mapa', size: tam, background: '#F4F1EC', map: { x: 0, y: 1500 }, layers: [T({ id: 'x4-t', text: 'Mapa da rede', x: 100, y: 400, width: 1700, height: 260, fontSize: 200, color: '#171717', enterAnimation: a('lines', 1000) })] },
    ],
  }
  return { slides, story, explorar }
}

/** Efeitos de texto medidos um a um (telas de diagnóstico depois do morph; mesma lista de montarDocumentos). */
const EFEITOS_TEXTO = ['letters', 'words', 'lines', 'cascade', 'typewriter', 'scramble', 'counter', 'highlight', 'words-semblur', 'letters-curto']

// ---------- medição no navegador ----------

/** Instala o gravador (rAF + long tasks) e começa a gravar. */
const iniciarGravacao = () => {
  const m = { quadros: [], longas: [], ativo: true }
  window.__med = m
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (m.ativo) m.longas.push(e.duration) }).observe({ type: 'longtask', buffered: false }) } catch { /* sem suporte */ }
  let ultimo
  const quadro = (t) => { if (!m.ativo) return; if (ultimo !== undefined) m.quadros.push(t - ultimo); ultimo = t; requestAnimationFrame(quadro) }
  requestAnimationFrame(quadro)
}
const pararGravacao = () => {
  const m = window.__med
  m.ativo = false
  return { quadros: m.quadros, longas: m.longas, animacoes: document.getAnimations().length, partes: document.querySelectorAll('[data-seg]').length, nos: document.getElementsByTagName('*').length }
}

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] }
const r1 = (n) => Math.round(n * 10) / 10

async function metricas(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
}

/** Diagnóstico (DESEMPENHO_PERFIL=1): funções JS com mais tempo próprio durante a medição. */
function resumoPerfil(perfil, n = 12) {
  const porNo = new Map(perfil.nodes.map((x) => [x.id, x]))
  const tempo = new Map()
  const dt = perfil.timeDeltas
  perfil.samples.forEach((id, i) => {
    const no = porNo.get(id)
    const f = no.callFrame
    const chave = `${f.functionName || "(anônima)"} ${f.url.split("/").pop()}:${f.lineNumber}:${f.columnNumber}`
    tempo.set(chave, (tempo.get(chave) ?? 0) + (dt[i] ?? 0) / 1000)
  })
  return [...tempo.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${Math.round(v)} ms  ${k}`)
}

/** Diagnóstico: camadas compostas agora (cada uma pesa no Layerize/Commit de todo quadro que repinta). */
async function capturarCamadas(page, cdp) {
    // camadas compostas no fim da medição (cada uma pesa no Layerize/Commit de todo quadro que repinta)
    const camadas = await new Promise((ok) => {
      const h = (e) => { if (e.layers) { cdp.off('LayerTree.layerTreeDidChange', h); ok(e.layers) } }
      cdp.on('LayerTree.layerTreeDidChange', h)
      // um toque no estilo garante um quadro novo (a árvore só chega quando muda)
      void cdp.send('LayerTree.enable').then(() => page.evaluate(() => { document.body.style.outlineColor = document.body.style.outlineColor ? '' : 'transparent' }))
      setTimeout(() => ok([]), 3000)
    })
    await cdp.send('LayerTree.disable')
    const motivos = new Map()
    for (const l of camadas.slice(0, 400)) {
      try { const { compositingReasonIds } = await cdp.send("LayerTree.compositingReasons", { layerId: l.layerId }); for (const m of compositingReasonIds) motivos.set(m, (motivos.get(m) ?? 0) + 1) } catch (e) { motivos.set("erro " + e.message.slice(0, 40), (motivos.get("erro " + e.message.slice(0, 40)) ?? 0) + 1) }
    }
    console.log(`    camadas compostas: ${camadas.length}`, Object.fromEntries([...motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)))
    const desenham = camadas.filter((l) => l.drawsContent)
    const area = desenham.reduce((t, l) => t + l.width * l.height, 0)
    console.log(`    desenham conteúdo: ${desenham.length} · área somada: ${(area / (1440 * 900)).toFixed(2)} telas · maiores:`, desenham.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 8).map((l) => `${Math.round(l.width)}x${Math.round(l.height)}`).join(' '))
    if (process.env.DESEMPENHO_CAMADAS === '2') {
      const amostra = camadas.filter((l) => l.backendNodeId).slice(-12)
      for (const l of amostra) {
        const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId }).catch(() => null)
        console.log(`      ${l.width}x${l.height} desenha=${l.drawsContent} pinturas=${l.paintCount} ${d?.node?.nodeName} ${JSON.stringify(d?.node?.attributes ?? []).slice(0, 160)}`)
      }
      console.log('      sem nó:', camadas.filter((l) => !l.backendNodeId).length)
    }
}

async function medir(page, cdp, acao, ms) {
  const perfil = !!process.env.DESEMPENHO_PERFIL
  if (perfil) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start') }
  const rastro = !!process.env.DESEMPENHO_RASTRO
  let eventos = []
  if (rastro) {
    cdp.on('Tracing.dataCollected', (e) => { eventos.push(...e.value) })
    await cdp.send('Tracing.start', { categories: `blink.animations,devtools.timeline,disabled-by-default-devtools.timeline${process.env.DESEMPENHO_RASTRO === '6' ? ',toplevel,viz,cc,gpu,__metadata' : process.env.DESEMPENHO_RASTRO === '7' ? ',blink,cc,disabled-by-default-blink.debug,disabled-by-default-cc.debug' : ''}`, transferMode: 'ReportEvents' })
  }
  await page.evaluate(iniciarGravacao)
  const m0 = await metricas(cdp)
  await acao()
  // DESEMPENHO_CAMADAS_EM=ms: fotografa as camadas compostas no meio da animação (perturba a medição)
  const meio = Number(process.env.DESEMPENHO_CAMADAS_EM || 0)
  if (meio) { await page.waitForTimeout(meio); await capturarCamadas(page, cdp) }
  await page.waitForTimeout(Math.max(0, ms - meio))
  const m1 = await metricas(cdp)
  const r = await page.evaluate(pararGravacao)
  if (process.env.DESEMPENHO_CAMADAS && !process.env.DESEMPENHO_CAMADAS_EM) await capturarCamadas(page, cdp)
  if (perfil) { const { profile } = await cdp.send('Profiler.stop'); console.log(resumoPerfil(profile).map((l) => `    ${l}`).join('\n')) }
  if (rastro) {
    const fim = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
    await cdp.send('Tracing.end'); await fim
    const anim = eventos.filter((e) => e.name === 'Animation')
    const falhas = new Map()
    for (const e of anim) { const d = e.args?.data; if (d && d.compositeFailed !== undefined) { const k = `${d.compositeFailed} ${JSON.stringify(d.unsupportedProperties ?? [])}`; falhas.set(k, (falhas.get(k) ?? 0) + 1) } }
    console.log('    animações não compostas (motivo: quantidade):', Object.fromEntries(falhas))
    if (process.env.DESEMPENHO_RASTRO === '2') {
      const nomes = new Map(anim.filter((e) => e.ph === 'b').map((e) => [e.id2?.local ?? e.id, e.args?.data]))
      const exemplos = new Map()
      for (const e of anim) { const d = e.args?.data; if (d?.compositeFailed) { const k = `${d.compositeFailed}|${nomes.get(e.id2?.local ?? e.id)?.name}`; exemplos.set(k, (exemplos.get(k) ?? 0) + 1) } }
      console.log('    por keyframe:', Object.fromEntries(exemplos))
      if (process.env.DESEMPENHO_AMOSTRA) for (const e of anim.filter((x) => x.args?.data?.compositeFailed).slice(0, 4)) console.log('     ', e.ph, JSON.stringify(e.args).slice(0, 300), JSON.stringify(nomes.get(e.id2?.local ?? e.id) ?? {}).slice(0, 200))
    }
    const porNome = new Map()
    const contagem = new Map()
    for (const e of eventos) if (e.ph === 'X' && e.dur) { porNome.set(e.name, (porNome.get(e.name) ?? 0) + e.dur / 1000); contagem.set(e.name, (contagem.get(e.name) ?? 0) + 1) }
    if (process.env.DESEMPENHO_RASTRO === '3') {
      // recálculos de estilo: quantos elementos por vez (o que recalcula a cada quadro)
      const ult = eventos.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X')
      const contagens = ult.map((e) => e.args?.elementCount ?? e.args?.endData?.elementCount ?? '?')
      console.log('    elementos por recálculo:', contagens.slice(0, 120).join(' '))
    }
    if (process.env.DESEMPENHO_RASTRO === '7') {
      // por que o compositor de pintura refaz a composição (args dos eventos Layerize / PaintArtifactCompositor)
      const motivos = new Map()
      for (const e of eventos) if (/Layerize|PaintArtifactCompositor|SetNeedsUpdate/.test(e.name)) { const k = `${e.name} ${JSON.stringify(e.args ?? {}).slice(0, 120)}`; motivos.set(k, (motivos.get(k) ?? 0) + 1) }
      console.log('    composição:', [...motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${v}× ${k}`).join('\n      '))
    }
    if (process.env.DESEMPENHO_RASTRO === '6') {
      // quadros lentos: tempo ocupado de cada thread (de todos os processos) no intervalo
      const nomes = new Map(eventos.filter((e) => e.name === 'thread_name').map((e) => [`${e.pid}:${e.tid}`, e.args?.name]))
      const tid = eventos.find((e) => e.name === 'FireAnimationFrame')?.tid
      const raf = eventos.filter((e) => e.name === 'FireAnimationFrame' && e.tid === tid).map((e) => e.ts).sort((a, b) => a - b)
      // uma tarefa de cada nível só (ThreadControllerImpl::RunTask envolve a RunTask do devtools)
      const tarefas = eventos.filter((e) => e.ph === 'X' && (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'ThreadPool_RunTask'))
      const lentos = []
      for (let i = 1; i < raf.length; i++) if (raf[i] - raf[i - 1] > 20000) lentos.push([raf[i - 1], raf[i]])
      const ocupado = (a, b) => {
        const m = new Map()
        for (const e of tarefas) { const ini = Math.max(a, e.ts); const fim = Math.min(b, e.ts + (e.dur ?? 0)); if (fim > ini) { const k = nomes.get(`${e.pid}:${e.tid}`) ?? `${e.pid}:${e.tid}`; m.set(k, (m.get(k) ?? 0) + (fim - ini) / 1000) } }
        return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')
      }
      const doViz = eventos.filter((e) => e.ph === 'X' && nomes.get(`${e.pid}:${e.tid}`) === 'VizCompositorThread' && !/RunTask/.test(e.name))
      for (const [a, b] of lentos.slice(0, 8)) {
        console.log(`     quadro ${Math.round((b - a) / 1000)} ms:`, ocupado(a, b))
        const m = new Map()
        const n = new Map()
        for (const e of doViz) if (e.ts >= a && e.ts < b) { m.set(e.name, (m.get(e.name) ?? 0) + e.dur / 1000); n.set(e.name, (n.get(e.name) ?? 0) + 1) }
        console.log('       viz:', [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(1)} (${n.get(k)}×)`).join(' · '))
        if (process.env.DESEMPENHO_QUADS) for (const e of doViz) if (e.ts >= a && e.ts < b && e.name === 'SoftwareRenderer::DoDrawQuad' && e.dur > 500) console.log('         quad', (e.dur / 1000).toFixed(1), JSON.stringify(e.args ?? {}).slice(0, 200))
      }
      const cont = (nome) => doViz.filter((e) => e.name === nome).length
      console.log(`     viz no total: ${cont('DirectRenderer::DrawFrame')} quadros desenhados · ${cont('DirectRenderer::DrawRenderPass')} passes · ${cont('SoftwareRenderer::DoDrawQuad')} quads · ${(doViz.filter((e) => e.name === 'SoftwareRenderer::DoDrawQuad').reduce((t, e) => t + e.dur, 0) / 1000).toFixed(0)} ms em quads`)
      if (raf.length > 2) console.log('     média por quadro:', ocupado(raf[0], raf[raf.length - 1]).replace(/(\d+\.\d)/g, (x) => (Number(x) / (raf.length - 1)).toFixed(2)))
    }
    if (process.env.DESEMPENHO_RASTRO === '5') {
      // quadros lentos: o que a thread principal fez entre um requestAnimationFrame e o seguinte
      const tid = eventos.find((e) => e.name === 'FireAnimationFrame')?.tid
      const raf = eventos.filter((e) => e.name === 'FireAnimationFrame' && e.tid === tid).map((e) => e.ts).sort((a, b) => a - b)
      const tipos = ['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'FunctionCall', 'EventDispatch', 'TimerFire', 'FireAnimationFrame', 'HitTest', 'MinorGC', 'MajorGC', 'RunMicrotasks', 'IntersectionObserverController::computeIntersections', 'UpdateLayer', 'RunTask']
      const todos = process.env.DESEMPENHO_TODOS
      const principais = eventos.filter((e) => e.tid === tid && e.ph === 'X' && (todos ? e.name !== 'RunTask' && e.name !== 'ThreadControllerImpl::RunTask' : tipos.includes(e.name)))
      const lentos = []
      for (let i = 1; i < raf.length; i++) if (raf[i] - raf[i - 1] > 20000) lentos.push([raf[i - 1], raf[i]])
      for (const [a, b] of lentos.slice(0, 10)) {
        const soma = new Map()
        for (const e of principais) if (e.ts >= a && e.ts < b) soma.set(e.name, (soma.get(e.name) ?? 0) + e.dur / 1000)
        console.log(`     quadro ${Math.round((b - a) / 1000)} ms:`, [...soma.entries()].sort((x, y) => y[1] - x[1]).slice(0, 9).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · '))
      }
    }
    if (process.env.DESEMPENHO_RASTRO === '4') {
      // o que é pintado (nó de cada evento Paint)
      const pintados = new Map()
      for (const e of eventos) if (e.name === 'Paint' && e.ph === 'X') { const d = e.args?.data ?? {}; const k = `${d.nodeName ?? '?'}#${d.nodeId ?? '?'} ${JSON.stringify(d.clip ?? []).slice(0, 60)}`; pintados.set(k, (pintados.get(k) ?? 0) + e.dur / 1000) }
      console.log('    pinturas:', [...pintados.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${Math.round(v)}ms`).join('\n      '))
    }
    console.log('    ', [...porNome.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${Math.round(v)}ms (${contagem.get(k)}×)`).join(' · '))
    // tarefas longas da thread principal: o que há dentro de cada uma
    const principal = eventos.find((e) => e.name === 'FireAnimationFrame')?.tid
    const longas = eventos.filter((e) => e.name === 'RunTask' && e.tid === principal && e.dur > 50000)
    for (const t of longas.slice(0, 6)) {
      const dentro = new Map()
      for (const e of eventos) if (e.tid === principal && e.ph === 'X' && e !== t && e.ts >= t.ts && e.ts + (e.dur ?? 0) <= t.ts + t.dur && ['FunctionCall', 'EventDispatch', 'UpdateLayoutTree', 'Layout', 'Paint', 'Layerize', 'PrePaint', 'Commit', 'TimerFire', 'FireAnimationFrame', 'ParseHTML', 'MinorGC', 'MajorGC', 'v8.execute'].includes(e.name)) dentro.set(e.name, (dentro.get(e.name) ?? 0) + e.dur / 1000)
      console.log(`     tarefa ${Math.round(t.dur / 1000)} ms:`, [...dentro.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · '))
    }
    eventos = []
  }
  if (process.env.DESEMPENHO_QUADROS) {
    // diagnóstico: em que momento (ms desde a ação) caem os quadros lentos
    let t = 0
    console.log('    quadros lentos (ms desde o início: duração):', r.quadros.map((q) => { t += q; return [Math.round(t - q), Math.round(q)] }).filter(([, q]) => q > 20).map(([a, q]) => `${a}:${q}`).join(' '))
  }
  const d = (k) => (m1[k] ?? 0) - (m0[k] ?? 0)
  return {
    quadros: r.quadros.length,
    p50: r1(pct(r.quadros, 50)),
    p95: r1(pct(r.quadros, 95)),
    max: r1(Math.max(0, ...r.quadros)),
    acima20: r.quadros.filter((q) => q > 20).length,
    longas: r.longas.length,
    longasMs: Math.round(r.longas.reduce((s, x) => s + x, 0)),
    layouts: d('LayoutCount'),
    layoutMs: Math.round(d('LayoutDuration') * 1000),
    estilos: d('RecalcStyleCount'),
    estiloMs: Math.round(d('RecalcStyleDuration') * 1000),
    scriptMs: Math.round(d('ScriptDuration') * 1000),
    animacoes: r.animacoes,
    partes: r.partes,
    nos: r.nos,
  }
}

// ---------- cenários ----------

const viewerPronto = async (page) => {
  await page.locator('[role=status][aria-hidden=true]').first().waitFor({ state: 'attached', timeout: 20000 })
  await page.waitForTimeout(900)
}
/** Abre o /apresentar (na tela `inicio`) e, se começar no meio, espera as entradas dela terminarem. */
const abrirApresentar = async (page, projeto, inicio = 0) => { await page.goto(`${BASE}/app/projects/${projeto}/apresentar${inicio ? `?inicio=${inicio}` : ''}`); await viewerPronto(page); if (inicio) await page.waitForTimeout(2600) }
const avancar = (page, n = 1) => async () => { for (let i = 0; i < n; i++) await page.keyboard.press('ArrowRight') }
/** Passa o mouse pelos pontos (px da janela), em `ms` no total, com movimentos contínuos (vários pointermove por trecho). */
const moverMouse = async (page, pontos, ms) => {
  const passos = Math.max(1, Math.round(ms / 40 / pontos.length))
  let [x0, y0] = pontos[0]
  for (const [x, y] of pontos) {
    for (let i = 1; i <= passos; i++) {
      const t0 = Date.now()
      await page.mouse.move(x0 + ((x - x0) * i) / passos, y0 + ((y - y0) * i) / passos)
      await page.waitForTimeout(Math.max(0, 40 - (Date.now() - t0)))
    }
    ;[x0, y0] = [x, y]
  }
}

const CENARIOS = [
  { id: 'entradas', nome: 'Entradas (14 camadas: blur, escala, revelar, 3D, ênfase)', principal: true, ms: 2400,
    preparar: (p) => abrirApresentar(p, 'pr-atlas'), acao: (p) => avancar(p) },
  { id: 'texto', nome: 'Texto animado (letra, palavra, linha, máquina, decodificar, contador, destaque)', principal: true, ms: 3200,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 1) }, acao: (p) => avancar(p) },
  { id: 'texto-pesado', nome: 'Texto pesado (a tela de texto com dois parágrafos longos)', principal: false, ms: 3200,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 5) }, acao: (p) => avancar(p) },
  { id: 'loops', nome: 'Loops contínuos (8 camadas)', principal: true, ms: 2000,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 3) }, acao: () => async () => {} },
  { id: 'saidas', nome: 'Saídas + fade da tela seguinte', principal: true, ms: 2000,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 3) }, acao: (p) => avancar(p) },
  { id: 'morph', nome: 'Transição morph (4 pares + 1 nova)', principal: true, ms: 1800,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 4) }, acao: (p) => avancar(p) },
  ...EFEITOS_TEXTO.map((tipo, i) => ({ id: `efeito-${tipo}`, nome: `Texto: só ${tipo} (parágrafo longo)`, principal: false, ms: tipo === 'typewriter' ? 2800 : 1800,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 6 + i) }, acao: (p) => avancar(p) })),
  { id: 'parallax', nome: 'Parallax: transição "empurrar" + mouse (profundidades, tilt e luz)', principal: true, ms: 0,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 16); await p.mouse.move(720, 450) },
    acao: (p) => async () => { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); await moverMouse(p, [[200, 200], [1240, 260], [1240, 700], [200, 700], [720, 450]], 2600) } },
  { id: 'tilt', nome: 'Tilt 3D + luz + lanterna (mouse passando pelos cartões)', principal: true, ms: 0,
    preparar: async (p) => { await abrirApresentar(p, 'pr-atlas', 17); await p.mouse.move(60, 60) },
    acao: (p) => async () => { await moverMouse(p, [[150, 640], [420, 760], [540, 640], [720, 760], [900, 640], [1100, 760], [1300, 640], [60, 60]], 3000) } },
  { id: 'rolagem', nome: 'Story: parallax e entradas que acompanham a rolagem (vai e volta)', principal: true, ms: 0,
    // começa um pouco antes da 2ª seção (cartões com entrada "ao rolar" e profundidades diferentes)
    preparar: async (p) => { await abrirApresentar(p, 'pr-mare'); await p.mouse.move(700, 450); await p.evaluate(() => { const r = document.querySelector('.overflow-y-auto'); if (r) r.scrollTop = 830 }); await p.waitForTimeout(1500) },
    acao: (p) => async () => { for (const d of [70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, 70, 70, 70, 70, 70, 70, 70, 70]) { await p.mouse.wheel(0, d); await p.waitForTimeout(50) } await p.waitForTimeout(600) } },
  { id: 'story', nome: 'Story: rolagem com entradas por seção', principal: true, ms: 0,
    preparar: async (p) => { await abrirApresentar(p, 'pr-mare') },
    acao: (p) => async () => { await p.mouse.move(700, 450); for (let i = 0; i < 48; i++) { await p.mouse.wheel(0, 110); await p.waitForTimeout(60) } await p.waitForTimeout(1200) } },
  { id: 'explorar', nome: 'Explorar: voo da câmera + entrada', principal: true, ms: 2600,
    preparar: (p) => abrirApresentar(p, 'pr-linha4'), acao: (p) => avancar(p) },
  { id: 'galeria', nome: 'Editor: prévia ao passar o mouse na galeria', principal: true, ms: 0,
    preparar: async (p) => {
      await p.goto(`${BASE}/app/projects/pr-atlas/edit`)
      await p.getByRole('listbox', { name: 'Telas' }).getByRole('option').nth(2).click()
      await p.getByRole('tab', { name: 'Camadas' }).click()
      await p.getByRole('treeitem', { name: 'Parágrafo palavras' }).click()
      await p.getByRole('tab', { name: 'Animação' }).click()
      await p.waitForTimeout(800)
    },
    acao: (p) => async () => {
      const cartoes = p.locator('[role=radiogroup] button[role=radio]').filter({ has: p.locator('span.pointer-events-none') })
      const n = Math.min(12, await cartoes.count())
      for (let i = 0; i < n; i++) { await cartoes.nth(i).hover(); await p.waitForTimeout(220) }
    } },
  { id: 'editor', nome: 'Editor: prévia da tela inteira (linha do tempo)', principal: true, ms: 3200,
    preparar: async (p) => {
      await p.goto(`${BASE}/app/projects/pr-atlas/edit`)
      await p.getByRole('listbox', { name: 'Telas' }).getByRole('option').nth(2).click()
      await p.keyboard.press('Escape')
      await p.getByRole('tab', { name: 'Animação' }).click()
      await p.getByTestId('linha-do-tempo').waitFor()
      await p.waitForTimeout(800)
    },
    acao: (p) => async () => { await p.getByTestId('linha-do-tempo').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Prévia' }).first().click().catch(async () => { await p.getByRole('button', { name: 'Prévia' }).last().click() }) } },
]

// ---------- execução ----------

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
const page = await ctx.newPage()
// diagnóstico: script injetado em toda página antes do app (ex.: ligar um modo alternativo para comparar)
if (process.env.DESEMPENHO_JS) await page.addInitScript(process.env.DESEMPENHO_JS)
const erros = []
page.on('pageerror', (e) => erros.push(e.message))

// sessão demo + estado persistido (renomear um projeto grava o estado inteiro no localStorage)
await page.goto(`${BASE}/`)
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('apresentacoes.sessao', JSON.stringify({ email: 'desempenho@exemplo.com', em: Date.now() })) })
await page.goto(`${BASE}/app/projects/pr-atlas/edit`)
const nome = page.getByLabel('Nome do projeto')
await nome.waitFor({ timeout: 30000 })
await nome.fill('Desempenho')
await nome.blur()
await page.waitForFunction(() => !!localStorage.getItem('mostra.demo.v2'), null, { timeout: 10000 })
// sai do editor antes de trocar os documentos (o autosave dele regravaria o estado antigo)
await page.goto(`${BASE}/`)
await page.evaluate(([fonte]) => {
  const montar = new Function(`return (${fonte})`)()
  const estado = JSON.parse(localStorage.getItem('mostra.demo.v2'))
  const atlas = estado.projetos.find((p) => p.id === 'pr-atlas').documento
  const todas = atlas.scenes.flatMap((s) => s.layers)
  const docs = montar({ texto: todas.find((l) => l.id === 'sub'), forma: todas.find((l) => l.id === 'foto'), svg: todas.find((l) => l.type === 'svg') })
  const trocar = (id, doc, modo) => { const p = estado.projetos.find((x) => x.id === id); p.documento = { ...p.documento, ...doc }; p.modo = modo }
  trocar('pr-atlas', docs.slides, 'slides')
  trocar('pr-mare', docs.story, 'story')
  trocar('pr-linha4', docs.explorar, 'explorar')
  localStorage.setItem('mostra.demo.v2', JSON.stringify(estado))
}, [montarDocumentos.toString()])

const cdp = await ctx.newCDPSession(page)
await cdp.send('Performance.enable')
const execucoes = []
const escolhidos = CENARIOS.filter((c) => (SO ? SO.has(c.id) : c.principal))

// DESEMPENHO_CAPTURAS=pasta: em vez de medir, fotografa cada cenário em instantes fixos depois da ação
// (para comparar o visual antes/depois das otimizações)
if (process.env.DESEMPENHO_CAPTURAS) {
  const pasta = process.env.DESEMPENHO_CAPTURAS
  fs.mkdirSync(pasta, { recursive: true })
  for (const c of escolhidos) {
    await c.preparar(page)
    const t0 = Date.now()
    const acao = c.acao(page)()
    for (const t of [80, 250, 500, 900, 1400, 2200, 3500]) {
      await page.waitForTimeout(Math.max(0, t - (Date.now() - t0)))
      await page.screenshot({ path: `${pasta}/${c.id}-${String(t).padStart(4, '0')}.png` })
    }
    await acao
  }
  await browser.close()
  console.log(`capturas em ${pasta}`)
  process.exit(0)
}
for (const taxa of TAXAS) {
  for (const c of escolhidos) {
    for (let rep = 0; rep < REPETICOES; rep++) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      try {
        await c.preparar(page)
        // diagnóstico: CSS extra injetado antes de medir (ex.: esconder um painel para ver quanto ele pesa)
        if (process.env.DESEMPENHO_CSS) await page.addStyleTag({ content: process.env.DESEMPENHO_CSS })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: taxa })
        const r = await medir(page, cdp, c.acao(page), c.ms)
        execucoes.push({ cenario: c.id, taxa, ...r })
        console.log(`${taxa}× ${c.id.padEnd(9)} p50 ${String(r.p50).padStart(5)} · p95 ${String(r.p95).padStart(5)} · máx ${String(r.max).padStart(6)} · >20ms ${String(r.acima20).padStart(3)}/${r.quadros} · long tasks ${r.longas} (${r.longasMs} ms) · layout ${r.layouts} (${r.layoutMs} ms) · estilo ${r.estilos} (${r.estiloMs} ms) · script ${r.scriptMs} ms · animações ${r.animacoes} · partes ${r.partes}`)
      } catch (e) {
        console.log(`${taxa}× ${c.id}: falhou — ${e.message.split('\n')[0]}`)
        execucoes.push({ cenario: c.id, taxa, erro: e.message })
      }
    }
  }
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
await browser.close()

// mediana das repetições (a máquina pode estar ocupada; o máximo é o pior quadro de todas)
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0 }
const resultados = []
for (const taxa of TAXAS) for (const c of escolhidos) {
  const rs = execucoes.filter((r) => r.cenario === c.id && r.taxa === taxa && !r.erro)
  if (!rs.length) { resultados.push({ cenario: c.id, nome: c.nome, principal: c.principal, taxa, erro: true }); continue }
  const m = (k) => mediana(rs.map((r) => r[k]))
  resultados.push({ cenario: c.id, nome: c.nome, principal: c.principal, taxa, execucoes: rs.length, p50: m('p50'), p95: m('p95'), max: Math.max(...rs.map((r) => r.max)), acima20: m('acima20'), quadros: m('quadros'), longas: m('longas'), longasMs: m('longasMs'), layouts: m('layouts'), layoutMs: m('layoutMs'), estilos: m('estilos'), estiloMs: m('estiloMs'), scriptMs: m('scriptMs'), animacoes: m('animacoes') })
}

console.log(`\nMediana de ${REPETICOES} execução(ões) por cenário · carga da máquina: ${os.loadavg().map((x) => x.toFixed(1)).join(' / ')} (${os.cpus().length} CPUs)`)
console.log('| Cenário | CPU | p50 (ms) | p95 (ms) | máx (ms) | quadros > 20 ms | long tasks (ms) | layouts (ms) | recálc. estilo (ms) | script (ms) |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const r of resultados) {
  if (r.erro) { console.log(`| ${r.cenario} | ${r.taxa}× | erro | | | | | | | |`); continue }
  console.log(`| ${r.cenario} | ${r.taxa}× | ${r.p50} | ${r.p95} | ${r.max} | ${r.acima20}/${r.quadros} | ${r.longas} (${r.longasMs}) | ${r.layouts} (${r.layoutMs}) | ${r.estilos} (${r.estiloMs}) | ${r.scriptMs} |`)
}
if (JSON_SAIDA) fs.writeFileSync(JSON_SAIDA, JSON.stringify({ resultados, execucoes }, null, 2))
if (erros.length) console.log('\nErros na página:', erros.slice(0, 5))

const reprovados = resultados.filter((r) => r.principal && r.taxa === 4 && (r.erro || r.p95 > LIMITE_P95))
if (reprovados.length) {
  console.log(`\n✘ p95 acima de ${LIMITE_P95} ms com 4×: ${reprovados.map((r) => r.cenario).join(', ')}`)
  process.exit(1)
}
console.log(`\n✔ cenários principais com p95 ≤ ${LIMITE_P95} ms${TAXAS.includes(4) ? ' com 4×' : ''}`)
