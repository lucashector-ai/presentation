'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { dados, mensagemDeErro, useCarregar, useDados } from '@/lib/dados'
import { ACOES_IA, CUSTO_CREDITOS, PLANOS, TELAS_REFERENCIA, apresentacoesCom, custoApresentacao, formatarBytes, formatarLimite, percentualUso, precoComCiclo, textoApresentacoes } from '@/lib/planos'
import { alternarTema } from '@/lib/sessao'
import { Botao, Campo, Entrada, ModalConfirmar, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useCreditos } from './Creditos'

const fmt = (n: number) => n.toLocaleString('pt-BR')

function Bloco({ id, titulo, children, acao }: { id?: string; titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-borda bg-superficie p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-[15px] font-medium">{titulo}</h2>{acao}</div>
      {children}
    </section>
  )
}

export function Configuracoes() {
  // conta (saldo, extrato, uso) sempre fresca nesta tela
  useCarregar(['conta'])
  useEffect(() => { void dados.carregar(['conta'], { forcar: true }) }, [])
  const usuario = useDados((e) => e.usuario)
  const workspace = useDados((e) => e.workspace)
  const creditos = useDados((e) => e.creditos)
  const u = useDados((e) => e.uso)
  const [salvando, setSalvando] = useState(false)
  const plano = PLANOS[workspace.planoId]
  const [ciclo, setCiclo] = useState<'anual' | 'mensal'>('anual')
  const [excluir, setExcluir] = useState(false)
  const [nome, setNome] = useState(usuario.nome)
  const [email, setEmail] = useState(usuario.email)
  const router = useRouter()
  const { mostrar } = useToast()
  const { abrirCompra, abrirPlano } = useCreditos()

  useEffect(() => { setNome(usuario.nome); setEmail(usuario.email) }, [usuario])
  // links como /app/settings#plano: o conteúdo só existe depois da checagem de sessão, então rola manualmente
  useEffect(() => {
    const alvo = window.location.hash.slice(1)
    if (!alvo) return
    const t = setTimeout(() => document.getElementById(alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [])

  const usadosNoMes = creditos.movimentos.filter((m) => m.quantidade < 0).reduce((s, m) => s - m.quantidade, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-borda pb-6"><div className="rotulo-mono">Configurações</div><h1 className="titulo-display mt-2.5 text-[32px] sm:text-[40px]">Conta e planos.</h1></div>

      <Bloco id="creditos" titulo="Créditos de IA" acao={<Botao tamanho="sm" onClick={() => abrirCompra()}>Comprar créditos</Botao>}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <div className="flex items-baseline gap-2">
              <Sparkles className="h-4 w-4 self-center text-acento" />
              <span className="text-[34px] font-medium leading-none tracking-[-0.04em]">{fmt(creditos.saldo)}</span>
              <span className="text-[13px] text-texto2">créditos</span>
            </div>
            <p className="mt-2 text-[14px]">{textoApresentacoes(creditos.saldo)} de {TELAS_REFERENCIA} telas</p>
            <p className="mt-3 text-[13px] leading-relaxed text-texto2">
              Créditos pagam a IA que escreve suas apresentações. Editar, apresentar, enviar links e acompanhar o cliente não consomem nada.{' '}
              {plano.creditos.recorrencia === 'mensal' ? `O plano ${plano.nome} renova ${fmt(plano.creditos.quantidade)} créditos por mês${plano.creditos.compartilhados ? ', compartilhados pela equipe' : ''} (${textoApresentacoes(plano.creditos.quantidade)}).` : `O plano Free dá ${fmt(plano.creditos.quantidade)} créditos no cadastro (${textoApresentacoes(plano.creditos.quantidade)}).`}
            </p>
            <div className="rotulo-mono mb-2 mt-6">Extrato</div>
            <ul className="max-h-48 divide-y divide-borda overflow-y-auto text-[12px]">
              {creditos.movimentos.slice(0, 30).map((m) => (
                <li key={m.id} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate text-texto2">{m.motivo}<span className="text-texto3"> · {new Date(m.criadoEm).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')}</span></span>
                  <span className={cx('mono shrink-0', m.quantidade < 0 ? 'text-perigo' : 'text-sucesso')}>{m.quantidade > 0 ? '+' : ''}{fmt(m.quantidade)}</span>
                </li>
              ))}
            </ul>
            {usadosNoMes > 0 && <p className="mt-2 text-[12px] text-texto3">Usados no período: {fmt(usadosNoMes)} créditos (≈ {fmt(Math.round(usadosNoMes / custoApresentacao(TELAS_REFERENCIA)))} apresentações).</p>}
          </div>
          <div>
            <div className="rotulo-mono mb-2">Quanto custa</div>
            <ul className="divide-y divide-borda text-[13px]">
              {ACOES_IA.map((a) => (
                <li key={a.id} className={cx('flex items-start justify-between gap-3 py-2.5', a.id === 'apresentacao' && 'font-medium')}>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">{a.rotulo}{!a.disponivel && <span className="mono rounded-full bg-hover px-1.5 py-0.5 text-[9px] font-normal text-texto2">EM BREVE NO EDITOR</span>}</span>
                    <span className="mt-0.5 block text-[12px] font-normal text-texto3">{a.detalhe}</span>
                  </span>
                  <span className="mono shrink-0 text-texto2">{a.id === 'apresentacao' ? `${TELAS_REFERENCIA} telas = ${a.creditos}` : `${a.creditos} créditos`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-acentoSuave px-3 py-2.5 text-[12px] leading-relaxed text-texto">
              Uma apresentação de {TELAS_REFERENCIA} telas custa {CUSTO_CREDITOS.roteiro} + {TELAS_REFERENCIA} × {CUSTO_CREDITOS.tela} = <strong className="font-medium">{custoApresentacao(TELAS_REFERENCIA)} créditos</strong>, cobrados uma vez, quando a IA escreve o roteiro. Ajustar o roteiro, trocar o tema e redesenhar as telas é grátis.
            </p>
          </div>
        </div>
      </Bloco>

      <Bloco id="plano" titulo="Plano e uso" acao={
        <div className="inline-flex rounded-full border-[1.5px] border-grafite p-0.5 text-[12px]">
          {(['anual', 'mensal'] as const).map((c) => <button key={c} onClick={() => setCiclo(c)} aria-pressed={ciclo === c} className={cx('rounded-full px-3 py-1 font-medium', ciclo === c ? 'bg-grafite text-fundo' : '')}>{c === 'anual' ? 'Anual · −20%' : 'Mensal'}</button>)}
        </div>
      }>
        <div className="space-y-4 text-[13px]">
          <Barra rotulo="Projetos" usado={u.projetosAtivos} limite={plano.limites.projetos} fmt={(n) => formatarLimite(n)} />
          <Barra rotulo="Armazenamento" usado={u.armazenamentoBytes} limite={plano.limites.armazenamentoBytes} fmt={formatarBytes} />
          <p className="text-texto2">Plano {plano.nome}: apresentações de até {plano.limites.telasPorPrompt} telas com IA · arquivos até {formatarBytes(plano.limites.tamanhoArquivoBytes)} · banda mensal {formatarBytes(plano.limites.bandaMensalBytes)}. Se a assinatura expirar, nada é apagado: o espaço entra em modo leitura.</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(PLANOS).map((p) => (
            <div key={p.id} className={cx('flex flex-col rounded-xl border-[1.5px] p-4 text-[13px]', p.id === plano.id ? 'border-grafite' : 'border-borda')}>
              <div className="flex items-center justify-between"><span className="font-medium">{p.nome}</span>{p.id === 'pro' && <span className="mono rounded-full bg-lima px-2 py-0.5 text-[9px]">MAIS ESCOLHIDO</span>}</div>
              <div className="mt-2 text-[24px] font-medium tracking-tight">R${precoComCiclo(p, ciclo)}<span className="text-[12px] font-normal text-texto2"> /{p.porMembro ? 'membro/' : ''}mês</span></div>
              <div className="mt-1 text-[12px]">{fmt(p.creditos.quantidade)} créditos {p.creditos.recorrencia === 'mensal' ? 'por mês' : 'no cadastro'}</div>
              <div className="text-[12px] text-texto2">≈ {fmt(apresentacoesCom(p.creditos.quantidade))} apresentações{p.creditos.recorrencia === 'mensal' ? '/mês' : ''}</div>
              <div className="mt-1 text-[12px] text-texto3">{p.limites.projetos >= Number.MAX_SAFE_INTEGER ? 'Projetos ilimitados' : `${p.limites.projetos} projetos`} · até {p.limites.telasPorPrompt} telas por apresentação</div>
              <div className="min-h-4 flex-1" />
              <Botao tamanho="sm" variante={p.id === plano.id ? 'secundario' : 'primario'} className="w-full" disabled={p.id === plano.id} onClick={() => abrirPlano(p.id, ciclo)}>{p.id === plano.id ? 'Plano atual' : 'Escolher'}</Botao>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Perfil">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome"><Entrada value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="E-mail" dica={dados.capacidades.editarEmail ? 'Alterar o e-mail exige nova verificação.' : 'Para trocar o e-mail da conta, fale com a gente.'}><Entrada value={email} onChange={(e) => setEmail(e.target.value)} type="email" disabled={!dados.capacidades.editarEmail} /></Campo>
          {dados.capacidades.editarEmail && <Campo rotulo="Nova senha" dica="Mínimo de 8 caracteres."><Entrada type="password" autoComplete="new-password" /></Campo>}
        </div>
        <Botao className="mt-5" carregando={salvando} onClick={async () => {
          setSalvando(true)
          try {
            await dados.atualizarPerfil({ nome, ...(dados.capacidades.editarEmail ? { email } : {}) })
            mostrar('Perfil salvo.', 'sucesso')
          } catch (e) {
            mostrar(mensagemDeErro(e, 'Não foi possível salvar o perfil.'), 'erro')
          } finally {
            setSalvando(false)
          }
        }}>Salvar</Botao>
      </Bloco>

      <Bloco titulo="Aparência"><Botao variante="secundario" onClick={() => alternarTema()}>Alternar tema claro/escuro</Botao></Bloco>

      <Bloco titulo="Dados e privacidade (LGPD)">
        <p className="mb-4 text-[13px] text-texto2">Exporte seus dados ou exclua a conta. A exclusão apaga projetos, mídias e links após o prazo de retenção.</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => mostrar('Exportação solicitada. Você receberá um e-mail quando estiver pronta (demonstração).', 'info')}>Exportar meus dados</Botao>
          <Botao variante="perigo" onClick={() => setExcluir(true)}>Excluir conta</Botao>
        </div>
      </Bloco>

      {dados.capacidades.dadosDeExemplo && <Bloco titulo="Demonstração">
        <p className="mb-4 text-[13px] text-texto2">Este ambiente guarda dados fictícios no seu navegador. Para ver o app como uma pessoa que acabou de criar a conta, comece com um espaço vazio no plano Free.</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => { dados.reiniciarExemplo(); mostrar('Dados de exemplo restaurados.', 'sucesso') }}>Restaurar dados de exemplo</Botao>
          <Botao variante="secundario" onClick={() => { dados.reiniciarExemplo({ vazio: true }); mostrar('Espaço vazio criado: plano Free com 400 créditos.', 'sucesso'); router.push('/app') }}>Começar como conta nova</Botao>
        </div>
      </Bloco>}

      <ModalConfirmar aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Excluir conta?" descricao={dados.capacidades.dadosDeExemplo ? 'Esta ação não pode ser desfeita.' : 'Por segurança, a exclusão da conta é feita pela equipe da Mostra: confirme e enviaremos as instruções para o seu e-mail.'} rotuloConfirmar="Excluir conta" perigoso aoConfirmar={async () => {
        if (!dados.capacidades.dadosDeExemplo) { setExcluir(false); mostrar('Pedido registrado. Você receberá as instruções por e-mail.', 'info'); return }
        dados.reiniciarExemplo(); await dados.sair(); router.push('/')
      }} />
    </div>
  )
}

function Barra({ rotulo, usado, limite, fmt }: { rotulo: string; usado: number; limite: number; fmt: (n: number) => string }) {
  const pct = percentualUso(usado, limite)
  return (
    <div>
      <div className="mb-1.5 flex justify-between"><span>{rotulo}</span><span className="text-texto2">{limite >= Number.MAX_SAFE_INTEGER ? `${fmt(usado)} · ilimitados` : `${fmt(usado)} de ${fmt(limite)}`}</span></div>
      <div className="h-[3px] overflow-hidden rounded-sm bg-borda" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}><div className={pct >= 90 ? 'h-full bg-perigo' : 'h-full bg-grafite'} style={{ width: `${Math.max(1, pct)}%` }} /></div>
    </div>
  )
}
