# ADR 0004 — Renderizador de cena compartilhado

**Status:** aceito · **Data:** 2026-10-21

## Decisão
Um único componente, `components/renderer/SceneRenderer.tsx`, renderiza cenas para o editor (modo `editor`), miniaturas (`miniatura`), preview e visualizador (`viewer`). Camadas são `div`s posicionadas nas coordenadas de referência da cena dentro de um contêiner com `transform: scale(escala)`; assim tipografia, raios e sombras são idênticos em qualquer tamanho (reprodutibilidade, seção 2.1).

O comportamento interativo vive em `lib/scene/motor.ts` (reducer puro) e as animações no catálogo de keyframes de `app/globals.css`. `prefers-reduced-motion` troca qualquer animação por fade de 150 ms (`adaptarAnimacao`).

## Por que não canvas
Texto real (seleção, leitores de tela), vídeo nativo, foco por teclado nos hotspots (`role=button`, `aria-label`) e custo baixo de implementação. Efeitos 3D/física ficam para a Fase 2 e, se vierem, podem ser camadas específicas sem trocar a base.

## Responsividade (MVP)
Escala proporcional + `contain/cover` por camada e ajustes simples para celular (`mobile.fit`, `mobile.hidden`). Breakpoints com layouts distintos: Fase 2.
