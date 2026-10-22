'use client'
/** Aceitar um convite para o espaço (depois do login). Ao aceitar, o espaço convidado vira o ativo. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { dados, mensagemDeErro, useDados, type InfoConvite } from '@/lib/dados'
import { Botao, Carregando, Cartao } from '@/components/ui'
import { Grade, PaginaPainel } from './Layout'

export function AceitarConvite({ token }: { token: string }) {
  const [info, setInfo] = useState<InfoConvite | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aceitando, setAceitando] = useState(false)
  const usuario = useDados((e) => e.usuario)

  useEffect(() => {
    let vivo = true
    dados.convites.obter(token).then((i) => { if (vivo) setInfo(i) }, (e) => { if (vivo) setErro(mensagemDeErro(e, 'Não foi possível abrir o convite.')) })
    return () => { vivo = false }
  }, [token])

  const aceitar = async () => {
    setAceitando(true)
    setErro(null)
    try {
      const r = await dados.convites.aceitar(token)
      // recarrega o app inteiro no espaço novo (os dados em cache eram do espaço anterior)
      window.location.assign(r.projetoId ? `/app/projects/${r.projetoId}/edit` : '/app')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível aceitar o convite.'))
      setAceitando(false)
    }
  }

  return (
    <PaginaPainel>
      {/* um cartão centralizado no grid: 6 colunas no tablet e no xl */}
      <Grade>
        <Cartao className="col-span-4 p-8 text-center sm:col-span-6 sm:col-start-2 xl:col-span-6 xl:col-start-4">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-acento/10 text-acento"><Users className="h-6 w-6" /></div>
          {!info && !erro && <div className="flex justify-center"><Carregando texto="Abrindo o convite…" /></div>}
          {info?.estado === 'invalido' && (
            <>
              <h1 className="text-2xl font-medium">Este convite não vale mais</h1>
              <p className="mt-2 text-[14px] text-texto2">Ele pode ter expirado, sido revogado ou já usado. Peça um novo convite a quem administra o espaço.</p>
            </>
          )}
          {info?.estado === 'outro_email' && (
            <>
              <h1 className="text-2xl font-medium">Este convite é para outra conta</h1>
              <p className="mt-2 text-[14px] text-texto2">Ele foi enviado para {info.emailConvidado}, e você entrou como {usuario.email}. Saia e entre com a conta convidada.</p>
            </>
          )}
          {info?.estado === 'valido' && (
            <>
              <h1 className="text-2xl font-medium">{info.convidadoPor} convidou você para {info.workspaceNome}</h1>
              <p className="mt-2 text-[14px] text-texto2">{info.papel === 'editor' ? 'Você vai poder editar os projetos do espaço, ao mesmo tempo que a equipe.' : 'Você vai poder ver os projetos do espaço e acompanhar a edição.'}{info.jaMembro ? ' Você já faz parte deste espaço.' : ''}</p>
              <Botao className="mt-6" tamanho="lg" carregando={aceitando} onClick={() => void aceitar()}>{info.jaMembro ? 'Abrir o espaço' : 'Aceitar convite'}</Botao>
            </>
          )}
          {erro && <p role="alert" className="mt-4 text-[13px] text-perigo">{erro}</p>}
          <p className="mt-8 text-[13px]"><Link href="/app" className="text-texto2 underline">Voltar ao meu espaço</Link></p>
        </Cartao>
      </Grade>
    </PaginaPainel>
  )
}
