# ADR 0003 — Upload e entrega de mídia

**Status:** aceito · **Data:** 2026-10-21 · Partes de Supabase substituídas pela ADR 0010 (Neon + R2).

## Decisão
1. `POST /api/assets/upload-url` valida cota e tamanho **por plano no servidor**, cria o registro `queued` e devolve URL assinada de upload direto ao bucket privado `midias` (o arquivo não passa pelo servidor Next).
2. O cliente faz `PUT` direto e chama `POST /api/assets/:id/finalize`: o servidor confere que o objeto existe, compara tamanho e lê os **32 primeiros bytes** (Range em URL assinada) para detectar o MIME real (`lib/midia/mime.ts`). Formatos ativos (SVG, HTML, executáveis) são rejeitados e o objeto removido.
3. Entrega: nunca URL pública. Autores e convidados recebem URLs assinadas de 15 min geradas após a autorização (`urlsAssinadas`). Rotas `/p/*` e `/api/share/*` respondem com `Cache-Control: private, no-store`, `X-Robots-Tag: noindex` e `Referrer-Policy: no-referrer`.
4. Exclusão é soft (`deleted_at`); a rotina de retenção remove objetos não referenciados.

## Pendente
Worker (fila) para thumbnails/WebP/poster/transcodificação, preenchendo `metadata_json.thumb_key/poster_key` e `status: processing → ready`. GIF e SVG continuam fora do MVP (GIF aceito só como opcional).

## Limitação honesta
Nenhuma solução web impede prints ou gravação de tela por convidados autorizados.
