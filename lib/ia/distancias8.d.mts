/** Tipos de lib/ia/distancias8.mjs (conferência da regra do 8 pelas distâncias, usada nos testes e no e2e). */
export interface CamadaDistancia { id: string; type: string; parentId?: string; hidden?: boolean; text?: string }
export interface CaixaDistancia { x: number; y: number; w: number; h: number }
export function distanciasForaDe8(camadas: readonly CamadaDistancia[], caixas: ReadonlyMap<string, CaixaDistancia>, tamanho: { width: number; height: number }): { problemas: string[]; conferidas: number }
