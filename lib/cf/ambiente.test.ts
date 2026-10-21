import { describe, expect, it } from 'vitest'
import { obterBucketMidias } from './ambiente'

describe('ambiente do Cloudflare', () => {
  it('fora do Worker não há bindings: o bucket de mídias é null (e o import não quebra)', async () => {
    expect(await obterBucketMidias()).toBeNull()
    expect(await obterBucketMidias()).toBeNull()
  })
})
