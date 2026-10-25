'use client'
/**
 * Fotos do feed do Instagram (seção Mockup): foto do perfil, capas dos destaques e os 9 posts no mesmo arranjo
 * do celular. Clicar num lugar o escolhe; embaixo, as imagens do espaço (ou enviar do computador) entram nele.
 * A foto de um post vai para a célula da grade e para o post em destaque (o que abre ao clicar nele).
 */
import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { Camada } from '@/lib/scene/schema'
import { descendentes } from '@/lib/scene/arvore'
import { fotosDoFeed, type FotoFeed } from '@/lib/editor/feedFotos'
import { aplicarFotoNoFeed } from '@/lib/editor/importar'
import type { Editor } from '@/lib/editor/useEditor'
import { cx } from '@/components/ui'
import { BotaoMini } from './campos'
import { CampoTexto, LinhaCampos } from './controles'
import { EnviarImagem } from './EnviarImagem'
import { useInspetor } from './contexto'

export function FotosDoFeed({ editor, raizId, inicial = 'post-1' }: { editor: Editor; raizId: string; inicial?: string }) {
  const { imagens } = useInspetor()
  const camadas = editor.cena?.layers ?? []
  const fotos = fotosDoFeed(raizId, camadas)
  const [chave, setChave] = useState(inicial)
  const ativa = fotos.find((f) => f.chave === chave) ?? fotos[0]
  if (!ativa) return null
  const url = (id?: string) => (id ? imagens.find((i) => i.id === id)?.url : undefined)
  const porFoto = (assetId: string | null) => aplicarFotoNoFeed(editor, raizId, ativa.lugar, assetId)
  const redondas = fotos.filter((f) => f.lugar.tipo !== 'post')
  const posts = fotos.filter((f) => f.lugar.tipo === 'post')
  const rotuloDestaque = ativa.lugar.tipo === 'destaque' ? descendentes(raizId, camadas).find((c): c is Extract<Camada, { type: 'text' }> => c.type === 'text' && c.name === `Rótulo do destaque ${(ativa.lugar as { i: number }).i}`) : undefined

  const lugar = (f: FotoFeed, redondo: boolean) => {
    const u = url(f.assetId)
    return (
      <button
        key={f.chave}
        type="button"
        title={f.rotulo}
        aria-label={`Escolher foto: ${f.rotulo}`}
        aria-pressed={f.chave === ativa.chave}
        onClick={() => setChave(f.chave)}
        className={cx('relative shrink-0 overflow-hidden bg-superficie2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-acento', redondo ? 'h-6 w-6 rounded-full' : 'aspect-square w-full rounded-[3px]', f.chave === ativa.chave ? 'ring-2 ring-acento ring-offset-1 ring-offset-superficie' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)] hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,.24)]')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {u ? <img src={u} alt="" className="h-full w-full object-cover" draggable={false} /> : <span className="block h-full w-full bg-[linear-gradient(135deg,#DCE3DA,#B5D8C2)] opacity-60" />}
      </button>
    )
  }

  return (
    <div className="space-y-1.5 pt-1">
      <LinhaCampos rotulo="Perfil">
        <div className="flex items-center gap-1.5">{redondas.map((f) => lugar(f, true))}</div>
      </LinhaCampos>
      <LinhaCampos rotulo="Posts">
        <div className="grid w-[116px] grid-cols-3 gap-1">{posts.map((f) => lugar(f, false))}</div>
      </LinhaCampos>
      <div className="space-y-1 rounded-md bg-superficie2/60 p-1.5">
        <div className="flex h-6 items-center justify-between gap-1">
          <span className="truncate text-[11px] font-medium text-texto">{ativa.rotulo}</span>
          {ativa.assetId && <BotaoMini rotulo="Tirar a foto" onClick={() => porFoto(null)}><ImageOff /></BotaoMini>}
        </div>
        {rotuloDestaque && <CampoTexto rotulo="Nome do destaque" valor={rotuloDestaque.text} aoConfirmar={(v) => editor.acoes.atualizarCamadas([rotuloDestaque.id], { text: v } as Partial<Camada>)} />}
        {imagens.length > 0 && (
          <div role="radiogroup" aria-label={`Imagem para ${ativa.rotulo}`} className="grid max-h-[104px] grid-cols-6 gap-1 overflow-y-auto rolagem-fina">
            {imagens.map((im) => (
              <button key={im.id} type="button" role="radio" aria-checked={ativa.assetId === im.id} title={im.nome} aria-label={im.nome} onClick={() => porFoto(im.id)} className={cx('aspect-square overflow-hidden rounded-[3px] bg-superficie outline-none focus-visible:ring-2 focus-visible:ring-acento', ativa.assetId === im.id ? 'ring-2 ring-acento' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)] hover:opacity-80')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="h-full w-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        )}
        <EnviarImagem largo aoEnviada={(id) => porFoto(id)} />
      </div>
    </div>
  )
}
