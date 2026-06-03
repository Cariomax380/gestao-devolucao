export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct } from '@/lib/utils'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'
import { Suspense } from 'react'
import { ReversaoMemoria } from './ReversaoMemoria'
import type { RegistroReversao } from '@/lib/calcular-reversao'
import { ErroRPC } from '@/components/layout/ErroRPC'

export default async function ReversaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  // ── Busca paralela: KPIs (RPC) + registros brutos + períodos + motoristas ──
  // Inclui devolvidos, repasses E tratativas_abertas (pendentes = devolução não revertida)
  let rawQuery = supabase
    .from('devolucoes')
    .select('status_final, pdvs_devolvidos, pdv_repasse, motorista, codigo_pdv, data_rota, motivo, rota')
    .or('pdvs_devolvidos.gt.0,pdv_repasse.gt.0,status_final.eq.tratativa_aberta')

  if (periodo) rawQuery = rawQuery.like('periodo', `${periodo}%`)

  const [
    { data: res, error: errRes },
    { data: periodos },
    { data: rawRows },
    motMap,
  ] = await Promise.all([
    supabase.rpc('resumo_reversoes', { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
    rawQuery,
    getMotoristaMap(),
  ])

  if (errRes) return <ErroRPC nome="resumo_reversoes" />

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpi          = res?.[0] ?? {}
  const totalDev     = Number(kpi.total_dev    ?? 0)
  const totalRepasse = Number(kpi.total_repasse ?? 0)
  const totalRevert  = Number(kpi.total_revert  ?? 0)

  interface Tratativa {
    data_rota: string | null
    motorista: string | null
    cliente?:  string | null  // opcional: pode não vir da RPC dependendo da versão
    motivo:    string | null
  }
  const tratativas: Tratativa[] = kpi.tratativas_abertas ?? []

  // % Reversão = QTD REV / (QTD DEV + QTD REV)
  // QTD DEV = todos os devolvidos + tratativas (independente de reattempt)
  // QTD REV = SUM(pdv_repasse) — reattempts entregues
  // Um registro pode contar nos dois lados (devolvido que também teve reattempt)
  const totalOportunidades = totalDev + totalRepasse
  const pctReversao = totalOportunidades > 0
    ? (totalRepasse / totalOportunidades) * 100
    : null

  // ── Registros para memória de cálculo ─────────────────────────────────────
  const registros: RegistroReversao[] = (rawRows ?? []).map(r => ({
    status_final:    r.status_final ?? null,
    pdvs_devolvidos: Number(r.pdvs_devolvidos ?? 0),
    pdv_repasse:     Number(r.pdv_repasse     ?? 0),
    motorista_nome:  resolveMotorista(motMap, r.motorista),
    codigo_pdv:      r.codigo_pdv ? String(r.codigo_pdv).trim() : null,
    data_rota:       r.data_rota ?? null,
    motivo:          r.motivo    ?? null,
    rota:            r.rota      ?? null,
  }))

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Reversões e Repasses</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {periodo ? `Período ${periodo}` : 'Acumulado total da base'}
          </p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Devolvidos',
            value: totalDev.toLocaleString('pt-BR'),
            accent: '#F2C800',
            sub:    'devolvidos não revertidos',
          },
          {
            label: 'Repasses',
            value: totalRepasse.toLocaleString('pt-BR'),
            accent: '#F2C800',
            sub:    'QTD REV — revertidas via repasse',
          },
          {
            label: 'Tratativas Abertas',
            value: String(tratativas.length),
            accent: '#EF4444',
            alert:  true,
            sub:    '',
          },
          {
            label:     '% Reversão',
            value:     formatPct(pctReversao, 2),
            accent:    '#7c3aed',
            highlight: true,
            sub:       'QTD REV ÷ (QTD REV + QTD DEV)',
          },
        ].map(c => (
          <div
            key={c.label}
            className="bg-white border border-gray-100 rounded-xl p-5"
            style={{ borderLeftWidth: 4, borderLeftColor: c.accent }}
          >
            <p className="text-sm text-gray-500 font-medium mb-1 leading-tight">{c.label}</p>
            <p className={`text-2xl font-bold ${
              c.alert     ? 'text-[#EF4444]' :
              c.highlight ? 'text-[#7c3aed]' :
              'text-[#003087]'
            }`}>
              {c.value}
            </p>
            {c.sub && (
              <p className="text-[10px] text-gray-400 mt-1">{c.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Memória de cálculo */}
      <ReversaoMemoria registros={registros} />

      {/* Fila de tratativas abertas */}
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
                    <td className="py-2 px-2 text-gray-700 truncate">
                      {resolveMotorista(motMap, r.motorista)}
                    </td>
                    <td className="py-2 px-2 text-gray-500 max-w-[200px] truncate">
                      {r.cliente ?? '—'}
                    </td>
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
