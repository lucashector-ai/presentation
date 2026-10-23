'use client'
import { useState } from 'react'
import { CheckCircle2, UploadCloud } from 'lucide-react'
import { dados, mensagemDeErro, useDados } from '@/lib/dados'
import { Botao, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

/**
 * Estado de publicação fora do editor (página de compartilhar, detalhes): permite publicar ali mesmo,
 * em vez de mandar a pessoa de volta ao editor só para apertar "Publicar".
 */
export function BarraPublicacao({ projetoId, className }: { projetoId: string; className?: string }) {
  const projeto = useDados((e) => e.projetos.find((p) => p.id === projetoId && !p.excluidoEm))
  const { mostrar } = useToast()
  const [publicando, setPublicando] = useState(false)
  if (!projeto) return null
  const nunca = projeto.revisaoPublicada == null
  const pendente = !nunca && projeto.revisaoAtual > (projeto.revisaoPublicada ?? 0)
  const publicarAgora = async () => {
    setPublicando(true)
    try {
      const r = await dados.publicar(projeto.id, projeto.revisaoAtual)
      mostrar(nunca ? `Revisão ${r.publishedRevision} publicada. Agora gere o link para o cliente.` : `Revisão ${r.publishedRevision} publicada. Quem tem o link já vê a versão nova.`, 'sucesso')
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível publicar.'), 'erro')
    } finally {
      setPublicando(false)
    }
  }
  return (
    <div role="status" className={cx('flex min-h-14 flex-wrap items-center gap-4 rounded-cartao border px-4 py-2 text-[13px]', nunca || pendente ? 'border-tinta bg-superficie' : 'border-borda bg-superficie', className)}>
      {nunca || pendente ? <UploadCloud className="h-4 w-4 shrink-0 text-acento" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-sucesso" />}
      <span className="min-w-0 flex-1">
        {nunca ? 'Ainda não publicado. Publique para congelar uma revisão e poder gerar links.' : pendente ? `O cliente vê a revisão ${projeto.revisaoPublicada}; o rascunho está na ${projeto.revisaoAtual}.` : `Revisão ${projeto.revisaoPublicada} publicada e atualizada.`}
      </span>
      {(nunca || pendente) && <Botao tamanho="sm" carregando={publicando} onClick={() => void publicarAgora()}>{nunca ? 'Publicar agora' : 'Publicar ajustes'}</Botao>}
    </div>
  )
}
