import type * as React from 'react'

/** Web component do @google/model-viewer (camadas 3D). Atributos são passados como strings. */
// React 19: os elementos intrínsecos vivem em React.JSX (não há mais JSX global), então aumentamos o módulo.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { [atributo: string]: unknown }
    }
  }
}
export {}
