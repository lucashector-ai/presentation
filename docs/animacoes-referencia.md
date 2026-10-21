# Referência de animações do Mostra

Guia de produto (enviado pelo usuário, 21/10/2026) para o sistema de animações. Serve de especificação para o agente `animacoes` e para revisão de qualidade. O catálogo implementado e os parâmetros técnicos ficam em `docs/animacoes.md`.

## Modelo de um efeito
Todo efeito tem:
- **Gatilho** — quando começa: ao entrar na tela, ao entrar no viewport (scroll), ao clicar, ao passar o mouse, automático (após um tempo), em cadeia (depois que outra animação termina).
- **Estado inicial** — deslocado, invisível, desfocado, menor/maior, girado.
- **Transformação** — sobe, revela, gira, aumenta, troca, aparece por máscara.
- **Estado final** — posição normal, opacidade 100%, blur 0, escala 100%.
- **Ajustes** — controles finos (abaixo).

## Ajustes (valem para quase todos os efeitos)
1. **Direção** — de cima, de baixo, da esquerda, da direita, diagonal, do centro para fora, das bordas para dentro.
2. **Distância** — 20 px sutil · 80 px evidente · 200 px dramático.
3. **Opacidade inicial** — 0% (do zero) · 30% (já aparece levemente).
4. **Escala inicial** — 0.9 cresce levemente · 1.1 diminui até o tamanho certo.
5. **Rotação inicial** — ex.: −6°, +10°.
6. **Blur inicial** — ex.: 12 px → 0 px.
7. **Ponto de origem** — centro, topo, canto superior esquerdo, base, lado direito (zoom, rotação, máscara).
8. **Duração** — 0,25 s rápida · 0,6 s elegante · 1,2 s dramática.
9. **Atraso** — para sequências.
10. **Curva** — linear, ease out, ease in-out, spring, bounce suave.
11. **Loop / repetição** — uma vez, N vezes, infinito, até sair da tela.
12. **Intensidade** — fraca, média, forte.

## Categorias
1. **Entrada básica** — Fade In (simples, com movimento, com blur, com escala), Fade Up, Fade Down, Fade Left/Right, Scale In, Rotate In.
2. **Revelar** (o mais "profissional" para editoriais) — máscara de baixo para cima, máscara lateral, cortina (vertical/horizontal/diagonal), wipe, íris circular, reveal por blocos.
3. **Movimento** — slide com blur de movimento, drift (flutuação leve contínua), parallax (camadas em velocidades diferentes no scroll), push (um elemento empurra o outro), desdobrar/fold, zoom com profundidade.
4. **3D** — flip 3D (eixo X/Y com perspectiva), rotação em perspectiva, tilt (inclinação no hover), fold 3D (abre como aba).
5. **Ênfase** — pulse, bounce suave, spotlight (resto escurece, alvo em foco), glow discreto, shake leve.
6. **Texto** — linha por linha com máscara, palavra por palavra, letra por letra, blur reveal, cascata elástica, decode/scramble, typewriter com cursor, sublinhado desenhado, marca-texto desenhado.
7. **Números e dados** — count-up (prefixo, sufixo, casas decimais, separador de milhar: 0 → 38%, 0 → R$ 2,4 mi, 0 → 1.250), incremento segmentado (símbolo, valor e complemento animam separados), barra/círculo de progresso junto com o número.
8. **Saída** — fade out, slide out, mask out, collapse, shrink out, exit blur, dissolve.

## Divisão e ordem
- **Animar por:** elemento inteiro, linha, palavra, letra, grupo, item de lista, coluna, bloco, camada.
- **Ordem:** do início para o fim, do fim para o início, do centro para fora, das bordas para o centro, aleatório, em sequência, com overlap.

## O que deixa profissional
1. Menos força, mais precisão — movimento curto e elegante.
2. Ritmo — sequência com boa cadência.
3. Hierarquia — título, depois subtítulo, depois imagem, detalhes por último.
4. Máscara é mais sofisticada do que simplesmente aparecer.
5. Blur e escala sutis.
6. Overlap deixa vivo — uma animação começa antes da outra terminar.
7. Saídas importam tanto quanto entradas.
8. Cada conteúdo pede um efeito: texto → máscara/blur/cascata · imagem → reveal/zoom/slide/parallax · número → count-up · CTA → pulse/ênfase suave · bloco grande → cortina/wipe/reveal.

## O sistema precisa ter
Entrada, saída, ênfase, texto, números, reveal por máscara, movimento, 3D, ajustes finos por efeito, prévia em tempo real, gatilhos diferentes, sequência e divisão por linha/palavra/letra/grupo.
