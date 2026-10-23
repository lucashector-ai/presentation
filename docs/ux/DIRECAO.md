# Mostra — direção de UX

Dono: agente `ux` (`.claude/agents/ux.md`). Última revisão: 23.10.2026. Problemas e pendências ficam em [`BACKLOG.md`](./BACKLOG.md).

O Mostra **gera e envia apresentações**. A pessoa traz artes (Figma, Illustrator, Blender) ou pede para a IA montar a apresentação, ajusta no editor, publica e manda um link privado ao cliente — e depois acompanha se o cliente abriu. Tudo que não serve a esse ciclo é ruído.

---

## 1. Princípios

1. **Apresentação é a unidade de tudo.** Planos, créditos, limites e métricas falam em apresentações e telas. "Créditos" sempre vêm acompanhados da tradução: *≈ N apresentações de 10 telas*.
2. **O painel é a casa.** De `/app` se cria (IA, em branco, template, importação), se retoma o trabalho, se vê o que foi enviado e como o cliente reagiu, e se entende e compra créditos. Nenhuma ação importante exige procurar.
3. **Do zero ao link em minutos.** Cada fluxo é medido em cliques até "o cliente abriu" (seção 4). Atalhos pulam etapas quando a intenção já é clara (prompt digitado no painel, `?comeco=template`, `?passo=arquivos`).
4. **Profissional e calmo.** Tokens de `app/globals.css`/`tailwind.config.js`, Geist, acento `#5965F2`, formas geométricas com moderação (landing e Criar com IA; o app é sóbrio). Português do Brasil, frases curtas, sem jargão ("Enviados", não "share links").
5. **Sempre um próximo passo.** Estado vazio ensina e oferece a ação; erro diz o que fazer (limite de plano → "Ver planos"; sem créditos → abre a compra); ações destrutivas pedem confirmação e, quando possível, oferecem "Desfazer".
6. **Honestidade.** O que ainda não existe aparece como "em breve" (gerar imagem para uma tela) ou sai da página (PDF/PPTX, HTML offline). Demonstração sempre avisa "sem cobrança".

## 2. Arquitetura de informação

```
Landing (/)                       Público
├─ #ia  DemoIA → /criar?prompt=…&formato=…  ──┐
├─ #precos  planos · créditos · pacotes      │
├─ /signup · /login (?proximo= preserva o destino)
└─ /p/:token  apresentação do cliente (viewer) │
                                              ▼
/criar ── redireciona ─► /app/criar (com sessão) ou /signup?proximo=/app/criar?… (sem sessão)

App (barra lateral)               Logado
├─ Início            /app                 painel: criar · continuar · enviados · créditos · primeiros passos · projetos
├─ Criar com IA      /app/criar           prompt → roteiro → apresentação (dentro do app)
├─ Enviados          /app/compartilhados  links, visualizações, ajustes pendentes, prontos para enviar
├─ Biblioteca        /app/biblioteca      arquivos do espaço, envio direto
├─ Lixeira           /app/lixeira         restaurar · excluir · esvaziar
├─ Plano e conta     /app/settings        #creditos (saldo, extrato, quanto custa) · #plano (uso, planos) · perfil · LGPD · demonstração
├─ Busca ⌘K          (sobreposição)       projetos, ações de criação, áreas
├─ Cartão de créditos (rodapé)            saldo, ≈ apresentações, "Comprar"
│
├─ Projeto           /app/projects/:id            detalhes, telas, publicar, links
│  ├─ Compartilhar   /app/projects/:id/share      publicar aqui mesmo + gerar/revogar links
│  └─ (tela cheia)   /edit · /apresentar · /apresentador
└─ (tela cheia)      /app/novo  (?comeco=template · ?passo=arquivos)
```

Regras:
- **Tela cheia** só onde a tarefa pede foco total: editor, apresentar, apresentador e o assistente de novo projeto (`SEM_CHROME` em `components/app/Shell.tsx`). O Criar com IA fica dentro do app para manter créditos e navegação à vista.
- **Um caminho por destino.** "Meus projetos" (que levava ao mesmo `/app`) saiu da barra; a grade de projetos vive no Início com filtros. "Compartilhados" virou **Enviados** (o termo do usuário). O botão "Trocar de espaço (Fase 2)", que não fazia nada, virou link para o plano.
- **Créditos e plano** abrem de qualquer lugar por `useCreditos()` (`components/app/Creditos.tsx`): `abrirCompra(motivo?)` e `abrirPlano(id)`.

## 3. Créditos e planos (decisão central)

Fonte única: `lib/planos.ts`. Landing (`components/marketing/dados.ts`), painel, Criar com IA, configurações e a rota `/api/ai/roteiro` usam as mesmas funções.

| Ação | Créditos | Observação |
| --- | --- | --- |
| **Gerar uma apresentação** (roteiro + telas) | 10 + 5 por tela → **10 telas = 60** | `custoApresentacao(n)` = `custoDe({ roteiro: 1, tela: n })`, cobrado **uma vez**, quando a IA escreve o roteiro. Ajustar o roteiro, trocar tema, redesenhar: grátis. "Gerar outro roteiro" mostra o custo no botão. |
| Refazer uma tela | 5 | no editor: ✦ IA → Refazer tela (novo texto no mesmo layout, com instrução opcional) |
| Reescrever (ou traduzir) o texto de uma tela | 2 | no editor: ✦ IA, menu de contexto ou seção IA do inspetor de texto |
| Gerar imagem para uma tela | 20 | aparece desligado, "em breve" (não há modelo de imagem) |

| Plano | Créditos | ≈ apresentações de 10 telas | Telas por apresentação com IA |
| --- | --- | --- | --- |
| Free | 400 no cadastro | 6 | até 10 |
| Plus | 1.000/mês | 16 | até 50 |
| Pro | 4.000/mês | 66 | até 100 |
| Studio | 20.000/mês (equipe) | 333 | até 100 |

Pacotes avulsos (não expiram): 500/R$19 ≈ 8 · 2.000/R$59 ≈ 33 · 10.000/R$229 ≈ 166.

Decisões:
- **D1 — Créditos explicados em telas** (substituída por D6): a pessoa pensa em quantas apresentações consegue fazer, não em tokens; o saldo vira "≈ N telas com IA" com um exemplo de apresentações de 10 e de 20.
- **D2 — "Gerar vídeo curto" (100) saiu.** Não existe no produto, não serve ao ciclo apresentação → link → cliente, e um item de 100 créditos distorcia a leitura "créditos ≈ apresentações" (um vídeo valeria quase duas apresentações). Se voltar, entra como ação *dentro* de uma tela ("Animar fundo da tela"), com custo próprio. O `kind 'video'` da tabela `ai_generations` (migration 0002) fica inofensivo; não exige migration.
- **D3 — Ações secundárias sempre "de uma tela".** "Gerar uma tela" solto confundia (gera onde?); virou "Refazer uma tela" (5, mesmo preço de desenhar uma tela). Reescrever e imagem ganharam "para/de uma tela".
- **D4 — Preços e pacotes mantidos.** A conta já fechava em apresentações (Plus: R$24 ≈ 16 apresentações ≈ R$1,50 cada). Nenhuma mudança de preço era necessária para a mensagem ficar clara.
- **D5 — Limite de telas por plano aplicado na UI e na rota** (`podeGerarTelas`, `telasPorPrompt`): de 6 até o limite do plano (Free 12, Plus 20, Pro e Studio 30) no Criar com IA e no painel; acima do limite aparece o plano que libera, com "Ver planos".
- **D6 — Demonstração debita créditos fictícios** mesmo com o gerador local, para o ciclo saldo → geração → compra ser visível. No backend real, a rota só debita quando o Claude escreve e estorna se falhar (ADR 0008).
- **D8 — IA no editor muda texto, não layout** ([ADR 0009](../adr/0009-ia-no-editor.md)). Reescrever e Refazer devolvem conteúdo para as caixas que já existem (estilos, animações e interações ficam); prévia antes/depois e aplicar em um passo de desfazer. Sem IA conectada, regras locais rotuladas "exemplo local".
- **D9 — Aviso de saldo uma vez por sessão.** Quando um gasto deixa o saldo em ≈ 1 apresentação, um toast com "Comprar" — antes de a pessoa dar de cara com um botão bloqueado.
- **D7 — Compra e troca de plano funcionam na demonstração** (`comprarPacote`, `trocarPlano` em `lib/demo/store.ts`). Upgrade credita os créditos do mês na hora; downgrade não apaga nada (projetos acima do limite continuam abertos, só bloqueia criar novos) e o modal avisa isso antes.

- **D6 — Créditos em telas.** O saldo é mostrado como telas com IA (`lib/telasIa.ts`: `textoTelas`, `exemploApresentacoes` — "≈ 4 apresentações de 10 ou 2 de 20"), nunca fixo em "apresentações de 10 telas". Valores vêm de `lib/planos.ts`/`lib/ia/economia.ts`.
- **D7 — Criar com IA em passos.** Briefing → Marca → Material → Estilo → Tamanho → Revisar e gerar → Roteiro → Design. Passos opcionais se pulam com um clique ("Pular", "Ir para revisar"); a barra de baixo mostra sempre o custo; o que é grátis (marca, cores, logo, estilo, troca de estilo depois) diz "grátis". O atalho do painel entra direto, com prompt e tamanho preenchidos.
- **D10 — Painel alinhado à barra lateral, não centralizado.** O conteúdo começa sempre a 48 px da barra (32 no lg) e para em 1248; em telas largas o vazio fica à direita, não dos dois lados. Com a barra lateral como âncora, a leitura começa no mesmo x em todas as telas e larguras; centralizar no que sobra abria um vão (220 px em 1920) que parecia erro.
- **D11 — Tema claro, escuro e automático por tokens** (`app/globals.css`, `lib/design-tokens.ts › CORES_TEMA`, `lib/tema.ts`). Toda cor de interface sai de `--cor-*` (fundo, duas superfícies, bordas, texto 1/2/3 + corpo, **tinta** = traço da marca, ação, acento com texto próprio, estados, canvas). O escuro é um quase-preto quente (#121110/#1A1918/#232120), off-white #F2EFEA, violeta clareado #7F89FF (6,2:1), bordas sutis; contraste conferido (texto ≥ 4,5:1; placeholder ≥ 3:1). Preferência em `localStorage` + cookie `tema` (`auto | claro | escuro`); `<html data-tema>` guarda o tema efetivo, escrito pelo servidor (cookie) e por um script inline no `<head>` antes do CSS — sem piscar. "Automático" segue `prefers-color-scheme` (listener + `@media` no CSS para quando não há JS). Seletor em **Plano e conta → Preferências** e no **menu do usuário**; sem atalho de teclado. **O conteúdo das apresentações nunca muda de cor**: o `SceneRenderer` fixa `color-scheme: light` e `forced-color-adjust: none`, miniaturas e exportação PNG/PDF renderizam o documento como ele é; só a moldura (canvas, painéis, página de senha do `/p`) segue o tema. O visualizador e o apresentador continuam sempre escuros (moldura de cinema). Navegador com "escuro forçado" (Chrome Android, Dark Reader): `color-scheme` coerente (`light dark` no automático, `only light` no claro, `dark` no escuro) e campos/cartões/placeholders com fundo explícito — o navegador não tem mais o que inverter. Landing: fundo e tinta seguem o tema; as seções com cor de marca (grafite, ipê, sálvia, ameixa, violeta) e os cartões de plano ficam como no design.
- **D8 — Auto layout nas telas geradas.** Nada de caixas soltas empilhadas por conta: os grupos de conteúdo são frames de auto layout (gap do tema), textos abraçam a altura e o título com ênfase são duas partes num frame com gap 0. Se o conteúdo não cabe, a tela é montada de novo menor (nunca transborda nem sobrepõe).

## 4. Fluxos principais (cliques contados a partir do estado inicial; digitação não conta)

### A. Primeiro acesso → primeira apresentação enviada (pela landing, com IA) — 9 cliques
1. Landing, seção Criar com IA: escreve a ideia, clica **Gerar ✦** → `/criar?prompt=…` → sem sessão vai para `/signup?proximo=/app/criar?…`. *(1)*
2. Cadastro: nome, e-mail, senha → **Criar conta** *(2)* → **Continuar para o painel** *(3)* → volta direto para `/app/criar` com o prompt preenchido (o nome digitado vira a saudação).
3. **Gerar roteiro →** *(4)* — custo e saldo ("40 créditos · seu saldo dá ≈ 10 apresentações") visíveis antes.
4. Revisa o roteiro (editar, reordenar, tema) → **Gerar apresentação** *(5)*.
5. Pronto: **Publicar e enviar** *(6)* → página Compartilhar → **Publicar agora** *(7)* → **Gerar link** *(8)* → **Copiar** *(9)*.

Variante pelo painel (conta já criada): prompt no cartão "Criar apresentação com IA" → **Continuar** → mesmos passos 3–5 (7 cliques). Antes eram 11+ (ir ao editor para publicar, abrir o modal etc.).

### B. Primeiro acesso → apresentação com minhas artes — 6 cliques
Painel → **Importar arquivos** *(1)* (`/app/novo?passo=arquivos`) → escolher/soltar arquivos *(2)* → **Criar projeto** *(3)* (cada imagem vira uma tela; abre o editor) → **Compartilhar** *(4)* → **Publicar** *(5)* → **Gerar link** *(6)*.

### C. Pessoa que volta
- Retomar: login → painel → **Abrir no editor** em "Continuar de onde parou" (1 clique depois do login).
- Achar qualquer coisa: **⌘K** → digita → Enter (projetos, "Criar apresentação com IA ‘<texto>’", comprar créditos, áreas).
- Grade: filtros com contagem (Todos · Rascunhos · Publicados · Enviados · Arquivados), filtro por nome/cliente, ordenação, menu ⋯ (editar, apresentar, compartilhar, duplicar, arquivar com Desfazer, lixeira).

### D. Geração com IA (detalhe)
Prompt / colar texto / importar arquivo de texto → formato, telas (limitadas pelo plano), estilo → **Gerar roteiro →** (débito único) → roteiro editável (título, tipo, texto, itens, notas, ordem, + tela) com tema/imagens/densidade → **Gerar apresentação** (cria o projeto e revela as telas uma a uma) → Apresentar · Publicar e enviar · Abrir no editor. Sem saldo: o botão abre a compra com o motivo ("Esta apresentação custa 60 créditos e você tem 20").

### E. Enviar e acompanhar o cliente
- Enviar: Projeto → **Compartilhar** → (publicar, se preciso) → validade/senha → **Gerar link** → **Copiar**.
- Acompanhar: barra lateral **Enviados** *(1)* → apresentações no ar, visualizações, links com senha, expiração; cartão "Enviados" no painel mostra os 3 mais recentes.
- Ajustar depois de enviar: editar → em Enviados (ou Compartilhar/Detalhes) **Publicar ajustes** *(1)* → o cliente vê a nova revisão no mesmo link.
- Encerrar: **Gerenciar links** → **Revogar** → confirmar (3 cliques); o link morre na hora.
- "Prontos para enviar": projetos publicados sem link ativo, com **Gerar link** direto.

### F. Créditos e plano
Saldo sempre visível (rodapé da barra lateral, cartão do painel, cabeçalho do Criar com IA). **Comprar** → escolhe pacote (com ≈ apresentações) → **Comprar** (2 cliques). Plano: Plano e conta → **Escolher** → confirmar (2 cliques).

## 5. Inventário de telas

| Tela | Rota / arquivo | Status |
| --- | --- | --- |
| Landing | `/` · `components/marketing/*` | ✅ créditos em apresentações (calculadora "Gerar uma apresentação", ações dentro de uma apresentação, planos e pacotes com ≈ N); FAQ de créditos; promessas não implementadas removidas; selo DEMO na logo enquanto o produto está em demonstração (`Cabecalho.tsx › SELO_DEMO`) · ⚠ "Explorar a plataforma" só existe no build demo (U11) |
| Cadastro / login / recuperar | `/signup` `/login` · `FormAuth.tsx` | ✅ preserva `?proximo=` (inclusive ao alternar login↔cadastro); nome do cadastro vira o usuário; formulário centralizado na coluna, logo no topo, "G" oficial do Google |
| Redirecionamento do Criar com IA | `/criar` · `app/criar/*` | ✅ mantém prompt/formato; sem sessão → cadastro |
| Painel (Início) | `/app` · `Dashboard.tsx` | ✅ hub: criar (IA + 3 atalhos), continuar, enviados, créditos, primeiros passos, projetos; tudo numa grade só (bordas alinhadas entre as linhas) |
| Barra lateral + busca ⌘K | `Shell.tsx`, `BuscaRapida.tsx` | ✅ |
| Criar com IA | `/app/criar` · `CriarComIA.tsx` | ✅ dentro do app; custo em apresentações; limite por plano; compra quando falta saldo · ⚠ só o invólucro no grid (U9) |
| Novo projeto | `/app/novo` · `NovoProjeto.tsx` | ✅ atalhos por query; importar acessível no celular |
| Detalhes do projeto | `/app/projects/:id` · `DetalheProjeto.tsx` | ✅ publicar aqui mesmo; estado "não encontrado" com saída |
| Compartilhar | `/app/projects/:id/share` | ✅ publicar aqui mesmo (`BarraPublicacao`); sem avisos repetidos; link novo leva a Enviados |
| Enviados | `/app/compartilhados` · `Paginas.tsx` | ✅ métricas, links, ajustes pendentes, prontos para enviar, inativos sob demanda |
| Biblioteca | `/app/biblioteca` | ✅ envio direto e por arrastar |
| Lixeira | `/app/lixeira` | ✅ esvaziar; aviso de que links revogados não voltam |
| Plano e conta | `/app/settings` | ✅ créditos (saldo, ≈, extrato, quanto custa), plano (uso, troca), perfil salva, **Preferências → Tema** (Automático · Claro · Escuro), conta nova na demonstração |
| Editor | `/app/projects/:id/edit` | ✅ IA na tela (✦ IA: reescrever, refazer; imagem em breve) · ⚠ demais itens no backlog (agentes copia-figma/animações) |
| Apresentar / apresentador | `/apresentar` `/apresentador` | ⚠ ver backlog (viewer) |
| Página do cliente | `/p/:token` | ✅ selo "Feito com Mostra" só nos planos com marca da plataforma (Free) |

## 6. Padrões de interface (app)

- **Grid do painel** (`components/app/Layout.tsx`, valores em `lib/design-tokens.ts › T.layout`): 4 colunas no celular, 8 no tablet e com a barra lateral (lg), 12 a partir de xl; calha 16 → 24; margem do `main` 16 → 32 → 48; largura máxima 1248 (`PaginaPainel`) **alinhada à barra lateral** — o `main` do Shell para em 1248 + margens (`max-w-painel-lg/xl`), então o conteúdo começa a 48 px da barra (32 no lg) em qualquer largura, em vez de centralizar no que sobra; sem barra lateral (Novo projeto) fica centralizado. Tudo que fica lado a lado entra numa `Grade` com um `SPAN` (`terco`, `doisTercos`, `quarto`, `sexto`, `metade`, `lateral`, `cheio`), assim as bordas batem entre as linhas por construção. Conjuntos fixos (atalhos, exemplos, formatos, KPIs) fecham as linhas sem órfãos.
- **Escala de 8:** margens, calhas, paddings e espaços entre blocos só em 8/16/24/32/40/48/56/64/80/96; 4 só dentro de componentes (ícone e texto, título e meta, badge). `components/app/espacamento.test.ts` barra o resto nas telas do painel.
- Ritmo vertical: rótulo → H1 8 · H1 → descrição 16 · cabeçalho → primeiro bloco 32 · entre seções 48 · H2 (20 px) → conteúdo 16.
- Controles: 32 (ações em cartões e listas) · 40 (padrão: botão, campo, select, busca, item de navegação) · 48 (ação principal da tela; entrada e cadastro). Raios: 8 controles, 12 cartões e capas, 16 estados vazios e modais.
- Cabeçalho de página (`CabecalhoPagina`): rótulo mono + `titulo-display` 32/40 px + descrição curta; ação principal à direita; sem linha embaixo.
- **Marca:** um tamanho só onde ela identifica o produto (`TAMANHO_MARCA` em `components/ui/Logo.tsx`: 28 px, 34 a partir de sm) — cabeçalho da landing, barra lateral e cabeçalho móvel do painel, entrada e cadastro. Favicon: `public/favicon.svg` (símbolo em `#5965F2`, fundo transparente) + `apple-touch-icon.png` gerado por `scripts/gerar-favicon.mjs`.
- **Botões da landing:** ao lado de um botão com sombra carimbo, calha de 16 (a sombra avança 5 px, 7 no hover; com 12 ela invade o vizinho).
- Cartões do painel (`CartaoPainel`): `rounded-cartao border-borda bg-superficie p-4 sm:p-6`, `h-full` (vizinhos com a mesma altura) e rodapé com `mt-auto` (botões na mesma linha de base); rótulo mono numa linha de 24 px; número grande `tracking-[-0.04em]`.
- Status de projeto: **Rascunho** (cinza, nunca publicado) → **Publicado** (acento, revisão pronta sem link) → **Enviado** (verde, link ativo) · **Arquivado**. "Alterações não publicadas" em âmbar quando o rascunho passou da revisão publicada.
- Capas: 16:10; telas verticais (Story) aparecem inteiras sobre fundo neutro (`CapaProjeto`).
- Destaque de IA: ponto acento + sombra carimbo violeta (4 px, dentro da calha; o alinhamento é pela borda) só no cartão de criação com IA.
- Demonstração: todo "comprar/assinar/exportar" termina com "(demonstração, sem cobrança)".
- **Cores só por token** (`bg-superficie`, `text-texto2`, `border-tinta`, `bg-acao text-acaoTexto`, `bg-acento text-acentoTexto`, `shadow-carimbo`…): nada de `bg-white`, `#525252` ou `border-grafite` na interface — esses não viram no escuro. `grafite`, `lima`, `violeta` etc. (paleta da marca) só em blocos de cor fixa (selo, cartões de marca da landing, moldura do viewer). Pares: texto branco sobre `bg-violeta` (fixo) continua `text-white`; sobre `bg-acento` (muda no escuro) é `text-acentoTexto`.

## 7. Como validar

- `npx tsc --noEmit`, `npx vitest run` (planos e store cobrem créditos, compra, troca de plano, conta vazia), `npx next lint`.
- E2E `e2e/fluxo.mjs` (cadastro → painel → novo projeto → editor → publicar → link → convidado → revogar → tema escuro → Criar com IA). O passo do tema confere `data-tema`, fundo do body, contraste do campo "Para quem" do Criar com IA, cor da tela no canvas e no PNG exportado, persistência ao recarregar e o automático com `prefers-color-scheme`.
- Capturas claro/escuro das telas principais (1440 e 390): `E2E_BASE_URL=http://localhost:8855 node e2e/tema-capturas.mjs`.
- `lib/tema.test.ts` garante que os dois blocos escuros do CSS são iguais e que `CORES_TEMA` espelha as variáveis.
- Conta nova: Plano e conta → Demonstração → **Começar como conta nova** (Free, 400 créditos, nada criado).
