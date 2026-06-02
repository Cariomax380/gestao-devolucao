export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct } from '@/lib/utils'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'

export default async function PDVsPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [{ data }, { data: periodos }] = await Promise.all([
    supabase.rpc('resumo_pdvs_reincidentes', { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
  ])

  const reincidentes = (data ?? []).map((r: any) => ({
    codigo: r.codigo_pdv as string,
    cliente: r.cliente as string,
    dev: Number(r.total_dev),
    fat: Number(r.total_fat),
  }))

  const totalDev = reincidentes.reduce((s, r) => s + r.dev, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">PDVs Reincidentes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{reincidentes.length.toLocaleString('pt-BR')} PDVs com 2+ devoluções</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'PDVs Reincidentes',  value: reincidentes.length.toLocaleString('pt-BR') },
          { label: 'Total Devoluções',   value: totalDev.toLocaleString('pt-BR') },
          { label: 'Maior Reincidência', value: reincidentes[0]?.dev ?? '—' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl p-5">
            <p className="text-sm text-gray-500 font-medium mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-[#003087]">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold text-[#003087] mb-4">Lista de Reincidentes</h2>
        <div className="overflow-auto max-h-[32rem]">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-20" />
              <col />
              <col className="w-16" />
              <col className="w-20" />
              <col className="w-16" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003087] text-white text-xs font-medium">
                <th className="text-left py-3 px-2 rounded-tl-lg">#</th>
                <th className="text-left py-3 px-2">PDV</th>
                <th className="text-left py-3 px-2">Cliente</th>
                <th className="text-right py-3 px-2">Dev.</th>
                <th className="text-right py-3 px-2">Fat.</th>
                <th className="text-right py-3 px-2 rounded-tr-lg">% Dev.</th>
              </tr>
            </thead>
            <tbody>
              {reincidentes.map((p, i) => (
                <tr key={p.codigo} className="border-b border-gray-50 hover:bg-[#FFF8DC]">
                  <td className="py-3 px-2 text-[#D4A800] font-bold">{i + 1}</td>
                  <td className="py-3 px-2 text-[#0057A8] font-mono text-xs">{p.codigo}</td>
                  <td className="py-3 px-2 text-gray-600 max-w-[240px] truncate">{p.cliente}</td>
                  <td className="py-3 px-2 text-right font-bold text-[#003087]">{p.dev}</td>
                  <td className="py-3 px-2 text-right text-gray-500">{p.fat}</td>
                  <td className="py-3 px-2 text-right text-[#D4A800] font-semibold">{formatPct(p.fat > 0 ? p.dev / p.fat * 100 : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
