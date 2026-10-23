import { grafoJsonLd, serializarJsonLd, type JsonLd as No } from '@/lib/seo'

/** Dados estruturados da página: um <script type="application/ld+json"> com todos os nós em @graph (lib/seo.ts). */
export function JsonLd({ nos }: { nos: No[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(grafoJsonLd(nos)) }} />
}
