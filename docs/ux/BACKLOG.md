# Mostra — backlog de UX

Prioridade: **P0** quebra o ciclo criar → enviar → acompanhar · **P1** atrito forte ou promessa não cumprida · **P2** acabamento.
Dono: `ux` (painel, IA, planos, marketing) · `copia-figma` (editor, importação, inspetor, viewer/apresentar) · `animacoes` (motion, aba Animação, presets).
Direção e fluxos em [`DIRECAO.md`](./DIRECAO.md). Feito nesta rodada no fim do arquivo.

## Editor e viewer (fora do escopo do agente ux — recomendações)

| # | P | Dono | Problema | Onde | Recomendação |
| --- | --- | --- | --- | --- | --- |
| E1 | ✅ | ux | ~~Ações de IA dentro de uma apresentação "em breve no editor".~~ **Feito:** Reescrever o texto de uma tela (2) e Refazer uma tela (5) funcionam; Gerar imagem (20) aparece desligado "em breve". | `components/editor/ia/PainelIA.tsx`, `app/api/ai/texto`, `app/api/ai/tela`, `lib/ia/texto.ts`, `lib/ia/tela.ts` | Botão ✦ IA no cabeçalho, itens no menu de contexto e seção IA no inspetor de texto. Prévia antes/depois, aplicar = um passo de desfazer, aviso "não cabe na caixa", reserva local rotulada "exemplo local". `ACOES_IA` com `disponivel: true`. Decisões na [ADR 0009](../adr/0009-ia-no-editor.md). Pendente: imagem e `ai_generations`. |
| E2 | P1 | copia-figma | Editor no celular: o cabeçalho estoura a largura (página com 544 px em 390 px; "Pré-visualizar" cortado). | `components/editor/EditorShell.tsx` (cabeçalho) | Abaixo de `sm`, esconder desfazer/refazer e mostrar só ícone em Pré-visualizar; título com `min-w-0 truncate`. |
| E3 | ✅ | ux | ~~Selo "Feito com Mostra" em qualquer plano.~~ **Feito:** o selo segue `marcaDaPlataforma` do plano do workspace (Free mostra; Plus/Pro/Studio não). | `components/viewer/PaginaPublica.tsx`, `lib/demo/store.ts` (`resolverToken` → `marca`), `app/api/share/[token]` (`brand`) | — |
| E4 | ✅ | ux | ~~"Publique no editor" na página /share, avisos repetidos, "1 ativo(s)".~~ **Feito:** prop `publicarFora` (página Compartilhar e modal do editor já mostram o estado de publicação) esconde os avisos do componente; texto neutro "Publique antes de criar links" quando usado sozinho; "Publique acima para gerar links" ao lado do botão desligado; "1 ativo / 2 ativos", "1 visualização". | `components/compartilhar/Compartilhar.tsx` | — |
| E5 | ✅ | ux | ~~Sem caminho para acompanhar depois de gerar o link.~~ **Feito:** "Acompanhe as visualizações em Enviados →" no bloco do link novo. | `Compartilhar.tsx` | — |
| E6 | P2 | copia-figma | Avatar "MD" fixo no cabeçalho do editor (aparece "MD" para qualquer usuário). | `EditorShell.tsx:222` | Iniciais de `useDemo((e) => e.usuario.nome)`. |
| E7 | P2 | copia-figma | O símbolo do canto do editor volta para os detalhes do projeto; não há caminho de um clique para o Início. | `EditorShell.tsx:208` | Trilha "Início / Nome do projeto" (o nome já está lá) com "Início" → `/app`. |
| E8 | P2 | copia-figma | Slides 16:9 no celular em retrato ficam pequenos e com muito vazio; nenhuma dica de girar. | `components/viewer/Viewer.tsx` | Em retrato com tela horizontal, dica discreta "Gire o celular" uma vez por sessão; tocar nas metades esquerda/direita para navegar. |
| E9 | P2 | copia-figma | Visualização registra só contagem por link; a landing prometia tempo por tela (texto já suavizado). | `lib/demo/store.ts` `resolverToken`, viewer | Evento por tela vista (`share_view_scene`) com duração; mostrar em Enviados ("parou na tela 4"). Depende de backend — combinar com ux. |
| E10 | P2 | copia-figma | Toggle "Proteger com senha" desligado tem pouco contraste sobre o fundo claro (parece desabilitado). | `components/ui/index.tsx` `Alternador` (compartilhado) | Trilho desligado `#C9C7C4` + borda; ux pode ajustar junto, é componente compartilhado. |
| A1 | P2 | animacoes | Telas geradas pela IA usam sempre fade/slide de 600 ms; a aba Animação tem presets melhores que não chegam à geração. | `lib/ia/roteiro.ts` (`montarDocumento`, transições/entradas) | Expor os presets da aba Animação como função pura e aplicar por tipo de tela (capa: entrada em cascata; números: contagem; paleta: blocos em sequência). Manter `prefers-reduced-motion` (AC-14). |
| A2 | P2 | animacoes | Revelação das telas no passo 3 do Criar com IA é um fade simples a cada 380 ms. | `components/app/CriarComIA.tsx` (passo 3) | Sugerir curva/escala da marca; ux implementa se vier como classe/keyframe em `globals.css`. |

## Painel, IA, planos e marketing (dono: ux)

| # | P | Problema | Onde | Próximo passo |
| --- | --- | --- | --- | --- |
| U1 | P1 | Créditos e compra só existem no navegador (demo); no backend real falta checkout de pacote e troca de plano. | `components/app/Creditos.tsx`, `lib/demo/store.ts` (`comprarPacote`, `trocarPlano`) | Rota `POST /api/billing/checkout` (Stripe) → webhook → `credit_transactions`; a UI já chama um ponto só. |
| U2 | ✅ | ~~Avisos proativos de saldo.~~ **Feito:** toast único por sessão quando um gasto deixa o saldo em ≈ 1 apresentação de 10 telas ou menos, com "Comprar" (toasts com ação ficam 8 s). Falta o e-mail no backend real. | `components/app/Creditos.tsx` (`AvisoSaldoBaixo`) | E-mail "seu saldo está acabando" quando houver backend de notificações. |
| U3 | P2 | "Primeiros passos" some sozinho quando tudo é feito, mas não pode ser dispensado antes. | `Dashboard.tsx` `PrimeirosPassos` | Botão "Dispensar" com preferência em `localStorage` (é conveniência por pessoa). |
| U4 | P2 | Notificação quando o cliente abre (o pedido principal de quem envia propostas). | Enviados, `Shell` | Ponto na barra lateral "Enviados" + lista "Aberto há 5 min" quando houver eventos com data. Depende de E9. |
| U5 | P2 | Alterar senha e exportar dados são só demonstração (toast). | `Configuracoes.tsx` | Ligar ao Neon Auth (troca de senha por código) / job de exportação. |
| U6 | P2 | Rodapé da landing com "Templates", "Central de ajuda", "Blog" sem página. | `components/marketing/dados.ts` `RODAPE` | Página de templates pública reaproveitando `TEMPLATES` (`lib/ia/roteiro.ts`) com "Usar template" → `/app/novo?comeco=template`. |
| U7 | P2 | Troca de espaço/equipe (Studio "por membro") ainda não existe; o cartão do espaço leva ao plano. | `Shell.tsx` | Fase 2: seletor de espaço e convites. |
| U8 | P2 | Criar com IA aceita só texto (.txt/.md/.html); PDF/DOCX pedem para colar. | `CriarComIA.tsx` `importar` | Extração no servidor (ADR 0008, pendências). |

## Feito na rodada do Criar com IA em passos (ux)

- Fluxo em 8 passos com custo sempre visível; marca com logo (upload real), paleta do logo, paletas prontas, par de fontes e kit de marca por workspace (Neon, migração 0005; demo no armazenamento local); material com números, obrigatórios, a evitar e fotos próprias; galeria com 23 estilos, filtro e busca; 6 até 30 telas pelo plano; custo de "gerar outro roteiro" e "redesenhar telas" antes de cada ação.
- Telas geradas com auto layout (sem caixas sobrepostas) e teste que cobre todos os estilos × componentes × variantes.
- Fora desta rodada: imagens geradas por IA para os espaços de imagem; editar o kit de marca fora do Criar com IA (Plano e conta).

## Feito na rodada 3 (ux)

- **IA no editor (E1):** Reescrever texto (mais curto, impactante, formal, simples, corrigir, traduzir para inglês/espanhol/português) e Refazer tela (com instrução opcional e o contexto das outras telas), rotas `/api/ai/texto` e `/api/ai/tela` no mesmo padrão de `/api/ai/roteiro`, reserva local determinística, créditos com compra quando falta saldo. ADR 0009.
- **Compartilhar (E3–E5):** selo da plataforma por plano; sem avisos repetidos; pluralização; caminho para Enviados depois de gerar o link.
- **Aviso de saldo (U2):** toast único por sessão com "Comprar".

## Feito na rodada anterior (ux)

- Créditos reescritos em apresentações (`lib/planos.ts`: `custoApresentacao`, `apresentacoesCom`, `textoApresentacoes`, `podeGerarTelas`, `ACOES_IA`; vídeo removido) e aplicados em landing, painel, Criar com IA, configurações e README.
- Painel como centro: criar com IA no próprio painel, atalhos (em branco, template, importar), continuar, resumo de Enviados, cartão de créditos com compra, primeiros passos, grade com filtros/contagens/ordenação, capas 16:10 (Story inteiro).
- Barra lateral reorganizada (Criar com IA, Enviados, Plano e conta, créditos com "Comprar", busca ⌘K global); botão morto "Trocar de espaço" removido.
- `/app/criar` dentro do app; `/criar` redireciona mantendo prompt; login/cadastro preservam o destino.
- Compra de créditos e troca de plano funcionando na demonstração; "Começar como conta nova" para testar o primeiro acesso; nome do cadastro vira o usuário.
- Enviados com métricas, ajustes pendentes ("Publicar ajustes"), inativos e "Prontos para enviar"; publicar direto em Detalhes/Compartilhar; "Publicar e enviar" no fim do Criar com IA.
- Biblioteca com envio; Lixeira com esvaziar; Novo projeto com "Arquivos" no celular; promessas falsas da landing (PDF/PPTX, HTML offline, métricas por tela) corrigidas.
