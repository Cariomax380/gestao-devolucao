'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { ResultadoReversao } from '@/lib/calcular-reversao'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function abrevMes(periodo: string) {
  const m = parseInt(periodo.split('-')[1]) - 1
  return MESES[m] ?? periodo
}

interface DadoMensal {
  periodo:      string
  qtd_rev:      number
  qtd_dev:      number
  pct_reversao: number
}

interface Props {
  mensal:        DadoMensal[]
  topMotoristas: ResultadoReversao[]
}

function TooltipMensal({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as DadoMensal
  const pct = d.pct_reversao
  return (
    <div className="bg-white border border-gray-100 shadow-md rounded-xl p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-[#003087] mb-2">{abrevMes(d.periodo)} / {d.periodo.slice(0, 4)}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Repasses</span>
          <span className="font-semibold text-[#10B981]">{d.qtd_rev.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Devolvidos</span>
          <span className="font-semibold text-[#EF4444]">{d.qtd_dev.toLocaleString('pt-BR')}</span>
        </div>
        <div className="border-t border-gray-50 pt-1.5 flex justify-between gap-4">
          <span className="text-gray-400">% Reversão</span>
          <span className="font-bold text-[#7c3aed]">{pct.toFixed(2).replace('.', ',')}%</span>
        </div>
      </div>
    </div>
  )
}

function corPorPct(pct: number) {
  if (pct >= 0.7) return { bar: '#10B981', badge: 'bg-[#10B981]/10 text-[#10B981]' }
  if (pct >= 0.5) return { bar: '#F2C800', badge: 'bg-[#F2C800]/20 text-[#D4A800]' }
  return { bar: '#0057A8', badge: 'bg-[#0057A8]/10 text-[#0057A8]' }
}

export function ReversaoGraficos({ mensal, topMotoristas }: Props) {
  const top10 = topMotoristas.slice(0, 10)

  if (!mensal.length && !top10.length) return null

  // Média para reference line
  const media = mensal.length
    ? mensal.reduce((s, d) => s + d.pct_reversao, 0) / mensal.length
    : 0

  const melhor = mensal.length ? Math.max(...mensal.map(d => d.pct_reversao)) : 0
  const pior   = mensal.length ? Math.min(...mensal.map(d => d.pct_reversao)) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Evolução mensal — área limpa */}
      {mensal.length > 1 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-[#003087]">% Reversão — Evolução Mensal</p>
              <p className="text-xs text-gray-400 mt-0.5">Tendência do ano por mês</p>
            </div>
            <div className="flex gap-3 text-right">
              <div>
                <p className="text-[10px] text-gray-400">Melhor</p>
                <p className="text-xs font-bold text-[#10B981]">{melhor.toFixed(1).replace('.', ',')}%</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Pior</p>
                <p className="text-xs font-bold text-[#EF4444]">{pior.toFixed(1).replace('.', ',')}%</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Média</p>
                <p className="text-xs font-bold text-[#7c3aed]">{media.toFixed(1).replace('.', ',')}%</p>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mensal} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReversao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F3F4F6" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="periodo"
                tickFormatter={abrevMes}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
              />
              <ReferenceLine
                y={media}
                stroke="#7c3aed"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
              <Tooltip content={<TooltipMensal />} />
              <Area
                type="monotone"
                dataKey="pct_reversao"
                stroke="#7c3aed"
                strokeWidth={2.5}
                fill="url(#gradReversao)"
                dot={{ r: 4, fill: '#7c3aed', stroke: 'white', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#7c3aed', stroke: 'white', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranking de motoristas — cards */}
      {top10.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-semibold text-[#003087] mb-0.5">Top Motoristas — Repasses</p>
          <p className="text-xs text-gray-400 mb-4">Maior volume de PDVs revertidos via repasse</p>

          <div className="space-y-2 overflow-auto max-h-[240px] pr-1">
            {top10.map((r, i) => {
              const cores = corPorPct(r.percentual_reversao)
              return (
                <div key={r.grupo} className="flex items-center gap-3">
                  {/* posição */}
                  <span className="text-[#D4A800] font-bold text-xs w-5 shrink-0 text-right">
                    {i + 1}
                  </span>

                  {/* nome + barra */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#111111] truncate max-w-[160px]">
                        {r.grupo}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-[#10B981] font-semibold">
                          {r.qtd_rev} rep
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cores.badge}`}>
                          {r.percentual_reversao_formatado}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${r.percentual_reversao * 100}%`,
                          backgroundColor: cores.bar,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* legenda */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50">
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
      )}

    </div>
  )
}
