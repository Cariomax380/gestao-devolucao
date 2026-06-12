export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { MetasForm } from './MetasForm'
import { UsuariosSection } from './UsuariosSection'
import { Suspense } from 'react'

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo } = await searchParams
  const periodoSelecionado = periodo || 'global'

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const [{ data: periodos }, { data: metasPeriodo }, { data: metasGlobal }, { data: authUsers }] = await Promise.all([
    supabase.rpc('periodos_disponiveis'),
    supabase
      .from('metas')
      .select('indicador, valor_meta')
      .eq('cdd', '*')
      .eq('periodo', periodoSelecionado),
    supabase
      .from('metas')
      .select('indicador, valor_meta')
      .eq('cdd', '*')
      .eq('periodo', 'global'),
    admin.auth.admin.listUsers(),
  ])

  const metasAtuais: Record<string, number> = {}
  for (const m of metasGlobal ?? []) metasAtuais[m.indicador] = m.valor_meta
  for (const m of metasPeriodo ?? []) metasAtuais[m.indicador] = m.valor_meta

  const usuarios = (authUsers?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '',
    created_at: u.created_at,
    confirmado: !!u.email_confirmed_at,
  }))

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="font-semibold text-lg text-[#003087]">Configurações</h1>

      {/* ── Área 1: Acesso ── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-[#003087]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-[#003087]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#003087]">Acesso</h2>
            <p className="text-xs text-gray-400 mt-0.5">Controle quem pode entrar no painel</p>
          </div>
        </div>
        <UsuariosSection usuarios={usuarios} />
      </div>

      {/* ── Área 2: Indicadores ── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-[#F2C800]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-[#A88000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#003087]">Indicadores</h2>
            <p className="text-xs text-gray-400 mt-0.5">Metas de referência para Dev PDV, HL e Reversão</p>
          </div>
        </div>
        <Suspense>
          <MetasForm
            metasAtuais={metasAtuais}
            periodos={periodos ?? []}
            periodoSelecionado={periodoSelecionado}
          />
        </Suspense>
      </div>
    </div>
  )
}
