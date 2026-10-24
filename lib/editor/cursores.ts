/**
 * Cursores do Mostra (sistema "Mostra / Cursores"): traço de 2px #171717, halo branco, sombra leve, cores da marca.
 * Grade 32×32 (viewBox -2 -2 36 36). Desenhados em 24 px (compacto, como os do Figma), ponta/centro como hotspot.
 * Setas de redimensionar e de girar aceitam um ângulo e ficam em cache por passo de 5° (trocar a URL a cada
 * quadro custa um recálculo de estilo).
 */
const SOMBRA = '<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation=".7" flood-color="#000" flood-opacity=".28"/></filter></defs>'

const DESENHOS = {
  pointer: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z"/></g><g fill="#D7F25C" stroke="#171717" stroke-width="2"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z"/></g></g>`,
  grab: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M8.6 17.5v-5.8a1.7 1.7 0 0 1 3.4 0v-3a1.7 1.7 0 0 1 3.4 0v.5a1.7 1.7 0 0 1 3.4 0v3a1.7 1.7 0 0 1 3.4 0v9.3a5.5 5.5 0 0 1-5.5 5.5H14a6 6 0 0 1-4.7-2.3l-3.9-5.3a1.9 1.9 0 0 1 2.9-2.5Z"/></g><g fill="#D7F25C" stroke="#171717" stroke-width="2"><path d="M8.6 17.5v-5.8a1.7 1.7 0 0 1 3.4 0v-3a1.7 1.7 0 0 1 3.4 0v.5a1.7 1.7 0 0 1 3.4 0v3a1.7 1.7 0 0 1 3.4 0v9.3a5.5 5.5 0 0 1-5.5 5.5H14a6 6 0 0 1-4.7-2.3l-3.9-5.3a1.9 1.9 0 0 1 2.9-2.5Z"/></g><g fill="none" stroke="#171717" stroke-width="1.7"><path d="M12 11.7v4.3M15.4 9.2v6.8M18.8 12.2v3.8"/></g></g>`,
  grabbing: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M8.6 18v-3a1.7 1.7 0 0 1 3.4 0a1.7 1.7 0 0 1 3.4 0a1.7 1.7 0 0 1 3.4 0a1.7 1.7 0 0 1 3.4 0V22a5 5 0 0 1-5 5H14a6 6 0 0 1-4.6-2.2L6.6 21a1.8 1.8 0 0 1 2-2.9Z"/></g><g fill="#AEB4FA" stroke="#171717" stroke-width="2"><path d="M8.6 18v-3a1.7 1.7 0 0 1 3.4 0a1.7 1.7 0 0 1 3.4 0a1.7 1.7 0 0 1 3.4 0a1.7 1.7 0 0 1 3.4 0V22a5 5 0 0 1-5 5H14a6 6 0 0 1-4.6-2.2L6.6 21a1.8 1.8 0 0 1 2-2.9Z"/></g><g fill="none" stroke="#171717" stroke-width="1.7"><path d="M12 15v2.4M15.4 15v2.4M18.8 15v2.4"/></g></g>`,
  text: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="none" stroke="#FFFFFF" stroke-width="6"><path d="M16 8v16M12 6.5c2.2 0 4 .6 4 2.5 0-1.9 1.8-2.5 4-2.5M12 25.5c2.2 0 4-.6 4-2.5 0 1.9 1.8 2.5 4 2.5"/></g><g fill="none" stroke="#171717" stroke-width="2.2"><path d="M16 8v16M12 6.5c2.2 0 4 .6 4 2.5 0-1.9 1.8-2.5 4-2.5M12 25.5c2.2 0 4-.6 4-2.5 0 1.9 1.8 2.5 4 2.5"/></g></g>`,
  crosshair: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="none" stroke="#FFFFFF" stroke-width="6"><path d="M16 4.5v7M16 20.5v7M4.5 16h7M20.5 16h7"/></g><g fill="none" stroke="#171717" stroke-width="2.2"><path d="M16 4.5v7M16 20.5v7M4.5 16h7M20.5 16h7"/></g><circle cx="16" cy="16" r="2" fill="#5965F2" stroke="none"/></g>`,
  pen: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M6.4 7.6c-.4-1.2.6-2.2 1.8-1.8l10.2 3.3c.6.2 1 .6 1.2 1.2l1.6 5.6 3.5 3.5c.6.6.6 1.5 0 2.1l-2.4 2.4c-.6.6-1.5.6-2.1 0l-3.5-3.5-5.6-1.6c-.6-.2-1-.6-1.2-1.2Z"/></g><g fill="#D7F25C" stroke="#171717" stroke-width="2"><path d="M6.4 7.6c-.4-1.2.6-2.2 1.8-1.8l10.2 3.3c.6.2 1 .6 1.2 1.2l1.6 5.6 3.5 3.5c.6.6.6 1.5 0 2.1l-2.4 2.4c-.6.6-1.5.6-2.1 0l-3.5-3.5-5.6-1.6c-.6-.2-1-.6-1.2-1.2Z"/></g><g fill="none" stroke="#171717" stroke-width="1.7"><path d="M7.4 7.4l5.4 5.4"/></g><circle cx="14" cy="14" r="1.9" fill="#171717" stroke="none"/></g>`,
  zoomIn: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><circle cx="13.5" cy="13.5" r="8"/><rect x="18.5" y="21.9" width="11" height="4.2" rx="2.1" transform="rotate(45 24 24)"/></g><g fill="#FFA78C" stroke="#171717" stroke-width="2"><circle cx="13.5" cy="13.5" r="8"/><rect x="18.5" y="21.9" width="11" height="4.2" rx="2.1" transform="rotate(45 24 24)"/></g><g fill="none" stroke="#171717" stroke-width="1.7"><path d="M13.5 10v7M10 13.5h7"/></g></g>`,
  zoomOut: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><circle cx="13.5" cy="13.5" r="8"/><rect x="18.5" y="21.9" width="11" height="4.2" rx="2.1" transform="rotate(45 24 24)"/></g><g fill="#DDE0FD" stroke="#171717" stroke-width="2"><circle cx="13.5" cy="13.5" r="8"/><rect x="18.5" y="21.9" width="11" height="4.2" rx="2.1" transform="rotate(45 24 24)"/></g><g fill="none" stroke="#171717" stroke-width="1.7"><path d="M10 13.5h7"/></g></g>`,
  notAllowed: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><g fill="#FFA78C" stroke="#171717" stroke-width="2"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><circle cx="22.5" cy="22.5" r="6.6" fill="#FF7A59" stroke="#FFFFFF" stroke-width="4"/><circle cx="22.5" cy="22.5" r="6.6" fill="#FF7A59" stroke="#171717" stroke-width="2"/><path d="M20 25l5-5" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22.5" cy="22.5" r="3.6" fill="none" stroke="#FFFFFF" stroke-width="1.7"/></g>`,
  duplicate: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="translate(9 9) scale(.66)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3"/></g><g transform="translate(-1 -1) scale(.72)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="2.8"/></g></g><g fill="#D7F25C" stroke="#171717" stroke-width="2"><g transform="translate(9 9) scale(.66)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3"/></g><g transform="translate(-1 -1) scale(.72)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="2.8"/></g></g></g>`,
  copy: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><g fill="#D7F25C" stroke="#171717" stroke-width="2"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><circle cx="22.5" cy="22.5" r="6.6" fill="#D7F25C" stroke="#FFFFFF" stroke-width="4"/><circle cx="22.5" cy="22.5" r="6.6" fill="#D7F25C" stroke="#171717" stroke-width="2"/><path d="M22.5 19.6v5.8M19.6 22.5h5.8" fill="none" stroke="#171717" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  link: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M12 18V6.5a2 2 0 0 1 4 0V13a1.8 1.8 0 0 1 3.6 0v.8a1.8 1.8 0 0 1 3.6 0V15a1.6 1.6 0 0 1 3.2 0v6.5a5.5 5.5 0 0 1-5.5 5.5h-3.4a6 6 0 0 1-4.7-2.3L7.6 19a1.9 1.9 0 0 1 2.9-2.5Z"/></g><g fill="#DDE0FD" stroke="#171717" stroke-width="2"><path d="M12 18V6.5a2 2 0 0 1 4 0V13a1.8 1.8 0 0 1 3.6 0v.8a1.8 1.8 0 0 1 3.6 0V15a1.6 1.6 0 0 1 3.2 0v6.5a5.5 5.5 0 0 1-5.5 5.5h-3.4a6 6 0 0 1-4.7-2.3L7.6 19a1.9 1.9 0 0 1 2.9-2.5Z"/></g><g fill="none" stroke="#171717" stroke-width="1.7"><path d="M16 13v2.4M19.6 13.8v2M23.2 15v2"/></g></g>`,
  eyedropper: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><rect x="16.5" y="4" width="7" height="12" rx="3.5" transform="rotate(45 20 10)"/></g><g fill="none" stroke="#FFFFFF" stroke-width="6"><path d="M7.5 24.5L17.5 14.5"/></g><g fill="#DDE0FD" stroke="#171717" stroke-width="2"><rect x="16.5" y="4" width="7" height="12" rx="3.5" transform="rotate(45 20 10)"/></g><g fill="none" stroke="#171717" stroke-width="2.2"><path d="M7.5 24.5L17.5 14.5"/></g></g>`,
  move: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M16 3.5l3.6 4.2h-7.2Z M16 28.5l3.6-4.2h-7.2Z M3.5 16l4.2-3.6v7.2Z M28.5 16l-4.2-3.6v7.2Z"/></g><g fill="none" stroke="#FFFFFF" stroke-width="6"><path d="M16 8v16M8 16h16"/></g><g fill="none" stroke="#171717" stroke-width="2.2"><path d="M16 8v16M8 16h16"/></g><g fill="#171717" stroke="#171717" stroke-width="2"><path d="M16 3.5l3.6 4.2h-7.2Z M16 28.5l3.6-4.2h-7.2Z M3.5 16l4.2-3.6v7.2Z M28.5 16l-4.2-3.6v7.2Z"/></g></g>`,
  seta: (a = 0) => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="rotate(${a} 16 16)"><path d="M4.5 16l4.6-4v8Z M27.5 16l-4.6-4v8Z"/></g></g><g fill="none" stroke="#FFFFFF" stroke-width="6"><g transform="rotate(${a} 16 16)"><path d="M8.5 16h15"/></g></g><g fill="none" stroke="#171717" stroke-width="2.2"><g transform="rotate(${a} 16 16)"><path d="M8.5 16h15"/></g></g><g fill="#171717" stroke="#171717" stroke-width="2"><g transform="rotate(${a} 16 16)"><path d="M4.5 16l4.6-4v8Z M27.5 16l-4.6-4v8Z"/></g></g></g>`,
  girar: (a = 0) => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="rotate(${a} 16 16)"><path d="M27 10.5l-5.4-4.6v9.2Z M8.5 27l-4.6-5.4h9.2Z"/></g></g><g fill="none" stroke="#FFFFFF" stroke-width="6"><g transform="rotate(${a} 16 16)"><path d="M8.5 21.5v-2.5c0-5 3.5-8.5 8.5-8.5h4"/></g></g><g fill="none" stroke="#171717" stroke-width="2.2"><g transform="rotate(${a} 16 16)"><path d="M8.5 21.5v-2.5c0-5 3.5-8.5 8.5-8.5h4"/></g></g><g fill="#171717" stroke="#171717" stroke-width="2"><g transform="rotate(${a} 16 16)"><path d="M27 10.5l-5.4-4.6v9.2Z M8.5 27l-4.6-5.4h9.2Z"/></g></g></g>`,
  colResize: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M4.5 16l4.6-4v8Z M27.5 16l-4.6-4v8Z"/></g><g fill="none" stroke="#FFFFFF" stroke-width="6"><path d="M16 7v18M9.5 16h2.5M20 16h2.5"/></g><g fill="none" stroke="#171717" stroke-width="2.2"><path d="M16 7v18M9.5 16h2.5M20 16h2.5"/></g><g fill="#171717" stroke="#171717" stroke-width="2"><path d="M4.5 16l4.6-4v8Z M27.5 16l-4.6-4v8Z"/></g></g>`,
  rowResize: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="rotate(90 16 16)"><path d="M4.5 16l4.6-4v8Z M27.5 16l-4.6-4v8Z"/></g></g><g fill="none" stroke="#FFFFFF" stroke-width="6"><g transform="rotate(90 16 16)"><path d="M16 7v18M9.5 16h2.5M20 16h2.5"/></g></g><g fill="none" stroke="#171717" stroke-width="2.2"><g transform="rotate(90 16 16)"><path d="M16 7v18M9.5 16h2.5M20 16h2.5"/></g></g><g fill="#171717" stroke="#171717" stroke-width="2"><g transform="rotate(90 16 16)"><path d="M4.5 16l4.6-4v8Z M27.5 16l-4.6-4v8Z"/></g></g></g>`,
  progress: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><g fill="#AEB4FA" stroke="#171717" stroke-width="2"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><circle cx="22.5" cy="22.5" r="6.6" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="4"/><circle cx="22.5" cy="22.5" r="6.6" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><path d="M22.5 22.5V17.6a4.9 4.9 0 0 1 4.9 4.9Z M22.5 22.5v4.9a4.9 4.9 0 0 1-4.9-4.9Z" fill="#5965F2" stroke="none"/></g>`,
  wait: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><circle cx="16" cy="16" r="9.5" fill="none" stroke="#FFFFFF" stroke-width="7"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="#171717" stroke-width="3.2"/><path d="M16 6.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" stroke="#5965F2" stroke-width="3.2" stroke-linecap="round"/></g>`,
  help: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><g fill="#AEB4FA" stroke="#171717" stroke-width="2"><g transform="translate(1 1) scale(.62)"><path d="M8.6 6.6c-1.3-.6-2.6.7-2 2l6.3 15.7c.5 1.3 2.4 1.3 2.8-.1l1.8-5.7c.2-.6.6-1 1.2-1.2l5.7-1.8c1.4-.4 1.4-2.3.1-2.8Z" stroke-width="3.2"/></g></g><circle cx="22.5" cy="22.5" r="6.6" fill="#5965F2" stroke="#FFFFFF" stroke-width="4"/><circle cx="22.5" cy="22.5" r="6.6" fill="#5965F2" stroke="#171717" stroke-width="2"/><path d="M20.6 21a2 2 0 1 1 2.8 1.8c-.6.3-.9.7-.9 1.3" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22.5" cy="26.3" r="1" fill="#FFFFFF" stroke="none"/></g>`,
  cell: () => `<g filter="url(#sh)" stroke-linejoin="round" stroke-linecap="round"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5.5"><path d="M13.5 5.5h5v8h8v5h-8v8h-5v-8h-8v-5h8Z"/></g><g fill="#AEB4FA" stroke="#171717" stroke-width="2"><path d="M13.5 5.5h5v8h8v5h-8v8h-5v-8h-8v-5h8Z"/></g></g>`,
} satisfies Record<string, (a?: number) => string>

export type NomeCursor = keyof typeof DESENHOS

/** Hotspot no grid de 32: ponteiros na ponta (7,7); mão do link no dedo (14,5); o resto no centro. */
const PONTA: Partial<Record<NomeCursor, [number, number]>> = { pointer: [7, 7], copy: [5, 5], notAllowed: [5, 5], progress: [5, 5], help: [5, 5], duplicate: [5, 5], link: [14, 5], pen: [7, 7], eyedropper: [8, 24], zoomIn: [13.5, 13.5], zoomOut: [13.5, 13.5] }
const RESERVA: Record<NomeCursor, string> = { pointer: 'default', grab: 'grab', grabbing: 'grabbing', text: 'text', crosshair: 'crosshair', pen: 'crosshair', zoomIn: 'zoom-in', zoomOut: 'zoom-out', notAllowed: 'not-allowed', duplicate: 'copy', copy: 'copy', link: 'pointer', eyedropper: 'crosshair', move: 'move', seta: 'ew-resize', girar: 'grab', colResize: 'col-resize', rowResize: 'row-resize', progress: 'progress', wait: 'wait', help: 'help', cell: 'cell' }

const TAMANHO = 24
/** Data URL enxuta: aspas simples e só os caracteres que precisam de escape (metade do tamanho de encodeURIComponent). */
const svgEmUrl = (svg: string) => svg.replace(/"/g, "'").replace(/[%#<>]/g, (c) => encodeURIComponent(c))
const cache = new Map<string, string>()

/** Valor CSS de `cursor` para um cursor do Mostra. `angulo` (graus, horário) gira as setas e o cursor de girar. */
export function cursorMostra(nome: NomeCursor, angulo = 0): string {
  const a = nome === 'seta' ? ((Math.round(angulo / 5) * 5) % 180 + 180) % 180 : nome === 'girar' ? ((Math.round(angulo / 5) * 5) % 360 + 360) % 360 : 0
  const chave = `${nome}:${a}`
  const pronto = cache.get(chave)
  if (pronto) return pronto
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANHO}" height="${TAMANHO}" viewBox="-2 -2 36 36">${SOMBRA}${DESENHOS[nome](a)}</svg>`
  const [px, py] = PONTA[nome] ?? [16, 16]
  const escala = TAMANHO / 36
  const valor = `url("data:image/svg+xml,${svgEmUrl(svg)}") ${Math.round((px + 2) * escala)} ${Math.round((py + 2) * escala)}, ${RESERVA[nome]}`
  cache.set(chave, valor)
  return valor
}

/**
 * Variáveis CSS (`--cursor-<nome>`) com os cursores do Mostra para o site inteiro: o Tailwind (`cursor-*`) e os
 * estilos base de app/globals.css apontam para elas. Gerado por `npm run cursores` (o teste confere que está em dia).
 */
export const VARIAVEIS_CURSOR: Record<string, string> = {
  default: cursorMostra('pointer'),
  pointer: cursorMostra('link'),
  text: cursorMostra('text'),
  grab: cursorMostra('grab'),
  grabbing: cursorMostra('grabbing'),
  move: cursorMostra('move'),
  crosshair: cursorMostra('crosshair'),
  copy: cursorMostra('copy'),
  'not-allowed': cursorMostra('notAllowed'),
  'zoom-in': cursorMostra('zoomIn'),
  'zoom-out': cursorMostra('zoomOut'),
  help: cursorMostra('help'),
  progress: cursorMostra('progress'),
  wait: cursorMostra('wait'),
  cell: cursorMostra('cell'),
  'ew-resize': cursorMostra('seta', 0),
  'ns-resize': cursorMostra('seta', 90),
  'nwse-resize': cursorMostra('seta', 45),
  'nesw-resize': cursorMostra('seta', 135),
  'col-resize': cursorMostra('colResize'),
  'row-resize': cursorMostra('rowResize'),
}

export function cssCursores(): string {
  const vars = Object.entries(VARIAVEIS_CURSOR).map(([k, v]) => `  --cursor-${k}: ${v};`).join('\n')
  return `/* Gerado por \`npm run cursores\` a partir de lib/editor/cursores.ts — não edite à mão. */
:root {
${vars}
}
`
}
