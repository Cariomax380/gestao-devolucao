'use client'

import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { ResultadoReversao } from '@/lib/calcular-reversao'

export interface CruzadoRow {
  motivo:    string
  motorista: string
  qtd_rev:   number
  qtd_dev:   number
}

interface Props {
  motivos: ResultadoReversao[]
  cruzado: CruzadoRow[]
}

function abrev(s: string, max = 13) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function TooltipPareto({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as ResultadoReversao & { acumPct: number }
  return (
    <div className="bg-white border border-gray-100 shadow-md rounded-xl p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-[#003087] mb-2 leading-tight">{d.grupo}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Total devoluções</span>
          <span className="font-semibold text-[#003087]">{d.total_oportunidades.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Revertidos (REV)</span>
          <span className="font-semibold text-[#10B981]">{d.qtd_rev.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Não revertidos (DEV)</span>
          <span className="font-semibold text-[#EF4444]">{d.qtd_dev.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">% Reversão</span>
          <span className="font-bold text-[#7c3aed]">{d.percentual_reversao_formatado}</span>
        </div>
        <div className="border-t border-gray-50 pt-1 flex justify-between gap-4">
          <span className="text-gray-400">% acumulado</span>
          <span className="font-semibold text-[#003087]">{d.acumPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

type HeatMetric = 'pct' | 'rev' | 'dev'

interface CellData { qtd_rev: number; qtd_dev: number; pct: number }

function celStyle(cell: CellData | null, metric: HeatMetric, maxRev: number, maxDev: number) {
  if (!cell) return { background: '#F9FAFB', color: '#D1D5DB' }

  if (metric === 'pct') {
    if (cell.pct >= 0.7) return { background: '#10B98122', color: '#059669' }
    if (cell.pct >= 0.5) return { background: '#F2C80030', color: '#B8960C' }
    if (cell.pct > 0)    return { background: '#7c3aed18', color: '#7c3aed' }
    return { background: '#EF444415', color: '#DC2626' }
  }

  if (metric === 'rev') {
    const ratio = maxRev > 0 ? cell.qtd_rev / maxRev : 0
    const alpha = Math.round(ratio * 180 + 20).toString(16).padStart(2, '0')
    return { background: `#10B981${alpha}`, color: '#065F46' }
  }

  const ratio = maxDev > 0 ? cell.qtd_dev / maxDev : 0
  const alpha = Math.round(ratio * 180 + 20).toString(16).padStart(2, '0')
  return { background: `#EF4444${alpha}`, color: '#7F1D1D' }
}

function celLabel(cell: CellData | null, metric: HeatMetric) {
  if (!cell) return '—'
  if (metric === 'pct') return cell.pct > 0 ? `${(cell.pct * 100).toFixed(0)}%` : '0%'
  if (metric === 'rev') return cell.qtd_rev > 0 ? cell.qtd_rev.toString() : '—'
  return cell.qtd_dev > 0 ? cell.qtd_dev.toString() : '—'
}

export function ReversaoMotivo({ motivos, cruzado }: Props) {
  const [heatMetric, setHeatMetric] = useState<HeatMetric>('pct')

  if (!motivos.length) return null

  // ── Pareto ────────────────────────────────────────────────────────────────
  // Usa total_oportunidades (REV + DEV) — mesmo denominador do % Reversão
  const totalOport = motivos.reduce((s, m) => s + m.total_oportunidades, 0) || 1
  let acum = 0
  const paretoData = motivos
    .slice()
    .sort((a, b) => b.total_oportunidades - a.total_oportunidades)
    .map(m => {
      acum += m.total_oportunidades
      return { ...m, acumPct: (acum / totalOport) * 100 }
    })

  // ── % Reversão por motivo (maior → menor) ─────────────────────────────────
  const reversaoData = motivos
    .slice()
    .sort((a, b) => b.percentual_reversao - a.percentual_reversao)

  // ── Heatmap: top motoristas por total de oportunidades ────────────────────
  const motoristaAgg = new Map<string, { rev: number; dev: number }>()
  for (const r of cruzado) {
    const cur = motoristaAgg.get(r.motorista) ?? { rev: 0, dev: 0 }
    motoristaAgg.set(r.motorista, { rev: cur.rev + r.qtd_rev, dev: cur.dev + r.qtd_dev })
  }
  const topMotoristas = [...motoristaAgg.entries()]
    .sort((a, b) => (b[1].rev + b[1].dev) - (a[1].rev + a[1].dev))
    .slice(0, 12)
    .map(([nome]) => nome)

  const heatIdx = new Map<string, CellData>()
  for (const r of cruzado) {
    const total = r.qtd_rev + r.qtd_dev
    heatIdx.set(`${r.motivo}|${r.motorista}`, {
      qtd_rev: r.qtd_rev,
      qtd_dev: r.qtd_dev,
      pct: total > 0 ? r.qtd_rev / total : 0,
    })
  }

  // reduce em vez de spread — evita RangeError em arrays grandes (>100k linhas)
  const maxRev = cruzado.reduce((m, r) => Math.max(m, r.qtd_rev), 1)
  const maxDev = cruzado.reduce((m, r) => Math.max(m, r.qtd_dev), 1)

  const motivosHeat = motivos.slice().sort((a, b) => b.total_oportunidades - a.total_oportunidades)

  return (
    <div className="space-y-4">

      {/* Row 1: Pareto + % Reversão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pareto */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-semibold text-[#003087] mb-0.5">Pareto de Devoluções por Motivo</p>
          <p className="text-xs text-gray-400 mb-4">
            Barras = Total devoluções (REV + DEV) &nbsp;·&nbsp; Linha = % acumulada &nbsp;·&nbsp; <span className="text-[#7c3aed]">traço 80%</span>
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={paretoData} margin={{ top: 8, right: 28, left: -18, bottom: 44 }}>
              <CartesianGrid stroke="#F3F4F6" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="grupo"
                tick={{ fontSize: 9, fill: '#9CA3AF' }}
                tickFormatter={v => abrev(v, 11)}
                angle={-35}
                textAnchor="end"
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine yAxisId="right" y={80} stroke="#7c3aed" strokeDasharray="3 3" strokeOpacity={0.35} />
              <Tooltip content={<TooltipPareto />} />
              <Bar yAxisId="left" dataKey="total_oportunidades" fill="#F2C800" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acumPct"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#7c3aed', stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#7c3aed', stroke: 'white', strokeWidth: 1.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* % Reversão por motivo */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-semibold text-[#003087] mb-0.5">% Reversão por Motivo</p>
          <p className="text-xs text-gray-400 mb-4">Taxa de reversão — do maior para o menor</p>

          <div className="space-y-3 overflow-auto max-h-[210px] pr-1">
            {reversaoData.map(m => {
              const pct  = m.percentual_reversao
              const cor  = pct >= 0.7 ? '#10B981' : pct >= 0.5 ? '#F2C800' : '#0057A8'
              return (
                <div key={m.grupo}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 truncate max-w-[160px]" title={m.grupo}>
                      {m.grupo}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-gray-400">
                        {m.qtd_rev} REV · {m.qtd_dev} DEV
                      </span>
                      <span className="text-xs font-bold min-w-[42px] text-right" style={{ color: cor }}>
                        {m.percentual_reversao_formatado}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, backgroundColor: cor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" />≥ 70%
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-2 h-2 rounded-full bg-[#F2C800] inline-block" />50–70%
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-2 h-2 rounded-full bg-[#0057A8] inline-block" />&lt; 50%
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Heatmap motivo × motorista */}
      {topMotoristas.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-[#003087]">Reversão por Motivo × Motorista</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Top {topMotoristas.length} motoristas por oportunidades · motivos ordenados por total de devoluções
              </p>
            </div>
            <div className="flex gap-1">
              {([['pct', '% Rev'], ['rev', 'QTD REV'], ['dev', 'QTD DEV']] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setHeatMetric(v)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    heatMetric === v
                      ? 'bg-[#F2C800] text-[#003087]'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto">
            <div
              className="grid gap-1 mb-1"
              style={{ gridTemplateColumns: `190px repeat(${topMotoristas.length}, minmax(56px, 1fr))` }}
            >
              <div />
              {topMotoristas.map(mot => (
                <div
                  key={mot}
                  className="text-center text-[9px] text-gray-500 font-medium pb-1 truncate px-0.5"
                  title={mot}
                >
                  {abrev(mot, 8)}
                </div>
              ))}
            </div>

            {motivosHeat.map(m => (
              <div
                key={m.grupo}
                className="grid gap-1 mb-1 items-center"
                style={{ gridTemplateColumns: `190px repeat(${topMotoristas.length}, minmax(56px, 1fr))` }}
              >
                <p className="text-xs text-gray-700 truncate pr-2" title={m.grupo}>{m.grupo}</p>
                {topMotoristas.map(mot => {
                  const cell  = heatIdx.get(`${m.grupo}|${mot}`) ?? null
                  const style = celStyle(cell, heatMetric, maxRev, maxDev)
                  return (
                    <div
                      key={mot}
                      title={`${m.grupo} — ${mot}: ${celLabel(cell, heatMetric)}`}
                      className="h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold border border-white/40"
                      style={style}
                    >
                      {celLabel(cell, heatMetric)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {heatMetric === 'pct' && (
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50 flex-wrap">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="inline-block w-3 h-3 rounded border" style={{ background: '#10B98122', borderColor: '#10B981' }} />≥ 70%
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="inline-block w-3 h-3 rounded border" style={{ background: '#F2C80030', borderColor: '#D4A800' }} />50–70%
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="inline-block w-3 h-3 rounded border" style={{ background: '#7c3aed18', borderColor: '#7c3aed' }} />&lt; 50%
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="inline-block w-3 h-3 rounded border" style={{ background: '#EF444415', borderColor: '#EF4444' }} />0%
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="inline-block w-3 h-3 rounded bg-[#F9FAFB] border border-gray-200" />Sem dados
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
