# Mostra — backlog de UX

Prioridade: **P0** quebra o ciclo criar → enviar → acompanhar · **P1** atrito forte ou promessa não cumprida · **P2** acabamento.
Dono: `ux` (painel, IA, planos, marketing) · `copia-figma` (editor, importação, inspetor, viewer/apresentar) · `animacoes` (motion, aba Animação, presets).
Direção e fluxos em [`DIRECAO.md`](./DIRECAO.md). Feito nesta rodada no fim do arquivo.

## Editor e viewer (fora do escopo do agente ux — recomendações)

| # | P | Dono | Problema | Onde | Recomendação |
| --- | --- | --- | --- | --- | --- |
| E1 | P1 | copia-figma | As ações de IA dentro de uma apresentação (Refazer uma tela 5, Reescrever o texto de uma tela 2, Gerar imagem para uma tela 20) já estão na tabela de preços como "em breve no editor", mas não existem. | `components/editor/MenuContexto.tsx`, `components/editor/inspetor/InspetorTela.tsx`, texto em `AbaDesign.tsx` | Item "Refazer tela com IA" no menu da tela e "Reescrever com IA" no inspetor de texto. Custos de `CUSTO_CREDITOS.refazerTela/reescrever/imagem` (`lib/planos.ts`); débito com `gastarCreditos`; sem saldo, `useCreditos().abrirCompra(motivo)` (o `CreditosProvider` já envolve o editor via `Shell`). Ao entregar, marcar `disponivel: true` em `ACOES_IA`. Migration futura: `kind 'refazer_tela'` em `ai_generations`. |
| E2 | P1 | copia-figma | Editor no celular: o cabeçalho estoura a largura (página com 544 px em 390 px; "Pré-visualizar" cortado). | `components/editor/EditorShell.tsx` (cabeçalho) | Abaixo de `sm`, esconder desfazer/refazer e mostrar só ícone em Pré-visualizar; título com `min-w-0 truncate`. |
| E3 | P1 | copia-figma | Selo "Feito com Mostra" aparece no link do cliente em qualquer plano (inclusive Studio, que paga para tirar a marca). | `components/viewer/PaginaPublica.tsx:70` (`marca` sempre ligado) | Passar `marca={PLANOS[planoDoWorkspace].capacidades.marcaDaPlataforma}`; no modo demo, ler `estado().workspace.planoId`. |
| E4 | P1 | copia-figma | O componente Compartilhar diz "Publique o projeto **no editor**" mesmo na página `/share`, que agora tem "Publicar agora"; avisos de rascunho aparecem duas vezes. Pluralização "1 ativo(s)". | `components/compartilhar/Compartilhar.tsx` | Prop `publicarFora?: boolean` para esconder os avisos quando a página já mostra `BarraPublicacao`; texto neutro "Publique antes de criar links"; "1 ativo / 2 ativos". |
| E5 | P1 | copia-figma | Depois de gerar um link no modal do editor não há caminho para acompanhar; quem envia não descobre "Enviados". | `Compartilhar.tsx` (bloco do link novo) | Linha "Acompanhe as visualizações em Enviados →" ligando para `/app/compartilhados`. |
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
| U2 | P1 | Avisos proativos de saldo: só aparece vermelho no cartão quando sobra < 2 apresentações. | `CartaoCreditos`, `Shell` | Toast único por sessão "Seu saldo dá ≈ 1 apresentação" com "Comprar"; e-mail no backend real. |
| U3 | P2 | "Primeiros passos" some sozinho quando tudo é feito, mas não pode ser dispensado antes. | `Dashboard.tsx` `PrimeirosPassos` | Botão "Dispensar" com preferência em `localStorage` (é conveniência por pessoa). |
| U4 | P2 | Notificação quando o cliente abre (o pedido principal de quem envia propostas). | Enviados, `Shell` | Ponto na barra lateral "Enviados" + lista "Aberto há 5 min" quando houver eventos com data. Depende de E9. |
| U5 | P2 | Alterar senha e exportar dados são só demonstração (toast). | `Configuracoes.tsx` | Ligar ao Supabase Auth / job de exportação. |
| U6 | P2 | Rodapé da landing com "Templates", "Central de ajuda", "Blog" sem página. | `components/marketing/dados.ts` `RODAPE` | Página de templates pública reaproveitando `TEMPLATES` (`lib/ia/roteiro.ts`) com "Usar template" → `/app/novo?comeco=template`. |
| U7 | P2 | Troca de espaço/equipe (Studio "por membro") ainda não existe; o cartão do espaço leva ao plano. | `Shell.tsx` | Fase 2: seletor de espaço e convites. |
| U8 | P2 | Criar com IA aceita só texto (.txt/.md/.html); PDF/DOCX pedem para colar. | `CriarComIA.tsx` `importar` | Extração no servidor (ADR 0008, pendências). |

## Feito nesta rodada (ux)

- Créditos reescritos em apresentações (`lib/planos.ts`: `custoApresentacao`, `apresentacoesCom`, `textoApresentacoes`, `podeGerarTelas`, `ACOES_IA`; vídeo removido) e aplicados em landing, painel, Criar com IA, configurações e README.
- Painel como centro: criar com IA no próprio painel, atalhos (em branco, template, importar), continuar, resumo de Enviados, cartão de créditos com compra, primeiros passos, grade com filtros/contagens/ordenação, capas 16:10 (Story inteiro).
- Barra lateral reorganizada (Criar com IA, Enviados, Plano e conta, créditos com "Comprar", busca ⌘K global); botão morto "Trocar de espaço" removido.
- `/app/criar` dentro do app; `/criar` redireciona mantendo prompt; login/cadastro preservam o destino.
- Compra de créditos e troca de plano funcionando na demonstração; "Começar como conta nova" para testar o primeiro acesso; nome do cadastro vira o usuário.
- Enviados com métricas, ajustes pendentes ("Publicar ajustes"), inativos e "Prontos para enviar"; publicar direto em Detalhes/Compartilhar; "Publicar e enviar" no fim do Criar com IA.
- Biblioteca com envio; Lixeira com esvaziar; Novo projeto com "Arquivos" no celular; promessas falsas da landing (PDF/PPTX, HTML offline, métricas por tela) corrigidas.
