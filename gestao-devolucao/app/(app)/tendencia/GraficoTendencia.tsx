'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface Semana { semana: string; fat: number; dev: number; pct: number }

interface Props {
  dados:  Semana[]
  media:  number
}

const AMARELO = '#F2C800'
const AZUL    = '#003087'

const TooltipCustom = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs space-y-1 shadow-sm">
      <p className="text-gray-500">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.name === '% Dev.' ? `${p.value.toFixed(2)}%` : p.value.toLocaleString('pt-BR') : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export function GraficoTendencia({ dados, media }: Props) {
  if (!dados.length) return <p className="text-gray-400 text-xs text-center py-10">Sem dados suficientes.</p>

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-500 mb-4">% Devolução por semana</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={dados} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="semana"
              tick={{ fill: '#6B7280', fontSize: 10 }}
              tickFormatter={v => {
                const d = new Date(v + 'T12:00:00')
                return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
              }}
            />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip content={<TooltipCustom />} />
            {media > 0 && (
              <ReferenceLine
                y={media}
                stroke="#6B7280"
                strokeDasharray="4 4"
                label={{ value: `Média ${media.toFixed(1)}%`, fill: '#6B7280', fontSize: 9, position: 'insideTopRight' }}
              />
            )}
            <Line
              dataKey="pct"
              name="% Dev."
              stroke={AMARELO}
              strokeWidth={2.5}
              dot={{ fill: AMARELO, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: AMARELO }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-500 mb-4">Volume — Faturados vs Devolvidos</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dados} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="semana"
              tick={{ fill: '#6B7280', fontSize: 10 }}
              tickFormatter={v => {
                const d = new Date(v + 'T12:00:00')
                return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
              }}
            />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} />
            <Tooltip content={<TooltipCustom />} />
            <Line dataKey="fat" name="Faturados" stroke="#D1D5DB" strokeWidth={1.5} dot={false} />
            <Line dataKey="dev" name="Devolvidos" stroke={AZUL} strokeWidth={2} dot={{ fill: AZUL, r: 2, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
