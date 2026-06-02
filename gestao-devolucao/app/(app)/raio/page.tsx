export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct } from '@/lib/utils'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'

export default async function RaioPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams
  const p = periodo ?? null

  const [{ data: ofensores }, { data: periodos }, { data: raioGeral }, motMap] = await Promise.all([
    supabase.rpc('resumo_ofensores', { p_periodo: p }),
    supabase.rpc('periodos_disponiveis'),
    supabase.rpc('resumo_raio', { p_periodo: p }),
    getMotoristaMap(),
  ])

  const motoristas = (ofensores ?? [])
    .map((r: any) => ({
      motorista: r.motorista as string,
      total: Number(r.total),
      fora_raio: Number(r.fora_raio),
      dev: Number(r.dev),
      pct_fora: Number(r.total) > 0 ? Number(r.fora_raio) / Number(r.total) * 100 : 0,
    }))
    .filter((m: any) => m.total >= 3)
    .sort((a: any, b: any) => b.pct_fora - a.pct_fora)

  const g = raioGeral?.[0] ?? {}
  const totalEntregas = Number(g.total_entregas ?? 0)
  const dentroRaio   = Number(g.dentro_raio ?? 0)
  const foraRaio     = totalEntregas - dentroRaio
  const pctAderencia = totalEntregas > 0 ? (dentroRaio / totalEntregas) * 100 : null
  const pctFora      = totalEntregas > 0 ? (foraRaio / totalEntregas) * 100 : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Raio e Execução</h1>
          <p className="text-gray-500 text-sm mt-0.5">Aderência ao raio de entrega</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entregas',     value: totalEntregas.toLocaleString('pt-BR') },
          { label: 'Dentro do Raio',     value: dentroRaio.toLocaleString('pt-BR')   },
          { label: 'Fora do Raio',       value: foraRaio.toLocaleString('pt-BR')     },
          { label: 'Aderência ao Raio',  value: formatPct(pctAderencia)              },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl p-5">
            <p className="text-sm text-gray-500 font-medium mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-[#003087]">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de aderência */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold text-[#003087] mb-4">Aderência Geral ao Raio</h2>
        <div className="flex items-center gap-4 mb-2">
          <span className="text-[#10B981] font-semibold text-sm">Dentro {formatPct(pctAderencia)}</span>
          <span className="text-[#EF4444] font-semibold text-sm ml-auto">Fora {formatPct(pctFora)}</span>
        </div>
        <div className="bg-gray-100 rounded-full h-4 overflow-hidden flex">
          <div className="h-full bg-[#10B981] transition-all" style={{ width: `${pctAderencia ?? 0}%` }} />
          <div className="h-full bg-[#EF4444] transition-all" style={{ width: `${pctFora ?? 0}%` }} />
        </div>
      </div>

      {/* Ranking motoristas fora do raio */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold text-[#003087] mb-4">Motoristas com Maior Desvio de Raio</h2>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-16" />
              <col className="w-16" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003087] text-white text-xs font-medium">
                <th className="text-left py-3 px-2 rounded-tl-lg">#</th>
                <th className="text-left py-3 px-2">Motorista</th>
                <th className="text-right py-3 px-2">Entregas</th>
                <th className="text-right py-3 px-2">Fora Raio</th>
                <th className="text-right py-3 px-2">% Fora</th>
                <th className="text-right py-3 px-2 rounded-tr-lg">Dev.</th>
              </tr>
            </thead>
            <tbody>
              {motoristas.map((m: any, i: number) => (
                <tr key={m.motorista} className="border-b border-gray-50 hover:bg-[#FFF8DC]">
                  <td className="py-3 px-2 text-[#D4A800] font-bold">{i + 1}</td>
                  <td className="py-3 px-2 text-[#111111] font-medium truncate pr-2">{resolveMotorista(motMap, m.motorista)}</td>
                  <td className="py-3 px-2 text-right text-gray-500">{m.total.toLocaleString('pt-BR')}</td>
                  <td className="py-3 px-2 text-right text-gray-600">{m.fora_raio.toLocaleString('pt-BR')}</td>
                  <td className="py-3 px-2 text-right font-bold text-[#D4A800]">{formatPct(m.pct_fora)}</td>
                  <td className="py-3 px-2 text-right text-gray-500">{m.dev.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {motoristas.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Nenhum dado encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
