'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reiniciarDemo, uso } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { PLANOS, formatarBytes, percentualUso } from '@/lib/planos'
import { alternarTema, sair } from '@/lib/sessao'
import { Botao, Campo, Cartao, Entrada, ModalConfirmar, Selo } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

export function Configuracoes() {
  const usuario = useDemo((e) => e.usuario)
  const workspace = useDemo((e) => e.workspace)
  const u = useDemo((e) => uso(e))
  const plano = PLANOS[workspace.planoId]
  const [excluir, setExcluir] = useState(false)
  const router = useRouter()
  const { mostrar } = useToast()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Conta e planos</h1>

      <Cartao className="p-5">
        <h2 className="mb-4 font-semibold">Perfil</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome"><Entrada defaultValue={usuario.nome} /></Campo>
          <Campo rotulo="E-mail" dica="Alterar o e-mail exige nova verificação."><Entrada defaultValue={usuario.email} type="email" /></Campo>
          <Campo rotulo="Nova senha" dica="Mínimo de 8 caracteres."><Entrada type="password" autoComplete="new-password" /></Campo>
        </div>
        <Botao className="mt-4" onClick={() => mostrar('Perfil salvo (demonstração).', 'sucesso')}>Salvar</Botao>
      </Cartao>

      <Cartao className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Plano e uso</h2>
          <Selo tom="destaque">{plano.nome} · R$ {plano.precoMensalBRL}/mês</Selo>
        </div>
        <div className="space-y-4 text-sm">
          <Barra rotulo="Projetos ativos" usado={u.projetosAtivos} limite={plano.limites.projetos} fmt={(n) => String(n)} />
          <Barra rotulo="Armazenamento" usado={u.armazenamentoBytes} limite={plano.limites.armazenamentoBytes} fmt={formatarBytes} />
          <p className="text-texto2">Arquivos até {formatarBytes(plano.limites.tamanhoArquivoBytes)} · Banda mensal {formatarBytes(plano.limites.bandaMensalBytes)}. Quando a assinatura expira, nada é apagado: o espaço entra em modo leitura.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Object.values(PLANOS).map((p) => (
            <div key={p.id} className={`rounded-xl border p-4 text-sm ${p.id === plano.id ? 'border-texto' : ''}`}>
              <p className="font-medium">{p.nome}</p>
              <p className="text-texto2">R$ {p.precoMensalBRL}/mês</p>
              <Botao tamanho="sm" variante={p.id === plano.id ? 'secundario' : 'primario'} className="mt-3 w-full" disabled={p.id === plano.id} onClick={() => mostrar('Cobrança chega após o beta fechado. Limites já são aplicados por plano.', 'info')}>{p.id === plano.id ? 'Plano atual' : 'Escolher'}</Botao>
            </div>
          ))}
        </div>
      </Cartao>

      <Cartao className="p-5">
        <h2 className="mb-2 font-semibold">Aparência</h2>
        <Botao variante="secundario" onClick={() => alternarTema()}>Alternar tema claro/escuro</Botao>
      </Cartao>

      <Cartao className="p-5">
        <h2 className="mb-2 font-semibold">Dados e privacidade (LGPD)</h2>
        <p className="mb-3 text-sm text-texto2">Você pode exportar seus dados ou excluir a conta. A exclusão apaga projetos, mídias e links após o prazo de retenção.</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => mostrar('Exportação solicitada. Você receberá um e-mail quando estiver pronta (demonstração).', 'info')}>Exportar meus dados</Botao>
          <Botao variante="perigo" onClick={() => setExcluir(true)}>Excluir conta</Botao>
        </div>
      </Cartao>

      <Cartao className="p-5">
        <h2 className="mb-2 font-semibold">Demonstração</h2>
        <p className="mb-3 text-sm text-texto2">Este ambiente guarda dados fictícios no seu navegador.</p>
        <Botao variante="secundario" onClick={() => { reiniciarDemo(); mostrar('Dados de demonstração restaurados.', 'sucesso') }}>Restaurar dados de exemplo</Botao>
      </Cartao>

      <ModalConfirmar aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Excluir conta?" descricao="Esta ação não pode ser desfeita." rotuloConfirmar="Excluir conta" perigoso aoConfirmar={() => { reiniciarDemo(); sair(); router.push('/') }} />
    </div>
  )
}

function Barra({ rotulo, usado, limite, fmt }: { rotulo: string; usado: number; limite: number; fmt: (n: number) => string }) {
  const pct = percentualUso(usado, limite)
  return (
    <div>
      <div className="mb-1 flex justify-between"><span>{rotulo}</span><span className="text-texto2">{fmt(usado)} de {fmt(limite)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-superficie2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}><div className={`h-full ${pct >= 90 ? 'bg-perigo' : 'bg-acao'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
