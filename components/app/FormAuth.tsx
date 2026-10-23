'use client'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { carregarAuth, entrar, MODO_DEMO } from '@/lib/sessao'
import { dados } from '@/lib/dados'
import { PLANOS } from '@/lib/planos'
import { textoTelas } from '@/lib/telasIa'
import { Botao, Campo, Entrada, cx } from '@/components/ui'
import { Marca, TAMANHO_MARCA } from '@/components/ui/Logo'

const EMAIL_DEMO = 'demo@mostra.app'

const COPIA = {
  login: { titulo: 'Bem-vindo de volta.', subtitulo: 'Entre para continuar seus projetos.', cta: 'Entrar', troca: 'Ainda não tem conta?', trocaLink: 'Criar conta', trocaHref: '/signup' },
  signup: { titulo: 'Crie sua conta.', subtitulo: `Três projetos e ${PLANOS.free.creditos.quantidade} créditos de IA grátis (${textoTelas(PLANOS.free.creditos.quantidade)}). Sem cartão.`, cta: 'Criar conta', troca: 'Já tem conta?', trocaLink: 'Entrar', trocaHref: '/login' },
  recuperar: { titulo: 'Recuperar senha.', subtitulo: 'Informe seu e-mail e enviaremos um link para redefinir.', cta: 'Enviar link', troca: 'Lembrou a senha?', trocaLink: 'Voltar ao login', trocaHref: '/login' },
} as const

/** Erros do Neon Auth em português (o SDK só é baixado no modo real). */
const mensagemErro = async (e: unknown) => (await import('@/lib/auth/cliente')).mensagemErroAuth(e)

export function FormAuth({ modo }: { modo: 'login' | 'signup' }) {
  const router = useRouter()
  const params = useSearchParams()
  const recuperar = params.get('recuperar') === '1'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [verificar, setVerificar] = useState(false)
  const idSenha = useId()
  const c = COPIA[recuperar ? 'recuperar' : modo]
  // volta para onde a pessoa estava (ex.: /criar com o prompt da landing); só caminhos internos
  const proximo = params.get('proximo')
  const destino = proximo && proximo.startsWith('/') && !proximo.startsWith('//') && !proximo.startsWith('/\\') ? proximo : '/app'

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErro('Informe um e-mail válido.')
    if (!recuperar && senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    setEnviando(true)
    if (!MODO_DEMO) return enviarReal()
    await new Promise((r) => setTimeout(r, 400))
    if (recuperar) { setVerificar(true); setEnviando(false); return }
    if (modo === 'signup') { setVerificar(true); setEnviando(false); return }
    entrar(email)
    router.push(destino)
  }

  /** Modo real: Neon Auth (cadastro e login por e-mail e senha; a sessão vira cookie HttpOnly do app). */
  const enviarReal = async () => {
    try {
      const auth = await carregarAuth()
      if (modo === 'signup') {
        const { data, error } = await auth.signUp.email({ email, password: senha, name: nome.trim() || (email.split('@')[0] ?? '') })
        if (error) return setErro(await mensagemErro(error))
        // com verificação de e-mail ligada no Neon Auth, a conta nasce sem sessão até confirmar o código
        if (!data?.token) return setVerificar(true)
        return router.push(destino)
      }
      const { error } = await auth.signIn.email({ email, password: senha })
      if (error) return setErro(await mensagemErro(error))
      router.push(destino)
    } catch (e) {
      setErro(await mensagemErro(e))
    } finally {
      setEnviando(false)
    }
  }

  /** Modo demonstração: Google/Apple entram direto, como o formulário. Modo real: Google pelo Neon Auth. */
  const entrarSocial = async () => {
    if (MODO_DEMO) {
      entrar(email || EMAIL_DEMO)
      router.push(destino)
      return
    }
    setErro(null)
    try {
      const { error } = await (await carregarAuth()).signIn.social({ provider: 'google', callbackURL: new URL(destino, window.location.origin).href })
      if (error) setErro(await mensagemErro(error))
    } catch (e) {
      setErro(await mensagemErro(e))
    }
  }

  if (recuperar && !MODO_DEMO) return <RecuperarSenha />
  if (verificar && !MODO_DEMO) return <ConfirmarEmail email={email} senha={senha} destino={destino} />

  if (verificar) {
    return (
      <div className="flex flex-col gap-7">
        <div>
          <h1 className="m-0 text-[36px] font-medium leading-[1.05] tracking-[-0.045em]">Verifique seu e-mail</h1>
          <p className="mt-2.5 text-[15px] leading-normal text-texto2">
            {recuperar ? 'Se existir uma conta para' : 'Enviamos um link de confirmação para'} <strong className="font-medium text-texto">{email}</strong>
            {recuperar ? ', enviamos um link para redefinir a senha. Ele expira em 30 minutos.' : '.'}
          </p>
        </div>
        <p className="m-0 rounded-lg bg-acentoSuave px-3.5 py-3 text-[13px] leading-normal text-textoCorpo">
          Modo demonstração: nenhum e-mail é enviado. Clique abaixo para continuar como se tivesse confirmado.
        </p>
        <Botao className="h-[46px] w-full" onClick={() => { entrar(email); if (!recuperar) void dados.atualizarPerfil({ nome, email }); router.push(destino) }}>Continuar para o painel</Botao>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="m-0 text-[32px] font-medium leading-[1.05] tracking-[-0.045em] sm:text-[36px]">{c.titulo}</h1>
        <p className="mt-2.5 text-[15px] leading-normal text-texto2">{c.subtitulo}</p>
      </div>

      {!recuperar && (
        <>
          {/* Neon Auth (gerenciado) oferece Google, não Apple: no modo real só o Google aparece */}
          <div className={cx('grid gap-2.5', MODO_DEMO ? 'grid-cols-2' : 'grid-cols-1')}>
            <BotaoSocial rotulo="Google" onClick={entrarSocial} icone={<IconeGoogle />} />
            {MODO_DEMO && <BotaoSocial rotulo="Apple" onClick={entrarSocial} icone={<span className="block h-[13px] w-[11px] rounded-[5px_5px_6px_6px] bg-current" />} />}
          </div>
          <div className="flex items-center gap-3 text-[12px] text-texto3">
            <span aria-hidden className="h-px flex-1 bg-bordaForte" />
            ou com email
            <span aria-hidden className="h-px flex-1 bg-bordaForte" />
          </div>
        </>
      )}

      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        {modo === 'signup' && !recuperar && (
          <Campo rotulo="Nome"><Entrada className="h-12" autoComplete="name" placeholder="Marina Duarte" value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        )}
        <Campo rotulo="E-mail"><Entrada className="h-12" type="email" autoComplete="email" placeholder="voce@estudio.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
        {!recuperar && (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor={idSenha} className="text-[13px] font-medium text-texto">Senha</label>
              {modo === 'login' && <Link href="/login?recuperar=1" className="text-[13px] text-texto2 transition-colors hover:text-acento">Esqueceu a senha?</Link>}
            </div>
            <Entrada
              className="h-12"
              id={idSenha}
              type="password"
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              placeholder="Mínimo de 8 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
        )}
        {erro && <p role="alert" className="m-0 text-[13px] text-perigo">{erro}</p>}
        <Botao type="submit" className="mt-1.5 h-[46px] w-full" carregando={enviando}>{c.cta}</Botao>
      </form>

      <div className="flex flex-wrap gap-1.5 text-[14px] text-texto2">
        {c.troca}
        <Link href={proximo && destino !== '/app' ? `${c.trocaHref}?${new URLSearchParams({ proximo: destino })}` : c.trocaHref} className="font-medium text-texto underline underline-offset-[3px] transition-colors hover:text-acento">{c.trocaLink}</Link>
      </div>
      {MODO_DEMO && <p className="m-0 -mt-3 text-[12px] text-texto3">Modo demonstração: qualquer e-mail e senha entram, com dados fictícios locais.</p>}
    </div>
  )
}

const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function Titulo({ titulo, subtitulo }: { titulo: string; subtitulo: ReactNode }) {
  return (
    <div>
      <h1 className="m-0 text-[32px] font-medium leading-[1.05] tracking-[-0.045em] sm:text-[36px]">{titulo}</h1>
      <p className="mt-2.5 text-[15px] leading-normal text-texto2">{subtitulo}</p>
    </div>
  )
}

/** Modo real, conta criada com verificação de e-mail ligada: confirma o código de 6 dígitos e entra. */
function ConfirmarEmail({ email, senha, destino }: { email: string; senha: string; destino: string }) {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const confirmar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!/^\d{4,8}$/.test(codigo.trim())) return setErro('Digite o código que chegou por e-mail.')
    setEnviando(true)
    try {
      const auth = await carregarAuth()
      const { error } = await auth.emailOtp.verifyEmail({ email, otp: codigo.trim() })
      if (error) return setErro(await mensagemErro(error))
      // sem login automático após verificar, entra com a senha recém-criada
      if (!(await auth.getSession()).data?.user) {
        const r = await auth.signIn.email({ email, password: senha })
        if (r.error) return setErro(await mensagemErro(r.error))
      }
      router.push(destino)
    } catch (e) {
      setErro(await mensagemErro(e))
    } finally {
      setEnviando(false)
    }
  }
  return (
    <form onSubmit={confirmar} className="flex flex-col gap-7" noValidate>
      <Titulo titulo="Verifique seu e-mail" subtitulo={<>Enviamos um código de confirmação para <strong className="font-medium text-texto">{email}</strong>.</>} />
      <Campo rotulo="Código"><Entrada className="h-12" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></Campo>
      {erro && <p role="alert" className="m-0 -mt-4 text-[13px] text-perigo">{erro}</p>}
      <Botao type="submit" className="h-[46px] w-full" carregando={enviando}>Confirmar e entrar</Botao>
    </form>
  )
}

/** Modo real: recuperação por código no e-mail (funciona com o SMTP compartilhado do Neon; links pedem SMTP próprio). */
function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [etapa, setEtapa] = useState<'email' | 'codigo' | 'pronto'>('email')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const executar = async (fn: () => Promise<string | null>) => {
    setErro(null)
    setEnviando(true)
    try { setErro(await fn()) } catch (e) { setErro(await mensagemErro(e)) } finally { setEnviando(false) }
  }
  const pedirCodigo = (e: FormEvent) => {
    e.preventDefault()
    if (!RE_EMAIL.test(email)) return setErro('Informe um e-mail válido.')
    void executar(async () => {
      const { error } = await (await carregarAuth()).forgetPassword.emailOtp({ email })
      if (error) return mensagemErro(error)
      setEtapa('codigo')
      return null
    })
  }
  const redefinir = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4,8}$/.test(codigo.trim())) return setErro('Digite o código que chegou por e-mail.')
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    void executar(async () => {
      const { error } = await (await carregarAuth()).emailOtp.resetPassword({ email, otp: codigo.trim(), password: senha })
      if (error) return mensagemErro(error)
      setEtapa('pronto')
      return null
    })
  }

  return (
    <div className="flex flex-col gap-7">
      {etapa === 'email' && (
        <form onSubmit={pedirCodigo} className="flex flex-col gap-3.5" noValidate>
          <Titulo titulo="Recuperar senha." subtitulo="Informe seu e-mail e enviaremos um código para redefinir." />
          <Campo rotulo="E-mail"><Entrada className="h-12" type="email" autoComplete="email" placeholder="voce@estudio.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
          {erro && <p role="alert" className="m-0 text-[13px] text-perigo">{erro}</p>}
          <Botao type="submit" className="mt-1.5 h-[46px] w-full" carregando={enviando}>Enviar código</Botao>
        </form>
      )}
      {etapa === 'codigo' && (
        <form onSubmit={redefinir} className="flex flex-col gap-3.5" noValidate>
          <Titulo titulo="Nova senha." subtitulo={<>Se existir uma conta para <strong className="font-medium text-texto">{email}</strong>, o código chega em instantes.</>} />
          <Campo rotulo="Código"><Entrada className="h-12" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></Campo>
          <Campo rotulo="Nova senha"><Entrada className="h-12" type="password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
          {erro && <p role="alert" className="m-0 text-[13px] text-perigo">{erro}</p>}
          <Botao type="submit" className="mt-1.5 h-[46px] w-full" carregando={enviando}>Redefinir senha</Botao>
        </form>
      )}
      {etapa === 'pronto' && <Titulo titulo="Senha alterada." subtitulo="Entre com a nova senha." />}
      <div className="flex flex-wrap gap-1.5 text-[14px] text-texto2">
        {etapa === 'pronto' ? 'Tudo certo.' : 'Lembrou a senha?'}
        <Link href="/login" className="font-medium text-texto underline underline-offset-[3px] transition-colors hover:text-acento">{etapa === 'pronto' ? 'Entrar' : 'Voltar ao login'}</Link>
      </div>
    </div>
  )
}

/**
 * "G" do Google: o SVG oficial do logo de produto (fonts.gstatic.com/s/i/productlogos/googleg), nas cores da marca,
 * como pedem as diretrizes do "Sign in with Google" — sem recolorir nem recortar.
 */
function IconeGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function BotaoSocial({ rotulo, icone, onClick }: { rotulo: string; icone: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Continuar com ${rotulo}`}
      className="flex h-11 items-center justify-center gap-2.5 rounded-lg border border-bordaForte bg-superficie text-[14px] font-medium text-texto transition-colors hover:border-texto"
    >
      <span aria-hidden className="flex items-center">{icone}</span>
      {rotulo}
    </button>
  )
}

/**
 * Moldura das telas de login/cadastro (Claude Design, "Auth"): logo no topo, formulário centralizado na coluna
 * (na horizontal e na vertical, entre a logo e o rodapé) e, a partir de lg, o painel escuro "Feito com Mostra".
 * Fica fora do Suspense do FormAuth para ser renderizada no servidor.
 */
export function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-fundo text-texto lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-[clamp(24px,5vw,72px)]">
        <Link href="/" className="self-start text-texto hover:text-texto">
          <Marca className={TAMANHO_MARCA} />
        </Link>
        <main className="flex flex-1 flex-col items-center justify-center py-12">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <p className="m-0 text-center text-[12px] text-texto3">Ao continuar, você concorda com os Termos e a Política de Privacidade.</p>
      </div>
      <PainelAuth />
    </div>
  )
}

function PainelAuth() {
  return (
    <aside aria-label="Exemplo feito com Mostra" className="relative hidden min-h-[560px] items-center justify-center overflow-hidden bg-grafite p-12 lg:flex">
      <p className="absolute left-12 top-10 m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-texto2">Feito com Mostra</p>
      <div aria-hidden className="relative w-full max-w-[620px]">
        <div className="absolute inset-0 translate-x-7 -translate-y-7 rounded-md bg-mare opacity-60" />
        <div className="absolute inset-0 translate-x-3.5 -translate-y-3.5 rounded-md bg-carvao opacity-85" />
        <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-argila shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] [container-type:inline-size]">
          <div className="absolute left-[6%] top-[8%] font-mono uppercase tracking-[0.06em] text-[#8C6A55]" style={{ fontSize: '1.5cqw' }}>Identidade visual 2026</div>
          <div className="absolute bottom-[22%] left-[5%] font-medium leading-[0.85] tracking-[-0.06em] text-carvao" style={{ fontSize: '21cqw' }}>Atlas</div>
          <div className="absolute bottom-[9%] left-[6%] text-[#5B4335]" style={{ fontSize: '2.4cqw' }}>Forma, fogo e tempo.</div>
          <div className="absolute right-[6%] top-[8%] flex h-[84%] w-[32%] items-end bg-terracota" style={{ padding: '2cqw', backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 9px)' }}>
            <span className="font-mono text-white/85" style={{ fontSize: '1.4cqw' }}>foto · vaso esmaltado</span>
          </div>
          <div className="absolute right-[6%] top-[8%] h-[84%] w-[32%] border-[1.5px] border-dashed border-violeta bg-violeta/[0.08]" />
        </div>
        <div className="absolute -right-[18px] top-[46%] flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-[12px] text-grafite shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)]">
          <span className="h-2 w-2 rounded-full bg-violeta" />Clique → Tela 05 · Morph
        </div>
        <div className="absolute -bottom-3.5 left-[24%] flex items-center gap-1.5">
          <span className="h-0 w-0 -rotate-[30deg] border-x-[6px] border-b-[10px] border-x-transparent border-b-violeta" />
          <span className="rounded bg-violeta px-2 py-[3px] text-[11px] text-white">Marina</span>
        </div>
      </div>
      <div className="absolute bottom-10 left-12 right-12 flex flex-wrap justify-between gap-4 text-[13px] text-texto3">
        <span className="text-[#FAFAF9]">Atlas Cerâmica</span>
        <span className="text-texto3">Estúdio Norte · São Paulo</span>
      </div>
    </aside>
  )
}
