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
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">PDVs Reincidentes</h1>
          <p className="text-gray-500 text-sm mt-1">{reincidentes.length.toLocaleString('pt-BR')} PDVs com 2+ devoluções</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'PDVs Reincidentes',  value: reincidentes.length.toLocaleString('pt-BR') },
          { label: 'Total Devoluções',   value: totalDev.toLocaleString('pt-BR') },
          { label: 'Maior Reincidência', value: reincidentes[0]?.dev ?? '—' },
        ].map(c => (
          <div key={c.label} className="bg-[#141414] border border-white/5 rounded-xl p-5">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{c.label}</p>
            <p className="text-3xl font-bold text-[#C9A84C]">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Lista de Reincidentes</h2>
        <div className="overflow-y-auto max-h-[32rem] pr-4">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-20" />
              <col />
              <col className="w-16" />
              <col className="w-20" />
              <col className="w-16" />
            </colgroup>
            <thead className="sticky top-0 bg-[#141414] z-10">
              <tr className="text-gray-500 text-xs uppercase border-b border-white/5">
                <th className="text-left pb-3">#</th>
                <th className="text-left pb-3">PDV</th>
                <th className="text-left pb-3">Cliente</th>
                <th className="text-right pb-3">Dev.</th>
                <th className="text-right pb-3">Fat.</th>
                <th className="text-right pb-3">% Dev.</th>
              </tr>
            </thead>
            <tbody>
              {reincidentes.map((p, i) => (
                <tr key={p.codigo} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3 text-[#C9A84C] font-bold">{i + 1}</td>
                  <td className="py-3 text-[#C9A84C] font-mono text-xs">{p.codigo}</td>
                  <td className="py-3 text-gray-300 max-w-[240px] truncate">{p.cliente}</td>
                  <td className="py-3 text-right font-bold text-white">{p.dev}</td>
                  <td className="py-3 text-right text-gray-400">{p.fat}</td>
                  <td className="py-3 text-right text-[#C9A84C] font-semibold">{formatPct(p.fat > 0 ? p.dev / p.fat * 100 : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
