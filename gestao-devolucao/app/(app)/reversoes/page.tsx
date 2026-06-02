export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct } from '@/lib/utils'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'
import { Suspense } from 'react'

export default async function ReversaoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [{ data: res }, { data: periodos }, motMap] = await Promise.all([
    supabase.rpc('resumo_reversoes', { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
    getMotoristaMap(),
  ])

  const kpi = res?.[0] ?? {}
  const totalDev     = Number(kpi.total_dev     ?? 0)
  const totalRepasse = Number(kpi.total_repasse  ?? 0)
  const totalRevert  = Number(kpi.total_revert   ?? 0)
  const pctRepasse   = (totalDev + totalRepasse) > 0
    ? (totalRepasse / (totalDev + totalRepasse)) * 100
    : null
  const pctReversao  = totalDev > 0
    ? (totalRepasse / totalDev) * 100
    : null

  interface Tratativa { data_rota: string | null; motorista: string | null; cliente: string | null; motivo: string | null }
  const tratativas: Tratativa[] = kpi.tratativas_abertas ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Reversões e Repasses</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {periodo ? `Período ${periodo}` : 'Acumulado total da base'}
          </p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Devolvidos',   value: totalDev.toLocaleString('pt-BR'),     accent: '#F2C800' },
          { label: 'Repasses',           value: totalRepasse.toLocaleString('pt-BR'), accent: '#F2C800' },
          { label: '% Repasse',          value: formatPct(pctRepasse),                accent: '#F2C800' },
          { label: 'Tratativas Abertas', value: String(tratativas.length),            accent: '#EF4444', alert: true },
          { label: '% Reversão',         value: formatPct(pctReversao),               accent: '#7c3aed', highlight: true },
        ].map(c => (
          <div key={c.label}
            className="bg-white border border-gray-100 rounded-xl p-5"
            style={{ borderLeftWidth: 4, borderLeftColor: c.accent }}
          >
            <p className="text-sm text-gray-500 font-medium mb-1 leading-tight">{c.label}</p>
            <p className={`text-2xl font-bold ${c.alert ? 'text-[#EF4444]' : c.highlight ? 'text-[#7c3aed]' : 'text-[#003087]'}`}>
              {c.value}
            </p>
            {c.highlight && (
              <p className="text-[10px] text-gray-400 mt-1">repasses ÷ devoluções</p>
            )}
          </div>
        ))}
      </div>

      {tratativas.length > 0 && (
        <div className="bg-white border border-[#EF4444]/20 rounded-xl p-6">
          <h2 className="font-semibold text-[#003087] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            Fila de Tratativas Abertas
          </h2>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-24" />
                <col className="w-40" />
                <col />
                <col className="w-32" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#003087] text-white text-xs font-medium">
                  <th className="text-left py-3 px-2 rounded-tl-lg">Data</th>
                  <th className="text-left py-3 px-2">Motorista</th>
                  <th className="text-left py-3 px-2">Cliente</th>
                  <th className="text-left py-3 px-2 rounded-tr-lg">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {tratativas.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-[#FFF8DC]">
                    <td className="py-2 px-2 text-gray-500 text-xs">
                      {r.data_rota
                        ? new Date(r.data_rota + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-gray-700 truncate">{resolveMotorista(motMap, r.motorista)}</td>
                    <td className="py-2 px-2 text-gray-500 max-w-[200px] truncate">{r.cliente ?? '—'}</td>
                    <td className="py-2 px-2 text-[#D4A800] text-xs">{r.motivo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
