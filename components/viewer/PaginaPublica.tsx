'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { dados, mensagemDeErro, type ResolucaoLink } from '@/lib/dados'
import { tokenValido } from '@/lib/share/token'
import { Botao, Entrada, Logo } from '@/components/ui'
import { Viewer } from './Viewer'

/** /p/:token — visualizador público não listado (Fluxo C). Nunca revela se o link existe, expirou ou foi revogado. */
export function PaginaPublica({ token }: { token: string }) {
  const [res, setRes] = useState<ResolucaoLink | null>(null)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [falhaRede, setFalhaRede] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // muda depois de desbloquear (o acesso fica no cookie/grant) ou ao tentar de novo: resolve o link outra vez
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    if (!tokenValido(token) && !token.startsWith('demo_')) { setRes({ state: 'unavailable' }); return }
    setFalhaRede(null)
    dados.resolverToken(token).then(
      (r) => ativo && setRes(r),
      (e) => {
        if (!ativo) return
        // sem conexão/erro do servidor: não dizer que o link "não existe"; oferece tentar de novo
        if ((e as { code?: string } | null)?.code === 'sem_conexao' || (e as { code?: string } | null)?.code === 'erro_interno') setFalhaRede(mensagemDeErro(e, 'Não foi possível abrir a apresentação agora.'))
        else setRes({ state: 'unavailable' })
      }
    )
    return () => { ativo = false }
  }, [token, tentativa])

  if (falhaRede && !res) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-fundo p-6 text-center" role="alert">
        <Logo />
        <p className="max-w-sm text-[15px] leading-normal text-texto2">{falhaRede}</p>
        <Botao onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>
      </main>
    )
  }

  if (!res) return <div className="flex h-dvh items-center justify-center bg-[#111] text-sm text-white/60" role="status">Carregando…</div>

  if (res.state === 'unavailable') {
    return (
      <main className="relative flex h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-fundo p-6 text-center">
        <Formas />
        <Logo />
        <h1 className="titulo-display max-w-[14ch] text-balance text-[clamp(32px,5vw,52px)] font-semibold leading-[0.98] tracking-[-0.045em]">Este link não está mais disponível.</h1>
        <p className="max-w-sm text-[15px] leading-normal text-texto2">Peça um novo link a quem compartilhou a apresentação com você.</p>
      </main>
    )
  }

  if (res.state === 'locked') {
    const enviar = async (e: FormEvent) => {
      e.preventDefault()
      setEnviando(true)
      setErro(null)
      try {
        const r = await dados.desbloquear(token, senha)
        if (r.ok) setTentativa((n) => n + 1)
        else setErro(r.bloqueado ? 'Muitas tentativas. Aguarde alguns minutos.' : `Senha incorreta. Tente novamente.${r.restantes <= 2 ? ` (${r.restantes} tentativa(s) restante(s))` : ''}`)
      } catch (err) {
        setErro(mensagemDeErro(err, 'Não foi possível verificar.'))
      } finally {
        setEnviando(false)
      }
    }
    return (
      <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-fundo p-5">
        <Formas />
        <form onSubmit={enviar} className="relative w-full max-w-sm rounded-[18px] border-2 border-grafite bg-superficie p-6 shadow-[8px_8px_0_#171717] sm:p-8">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-acento text-white"><Lock className="h-[18px] w-[18px]" /></div>
          <div className="rotulo-mono mb-1">Apresentação protegida</div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">{res.projectName}</h1>
          <p className="mb-4 mt-1 text-sm text-texto2">Digite a senha que você recebeu de quem compartilhou.</p>
          <Entrada type="password" autoFocus autoComplete="off" aria-label="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-12 text-base" />
          {erro && <p role="alert" className="mt-2 text-sm text-perigo">{erro}</p>}
          <Botao type="submit" tamanho="lg" className="mt-4 w-full" carregando={enviando} disabled={!senha}>Abrir apresentação</Botao>
        </form>
      </main>
    )
  }

  return (
    <div className="h-dvh w-full bg-black">
      <Viewer documento={res.documento} assets={res.assets} nome={res.projectName} marca={res.marca} />
    </div>
  )
}

/** Formas decorativas da marca (só visual). */
function Formas() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
      <div className="absolute left-[8%] top-[14%] h-20 w-20 rounded-full bg-coral" />
      <div className="absolute right-[9%] top-[18%] h-16 w-16 rotate-[18deg] bg-violeta" />
      <div className="absolute bottom-[14%] right-[12%] h-[50px] w-[100px] rounded-t-full bg-ipe" />
      <div className="absolute bottom-[12%] left-[10%] h-[54px] w-[54px] rotate-[-14deg] bg-lima [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
    </div>
  )
}
