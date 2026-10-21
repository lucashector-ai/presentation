// Importação de arquivo como URL (recurso do Vite): `import url from 'pacote/arquivo?url'`.
declare module '*?url' {
  const url: string
  export default url
}

/** Pasta dos arquivos do OCR (worker, núcleo wasm e dados de idioma do tesseract.js), definida em vite.config.ts. */
declare const __BASE_OCR__: string
