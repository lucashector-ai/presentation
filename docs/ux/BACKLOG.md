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
| E10 | P2 | copia-figma | Toggle "Proteger com senha" desligado tem pouco contraste sobre o fundo claro (parece desabilitado). | `components/ui/index.tsx` `Alternador` (compartilhado) | Trilho desligado agora é `bg-bordaHover` (token); se quiser mais, `#C9C7C4` + borda no claro. |
| E12 | P2 | copia-figma | Prévias da aba Animação (miniaturas `MiniPrevia`, caixas do Interativos) e o xadrez do seletor de cor usam cores fixas claras; no tema escuro ficam como "cartões claros" dentro do inspetor escuro. Funciona, mas destoa. | `components/editor/animacao/ui.tsx` (210–234), `Interativos.tsx`, `SeletorCor.tsx › XADREZ` | Trocar os fundos das prévias por `bg-superficie2`/`bg-acentoSuave` e as barras por `bg-bordaForte`; o xadrez pode ficar (padrão universal de transparência). |
| E13 | P2 | copia-figma | Cursores SVG do canvas (duplicar) e as alças brancas de seleção não têm versão para canvas escuro; sobre telas claras continuam legíveis (o canvas escuro é só a calha). | `components/editor/Canvas.tsx` (`SVG_DUPLICAR`, alças `bg-white`) | Alças com `bg-superficie` + borda `selecao` já bastam; cursor pode ganhar contorno de 1 px na tinta. |
| E11 | P2 | copia-figma | Cabeçalho do editor estoura a largura a 1024 px (conteúdo de ~1350 px; "Pré-visualizar" quebra em duas linhas). Já acontecia antes do grid do painel; por isso o `Botao sm` manteve o padding de 12. | `components/editor/EditorShell.tsx` (cabeçalho) | Abaixo de xl, Pré-visualizar só com ícone e ferramentas de forma num menu; depois o `Botao sm` pode ir para padding 16 (escala de 8). |
| E14 | P2 | copia-figma | Galeria de entrada ainda é o bloco mais alto do inspetor (busca + sugestões + categoria = ~500 px; a aba Animação de um texto rola 1,6 tela a 1440). | `components/editor/animacao/Ajustes.tsx › Galeria` | "Todos os efeitos" recolhido por padrão quando há sugestões (abre ao buscar ou ao clicar); cartões de 3 colunas → 4 com rótulo de uma linha. |
| E15 | P2 | copia-figma | Prefixos "3D X"/"3D Y" não cabem nos 28 px do prefixo do campo numérico (ficam apertados). | `SecaoPosicao.tsx` (campos de inclinação) | Prefixo só com ícone de eixo (↻x / ↻y) e o nome completo no `title`; ou mover os dois campos para dentro do menu Vista 3D ("Personalizar…"). |
| E16 | P2 | copia-figma | `Chips` de 3 opções (Velocidade, Distância, Intensidade, Ritmo) e `Segmentado` são dois visuais para a mesma coisa (escolha única numa linha). | `animacao/ui.tsx › Chips`, `inspetor/controles.tsx › Segmentado` | Unificar em `Segmentado` (campo cinza com a opção ativa em relevo) nos casos de ≤ 4 opções; `Chips` só para filtros (categorias da galeria). |
| A3 | P2 | animacoes | Seção "Transição da tela" dentro da aba Animação da camada repete a da tela (mesmo componente `TransicaoTela`); o cartão "Nenhuma" (quadrado cinza) nas galerias não comunica nada. | `animacao/Transicao.tsx`, `ui.tsx › MiniPrevia cor="#C9C6C0"` | Prévia do "Nenhuma" como a camada parada com um traço; na transição, ao passar o mouse mostrar a tela anterior de verdade (miniatura) em vez dos blocos cinza. |
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
| U9 | P2 | Conteúdo dos passos do Criar com IA ainda fora da escala de 8 (alturas 52/34/44/28/36, `mt-1.5`, `gap-1.5`, `p-3.5`, raios 14/18). Só o invólucro entrou no grid, para não conflitar com o manual da marca. | `components/app/CriarComIA.tsx`, `components/app/criar/*` | Migrar depois do merge do manual da marca e tirar o arquivo de `AINDA_FORA` em `espacamento.test.ts`. |
| U10 | P2 | Plano e conta é uma tela longa sem atalhos para as seções. | `Configuracoes.tsx` | Índice lateral fixo no xl (`col-span-4`, `sticky`) com saldo e "Comprar créditos"; fichas âncora em lg. Fica para outra rodada (UI nova). |
| U8 | P2 | Criar com IA aceita só texto (.txt/.md/.html); PDF/DOCX pedem para colar. | `CriarComIA.tsx` `importar` | Extração no servidor (ADR 0008, pendências). |
| U12 | P2 | Tema é por navegador (localStorage + cookie), não por conta: quem usa dois computadores escolhe duas vezes. | `lib/tema.ts` | Guardar `preferencias.tema` no perfil (`/api/conta`) e aplicar no login; o cookie continua como cache para o primeiro HTML. |
| U13 | P2 | `texto3` no claro (#A3A3A3) fica em 2,4:1 — placeholders e rótulos mono de 11 px abaixo de AA (dívida anterior ao tema; no escuro o mesmo token passa de 4,7:1). | `app/globals.css` `--cor-texto-3` | Escurecer para #8A8A8A (3,4:1) nos rótulos e usar `texto2` nos placeholders; conferir no `rotulo-mono`. |
| U11 | P1 | "Explorar a plataforma" / "Ver um exemplo" (landing) apontam para `/p/demo_cafe_aurora…`, que só existe no armazenamento da demonstração; no build real a página responde "Este link não está mais disponível". | `components/marketing/dados.ts` `ROTAS.exemplo`, `lib/dados/real.ts` `resolverToken` | Apresentação-vitrine publicada no backend real com token fixo (seed) ou, no modo real, resolver tokens `demo_` pelos dados da demonstração. Até lá, no build real, esconder o botão ou apontar para o cadastro. |

## Feito na rodada do tema escuro (ux)

- Tokens claro/escuro em `app/globals.css` (`:root`, `[data-tema='escuro']`, `@media (prefers-color-scheme: dark)` para o automático) e `CORES_TEMA` em `lib/design-tokens.ts`; novos tokens `tinta`, `textoCorpo`, `bordaHover`, `acaoHover`, `acentoHover`, `acentoTexto`, `sucessoTexto/Fundo`, `avisoTexto/Fundo`; sombras `carimbo`, `carimbo-sm`, `carimbo-lg` na cor da tinta.
- `lib/tema.ts` (preferência, cookie, script do `<head>`, `prefers-color-scheme`), `components/app/SeletorTema.tsx` (Plano e conta → Preferências e menu do usuário), `app/layout.tsx` lê o cookie e manda `data-tema`, `meta color-scheme` e `theme-color` por tema.
- Cores fixas trocadas por tokens no painel inteiro, Criar com IA, Novo projeto, convite, entrada/cadastro, editor (painéis, inspetor, cabeçalho, rodapé, menus, modais, seletor de cor, seletor de fontes), página de senha e erros do `/p`, e na landing (fundo, tinta, hero, como funciona, recursos, preços, cabeçalho, menu móvel).
- Conteúdo das apresentações protegido: `SceneRenderer` com `color-scheme: light` e `forced-color-adjust: none`; capa de telas verticais com moldura `--cor-canvas`.
- Bug do "escuro forçado" (Criar com IA quebrado em navegador com tema escuro automático): `color-scheme` declarado por tema, `only light` no claro, campos com fundo explícito (`bg-superficie2`) e placeholder `texto3`.
- Guardas: `lib/tema.test.ts`; passo novo em `e2e/fluxo.mjs`; `e2e/tema-capturas.mjs`.

## Feito na rodada landing + entrada + folga do painel (ux)

- Landing: selo DEMO no canto da logo (`Cabecalho.tsx › SELO_DEMO`); calha de 16 entre os CTAs do hero e do CTA final — a sombra carimbo do botão escuro (5 px, 7 no hover) invadia a calha de 12 e aparecia como um "resto laranja" atrás de "Explorar a plataforma".
- Entrada e cadastro: formulário centralizado na coluna (horizontal e vertical), logo no topo, rodapé centrado; "G" oficial do Google (SVG do logo de produto servido pelo próprio Google) no lugar do "G" em texto; campos de 48 mantidos.
- Painel: conteúdo alinhado à barra lateral (48 px no xl, 32 no lg) com largura máxima 1248 — em 1920 a folga caiu de 220 para 48; bordas das colunas continuam batendo (`grade.cjs` delta 0 em 1024/1440/1920).
- Marca no mesmo tamanho da landing na barra lateral, no cabeçalho móvel e nas telas de entrada (`TAMANHO_MARCA`).
- Favicon em SVG (`public/favicon.svg`) + `apple-touch-icon.png` (`scripts/gerar-favicon.mjs`); `app/icon.svg` removido.

## Feito na rodada do inspetor (ux: abas Design e Animação)

- Auditoria com Playwright (1440 e 1280, claro e escuro; tela, texto, forma, multi, grupo, frame): capturas antes/depois em `scratchpad/ux-inspetor/`. Achados: aba Animação de um texto rolava 1,7–2,2 telas (galeria + velocidade + repetir + quando + direção + distância + ajustes abertos), abas internas escondiam a transição da tela, "Aplicar a todas as camadas da tela" não existia; no Design, 6 chips de 3D e 3 chips de predefinições de efeito à vista, "IA" no meio das seções do Figma, cabeçalhos de três jeitos (plano, recolhível, vazio), espaçamentos 6/10/12 misturados; "Link", "Restrições" e "Responsivo" sempre à vista.
- `Secao` única (`controles.tsx`): cabeçalho 32 px, recolhível com seta, resumo quando fechada, memória por seção; vazia = título + "+". Espaços em 8 (`space-y-2`, `pb-2`).
- `Menu` (`controles.tsx`): menu suspenso acessível (menuitem/menuitemcheckbox, setas, Home/End, Esc, clique fora) com gatilho de ícone ou de campo. Usado em Predefinições de efeito (Efeitos), Vista 3D (Posição) e "Mais" da animação.
- Animação da camada: seções Entrada · Ênfase · Saída · Interativo · (Em sequência) · Transição da tela, cada uma com resumo; Repetir foi para "Ajustes finos"; menu "Mais" com copiar, colar, aplicar a todas as camadas da tela (mantém os atrasos), aplicar às selecionadas, remover. Animação da tela: transição e linha do tempo abertas; Animar tudo, Profundidade e Avançar sozinha recolhidas com resumo. `TransicaoTela` compartilhada (`animacao/Transicao.tsx`); `Finos` compartilhado (`ui.tsx`).
- Design: ordem do Figma com IA depois de Exportar; Restrições e Responsivo sem UI; Link só com link (ou ao colar uma URL com a camada selecionada — `useColarLink`, com toast); cores do vetor sem a amostra de origem.

## Feito na rodada do grid do painel (ux)

- Um grid só para todas as telas do painel (`components/app/Layout.tsx`: `PaginaPainel`, `CabecalhoPagina`, `Grade`, `SPAN`, `Secao`, `CartaoPainel`, `Esqueleto`, `FiltroFichas`); tokens em `T.layout`, `T.controle` e raios `controle/cartao/bloco`.
- Início: IA, atalhos, Continuar, Enviados e Créditos na mesma grade (a borda dos atalhos bate com a dos Créditos e da 3ª capa); atalhos sempre com descrição; Continuar não some sem projeto ativo; esqueletos no lugar do "Carregando"; erro dentro dos cartões.
- Enviados, Biblioteca, Lixeira, Plano e conta, Detalhe do projeto, Compartilhar, Novo projeto e Aceitar convite no mesmo grid e na mesma margem; fim da rolagem lateral de 4 px no Plano e conta a 390 px; formatos do Novo projeto e exemplos do Criar com IA sem órfãos.
- Guarda: `components/app/espacamento.test.ts`.

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
