# ADR 0011 — Colaboração em tempo real (sala por projeto) e equipe

**Status:** aceito · **Data:** 2026-10-21

## Contexto
Duas ou mais pessoas precisam editar o mesmo projeto ao mesmo tempo, vendo-se (avatares, cursores, seleção) e sem
perder edições. Antes, cada aba salvava o documento inteiro com `baseRevision` e a segunda recebia 409 (ADR 0005).
O editor é um reducer imutável: toda ação é `documento → documento` (mais de 60 ações, gestos contínuos,
auto layout que reposiciona filhos). Telas e camadas são objetos com propriedades; texto é uma propriedade.

## Decisão
- **Uma sala por projeto**: Durable Object `SalaProjeto` (SQLite, nome = id do projeto), WebSockets com a
  *Hibernation API* (`acceptWebSocket`, anexo por conexão, auto-resposta de ping). O Worker (`worker/index.ts`)
  atende `GET /api/projects/:id/sala` antes do vinext e exporta a classe (`wrangler.jsonc` → `durable_objects` +
  `exports`).
- **Modelo de sincronização: operações por objeto/propriedade, last-writer-wins por propriedade, ordenadas pelo
  servidor** (o modelo do Figma), e não CRDT (Yjs):
  - cada mudança local vira `diferenca(antes, depois)` → operações `cam`/`cena`/`doc` (só as propriedades que
    mudaram), `cam+`/`cam-`, `cena+`/`cena-` e ordem (`cams`/`cenas`) — `lib/colab/ops.ts`, puro e testado;
  - o DO valida cada lote (Zod + schema do documento nas camadas/telas tocadas), dá um número de sequência,
    persiste e repassa; a última escrita de **cada propriedade** na ordem do servidor vence. Camadas diferentes, ou
    propriedades diferentes da mesma camada, nunca se perdem; na mesma propriedade (ex.: o mesmo texto ao mesmo
    tempo), vale a que chegou por último;
  - o cliente reconcilia (`lib/colab/motor.ts`): `local = confirmado + enviados + fila`. Operações remotas entram no
    confirmado e as pendentes são reaplicadas por cima; sem pendências, `local === servidor` (convergência exata,
    provada por teste aleatório com três pessoas).
  - Por que não Yjs: exigiria trocar o estado do editor (reducer imutável + Zod) por um `Y.Doc` e reescrever todas as
    ações; o ganho (merge de texto caractere a caractere) é pequeno para títulos e parágrafos curtos de
    apresentação, e LWW por propriedade preserva a validação pelo mesmo schema no servidor.
- **Desfazer por pessoa**: o histórico guarda as operações de cada ação e as inversas (`diferenca(depois, antes)`),
  aplicadas sobre o documento ATUAL. Desfazer só toca o que aquela pessoa mudou; o que outra pessoa fez depois numa
  propriedade diferente continua. Gestos contínuos (arrastar, digitar) viram um passo só.
- **Neon continua a fonte da verdade**: a sala grava o documento consolidado com `save_project_scenes` e a revisão
  (alarme ~2 s depois da primeira mudança, depois a cada ~2 s enquanto há edição, e quando a sala esvazia). Entre
  colaboradores não existe 409. Se alguém gravou fora da sala (revisão mudou), a sala recarrega o banco, reaplica
  por cima as operações ainda não gravadas (log no SQLite do DO) e avisa os clientes (`base`). O documento e o log
  ficam no SQLite do DO: sobrevivem à hibernação e a reinícios; a sala recomeça do banco quando alguém entra numa
  sala vazia.
- **Offline**: a conexão cai → o editor mostra "Offline · editando aqui" e continua editando (fila do motor); ao
  voltar, reconecta (backoff, evento `online`), recebe o documento da sala e reenvia só os lotes que o servidor não
  tinha (por `clienteId` + número do lote).
- **Equipe**: convites para o workspace por e-mail (só aquela conta aceita, uma vez) ou por link (7 dias), papéis
  editor/visualizador, remover/sair. Workspace ativo por cookie HttpOnly (`mostra_ws`), conferido em toda
  requisição em `autenticar` (quem foi removido volta ao próprio). Visualizador só lê (rotas e sala). Limite de
  membros do plano (`lib/planos.ts`: Free/Plus/Pro individuais, Studio até 50) conferido ao convidar e, com o
  workspace travado, ao aceitar (`aceitar_convite`, migração 0004).
- **Demo** (`NEXT_PUBLIC_DEMO=1`): sem sala; autosave local como antes; convites respondem "indisponível".

## Segurança
- Handshake do WebSocket: confere `Origin` (sem isso outro site abriria a sala com os cookies da pessoa), sessão do
  Neon Auth pelo cookie e participação no workspace do projeto (404 para quem não é membro). A identidade vai ao DO
  num cabeçalho montado pelo Worker; o DO não é alcançável de fora.
- Mensagens: até 2 MiB, JSON sem chaves `__proto__`/`constructor`/`prototype`, Zod no envelope e nas operações,
  schema do documento no resultado (camada/tela inválida ou chave desconhecida → lote recusado inteiro), modo do
  documento imutável, nunca zero telas. Balde de fichas por conexão (60/s, rajada 120; abuso fecha com 1008).
- Papéis reconferidos no banco a cada ~30 s (quem saiu é desconectado; papel novo vale na hora); conexões com mais
  de 12 h reautenticam. Ao gravar, a sala usa as mesmas regras do PUT (mídias só do próprio workspace).

## Consequências
- Edição no mesmo texto ao mesmo tempo: vence a última tecla que chegou ao servidor (sem merge por caractere).
- Revisões no banco sobem a cada gravação da sala (~2 s de edição contínua), como o autosave já fazia.
- A aba que fica offline por muito tempo reenvia a fila compactada ao voltar; uma tela gigante é dividida em
  partes (tela sem camadas + camadas) para caber numa mensagem.
