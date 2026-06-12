'use client'

import { useState } from 'react'
import {
  ComposedChart, Bar, Line, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

export interface PdvFechadoDia {
  data_rota:    string
  qtd_rev:      number
  qtd_dev:      number
  pct_reversao: number
}

interface Props {
  dados:    PdvFechadoDia[]
  periodo?: string | null
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmtDia(d: string) {
  const p = d.split('-')
  return p.length >= 3 ? `${p[2]}/${p[1]}` : d
}

function fmtMes(d: string) {
  const p = d.split('-')
  return p.length >= 2 ? (MESES[parseInt(p[1], 10) - 1] ?? d) : d
}

function agregarPorMes(dados: PdvFechadoDia[]): PdvFechadoDia[] {
  const mapa = new Map<string, { qtd_rev: number; qtd_dev: number }>()
  for (const d of dados) {
    const mes   = d.data_rota.substring(0, 7)
    const entry = mapa.get(mes) ?? { qtd_rev: 0, qtd_dev: 0 }
    entry.qtd_rev += d.qtd_rev
    entry.qtd_dev += d.qtd_dev
    mapa.set(mes, entry)
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, { qtd_rev, qtd_dev }]) => {
      const total = qtd_rev + qtd_dev
      return {
        data_rota:    mes,
        qtd_rev,
        qtd_dev,
        pct_reversao: total > 0 ? (qtd_rev / total) * 100 : 0,
      }
    })
}

function TooltipCustom({ active, payload, label, isAnual }: any) {
  if (!active || !payload?.length) return null
  const rev   = payload.find((p: any) => p.dataKey === 'qtd_rev')?.value ?? 0
  const dev   = payload.find((p: any) => p.dataKey === 'qtd_dev')?.value ?? 0
  const pct   = payload.find((p: any) => p.dataKey === 'pct_reversao')?.value ?? 0
  const total = rev + dev
  return (
    <div className="bg-white border border-gray-100 shadow-md rounded-xl p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-[#003087] mb-2">
        {isAnual ? `${label} / ${new Date().getFullYear()}` : label}
      </p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Revertidos (REV)</span>
          <span className="font-semibold text-[#10B981]">{rev.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Não revertidos (DEV)</span>
          <span className="font-semibold text-[#EF4444]">{dev.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Total</span>
          <span className="font-semibold text-[#003087]">{total.toLocaleString('pt-BR')}</span>
        </div>
        <div className="border-t border-gray-50 pt-1 flex justify-between gap-4">
          <span className="text-gray-400">% Reversão</span>
          <span className="font-bold text-[#7c3aed]">{Number(pct).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

export function ReversaoPdvFechado({ dados, periodo }: Props) {
  const [vista, setVista] = useState<'grafico' | 'tabela'>('grafico')

  const isAnual    = !periodo || periodo.length <= 4
  const dadosVista = isAnual ? agregarPorMes(dados) : dados
  const fmtLabel   = isAnual ? fmtMes : fmtDia
  const titulo     = isAnual ? 'PDV Fechado — Reversão Mês a Mês' : 'PDV Fechado — Reversão Dia a Dia'
  const subtitulo  = isAnual
    ? 'Abertura mensal de devoluções e repasses para o motivo PDV fechado'
    : 'Abertura diária de devoluções e repasses para o motivo PDV fechado'

  if (dados.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-sm font-semibold text-[#003087] mb-1">{titulo}</p>
        <p className="text-xs text-gray-400">Nenhum registro de PDV fechado no período.</p>
      </div>
    )
  }

  const totalRev = dadosVista.reduce((s, d) => s + d.qtd_rev, 0)
  const totalDev = dadosVista.reduce((s, d) => s + d.qtd_dev, 0)
  const totalOp  = totalRev + totalDev
  const pctGeral = totalOp > 0 ? (totalRev / totalOp) * 100 : 0

  const chartData = dadosVista.map(d => ({
    ...d,
    data_fmt: fmtLabel(d.data_rota),
  }))

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[#003087]">{titulo}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>
        </div>
        <div className="flex gap-1">
          {(['grafico', 'tabela'] as const).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`text-[11px] px-3 py-1 rounded-full font-medium transition-colors ${
                vista === v
                  ? 'bg-[#003087] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {v === 'grafico' ? 'Gráfico' : 'Tabela'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#FFF8DC] rounded-lg p-3">
          <p className="text-[10px] text-gray-500 font-medium">Total Oportunidades</p>
          <p className="text-xl font-bold text-[#003087]">{totalOp.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-[#DCFCE7] rounded-lg p-3">
          <p className="text-[10px] text-gray-500 font-medium">Revertidos (REV)</p>
          <p className="text-xl font-bold text-[#10B981]">{totalRev.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-[#F3E8FF] rounded-lg p-3">
          <p className="text-[10px] text-gray-500 font-medium">% Reversão PDV Fechado</p>
          <p className="text-xl font-bold text-[#7c3aed]">
            {pctGeral.toFixed(1).replace('.', ',')}%
          </p>
        </div>
      </div>

      {/* Gráfico */}
      {vista === 'grafico' && (
        <ResponsiveContainer width="100%" height={290}>
          <ComposedChart data={chartData} margin={{ top: 24, right: 40, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" />
            <XAxis
              dataKey="data_fmt"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="qtd"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 10, fill: '#7c3aed' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip content={<TooltipCustom isAnual={isAnual} />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) =>
                value === 'qtd_rev' ? 'REV' : value === 'qtd_dev' ? 'DEV' : '% Reversão'
              }
            />
            <Bar yAxisId="qtd" dataKey="qtd_rev" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} name="qtd_rev" />
            <Bar yAxisId="qtd" dataKey="qtd_dev" stackId="a" fill="#EF4444" radius={[3, 3, 0, 0]} name="qtd_dev" />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="pct_reversao"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ r: 3, fill: '#7c3aed' }}
              name="pct_reversao"
            >
              <LabelList
                dataKey="pct_reversao"
                position="top"
                formatter={(v: number) => `${Number(v).toFixed(1)}%`}
                style={{ fontSize: 10, fill: '#7c3aed', fontWeight: 700 }}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Tabela */}
      {vista === 'tabela' && (
        <div className="overflow-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003087] text-white font-medium">
                <th className="text-left py-2.5 px-3 rounded-tl-lg">
                  {isAnual ? 'Mês' : 'Data'}
                </th>
                <th className="text-right py-2.5 px-3">REV</th>
                <th className="text-right py-2.5 px-3">DEV</th>
                <th className="text-right py-2.5 px-3">Total</th>
                <th className="text-right py-2.5 px-3 rounded-tr-lg">% Reversão</th>
              </tr>
            </thead>
            <tbody>
              {dadosVista.map(d => {
                const total = d.qtd_rev + d.qtd_dev
                const pct   = Number(d.pct_reversao)
                return (
                  <tr key={d.data_rota} className="border-b border-gray-50 hover:bg-[#FFF8DC] transition-colors">
                    <td className="py-2 px-3 font-medium text-[#003087]">
                      {fmtLabel(d.data_rota)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-[#10B981]">
                      {d.qtd_rev.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-[#EF4444]">
                      {d.qtd_dev.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {total.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#7c3aed]">
                      {pct.toFixed(1).replace('.', ',')}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-xs">
                <td className="py-2 px-3 text-[#003087]">Total</td>
                <td className="py-2 px-3 text-right text-[#10B981]">{totalRev.toLocaleString('pt-BR')}</td>
                <td className="py-2 px-3 text-right text-[#EF4444]">{totalDev.toLocaleString('pt-BR')}</td>
                <td className="py-2 px-3 text-right text-gray-600">{totalOp.toLocaleString('pt-BR')}</td>
                <td className="py-2 px-3 text-right text-[#7c3aed]">
                  {pctGeral.toFixed(1).replace('.', ',')}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
