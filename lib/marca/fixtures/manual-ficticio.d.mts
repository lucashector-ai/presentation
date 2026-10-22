/** Tipos do gerador do manual de marca fictício (manual-ficticio.mjs). */
export declare const MANUAL_FICTICIO: {
  marca: string
  cores: { principal: string; secundaria: string; fundoEscuro: string; fundoClaro: string; destaqueCmyk: [number, number, number, number] }
  fontes: { titulos: string; textos: string; textosNoGoogle: string; numeros: string }
}
export declare function logoPng(createCanvas: (w: number, h: number) => unknown): Uint8Array
export declare function gerarManualFicticio(dep: { jsPDF: unknown; createCanvas: (w: number, h: number) => unknown }): Uint8Array
