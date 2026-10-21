# Critérios de aceite do MVP (seção 18)

Legenda: ✅ verificado automaticamente no modo demonstração · 🟡 implementado, aguarda verificação em staging com banco real · ⏳ pendente.

| ID | Cenário | Status | Como é verificado |
| --- | --- | --- | --- |
| AC-01 | Cadastro, sessão e recuperação | ✅ (demo) / ✅ (Neon Auth, API) | `e2e/fluxo.mjs` "AC-01"; isolamento por workspace no servidor (`autenticar` + `projetoDoWorkspace`), testado em `lib/api/autorizacao.test.ts` e de ponta a ponta contra o Neon |
| AC-02 | Upload em lote com progresso, thumbnail e erro individual | ✅ | E2E "AC-02/AC-03" (3 PNGs) e "AC-02 Formato inválido" (.txt) |
| AC-03 | Importar cria cenas reordenáveis, duplicáveis e apagáveis | ✅ | E2E + `lib/scene/order.test.ts` |
| AC-04 | Texto, mídia e hotspot: mover, dimensionar, alinhar, ordenar | ✅ | E2E "AC-04" (nudge por teclado, alinhar, trazer para frente) + `transform.test.ts` |
| AC-05 | Clique em hotspot navega no preview e no viewer | ✅ | E2E "AC-05" (preview) e "Demo Café Aurora" (viewer público); `motor.test.ts` |
| AC-06 | Slides e Story renderizam e navegam | ✅ | E2E "AC-05/AC-06" e "Story" |
| AC-07 | Botão de tela cheia; UI limpa no fallback | ✅ manual | `Viewer.tsx` usa `requestFullscreen` em gesto do usuário com try/catch; Playwright headless não expõe fullscreen |
| AC-08 | Projeto sem link não abre sem autenticação; URL adivinhada não abre | ✅ | E2E "AC-08" (redirect para login; `/p/AAAA…` indisponível); `/api/share/:token` devolve `unavailable` para qualquer token desconhecido |
| AC-09 | Link com senha expira, limita tentativas e é revogado imediatamente | ✅ | E2E "AC-09" e "Fluxo B"; `store.test.ts` (5 tentativas → bloqueio); `token.test.ts` |
| AC-10 | Fechar/reabrir preserva edição; falha de rede é sinalizada | ✅ | E2E "AC-10" (reload); estados `offline/falha` em `useEditor` (manual) |
| AC-11 | Rascunho não aparece para o cliente até publicar | ✅ | E2E "AC-11" + `store.test.ts` |
| AC-12 | Link navegável por toque no celular | ✅ | E2E "AC-09/AC-12" (viewport 390×844); swipe em `Viewer.tsx` |
| AC-13 | Asset privado não exposto por URL pública | 🟡 | R2 privado; mídia só por `/api/midias/:id` (sessão) e `/api/share/:token/midias/:id` (link ativo + versão publicada) |
| AC-14 | Operações por teclado; reduce-motion respeitado | ✅ | E2E "AC-14" (duração de animação com `prefers-reduced-motion`); atalhos do editor e do viewer; foco visível global |

## Suíte (seção 17.2)

- **Unitários** (`npm test`): modelos de cena, validação de interações, normalização de ordem, transformações, planos, tokens/senhas, MIME, motor, store de demonstração — 61 testes.
- **E2E** (`npm run test:e2e`): conta → projeto → upload → editor → preview → publicar → link → convidado (celular, senha) → revogação. 21 passos, zero erros de console.
- **Integração com banco, segurança (acesso cruzado, path traversal) e carga (30 cenas/50 mídias)**: ⏳ Sprint 1/4, em staging.
