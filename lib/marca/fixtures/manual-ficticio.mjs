/**
 * Manual de marca fictício ("Vela Energia") em PDF, para os testes da leitura do manual (lib/marca/*.test.ts) e
 * para o e2e do passo da marca (e2e/fluxo.mjs): capa com o logo (PNG com transparência), página de cores com
 * rótulos, HEX, RGB, CMYK e Pantone e as amostras desenhadas, tipografia (uma fonte do Google, uma comercial que
 * não está no Google e uma de números), tom de voz, regras do logo, fotografia, grafismos e usos incorretos.
 * JavaScript puro (sem TypeScript) para o e2e importar direto; recebe o jsPDF e o canvas do chamador.
 */

/** O que o manual diz, para os testes conferirem. */
export const MANUAL_FICTICIO = {
  marca: 'Vela Energia',
  cores: { principal: '#0B4F8A', secundaria: '#F28C28', fundoEscuro: '#0E1726', fundoClaro: '#F6F1E7', destaqueCmyk: [70, 0, 45, 0] },
  fontes: { titulos: 'Montserrat', textos: 'Helvetica Neue', textosNoGoogle: 'Inter', numeros: 'IBM Plex Mono' },
}

/** PNG do logo: um círculo laranja (a "vela") e um bloco azul, com fundo transparente. */
export function logoPng(createCanvas) {
  const c = createCanvas(360, 120)
  const g = c.getContext('2d')
  g.fillStyle = '#F28C28'
  g.beginPath()
  g.arc(60, 60, 46, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#0B4F8A'
  g.fillRect(130, 30, 210, 60)
  return new Uint8Array(c.toBuffer('image/png'))
}

/** Gera o PDF (A4, 5 páginas) e devolve os bytes. */
export function gerarManualFicticio({ jsPDF, createCanvas }) {
  const d = new jsPDF({ unit: 'pt', format: 'a4' })
  const titulo = (t, y = 80) => { d.setFont('helvetica', 'bold'); d.setFontSize(24); d.text(t, 50, y) }
  const sub = (t, y) => { d.setFont('helvetica', 'bold'); d.setFontSize(15); d.text(t, 50, y) }
  const corpo = (t, y) => { d.setFont('helvetica', 'normal'); d.setFontSize(11); d.text(t, 50, y) }

  // 1. capa com o logo
  d.addImage(logoPng(createCanvas), 'PNG', 50, 120, 270, 90)
  titulo('Manual da marca Vela Energia', 280)
  corpo('Guia de identidade visual · versão 2026', 304)

  // 2. cores
  d.addPage()
  titulo('Cores')
  const cores = [
    ['Primária · Azul Vela', 'HEX #0B4F8A', 'RGB 11 79 138', 'CMYK 92 43 0 46', 'Pantone 2154 C', '#0B4F8A'],
    ['Secundária · Laranja Sol', 'HEX #F28C28', 'RGB 242 140 40', 'CMYK 0 42 83 5', 'Pantone 151 C', '#F28C28'],
    ['Fundo escuro · Noite', 'HEX #0E1726', 'RGB 14 23 38', '', '', '#0E1726'],
    ['Fundo claro · Areia', 'HEX #F6F1E7', 'RGB 246 241 231', '', '', '#F6F1E7'],
    ['Destaque · Verde Mar', 'CMYK 70 0 45 0', '', '', '', '#4DFF8C'],
  ]
  cores.forEach(([rotulo, ...codigos], k) => {
    const y = 130 + k * 120
    d.setFillColor(codigos[4])
    d.rect(50, y - 14, 60, 60, 'F')
    sub(rotulo, y)
    codigos.slice(0, 4).filter(Boolean).forEach((c, j) => corpo(c, y + 18 + j * 15))
  })

  // 3. tipografia
  d.addPage()
  titulo('Tipografia')
  corpo('A família tipográfica da marca tem três níveis.', 120)
  sub('Títulos', 160)
  corpo('Montserrat Bold, em frases curtas.', 178)
  sub('Textos', 220)
  corpo('Fonte Helvetica Neue Regular para textos corridos.', 238)
  sub('Números', 280)
  corpo('Fonte IBM Plex Mono para números e tabelas.', 298)

  // 4. tom de voz e logo
  d.addPage()
  titulo('Tom de voz')
  corpo('Falamos de perto, com otimismo e sem jargão técnico.', 120)
  corpo('Escreva frases curtas e diretas, como numa conversa.', 136)
  corpo('Evite termos como “barato” e “imperdível”.', 152)
  sub('Logo', 200)
  corpo('Respeite a área de proteção igual à altura da letra V ao redor do logo.', 220)
  corpo('Tamanho mínimo: 24 mm ou 96 px de largura.', 236)
  corpo('Não distorça, não gire e não aplique sombra no logo.', 252)

  // 5. fotografia, grafismos e usos incorretos
  d.addPage()
  titulo('Fotografia')
  corpo('Use fotos reais, com luz natural e pessoas em ação.', 120)
  sub('Grafismos', 170)
  corpo('Linhas finas paralelas, inspiradas no movimento do vento.', 190)
  sub('Usos incorretos', 240)
  corpo('Não use gradientes nas cores da marca.', 260)
  corpo('Nunca use as cores da marca sobre fotos sem contraste.', 276)
  corpo('Pouco texto por página, com muito respiro.', 300)
  return new Uint8Array(d.output('arraybuffer'))
}
