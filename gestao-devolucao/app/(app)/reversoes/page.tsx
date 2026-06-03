export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct } from '@/lib/utils'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { ReversaoMemoria } from './ReversaoMemoria'
import { ReversaoGraficos } from './ReversaoGraficos'
import type { ResultadoReversao, Agrupamento } from '@/lib/calcular-reversao'
import { ErroRPC } from '@/components/layout/ErroRPC'

type RPCRow = { grupo: string; qtd_rev: number; qtd_dev: number; total_oportunidades: number }

function mapAgrupamento(rows: RPCRow[] | null): ResultadoReversao[] {
  return (rows ?? []).map(r => {
    const qtd_rev = Number(r.qtd_rev)
    const qtd_dev = Number(r.qtd_dev)
    const total   = qtd_rev + qtd_dev
    const pct     = total > 0 ? qtd_rev / total : 0
    return {
      grupo:                         r.grupo ?? '',
      qtd_rev,
      qtd_dev,
      total_oportunidades:           Number(r.total_oportunidades),
      percentual_reversao:           pct,
      percentual_reversao_formatado: `${(pct * 100).toFixed(2).replace('.', ',')}%`,
    }
  })
}

export default async function ReversaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo } = await searchParams
  const p = periodo ?? null

  const [
    { data: res, error: errRes },
    { data: periodos },
    { data: rowGeral },
    { data: rowMotorista },
    { data: rowPdv },
    { data: rowData },
    { data: rowMotivo },
    { data: rowRota },
    { data: rowMensal },
  ] = await Promise.all([
    supabase.rpc('resumo_reversoes',          { p_periodo: p }),
    supabase.rpc('periodos_disponiveis'),
    supabase.rpc('resumo_reversoes_agrupado', { p_periodo: p, p_agrupamento: 'geral'     }),
    supabase.rpc('resumo_reversoes_agrupado', { p_periodo: p, p_agrupamento: 'motorista' }),
    supabase.rpc('resumo_reversoes_agrupado', { p_periodo: p, p_agrupamento: 'cod_pdv'   }),
    supabase.rpc('resumo_reversoes_agrupado', { p_periodo: p, p_agrupamento: 'data'      }),
    supabase.rpc('resumo_reversoes_agrupado', { p_periodo: p, p_agrupamento: 'motivo'    }),
    supabase.rpc('resumo_reversoes_agrupado', { p_periodo: p, p_agrupamento: 'rota'      }),
    supabase.rpc('resumo_reversoes_mensal',   { p_periodo: p }),
  ])

  if (errRes) return <ErroRPC nome="resumo_reversoes" />

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpi          = res?.[0] ?? {}
  const totalDev     = Number(kpi.total_dev    ?? 0)
  const totalRepasse = Number(kpi.total_repasse ?? 0)

  const totalOportunidades = totalDev + totalRepasse
  const pctReversao = totalOportunidades > 0
    ? (totalRepasse / totalOportunidades) * 100
    : null

  // ── Dados da memória de cálculo ───────────────────────────────────────────
  const memoriaData: Record<Agrupamento, ResultadoReversao[]> = {
    geral:     mapAgrupamento(rowGeral     as RPCRow[] | null),
    motorista: mapAgrupamento(rowMotorista as RPCRow[] | null),
    cod_pdv:   mapAgrupamento(rowPdv       as RPCRow[] | null),
    data:      mapAgrupamento(rowData      as RPCRow[] | null),
    motivo:    mapAgrupamento(rowMotivo    as RPCRow[] | null),
    rota:      mapAgrupamento(rowRota      as RPCRow[] | null),
  }

  // ── Dados mensais para gráfico de tendência ───────────────────────────────
  const dadosMensais = (rowMensal ?? []).map((r: any) => ({
    periodo:      r.periodo as string,
    qtd_rev:      Number(r.qtd_rev),
    qtd_dev:      Number(r.qtd_dev),
    pct_reversao: Number(r.pct_reversao),
  }))

  // ── Motoristas sem nenhum repasse no período ───────────────────────────────
  const semReversao = memoriaData.motorista
    .filter(r => r.qtd_rev === 0 && r.qtd_dev > 0)
    .sort((a, b) => b.qtd_dev - a.qtd_dev)

  const qtdSemReversao = semReversao.length

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
        <div className="bg-white border border-gray-100 rounded-xl p-5" style={{ borderLeftWidth: 4, borderLeftColor: '#F2C800' }}>
          <p className="text-sm text-gray-500 font-medium mb-1 leading-tight">Total Devolvidos</p>
          <p className="text-2xl font-bold text-[#003087]">{totalDev.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] text-gray-400 mt-1">QTD DEV no período</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5" style={{ borderLeftWidth: 4, borderLeftColor: '#10B981' }}>
          <p className="text-sm text-gray-500 font-medium mb-1 leading-tight">Repasses</p>
          <p className="text-2xl font-bold text-[#003087]">{totalRepasse.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] text-gray-400 mt-1">QTD REV — revertidas via repasse</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5" style={{ borderLeftWidth: 4, borderLeftColor: '#EF4444' }}>
          <p className="text-sm text-gray-500 font-medium mb-1 leading-tight">Sem Reversão</p>
          <p className="text-2xl font-bold text-[#EF4444]">{qtdSemReversao.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] text-gray-400 mt-1">motoristas com 0 repasses</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5" style={{ borderLeftWidth: 4, borderLeftColor: '#7c3aed' }}>
          <p className="text-sm text-gray-500 font-medium mb-1 leading-tight">% Reversão</p>
          <p className="text-2xl font-bold text-[#7c3aed]">{formatPct(pctReversao, 2)}</p>
          <p className="text-[10px] text-gray-400 mt-1">QTD REV ÷ (QTD REV + QTD DEV)</p>
        </div>
      </div>

      {/* Gráficos */}
      <ReversaoGraficos
        mensal={dadosMensais}
        topMotoristas={memoriaData.motorista}
      />

      {/* Memória de cálculo */}
      <ReversaoMemoria dados={memoriaData} />

      {/* Motoristas sem nenhum repasse */}
      {semReversao.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-[#003087]">Motoristas Sem Reversão</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Nenhum repasse registrado no período — ordenado por volume de devoluções
              </p>
            </div>
            <span className="text-xs font-bold text-[#EF4444] bg-[#EF4444]/10 px-2 py-1 rounded-full">
              {qtdSemReversao} motorista{qtdSemReversao !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#003087] text-white text-xs font-medium">
                  <th className="text-left py-3 px-3 rounded-tl-lg w-8">#</th>
                  <th className="text-left py-3 px-3">Motorista</th>
                  <th className="text-right py-3 px-3 w-24">QTD DEV</th>
                  <th className="text-right py-3 px-3 w-28 rounded-tr-lg">Oportunidades</th>
                </tr>
              </thead>
              <tbody>
                {semReversao.map((r, i) => (
                  <tr key={r.grupo} className="border-b border-gray-50 hover:bg-[#FFF8DC] transition-colors">
                    <td className="py-2.5 px-3 text-[#D4A800] font-bold text-xs">{i + 1}</td>
                    <td className="py-2.5 px-3 text-[#111111] font-medium text-xs max-w-[200px] truncate">
                      {r.grupo}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#EF4444] font-semibold text-xs">
                      {r.qtd_dev.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-500 text-xs">
                      {r.total_oportunidades.toLocaleString('pt-BR')}
                    </td>
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
