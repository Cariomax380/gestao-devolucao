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
    // Metas do período específico
    supabase
      .from('metas')
      .select('indicador, valor_meta')
      .eq('cdd', '*')
      .eq('periodo', periodoSelecionado),
    // Metas globais (fallback)
    supabase
      .from('metas')
      .select('indicador, valor_meta')
      .eq('cdd', '*')
      .eq('periodo', 'global'),
  ])

  // Mescla: global como base, período específico sobrepõe
  const metasAtuais: Record<string, number> = {}
  for (const m of metasGlobal ?? []) metasAtuais[m.indicador] = m.valor_meta
  for (const m of metasPeriodo ?? []) metasAtuais[m.indicador] = m.valor_meta

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">
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
