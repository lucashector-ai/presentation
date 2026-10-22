import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Animacao, Loop } from '@/lib/scene/schema'
import { planoAnimacao } from './plano'

const entrada = (type: Animacao['type'], extra: Partial<Animacao> = {}): Animacao => ({ type, duration: 600, delay: 200, easing: 'easeOut', ...extra })
const flutuar: Loop = { type: 'float', duration: 3000, intensity: 1 }

describe('planoAnimacao: soltar a entrada quando termina', () => {
  it('entrada concluída sai do estilo e o loop continua no mesmo compasso (mesmo atraso)', () => {
    const tocando = planoAnimacao({ entrada: entrada('slideUp'), loop: flutuar, reduzir: false, ehTexto: false })
    expect(tocando.soltavel).toBe(true)
    expect(tocando.estilo?.animationName).toBe('anim-mov, loop-float')
    expect(String(tocando.estilo?.animationDelay).split(', ')[1]).toBe('800ms')

    const solta = planoAnimacao({ entrada: entrada('slideUp'), loop: flutuar, reduzir: false, ehTexto: false, concluida: true })
    expect(solta.estilo?.animationName).toBe('loop-float')
    expect(solta.estilo?.animationDelay).toBe('800ms')
    expect(solta.estilo).not.toHaveProperty('--anim-dy')
  })

  it('desfoque vai numa animação separada, no mesmo tempo (o movimento fica na GPU)', () => {
    const p = planoAnimacao({ entrada: entrada('zoomIn'), reduzir: false, ehTexto: false })
    expect(p.estilo?.animationName).toBe('anim-mov, anim-desfoque')
    expect(p.estilo?.animationDuration).toBe('600ms, 600ms')
    expect(p.estilo?.animationDelay).toBe('200ms, 200ms')
    const s = planoAnimacao({ saida: entrada('blurOut'), reduzir: false, ehTexto: false })
    expect(s.estilo?.animationName).toBe('anim-movSai, anim-desfoqueSai')
  })

  it('sem loop, a camada concluída fica sem animação nenhuma (não é mais composta)', () => {
    const p = planoAnimacao({ entrada: entrada('blurIn'), reduzir: false, ehTexto: false, concluida: true })
    expect(p.classe).toBeUndefined()
    expect(p.estilo?.animationName).toBeUndefined()
  })

  it('saídas nunca são soltas (terminam escondidas)', () => {
    const p = planoAnimacao({ saida: entrada('fadeOut'), reduzir: false, ehTexto: false, concluida: true })
    expect(p.soltavel).toBe(false)
    expect(p.estilo?.animationName).toBe('anim-movSai')
    // animação de saída tocada como "entrada" por uma interação (Animar → Fade out)
    const q = planoAnimacao({ entrada: entrada('fadeOut'), reduzir: false, ehTexto: false, concluida: true })
    expect(q.soltavel).toBe(false)
    expect(q.estilo?.animationName).toBe('anim-movSai')
  })

  it('desenhar contorno concluído solta também os traços', () => {
    const p = planoAnimacao({ entrada: entrada('draw'), reduzir: false, ehTexto: false, desenhavel: true, concluida: true })
    expect(p.desenho).toBe(false)
  })

  it('texto dividido continua dividido (cada parte se solta sozinha)', () => {
    const p = planoAnimacao({ entrada: entrada('words'), reduzir: false, ehTexto: true, concluida: true })
    expect(p.texto?.type).toBe('words')
  })

  it('movimento reduzido: fade curto, também solto no fim', () => {
    const p = planoAnimacao({ entrada: entrada('flip'), loop: flutuar, reduzir: true, ehTexto: false })
    expect(p.estilo?.animationName).toBe('anim-mov')
    expect(p.estilo?.animationDuration).toBe('150ms')
    expect(p.soltavel).toBe(true)
  })
})

/**
 * Soltar a animação no fim só é invisível se o último quadro de cada entrada for o estilo parado: opacidade
 * final (--op), transformação neutra + a da camada (--tf), sem filtro, recorte final da camada.
 */
describe('keyframes de entrada terminam no estilo parado', () => {
  const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')
  const ultimoQuadro = (nome: string): string => {
    const i = css.indexOf(`@keyframes ${nome} {`)
    expect(i, `@keyframes ${nome}`).toBeGreaterThanOrEqual(0)
    let prof = 0
    let fim = i
    for (let k = css.indexOf('{', i); k < css.length; k++) {
      if (css[k] === '{') prof++
      else if (css[k] === '}' && --prof === 0) { fim = k; break }
    }
    const corpo = css.slice(css.indexOf('{', i) + 1, fim)
    const blocos = [...corpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), decl: m[2]! }))
    const ultimo = blocos.filter((b) => /(^|,\s*)(to|100%)\s*$/.test(b.sel) || /(^|,\s*)(to|100%)(\s*,|$)/.test(b.sel))
    return ultimo[ultimo.length - 1]?.decl ?? ''
  }
  const neutra = (t: string) => {
    let s = t
      .replace(/var\(--tf, translate\(0\)\)/g, '')
      .replace(/translate\(var\(--anim-ox, 0%\), var\(--anim-oy, 0%\)\)/g, '')
      .replace(/translate\(calc\(-1 \* var\(--anim-ox, 0%\)\), calc\(-1 \* var\(--anim-oy, 0%\)\)\)/g, '')
      .replace(/calc\(var\(--anim-d[xy], 0px\) \* 0\)/g, '0px')
      .replace(/perspective\(\d+px\)/g, '')
    s = s.replace(/(translate[XY]?|rotate[XY]?)\(\s*0(px|%|deg)?\s*(,\s*0(px|%|deg)?\s*)?\)/g, '').replace(/scale\(\s*1\s*(,\s*1\s*)?\)/g, '')
    return s.trim() === ''
  }
  const ENTRADAS = ['anim-fadeIn', 'anim-mov', 'anim-movBlur', 'anim-desfoque', 'seg-desfoque', 'anim-pop', 'anim-elastic', 'anim-bounce', 'anim-flip', 'anim-reveal', 'anim-mask', 'anim-iris', 'anim-draw', 'seg-mov', 'seg-movBlur', 'seg-linha', 'seg-typewriter', 'seg-scramble', 'seg-aparece', 'seg-marca']
  for (const nome of ENTRADAS) {
    it(nome, () => {
      const d = ultimoQuadro(nome)
      expect(d, nome).not.toBe('')
      for (const [, prop, valor] of d.matchAll(/([a-z-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)) {
        if (prop === 'opacity') expect(['var(--op, 1)', '1']).toContain(valor)
        else if (prop === 'transform') expect(neutra(valor!), `${nome}: ${valor}`).toBe(true)
        else if (prop === 'filter') expect(valor).toBe('none')
        else if (prop === 'clip-path') expect(valor).toBe('var(--clip-final, none)')
        else if (prop === 'visibility') expect(valor).toBe('visible')
        else if (prop === 'background-size') expect(valor).toBe('100% var(--marca-h, .38em)')
        else throw new Error(`${nome}: propriedade inesperada no último quadro: ${prop}`)
      }
    })
  }
})
