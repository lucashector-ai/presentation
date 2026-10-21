// Importação de arquivo como URL (recurso do Vite): `import url from 'pacote/arquivo?url'`.
declare module '*?url' {
  const url: string
  export default url
}
