export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'

interface Reincidente { codigo_pdv: string; cliente: string; fat: number; dev: number }

export default async function ReincidenciaPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [{ data: res }, { data: periodos }] = await Promise.all([
    supabase.rpc('resumo_reincidencia', { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
  ])

  const kpi = res?.[0] ?? null

  const totalPdvs        = Number(kpi?.total_pdvs        ?? 0)
  const comDevolucao     = Number(kpi?.pdvs_com_devolucao ?? 0)
  const reincidentes     = Number(kpi?.pdvs_reincidentes  ?? 0)
  const taxaReincidencia = Number(kpi?.taxa_reincidencia  ?? 0)
  const top: Reincidente[] = kpi?.top_reincidentes ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Taxa de Reincidência</h1>
          <p className="text-gray-500 text-sm mt-0.5">PDVs com mais de uma devolução no período</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total PDVs',             value: totalPdvs.toLocaleString('pt-BR')     },
          { label: 'Com devolução',          value: comDevolucao.toLocaleString('pt-BR')  },
          { label: 'Reincidentes (>1 dev)',  value: reincidentes.toLocaleString('pt-BR')  },
          { label: 'Taxa reincidência',      value: `${taxaReincidencia.toFixed(1)}%`      },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl px-4 py-4">
            <p className="text-sm text-gray-500 font-medium mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-[#003087]">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de visão geral */}
      {comDevolucao > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-500 mb-4">Proporção de reincidentes</p>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-gray-500 text-xs w-28">Únicos (1 dev.)</span>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gray-300"
                style={{ width: `${comDevolucao > 0 ? ((comDevolucao - reincidentes) / comDevolucao) * 100 : 0}%` }}
              />
            </div>
            <span className="text-gray-500 text-xs w-12 text-right">
              {comDevolucao > 0 ? (((comDevolucao - reincidentes) / comDevolucao) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#D4A800] text-xs w-28 font-medium">Reincidentes</span>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#F2C800]"
                style={{ width: `${taxaReincidencia}%` }}
              />
            </div>
            <span className="text-[#D4A800] text-xs font-bold w-12 text-right">{taxaReincidencia.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Tabela top reincidentes */}
      {top.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-500 mb-4">Top PDVs reincidentes</p>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#003087] text-white text-xs font-medium">
                  <th className="text-left py-3 px-2 rounded-tl-lg">#</th>
                  <th className="text-left py-3 px-2">PDV / Cliente</th>
                  <th className="text-right py-3 px-2">Fat.</th>
                  <th className="text-right py-3 px-2">Dev.</th>
                  <th className="text-right py-3 px-2 rounded-tr-lg">% Dev.</th>
                </tr>
              </thead>
              <tbody>
                {top.map((p, i) => {
                  const pct = p.fat > 0 ? (p.dev / p.fat * 100) : 0
                  return (
                    <tr key={p.codigo_pdv} className="border-b border-gray-50 hover:bg-[#FFF8DC]">
                      <td className="py-3 px-2 text-[#D4A800] font-bold">{i + 1}</td>
                      <td className="py-3 px-2">
                        <p className="text-[#111111] text-sm">{p.cliente || '—'}</p>
                        <p className="text-gray-400 text-xs">{p.codigo_pdv}</p>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-500">{Number(p.fat).toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-2 text-right text-[#D4A800] font-semibold">{Number(p.dev).toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-2 text-right text-[#D4A800] font-bold">{pct.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!kpi && (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/30 rounded-xl px-4 py-3 text-xs text-gray-500">
          Nenhum dado encontrado. Execute primeiro a RPC <code className="text-[#D4A800]">resumo_reincidencia</code> no Supabase.
        </div>
      )}
    </div>
  )
}
