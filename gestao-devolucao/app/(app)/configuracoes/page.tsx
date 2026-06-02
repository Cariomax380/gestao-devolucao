export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { MetasForm } from './MetasForm'
import { Suspense } from 'react'

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo } = await searchParams
  const periodoSelecionado = periodo || 'global'

  const [{ data: periodos }, { data: metasPeriodo }, { data: metasGlobal }] = await Promise.all([
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
  ])

  const metasAtuais: Record<string, number> = {}
  for (const m of metasGlobal ?? []) metasAtuais[m.indicador] = m.valor_meta
  for (const m of metasPeriodo ?? []) metasAtuais[m.indicador] = m.valor_meta

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-semibold text-lg text-[#003087]">Configurações</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Defina metas por período — metas específicas sobrepõem a global ao filtrar
        </p>
      </div>

      <Suspense>
        <MetasForm
          metasAtuais={metasAtuais}
          periodos={periodos ?? []}
          periodoSelecionado={periodoSelecionado}
        />
      </Suspense>
    </div>
  )
}
