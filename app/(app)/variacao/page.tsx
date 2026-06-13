export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { Suspense } from 'react'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'
import { VariacaoClient } from './VariacaoClient'
import { FiltroMes } from '@/components/layout/FiltroMes'
import { ErroRPC } from '@/components/layout/ErroRPC'

export default async function VariacaoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [{ data: periodos }, motMap] = await Promise.all([
    supabase.rpc('periodos_disponiveis'),
    getMotoristaMap(),
  ])

  const periodosDisp: string[] = (periodos ?? [])
    .map((r: { periodo: string }) => r.periodo)
    .filter((p) => p?.length === 7)   // apenas YYYY-MM

  const periodoAtual = (periodo?.length === 7 ? periodo : null) ?? periodosDisp[0] ?? null

  const { data: variacao, error: errVariacao } = periodoAtual
    ? await supabase.rpc('resumo_ofensores_variacao', { p_periodo: periodoAtual })
    : { data: null, error: null }

  if (errVariacao) return <ErroRPC nome="resumo_ofensores_variacao" />

  // Período anterior label
  let periodoAntLabel = '—'
  if (periodoAtual) {
    const [ano, mes] = periodoAtual.split('-').map(Number)
    const antMes = mes === 1 ? 12 : mes - 1
    const antAno = mes === 1 ? ano - 1 : ano
    periodoAntLabel = `${String(antAno)}-${String(antMes).padStart(2, '0')}`
  }

  const motoristas = (variacao ?? [])
    .filter((r: { motorista?: string | null }) => r.motorista && String(r.motorista).trim() !== '')
    .map((r: Record<string, unknown>) => ({
      motorista:  String(r.motorista),
      nome:       resolveMotorista(motMap, String(r.motorista)),
      fat_atual:  Number(r.fat_atual),
      dev_atual:  Number(r.dev_atual),
      pct_atual:  Number(r.pct_atual),
      fat_ant:    Number(r.fat_ant),
      dev_ant:    Number(r.dev_ant),
      pct_ant:    r.pct_ant != null ? Number(r.pct_ant) : null,
      delta:      r.delta    != null ? Number(r.delta)   : null,
    }))

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Variação de Ofensores</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {periodoAtual ?? '—'} vs {periodoAntLabel} · base ≥ 5 PDVs faturados
          </p>
        </div>
        <Suspense><FiltroMes periodos={periodos ?? []} /></Suspense>
      </div>

      {!periodoAtual ? (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/30 rounded-xl px-4 py-3 text-xs text-gray-500">
          Selecione um período para ver a variação vs mês anterior.
        </div>
      ) : motoristas.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl px-6 py-10 text-center text-gray-400 text-sm">
          Nenhum dado encontrado. Verifique se a RPC{' '}
          <code className="text-[#D4A800]">resumo_ofensores_variacao</code> está criada no Supabase.
        </div>
      ) : (
        <VariacaoClient
          motoristas={motoristas}
          periodoAtual={periodoAtual}
          periodoAntLabel={periodoAntLabel}
        />
      )}
    </div>
  )
}
