'use client'
/**
 * Imagens sendo enviadas: aparecem na hora no canvas (prévia local + progresso) enquanto o arquivo sobe; a
 * camada de verdade entra quando o envio termina. Não toca no documento (a sala e o autosave nunca veem um
 * asset que ainda não existe no servidor).
 */
import { useSyncExternalStore } from 'react'

export interface EnvioEmCurso { id: string; url: string; cenaId: string; x: number; y: number; width: number; height: number; progresso: number }

let lista: EnvioEmCurso[] = []
const ouvintes = new Set<() => void>()
const avisar = () => { for (const f of ouvintes) f() }

export function iniciarEnvio(e: EnvioEmCurso) { lista = [...lista, e]; avisar() }
export function progressoEnvio(id: string, progresso: number) { lista = lista.map((e) => (e.id === id ? { ...e, progresso } : e)); avisar() }
export function terminarEnvio(id: string) {
  const e = lista.find((x) => x.id === id)
  lista = lista.filter((x) => x.id !== id)
  avisar()
  // a camada nova usa a URL do servidor; a prévia local some um pouco depois (sem piscar enquanto ela carrega)
  if (e) setTimeout(() => URL.revokeObjectURL(e.url), 4000)
}

export function useEnviosEmCurso(): EnvioEmCurso[] {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => lista, () => lista)
}

/**
 * Print colado (PNG grande da área de transferência) vira WebP de alta qualidade antes de subir: costuma ficar
 * 5 a 10× menor, e o envio, bem mais rápido. Se o navegador não gerar WebP (ou não compensar), fica o original.
 */
export async function comprimirColado(arquivo: File): Promise<File> {
  if (arquivo.type !== 'image/png' || arquivo.size < 800_000 || !/^image\.png$/i.test(arquivo.name)) return arquivo
  try {
    const bmp = await createImageBitmap(arquivo)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    canvas.getContext('2d')!.drawImage(bmp, 0, 0)
    bmp.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.92))
    if (!blob || blob.type !== 'image/webp' || blob.size > arquivo.size * 0.8) return arquivo
    return new File([blob], 'imagem-colada.webp', { type: 'image/webp' })
  } catch {
    return arquivo
  }
}
