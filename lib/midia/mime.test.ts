import { describe, expect, it } from 'vitest'
import { detectarMime, extensaoPorMime } from './mime'

const bytes = (...xs: (number | string)[]) => Uint8Array.from(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])))

describe('detectarMime', () => {
  it('reconhece PNG, JPEG, WebP, GIF, MP4 e WebM', () => {
    expect(detectarMime(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('image/png')
    expect(detectarMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(detectarMime(bytes('RIFF', 0, 0, 0, 0, 'WEBP', 'VP8 '))).toBe('image/webp')
    expect(detectarMime(bytes('GIF89a', 0))).toBe('image/gif')
    expect(detectarMime(bytes(0, 0, 0, 0x18, 'ftypisom', 0, 0, 0, 0))).toBe('video/mp4')
    expect(detectarMime(bytes(0x1a, 0x45, 0xdf, 0xa3, 0))).toBe('video/webm')
    expect(detectarMime(bytes('glTF', 2, 0, 0, 0))).toBe('model/gltf-binary')
  })
  it('rejeita SVG, HTML e executáveis (formatos ativos)', () => {
    expect(detectarMime(bytes('<svg xmlns'))).toBeNull()
    expect(detectarMime(bytes('<!DOCTYPE html>'))).toBeNull()
    expect(detectarMime(bytes('MZ', 0x90, 0))).toBeNull()
    expect(detectarMime(new Uint8Array(0))).toBeNull()
  })
  it('extensão por mime', () => {
    expect(extensaoPorMime('image/jpeg')).toBe('jpg')
    expect(extensaoPorMime('model/gltf-binary')).toBe('glb')
    expect(extensaoPorMime('image/svg+xml')).toBe('svg')
    expect(extensaoPorMime('application/x')).toBe('bin')
  })
})
