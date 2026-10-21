import type * as React from 'react'

/** Web component do @google/model-viewer (camadas 3D). Atributos são passados como strings. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { [atributo: string]: unknown }
    }
  }
}
export {}
