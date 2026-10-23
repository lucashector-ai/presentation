import type { MetadataRoute } from 'next'
import { entradasSitemap } from '@/lib/seo'

/** /sitemap.xml com as páginas públicas (lib/seo.ts › PAGINAS). */
export default function sitemap(): MetadataRoute.Sitemap {
  return entradasSitemap()
}
