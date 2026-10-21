/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite rodar uma segunda instância local sem disputar a pasta .next (ex.: NEXT_DIST_DIR=.next-2).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const seguranca = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    return [
      { source: '/:path*', headers: seguranca },
      // Rotas compartilhadas nunca devem ser indexadas (robots.txt não é segurança, mas noindex é obrigatório).
      { source: '/p/:token*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] },
      { source: '/app/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

module.exports = nextConfig
