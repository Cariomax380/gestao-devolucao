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
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Raio e Execução</h1>
          <p className="text-gray-500 text-sm mt-1">Aderência ao raio de entrega</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entregas',    value: totalEntregas.toLocaleString('pt-BR'), cor: 'branco' },
          { label: 'Dentro do Raio',   value: dentroRaio.toLocaleString('pt-BR'),   cor: 'branco' },
          { label: 'Fora do Raio',     value: foraRaio.toLocaleString('pt-BR'),     cor: 'dourado' },
          { label: 'Aderência ao Raio',value: formatPct(pctAderencia),              cor: 'dourado' },
        ].map(c => (
          <div key={c.label} className="bg-[#141414] border border-white/5 rounded-xl p-5">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{c.label}</p>
            <p className={`text-3xl font-bold ${c.cor === 'dourado' ? 'text-[#C9A84C]' : 'text-white'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de aderência */}
      <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Aderência Geral ao Raio</h2>
        <div className="flex items-center gap-4 mb-2">
          <span className="text-[#16A34A] font-semibold text-sm">Dentro {formatPct(pctAderencia)}</span>
          <span className="text-[#DC2626] font-semibold text-sm ml-auto">Fora {formatPct(pctFora)}</span>
        </div>
        <div className="bg-white/5 rounded-full h-4 overflow-hidden flex">
          <div className="h-full bg-[#16A34A] transition-all" style={{ width: `${pctAderencia ?? 0}%` }} />
          <div className="h-full bg-[#DC2626] transition-all" style={{ width: `${pctFora ?? 0}%` }} />
        </div>
      </div>

      {/* Ranking motoristas fora do raio */}
      <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Motoristas com Maior Desvio de Raio</h2>
        <div className="overflow-y-auto max-h-96 pr-4">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-16" />
              <col className="w-16" />
            </colgroup>
            <thead className="sticky top-0 bg-[#141414] z-10">
              <tr className="text-gray-500 text-xs uppercase border-b border-white/5">
                <th className="text-left pb-3">#</th>
                <th className="text-left pb-3">Motorista</th>
                <th className="text-right pb-3">Entregas</th>
                <th className="text-right pb-3">Fora Raio</th>
                <th className="text-right pb-3">% Fora</th>
                <th className="text-right pb-3">Dev.</th>
              </tr>
            </thead>
            <tbody>
              {motoristas.map((m: any, i: number) => (
                <tr key={m.motorista} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3 text-[#C9A84C] font-bold">{i + 1}</td>
                  <td className="py-3 text-white font-medium truncate pr-2">{resolveMotorista(motMap, m.motorista)}</td>
                  <td className="py-3 text-right text-gray-400">{m.total.toLocaleString('pt-BR')}</td>
                  <td className="py-3 text-right text-gray-300">{m.fora_raio.toLocaleString('pt-BR')}</td>
                  <td className="py-3 text-right font-bold text-[#C9A84C]">{formatPct(m.pct_fora)}</td>
                  <td className="py-3 text-right text-gray-400">{m.dev.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {motoristas.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-600">Nenhum dado encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
