# Domínio mostra.page

Estado em 2026-10-23. O Mostra responde hoje em `https://mostra.oobo-site.workers.dev`; o endereço oficial passa a ser `https://mostra.page` (com `www.mostra.page` redirecionando para ele).

## Onde estamos

| Item                                                      | Estado                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Zona `mostra.page` na conta do Cloudflare                 | **não existe ainda** (ver abaixo o que falta)                                                |
| Código preparado para o domínio (origem, redirecionamento) | pronto e no ar assim que houver deploy; não muda nada no workers.dev                          |
| Rotas de Custom Domain no `wrangler.jsonc`                | escritas, **comentadas** até a zona ficar ativa                                              |
| Neon Auth (login por e-mail e Google) em `mostra.page`    | depende de registrar a origem nova no Neon (checklist no fim)                                |

### Por que a zona não foi criada daqui

O `wrangler` desta máquina está logado por OAuth (`npx wrangler whoami`), e o login OAuth do Wrangler só concede `zone (read)`. A API respondeu à criação da zona com:

> Requires permission "com.cloudflare.api.account.zone.create" to create zones for the selected account

Não há como pedir esse escopo pelo `wrangler login`, então a zona precisa ser criada no painel (um minuto) ou com um API Token próprio (abaixo). As outras zonas da conta (`oobo.com.br`, `notchisland.app`) estão ativas e cada uma recebeu um par de nameservers diferente, por isso **não dá para adivinhar os dois nameservers de `mostra.page` antes de a zona existir**: o Cloudflare os atribui na hora.

## O que você precisa fazer (uma vez)

### 1. Adicionar o domínio no Cloudflare

1. Entre em <https://dash.cloudflare.com> na conta `1lucashector@gmail.com's Account` (id `0084528a162d7702e37ec620a34d55af`).
2. **Add a domain** (ou "Onboard a domain") → digite `mostra.page` → plano **Free** → *Quick scan for DNS records* pode pular (o Worker cria os registros de que precisa).
3. Na tela final o Cloudflare mostra **dois nameservers** no formato `nome.ns.cloudflare.com`. Eles também ficam em **Websites → mostra.page → Overview → Nameservers**. Esses são "os DNS" que vão no registrador.

Alternativa, se preferir que a gente crie por aqui: em **My Profile → API Tokens → Create Token**, template *Edit zone DNS* acrescentando a permissão **Zone → Zone → Edit** (escopo da conta inteira, para poder criar zona). Coloque o valor na variável de ambiente `CLOUDFLARE_API_TOKEN` da máquina (nunca no repositório nem no chat) e avise; o `wrangler` e a API passam a usar esse token.

### 2. Trocar os nameservers no registrador (onde o `mostra.page` foi comprado)

No painel do registrador, em DNS / Nameservers, escolha **nameservers personalizados** e cole exatamente os dois do passo 1, nada mais (remova os do registrador). Texto para copiar depois de pegar os nomes:

```
Nameserver 1: ______.ns.cloudflare.com
Nameserver 2: ______.ns.cloudflare.com
```

- Se o registrador tiver DNSSEC ligado, desligue antes de trocar (ou o domínio para de resolver); dá para religar depois pelo Cloudflare.
- Propagação: costuma levar minutos, pode chegar a 24 h. O Cloudflare manda e-mail quando a zona passa de *Pending* para **Active**; também aparece em Overview.

### Dá para manter o DNS fora do Cloudflare?

Para este app, não. O Worker é publicado por **Custom Domain** (`routes` com `custom_domain: true`), que exige que o Cloudflare seja o DNS autoritativo da zona: é ele quem cria o registro, emite o certificado e encaminha o tráfego ao Worker. Um CNAME feito noutro provedor apontando para `mostra.oobo-site.workers.dev` não funciona (o `workers.dev` não aceita hosts de terceiros e o certificado não cobriria `mostra.page`). O domínio pode continuar **registrado** onde está; só os nameservers mudam. Transferir o registro para o Cloudflare Registrar é opcional (e `.page` nem sempre está disponível para transferência).

Detalhe do TLD: todo `.page` está na lista de pré-carregamento de HSTS dos navegadores, então o site só abre por HTTPS. Isso é bom aqui (o Cloudflare cuida do certificado) e explica por que `http://mostra.page` nunca vai funcionar em nenhum provedor.

## O que acontece depois que a zona ficar ativa (eu faço)

1. Em `wrangler.jsonc`, descomentar as `routes`:
   ```jsonc
   "routes": [
     { "pattern": "mostra.page", "custom_domain": true },
     { "pattern": "www.mostra.page", "custom_domain": true }
   ],
   ```
   Já foi verificado que o build leva `routes` e `vars` para `dist/server/wrangler.json` e que `wrangler deploy --dry-run` aceita.
2. `env -u NEXT_PUBLIC_DEMO npm run build && npx wrangler deploy --config dist/server/wrangler.json`. O deploy cria os dois registros DNS e os certificados (o certificado pode levar alguns minutos na primeira vez).
3. Testar: `curl -I https://mostra.page` (200, com `Strict-Transport-Security`), `curl -I https://www.mostra.page/p/x?y=1` (301 para `https://mostra.page/p/x?y=1`), login por e-mail e por Google, abrir um link `/p/…`, editar em duas abas (sala de colaboração via WebSocket, que confere a origem).
4. Depois disso, em `lib/site.ts`, tirar `.workers.dev` de `HOSTS_DE_TRANSICAO` e fazer `mostra.oobo-site.workers.dev` redirecionar 301 para `https://mostra.page` (hoje ele continua atendendo normalmente, de propósito: ninguém fica sem acesso enquanto o DNS não muda). Avisar quem tiver links antigos copiados; os links continuam funcionando porque o redirecionamento preserva caminho e consulta.
5. Opcional: `wrangler.jsonc` → `"observability": { "enabled": true, "traces": { "enabled": true } }` para ter traces além dos logs.

## O que já mudou no código

- `lib/site.ts` (novo): `ORIGEM_SITE` (`NEXT_PUBLIC_SITE_URL`, padrão `https://mostra.page`; `NEXT_PUBLIC_APP_URL` ainda é aceito), `HOST_SITE`, `HOST_WWW`, `ORIGENS_DO_APP`, `origemCanonica(pedido)`, `origemNoNavegador()`, `urlDoSite()` e `destinoCanonico(url)`. Em `localhost` e no `workers.dev` as URLs absolutas usam a origem do próprio pedido, para nada apontar para um domínio que ainda não responde. É a constante que o trabalho de SEO deve usar para `metadataBase`, canonical, OG, sitemap e robots.
- `worker/index.ts`: `www.mostra.page` → 301 para `https://mostra.page` (caminho e consulta preservados); em `mostra.page` as respostas levam `Strict-Transport-Security`. O `workers.dev` não é redirecionado ainda.
- Checagem de origem (CSRF nas mutações em `lib/api/servidor.ts` e no WebSocket da sala em `lib/colab/entrada.ts`): aceita a origem do pedido e as de `ORIGENS_DO_APP` (domínio e workers.dev).
- Links de convite (`lib/api/equipeServidor.ts`) e de compartilhamento (`components/compartilhar/Compartilhar.tsx`) montados com a origem canônica.
- `wrangler.jsonc`: `vars.NEXT_PUBLIC_SITE_URL = "https://mostra.page"` e as `routes` prontas (comentadas). `.env.example` e a CI usam `NEXT_PUBLIC_SITE_URL`.
- Testes: `lib/site.test.ts`.

## Checklist do Neon Auth e do Google para o domínio novo

O login fala com o Neon Auth pelo proxy `/api/auth/*` do próprio app; os cookies de sessão (`__Secure-…session_token`, `session_data`, `mostra_ws`) são gravados pelo app no host em que a pessoa está, sem atributo `Domain`. Por isso **nada muda nos cookies**: em `mostra.page` eles valem para `mostra.page`; quem estava logado no `workers.dev` só precisa entrar de novo no domínio novo (são hosts diferentes, as sessões não se transferem). O que o Neon precisa saber é a **origem** nova, porque ele só redireciona (login com Google, verificação de e-mail, redefinição de senha) para origens da lista de confiança; sem isso o retorno do Google falha com `invalid domain`.

1. **Origem confiável no Neon Auth** — o CLI `neon` desta máquina não está logado (`neon login` abre o navegador), então faça num terminal seu, na pasta do projeto já `neon link`ada, apontando para o branch de produção:
   ```bash
   neon neon-auth domain list
   neon neon-auth domain add https://mostra.page
   # o www nunca serve o app (redireciona antes), então não precisa entrar
   ```
   Ou no console: **Neon Console → projeto → branch de produção → Auth → Configuration → Trusted domains (Redirect URIs) → Add** `https://mostra.page` (com `https://`, sem barra no fim). Mantenha `https://mostra.oobo-site.workers.dev` na lista até o redirecionamento do workers.dev entrar; depois remova (`neon neon-auth domain delete https://mostra.oobo-site.workers.dev`).
2. **Google OAuth** — no Neon Auth gerenciado, o redirect URI do Google é do próprio Neon (`{NEON_AUTH_BASE_URL}/callback/google`), então ele **não muda** com o domínio novo. Se o login com Google ainda usa as credenciais compartilhadas do Neon (só para desenvolvimento), crie as suas antes de divulgar o domínio: Google Cloud Console → APIs & Services → Credentials → OAuth client (Web): *Authorized JavaScript origins* `https://mostra.page`; *Authorized redirect URIs* exatamente o `{NEON_AUTH_BASE_URL}/callback/google` (o valor de `NEON_AUTH_BASE_URL` está no `.env.local`, não neste documento). Depois `neon neon-auth oauth-provider update google --client-id … --client-secret …` (ou no console, Auth → OAuth providers → Google). Na tela de consentimento do Google, "Authorized domains" recebe `mostra.page`.
3. **E-mails do Neon Auth** (verificação, redefinição de senha): os links apontam para a origem que fez o pedido, logo passam a sair com `mostra.page` sozinhos. Se houver remetente personalizado (Auth → Email), confira o nome do app e, se quiser, um remetente `@mostra.page` (exige configurar o domínio de envio no provedor de e-mail, fora do escopo daqui).
4. **Segredos**: nada muda (`NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET`, `SHARE_GRANT_SECRET`, `DATABASE_URL` continuam iguais no Worker).
5. **Teste final** em `https://mostra.page`: cadastro por e-mail, login, login com Google (popup e redirecionamento), sair e entrar de novo, abrir um link `/p/…` com senha (cookie do convidado) e aceitar um convite de equipe pelo link `https://mostra.page/app/convite/…`.
