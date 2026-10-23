/** Origem pública do site (canônicos, sitemap, Open Graph). `NEXT_PUBLIC_SITE_URL` entra no build; padrão: produção. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mostra.page').replace(/\/$/, '')
