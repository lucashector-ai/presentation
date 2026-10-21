import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import vinext from 'vinext'

// vinext (API do Next.js sobre o Vite) + plugin do Cloudflare: dev, build e preview rodam o servidor no workerd.
// O RSC é o ambiente principal do Worker; o SSR roda como ambiente filho dele.
export default defineConfig({
  plugins: [vinext(), cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } })],
})
