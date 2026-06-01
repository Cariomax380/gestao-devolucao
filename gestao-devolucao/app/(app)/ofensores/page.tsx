export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct, formatHL } from '@/lib/utils'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'

export default async function OfensoresPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [{ data }, { data: periodos }, motMap] = await Promise.all([
    supabase.rpc('resumo_ofensores', { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
    getMotoristaMap(),
  ])

  const motoristas = (data ?? []).map((r: any) => ({
    motorista: r.motorista as string,
    fat: Number(r.fat), dev: Number(r.dev),
    vol_fat: Number(r.vol_fat), vol_dev: Number(r.vol_dev),
    fora_raio: Number(r.fora_raio), total: Number(r.total),
    pct_dev: Number(r.fat) > 0 ? Number(r.dev) / Number(r.fat) * 100 : 0,
    pct_fora: Number(r.total) > 0 ? Number(r.fora_raio) / Number(r.total) * 100 : 0,
  })).filter((m: any) => m.fat >= 5)

  const rankingPct  = [...motoristas].sort((a, b) => b.pct_dev - a.pct_dev)
  const rankingVol  = [...motoristas].sort((a, b) => b.vol_dev - a.vol_dev)
  const rankingFora = [...motoristas].sort((a, b) => b.pct_fora - a.pct_fora)

  function prioridade(m: any) {
    if (m.pct_dev > 15 && m.pct_fora > 30) return { label: 'Crítico',          cor: '#DC2626' }
    if (m.pct_dev > 15)                     return { label: 'Alta Operacional', cor: '#D97706' }
    if (m.pct_fora > 30)                    return { label: 'Alta Geográfica',  cor: '#7c3aed' }
    if (m.vol_dev > 10)                     return { label: 'Monitor Volume',   cor: '#2563eb' }
    return                                         { label: 'Monitoramento',    cor: '#6B7280' }
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ofensores</h1>
          <p className="text-gray-500 text-sm mt-1">{motoristas.length} motoristas · base ≥ 5 PDVs</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Ranking — % Devolução PDV</h2>
        <div className="overflow-y-auto max-h-96 pr-4">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-16" />
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-28" />
            </colgroup>
            <thead className="sticky top-0 bg-[#141414] z-10">
              <tr className="text-gray-500 text-xs uppercase border-b border-white/5">
                <th className="text-left pb-3">#</th>
                <th className="text-left pb-3">Motorista</th>
                <th className="text-right pb-3">Fat.</th>
                <th className="text-right pb-3">Dev.</th>
                <th className="text-right pb-3">% Dev.</th>
                <th className="text-right pb-3">Vol HL</th>
                <th className="text-right pb-3">F. Raio</th>
                <th className="text-left pb-3 pl-3">Prioridade</th>
              </tr>
            </thead>
            <tbody>
              {rankingPct.map((m: any, i: number) => {
                const p = prioridade(m)
                return (
                  <tr key={m.motorista} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-3 text-[#C9A84C] font-bold">{i + 1}</td>
                    <td className="py-3 text-white font-medium">{resolveMotorista(motMap, m.motorista)}</td>
                    <td className="py-3 text-right text-gray-400">{m.fat.toLocaleString('pt-BR')}</td>
                    <td className="py-3 text-right text-gray-300">{m.dev.toLocaleString('pt-BR')}</td>
                    <td className="py-3 text-right font-bold text-[#C9A84C]">{formatPct(m.pct_dev)}</td>
                    <td className="py-3 text-right text-gray-300">{formatHL(m.vol_dev)}</td>
                    <td className="py-3 text-right text-gray-400">{formatPct(m.pct_fora)}</td>
                    <td className="py-3 pl-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: p.cor + '20', color: p.cor }}>{p.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Ranking — Volume Devolvido HL</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {rankingVol.map((m: any, i: number) => (
              <div key={m.motorista} className="flex items-center gap-3">
                <span className="text-[#C9A84C] font-bold text-sm w-5">{i + 1}</span>
                <span className="flex-1 text-gray-300 text-sm">{resolveMotorista(motMap, m.motorista)}</span>
                <span className="text-white font-semibold text-sm">{formatHL(m.vol_dev)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Ranking — Fora do Raio</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {rankingFora.map((m: any, i: number) => (
              <div key={m.motorista} className="flex items-center gap-3">
                <span className="text-[#C9A84C] font-bold text-sm w-5">{i + 1}</span>
                <span className="flex-1 text-gray-300 text-sm">{resolveMotorista(motMap, m.motorista)}</span>
                <span className="text-white font-semibold text-sm">{formatPct(m.pct_fora)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
