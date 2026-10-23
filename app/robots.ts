import type { MetadataRoute } from 'next'
import { configRobots } from '@/lib/seo'

/** /robots.txt (rota de metadados do Next/vinext). Regras e robôs de IA liberados em lib/seo.ts. */
export default function robots(): MetadataRoute.Robots {
  return configRobots()
}
