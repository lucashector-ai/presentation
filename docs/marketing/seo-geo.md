# SEO e GEO — o que está no código e o que falta fazer fora dele

SEO: aparecer no Google e no Bing para quem busca "apresentação com IA", "alternativa ao Gamma em português", "quanto custa o Mostra". GEO (generative engine optimization): ser citado, com os números certos, nas respostas do ChatGPT, Claude, Perplexity, Gemini e Copilot. Os dois saem da mesma fonte: páginas públicas com texto factual, dados estruturados e permissão de rastreamento.

## O que já está no repositório

| Peça | Onde | O que faz |
| --- | --- | --- |
| Origem canônica | `lib/site.ts` (`ORIGEM_SITE`, https://mostra.page; `NEXT_PUBLIC_SITE_URL` no build e em `wrangler.jsonc`) | Canônicos, sitemap, Open Graph e JSON-LD com URL absoluta; www redireciona para o apex no Worker |
| Metadados | `lib/seo.ts` › `metadadosPagina()` e `PAGINAS`; `app/layout.tsx` | `metadataBase`, título "… · Mostra", descrição, canônico, Open Graph (pt_BR, 1200×630) e Twitter por página; `lang="pt-BR"`; raiz `noindex` por padrão e as públicas liberam |
| Páginas públicas indexáveis | `/`, `/precos`, `/apresentacao-com-ia`, `/signup` | Landing, preços, página de intenção ("como fazer apresentação com IA" + "alternativa ao Gamma"), cadastro |
| Fora do índice | `/login` (meta), `/p/*` e `/app/*` (X-Robots-Tag em `next.config.js`), `/api`, `/criar` | Produto privado e links de cliente nunca entram em buscador |
| robots.txt | `app/robots.ts` ← `lib/seo.ts` › `configRobots()` | Bloqueia `/app/`, `/app$`, `/api/`, `/p/`, `/criar`; libera explicitamente GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Bingbot, CCBot e Applebot-Extended; aponta o sitemap |
| sitemap.xml | `app/sitemap.ts` ← `entradasSitemap()` | As 4 páginas públicas, com prioridade e frequência; sem `lastmod` (não temos data real de alteração) |
| llms.txt e llms-full.txt | `app/llms.txt/route.ts`, `app/llms-full.txt/route.ts` ← `components/marketing/llms.ts` | Resumo e versão completa do produto em Markdown (planos, créditos, formatos, FAQ, comparativo), gerados dos mesmos dados da landing |
| JSON-LD | `components/marketing/JsonLd.tsx` ← `lib/seo.ts` | Um `@graph` por página: Organization, WebSite, SoftwareApplication (+ WebApplication) com `AggregateOffer` em BRL (planos e pacotes de `lib/planos.ts`), WebPage, FAQPage (FAQ da landing; FAQ de cobrança em /precos), BreadcrumbList nas páginas internas |
| Conteúdo citável | `components/marketing/dados.ts` (`FAQ`, `FAQ_PRECOS`, `COMPARATIVO`), `Hero.tsx` | Frase-definição no topo, FAQ de 8 perguntas com respostas inteiras no HTML (acordeão com `hidden`, não desmontado), seção "Como funciona", tabela Mostra × Gamma × Pitch × Canva com "a confirmar" onde não há fato |
| Imagem de compartilhamento | `public/og.png` ← `scripts/gerar-og.mjs` (@napi-rs/canvas) | 1200×630; regenerar com `node scripts/gerar-og.mjs` quando o slogan mudar |
| Verificação de propriedade | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` e `NEXT_PUBLIC_BING_SITE_VERIFICATION` (`.env.example`, `app/layout.tsx`) | Com valor, saem as metas `google-site-verification` e `msvalidate.01`; sem valor, nada sai |
| Testes | `lib/seo.test.ts` (unitário); `e2e/seo.mjs` e `e2e/vitais.mjs` (contra o preview) | Medidas de título/descrição, robots, sitemap, JSON-LD válido, canônicos, noindex onde deve, fonte com preload; Web Vitals básicos |

Rodar antes de cada deploy que mexa na landing:

```
npm run typecheck && npm run lint && npx vitest run lib/seo.test.ts
NEXT_PUBLIC_DEMO=1 npm run build
npx wrangler dev --config dist/server/wrangler.json --port 8854 &
E2E_BASE_URL=http://localhost:8854 node e2e/seo.mjs
E2E_BASE_URL=http://localhost:8854 node e2e/vitais.mjs
```

## O que o usuário precisa fazer (fora do código)

### Google Search Console

1. Entrar em https://search.google.com/search-console com a conta Google que vai administrar o site.
2. "Adicionar propriedade" → tipo **Domínio** → `mostra.page`. Isso cobre apex, www, http e https de uma vez.
3. O Google pede um registro **TXT** no DNS. No Cloudflare (zona mostra.page) → DNS → adicionar registro TXT com nome `@` e o valor que o Google mostrar (`google-site-verification=...`). Esperar alguns minutos e clicar em "Verificar".
   - Alternativa sem DNS: tipo **Prefixo do URL** → `https://mostra.page` → método "Tag HTML": copiar só o conteúdo do atributo `content` para `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (no `wrangler.jsonc` › `vars` ou no `.env` de build), fazer deploy e verificar.
4. Sitemaps → enviar `https://mostra.page/sitemap.xml`.
5. Inspeção de URL → colar `https://mostra.page/`, `/precos` e `/apresentacao-com-ia` → "Solicitar indexação" em cada uma (acelera a primeira visita).
6. Em 2 a 7 dias: Páginas → conferir que as 4 públicas estão em "Indexadas" e que `/p/...`, `/app` e `/login` aparecem como "Excluídas por noindex" (correto).
7. Melhorias → "Perguntas frequentes" e "Dados estruturados": confirmar que FAQPage e SoftwareApplication foram lidos sem erro. Para validar antes: https://search.google.com/test/rich-results com cada URL.

### Bing Webmaster Tools

1. https://www.bing.com/webmasters → "Importar do Google Search Console" (um clique, herda a verificação) ou adicionar o site e usar a meta tag (`NEXT_PUBLIC_BING_SITE_VERIFICATION`) ou o TXT no DNS.
2. Enviar o sitemap `https://mostra.page/sitemap.xml`.
3. Ligar o **IndexNow** (Configurações → IndexNow) para o Bing e o Copilot pegarem alterações mais rápido. [preencher: chave gerada, guardar em `public/<chave>.txt` se for usar a submissão automática]

### Validar a imagem de compartilhamento

- LinkedIn: https://www.linkedin.com/post-inspector/ → colar `https://mostra.page`.
- X: colar o link num rascunho de post (o antigo Card Validator foi desligado; a prévia do composer basta).
- WhatsApp e Telegram: mandar o link para si mesmo.
- Facebook/Instagram: https://developers.facebook.com/tools/debug/ → "Depurar" e, se a imagem antiga ficar em cache, "Extrair novamente".

### Perfis e sameAs

Quando os perfis existirem (LinkedIn, Instagram, X, TikTok, YouTube), colocar as URLs em `lib/seo.ts` › `REDES` e o e-mail público em `EMAIL_CONTATO`. Hoje estão vazios de propósito: link quebrado no JSON-LD vale menos que nenhum.

### Páginas que faltam

`/sobre`, `/contato`, `/termos` e `/privacidade` aparecem no rodapé como texto sem link (`RODAPE` em `dados.ts`, `href: null`). Quando existirem, adicionar em `PAGINAS` (`lib/seo.ts`): entram no sitemap, no llms.txt e ganham metadados sozinhas. Termos e privacidade também contam para a confiança do Google em páginas com preço.

## GEO: como ser citado pelas IAs

O que já está feito: robôs de IA liberados no robots.txt; `llms.txt` e `llms-full.txt`; frase-definição no topo da landing ("Mostra é a plataforma brasileira para…"); FAQ com perguntas na forma como as pessoas perguntam a um assistente; tabela comparativa; preços em texto puro e em JSON-LD; nenhum número inventado.

O que fazer todo mês (15 minutos):

1. Perguntar ao ChatGPT (com busca), ao Perplexity, ao Gemini e ao Claude:
   - "Qual a melhor alternativa ao Gamma em português?"
   - "Como fazer uma apresentação com IA em português?"
   - "Quanto custa o Mostra (mostra.page)?"
   - "Ferramenta brasileira para criar apresentação com IA"
2. Registrar numa planilha [preencher link]: data, pergunta, assistente, o Mostra apareceu? com que números? certos ou errados?
3. Se um número saiu errado, conferir se a página pública diz a coisa certa de forma explícita (uma frase inteira, com o número, sem depender de tabela interativa). Corrigir em `dados.ts` ou `lib/planos.ts`; tudo o mais acompanha.
4. Cada pergunta nova que apareceu em suporte, comentários ou Product Hunt vira item da FAQ (máximo de 10 na landing; o resto vai para a central de ajuda quando existir).

Fontes que as IAs usam e que dependem de ação humana: página no Product Hunt, perfil no LinkedIn, menções em newsletters e blogs de design (press kit), repositórios de comparação ("alternativas ao Gamma"). Cada um desses é um lugar para constar com a frase-definição e o preço certos.

## Palavras-chave alvo (sem volume inventado)

| Intenção | Página | Status |
| --- | --- | --- |
| apresentação com IA / criar apresentação com inteligência artificial | `/apresentacao-com-ia` | no ar |
| alternativa ao Gamma / Gamma em português | `/apresentacao-com-ia#gamma`, `/#comparativo` | no ar |
| Mostra preços / quanto custa o Mostra | `/precos` | no ar |
| apresentação interativa / apresentação com animação | `/` (seções Formatos e Recursos) | no ar; página própria [a decidir] |
| importar Figma para apresentação | `/` (FAQ) | no ar; página própria [a decidir] |
| proposta comercial com IA | — | página futura [a decidir] |

Volumes de busca: consultar no Search Console (consultas reais) depois de 4 semanas e no Planejador de palavras-chave do Google Ads [preencher]. Não escrever página nova sem ver demanda real ou pergunta repetida.

## Checklist mensal

- [ ] Search Console → Páginas: 4 indexadas, nenhuma pública "excluída"; nada de `/p/` indexado.
- [ ] Search Console → Desempenho: top consultas e CTR; ajustar título/descrição em `PAGINAS` se o CTR de uma página ficar abaixo de 2% com mais de 100 impressões.
- [ ] Rich results sem erro (FAQPage, SoftwareApplication, BreadcrumbList).
- [ ] Core Web Vitals (Search Console → Experiência) verdes em celular; se não, rodar `e2e/vitais.mjs` e comparar com os números abaixo.
- [ ] Rodada GEO (4 perguntas × 4 assistentes) registrada.
- [ ] `llms.txt` e FAQ ainda batem com `lib/planos.ts` (os testes garantem, mas conferir o texto novo).
- [ ] Links de `REDES` e `EMAIL_CONTATO` preenchidos e válidos.

## Web Vitals de referência

Medidos com `e2e/vitais.mjs` no preview local (Worker em `wrangler dev`), não em campo. Preencher na primeira rodada e a cada mudança grande na landing.

| Página | Dispositivo | TTFB | FCP | LCP | CLS | Transferido | Pedidos | Data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | celular 390 | 24 ms | 232 ms | 232 ms | 0,000 | 400 KB | 39 | 2026-10-23 |
| / | desktop 1440 | 24 ms | 312 ms | 312 ms | 0,000 | 389 KB | 40 | 2026-10-23 |
| /precos | celular 390 | 18 ms | 200 ms | 200 ms | 0,000 | 523 KB | 37 | 2026-10-23 |
| /precos | desktop 1440 | 16 ms | 176 ms | 176 ms | 0,000 | 636 KB | 38 | 2026-10-23 |
| /apresentacao-com-ia | celular 390 | 22 ms | 184 ms | 184 ms | 0,000 | 593 KB | 38 | 2026-10-23 |
| /apresentacao-com-ia | desktop 1440 | 22 ms | 212 ms | 212 ms | 0,000 | 436 KB | 39 | 2026-10-23 |

Mediana de 3 carregamentos, cache frio, sem limitação de rede ou CPU; o TTFB real na borda do Cloudflare será outro.
