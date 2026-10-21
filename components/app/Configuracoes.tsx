'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { adicionarCreditos, reiniciarDemo, uso } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { CUSTO_CREDITOS, PACOTES_AVULSOS, PLANOS, formatarBytes, formatarLimite, percentualUso, precoComCiclo } from '@/lib/planos'
import { alternarTema, sair } from '@/lib/sessao'
import { Botao, Campo, Entrada, ModalConfirmar, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

function Bloco({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-[15px] font-medium">{titulo}</h2>{acao}</div>
      {children}
    </section>
  )
}

export function Configuracoes() {
  const usuario = useDemo((e) => e.usuario)
  const workspace = useDemo((e) => e.workspace)
  const creditos = useDemo((e) => e.creditos)
  const u = useDemo((e) => uso(e))
  const plano = PLANOS[workspace.planoId]
  const [ciclo, setCiclo] = useState<'anual' | 'mensal'>('anual')
  const [excluir, setExcluir] = useState(false)
  const router = useRouter()
  const { mostrar } = useToast()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-borda pb-6"><div className="rotulo-mono">Configurações</div><h1 className="titulo-display mt-2.5 text-[40px]">Conta e planos.</h1></div>

      <Bloco titulo="Créditos de IA" acao={<span className="flex items-center gap-1.5 rounded-full bg-lima px-3 py-1 text-[13px] font-medium text-grafite"><Sparkles className="h-3.5 w-3.5" /> {creditos.saldo.toLocaleString('pt-BR')} créditos</span>}>
        <p className="text-[13px] text-texto2">Créditos são usados só nos recursos de IA. Editar, apresentar e compartilhar não consomem nada. {plano.creditos.recorrencia === 'mensal' ? `O plano ${plano.nome} renova ${plano.creditos.quantidade.toLocaleString('pt-BR')} créditos por mês${plano.creditos.compartilhados ? ' (compartilhados pela equipe)' : ''}.` : `O plano Free dá ${plano.creditos.quantidade} créditos no cadastro.`}</p>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <div className="rotulo-mono mb-2">Quanto custa</div>
            <ul className="divide-y divide-borda text-[13px]">
              {([['roteiro', 'Gerar roteiro com IA'], ['tela', 'Gerar uma tela'], ['reescrever', 'Reescrever ou traduzir texto'], ['imagem', 'Gerar imagem com IA'], ['video', 'Gerar vídeo curto']] as const).map(([k, r]) => <li key={k} className="flex justify-between py-2"><span>{r}</span><span className="mono text-texto2">{CUSTO_CREDITOS[k]} créditos</span></li>)}
            </ul>
          </div>
          <div>
            <div className="rotulo-mono mb-2">Pacotes avulsos (não expiram)</div>
            <div className="grid grid-cols-3 gap-2">
              {PACOTES_AVULSOS.map((p) => (
                <button key={p.creditos} onClick={() => { adicionarCreditos(p.creditos, `Pacote avulso de ${p.creditos} créditos`); mostrar(`${p.creditos.toLocaleString('pt-BR')} créditos adicionados (demonstração, sem cobrança).`, 'sucesso') }} className={cx('rounded-lg border-[1.5px] p-3 text-left hover:border-grafite', 'destaque' in p ? 'border-grafite bg-lima' : 'border-borda')}>
                  <div className="text-[17px] font-medium">{p.creditos.toLocaleString('pt-BR')}</div>
                  <div className="text-[11px] text-texto2">créditos</div>
                  <div className="mt-2 text-[13px] font-medium">R${p.precoBRL}</div>
                </button>
              ))}
            </div>
            <div className="rotulo-mono mb-2 mt-5">Extrato</div>
            <ul className="max-h-40 divide-y divide-borda overflow-y-auto text-[12px]">
              {creditos.movimentos.slice(0, 20).map((m) => <li key={m.id} className="flex justify-between gap-3 py-1.5"><span className="truncate text-texto2">{m.motivo}</span><span className={cx('mono shrink-0', m.quantidade < 0 ? 'text-perigo' : 'text-sucesso')}>{m.quantidade > 0 ? '+' : ''}{m.quantidade.toLocaleString('pt-BR')}</span></li>)}
            </ul>
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Plano e uso" acao={
        <div className="inline-flex rounded-full border-[1.5px] border-grafite p-0.5 text-[12px]">
          {(['anual', 'mensal'] as const).map((c) => <button key={c} onClick={() => setCiclo(c)} aria-pressed={ciclo === c} className={cx('rounded-full px-3 py-1 font-medium', ciclo === c ? 'bg-grafite text-fundo' : '')}>{c === 'anual' ? 'Anual · −20%' : 'Mensal'}</button>)}
        </div>
      }>
        <div className="space-y-4 text-[13px]">
          <Barra rotulo="Projetos" usado={u.projetosAtivos} limite={plano.limites.projetos} fmt={(n) => formatarLimite(n)} />
          <Barra rotulo="Armazenamento" usado={u.armazenamentoBytes} limite={plano.limites.armazenamentoBytes} fmt={formatarBytes} />
          <p className="text-texto2">Arquivos até {formatarBytes(plano.limites.tamanhoArquivoBytes)} · banda mensal {formatarBytes(plano.limites.bandaMensalBytes)}. Se a assinatura expirar, nada é apagado: o espaço entra em modo leitura.</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(PLANOS).map((p) => (
            <div key={p.id} className={cx('rounded-xl border-[1.5px] p-4 text-[13px]', p.id === plano.id ? 'border-grafite' : 'border-borda')}>
              <div className="flex items-center justify-between"><span className="font-medium">{p.nome}</span>{p.id === 'pro' && <span className="mono rounded-full bg-lima px-2 py-0.5 text-[9px]">MAIS ESCOLHIDO</span>}</div>
              <div className="mt-2 text-[24px] font-medium tracking-tight">R${precoComCiclo(p, ciclo)}<span className="text-[12px] font-normal text-texto2"> /{p.porMembro ? 'membro/' : ''}mês</span></div>
              <div className="mt-1 text-[12px] text-texto2">{p.creditos.quantidade.toLocaleString('pt-BR')} créditos {p.creditos.recorrencia === 'mensal' ? 'por mês' : 'no cadastro'}</div>
              <Botao tamanho="sm" variante={p.id === plano.id ? 'secundario' : 'primario'} className="mt-4 w-full" disabled={p.id === plano.id} onClick={() => mostrar('A cobrança entra depois do beta fechado. Os limites já são aplicados por plano.', 'info')}>{p.id === plano.id ? 'Plano atual' : 'Escolher'}</Botao>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Perfil">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome"><Entrada defaultValue={usuario.nome} /></Campo>
          <Campo rotulo="E-mail" dica="Alterar o e-mail exige nova verificação."><Entrada defaultValue={usuario.email} type="email" /></Campo>
          <Campo rotulo="Nova senha" dica="Mínimo de 8 caracteres."><Entrada type="password" autoComplete="new-password" /></Campo>
        </div>
        <Botao className="mt-5" onClick={() => mostrar('Perfil salvo (demonstração).', 'sucesso')}>Salvar</Botao>
      </Bloco>

      <Bloco titulo="Aparência"><Botao variante="secundario" onClick={() => alternarTema()}>Alternar tema claro/escuro</Botao></Bloco>

      <Bloco titulo="Dados e privacidade (LGPD)">
        <p className="mb-4 text-[13px] text-texto2">Exporte seus dados ou exclua a conta. A exclusão apaga projetos, mídias e links após o prazo de retenção.</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => mostrar('Exportação solicitada. Você receberá um e-mail quando estiver pronta (demonstração).', 'info')}>Exportar meus dados</Botao>
          <Botao variante="perigo" onClick={() => setExcluir(true)}>Excluir conta</Botao>
        </div>
      </Bloco>

      <Bloco titulo="Demonstração">
        <p className="mb-4 text-[13px] text-texto2">Este ambiente guarda dados fictícios no seu navegador.</p>
        <Botao variante="secundario" onClick={() => { reiniciarDemo(); mostrar('Dados de demonstração restaurados.', 'sucesso') }}>Restaurar dados de exemplo</Botao>
      </Bloco>

      <ModalConfirmar aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Excluir conta?" descricao="Esta ação não pode ser desfeita." rotuloConfirmar="Excluir conta" perigoso aoConfirmar={() => { reiniciarDemo(); sair(); router.push('/') }} />
    </div>
  )
}

function Barra({ rotulo, usado, limite, fmt }: { rotulo: string; usado: number; limite: number; fmt: (n: number) => string }) {
  const pct = percentualUso(usado, limite)
  return (
    <div>
      <div className="mb-1.5 flex justify-between"><span>{rotulo}</span><span className="text-texto2">{fmt(usado)} de {fmt(limite)}</span></div>
      <div className="h-[3px] overflow-hidden rounded-sm bg-borda" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}><div className={pct >= 90 ? 'h-full bg-perigo' : 'h-full bg-grafite'} style={{ width: `${Math.max(1, pct)}%` }} /></div>
    </div>
  )
}
