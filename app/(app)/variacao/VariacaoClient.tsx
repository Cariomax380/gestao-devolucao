'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, ResponsiveContainer,
} from 'recharts'

type Filtro  = 'todos' | 'piorado' | 'melhorado' | 'novo'
type SortCol = 'delta' | 'pct_atual' | 'fat_atual' | 'dev_atual' | 'nome'

export interface MotoristaVariacao {
  motorista: string
  nome: string
  fat_atual: number
  dev_atual: number
  pct_atual: number
  fat_ant: number
  dev_ant: number
  pct_ant: number | null
  delta: number | null
}

interface Props {
  motoristas: MotoristaVariacao[]
  periodoAtual: string
  periodoAntLabel: string
}

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',     label: 'Todos'         },
  { key: 'piorado',   label: 'Pioraram'      },
  { key: 'melhorado', label: 'Melhoraram'    },
  { key: 'novo',      label: 'Sem histórico' },
]

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null)
    return <span className="text-gray-400 text-[10px] flex items-center gap-0.5"><Minus size={10} /> novo</span>
  if (delta === 0)
    return <span className="text-gray-500 text-[10px] flex items-center gap-0.5"><Minus size={10} /> 0,0 p.p.</span>
  if (delta > 0)
    return (
      <span className="text-[#EF4444] text-[10px] font-bold flex items-center gap-0.5">
        <TrendingUp size={11} /> +{delta.toFixed(1)} p.p.
      </span>
    )
  return (
    <span className="text-[#10B981] text-[10px] font-bold flex items-center gap-0.5">
      <TrendingDown size={11} /> {delta.toFixed(1)} p.p.
    </span>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].value as number
  return (
    <div className="bg-white border border-gray-100 shadow rounded-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1 max-w-[180px] truncate">{label}</p>
      <p style={{ color: d > 0 ? '#EF4444' : '#10B981' }} className="font-bold">
        Δ {d > 0 ? '+' : ''}{d.toFixed(1)} p.p.
      </p>
    </div>
  )
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: 'asc' | 'desc' }) {
  if (col !== sortCol) return <ChevronsUpDown size={11} className="opacity-30 shrink-0" />
  return sortDir === 'desc'
    ? <ChevronDown size={11} className="shrink-0" />
    : <ChevronUp size={11} className="shrink-0" />
}

export function VariacaoClient({ motoristas, periodoAtual, periodoAntLabel }: Props) {
  const [filtro,  setFiltro]  = useState<Filtro>('todos')
  const [busca,   setBusca]   = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('delta')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const piorados   = motoristas.filter(m => m.delta !== null && m.delta  > 0)
  const melhorados = motoristas.filter(m => m.delta !== null && m.delta  < 0)
  const novos      = motoristas.filter(m => m.delta === null)

  const comHistorico = motoristas.filter(m => m.delta !== null)
  const deltaMedia   = comHistorico.length > 0
    ? comHistorico.reduce((acc, m) => acc + (m.delta ?? 0), 0) / comHistorico.length
    : null

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const filtrados = useMemo(() => {
    let base: MotoristaVariacao[]
    if (filtro === 'piorado')   base = piorados
    else if (filtro === 'melhorado') base = melhorados
    else if (filtro === 'novo')      base = novos
    else                             base = motoristas

    if (busca.trim()) {
      const q = busca.toLowerCase()
      base = base.filter(m =>
        m.nome.toLowerCase().includes(q) || m.motorista.toLowerCase().includes(q)
      )
    }

    return [...base].sort((a, b) => {
      if (sortCol === 'nome') {
        const cmp = a.nome.localeCompare(b.nome, 'pt-BR')
        return sortDir === 'asc' ? cmp : -cmp
      }
      // null delta (novos) sempre ao final, independente da direção
      if (sortCol === 'delta') {
        if (a.delta === null && b.delta === null) return 0
        if (a.delta === null) return 1
        if (b.delta === null) return -1
        return sortDir === 'desc' ? b.delta - a.delta : a.delta - b.delta
      }
      const getVal = (m: MotoristaVariacao) =>
        sortCol === 'pct_atual' ? m.pct_atual :
        sortCol === 'fat_atual' ? m.fat_atual :
        m.dev_atual
      return sortDir === 'desc' ? getVal(b) - getVal(a) : getVal(a) - getVal(b)
    })
  }, [filtro, motoristas, busca, sortCol, sortDir, piorados, melhorados, novos])

  // Gráfico divergente — top 20 do filtro ativo
  const chartData = useMemo(() => {
    const fonte = filtrados.filter(m => m.delta !== null)
    const sorted = filtro === 'melhorado'
      ? [...fonte].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
      : [...fonte].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    return sorted.slice(0, 20).map(m => ({
      nome:  m.nome.length > 22 ? m.nome.slice(0, 20) + '…' : m.nome,
      delta: m.delta as number,
    }))
  }, [filtrados, filtro])

  const maxDelta = Math.max(...chartData.map(d => Math.abs(d.delta)), 1)

  const top5Piores    = [...piorados].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 5)
  const top5Melhores  = [...melhorados].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 5)
  const maxDeltaPior   = Math.max(...top5Piores.map(m => m.delta ?? 0), 0.01)
  const maxDeltaMelhor = Math.max(...top5Melhores.map(m => Math.abs(m.delta ?? 0)), 0.01)

  const pctTotal = (n: number) =>
    motoristas.length > 0 ? `${Math.round(n / motoristas.length * 100)}% do total` : ''

  const kpis = [
    {
      label: 'Motoristas',
      value: String(motoristas.length),
      cor: '#003087',
      sub: `${comHistorico.length} com histórico`,
    },
    {
      label: 'Pioraram',
      value: String(piorados.length),
      cor: '#EF4444',
      sub: pctTotal(piorados.length),
    },
    {
      label: 'Melhoraram',
      value: String(melhorados.length),
      cor: '#10B981',
      sub: pctTotal(melhorados.length),
    },
    {
      label: 'Sem mês anterior',
      value: String(novos.length),
      cor: '#9CA3AF',
      sub: '',
    },
    {
      label: 'Δ Médio',
      value: deltaMedia !== null
        ? `${deltaMedia > 0 ? '+' : ''}${deltaMedia.toFixed(1)} p.p.`
        : '—',
      cor: deltaMedia === null ? '#9CA3AF' : deltaMedia > 0 ? '#EF4444' : '#10B981',
      sub: deltaMedia === null ? '' : deltaMedia > 0 ? 'piorou vs anterior' : 'melhorou vs anterior',
    },
  ]

  return (
    <div className="space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map(c => (
          <div key={c.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl px-4 py-4">
            <p className="text-sm text-gray-500 font-medium mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.cor }}>{c.value}</p>
            {c.sub && <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtro === f.key
                ? 'bg-[#003087] text-white border-[#003087]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#003087]'
            }`}
          >
            {f.label}
            {f.key !== 'todos' && (
              <span className="ml-1.5 opacity-70">
                ({f.key === 'piorado' ? piorados.length
                  : f.key === 'melhorado' ? melhorados.length
                  : novos.length})
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-gray-400">
          {filtrados.length} motorista{filtrados.length !== 1 ? 's' : ''} exibido{filtrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Gráfico divergente + top 5 */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-sm font-semibold text-[#003087] mb-0.5">
              Variação — {filtro === 'todos' ? 'todos os motoristas' : FILTROS.find(f => f.key === filtro)?.label}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Δ em p.p. vs {periodoAntLabel}
              {` — ${chartData.length} motorista${chartData.length !== 1 ? 's' : ''}`}
            </p>
            <ResponsiveContainer width="100%" height={Math.max(chartData.length * 28, 200)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-maxDelta * 1.1, maxDelta * 1.1]}
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={150}
                  tick={{ fontSize: 10, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine x={0} stroke="#D1D5DB" strokeWidth={1.5} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="delta" radius={[0, 3, 3, 0]} maxBarSize={14}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.delta > 0 ? '#FCA5A5' : '#6EE7B7'}
                      stroke={entry.delta > 0 ? '#EF4444' : '#10B981'}
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-100 rounded-xl p-4 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-[#EF4444]" />
                <p className="text-xs font-semibold text-[#003087]">Top 5 Pioraram</p>
              </div>
              <div className="space-y-2">
                {top5Piores.map((m, i) => (
                  <div key={m.motorista} className="flex items-center gap-2">
                    <span className="text-[#D4A800] text-[10px] font-bold w-3 shrink-0">{i + 1}</span>
                    <span className="text-gray-700 text-[10px] truncate flex-1">{m.nome}</span>
                    <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-[#EF4444]"
                        style={{ width: `${((m.delta ?? 0) / maxDeltaPior) * 100}%` }} />
                    </div>
                    <span className="text-[#EF4444] text-[10px] font-bold w-10 text-right shrink-0">
                      +{(m.delta ?? 0).toFixed(1)}
                    </span>
                  </div>
                ))}
                {top5Piores.length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-2">Nenhum</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-4 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={14} className="text-[#10B981]" />
                <p className="text-xs font-semibold text-[#003087]">Top 5 Melhoraram</p>
              </div>
              <div className="space-y-2">
                {top5Melhores.map((m, i) => (
                  <div key={m.motorista} className="flex items-center gap-2">
                    <span className="text-[#D4A800] text-[10px] font-bold w-3 shrink-0">{i + 1}</span>
                    <span className="text-gray-700 text-[10px] truncate flex-1">{m.nome}</span>
                    <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-[#10B981]"
                        style={{ width: `${(Math.abs(m.delta ?? 0) / maxDeltaMelhor) * 100}%` }} />
                    </div>
                    <span className="text-[#10B981] text-[10px] font-bold w-10 text-right shrink-0">
                      {(m.delta ?? 0).toFixed(1)}
                    </span>
                  </div>
                ))}
                {top5Melhores.length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-2">Nenhum</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela completa */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <p className="text-sm font-semibold text-[#003087]">
            Ranking detalhado — {periodoAtual} vs {periodoAntLabel}
          </p>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar motorista..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-[#F2C800] focus:outline-none bg-white w-44"
            />
          </div>
        </div>
        <div className="overflow-auto max-h-[36rem]">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-16" />
              <col className="w-16" />
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-28" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003087] text-white text-xs font-medium">
                <th className="text-left py-3 px-2 rounded-tl-lg">#</th>
                <th
                  className="text-left py-3 px-2 cursor-pointer select-none hover:bg-[#004aad]"
                  onClick={() => handleSort('nome')}
                >
                  <span className="flex items-center gap-1">
                    Motorista <SortIcon col="nome" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th
                  className="text-right py-3 px-2 cursor-pointer select-none hover:bg-[#004aad]"
                  onClick={() => handleSort('fat_atual')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Fat. <SortIcon col="fat_atual" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th
                  className="text-right py-3 px-2 cursor-pointer select-none hover:bg-[#004aad]"
                  onClick={() => handleSort('dev_atual')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Dev. <SortIcon col="dev_atual" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th
                  className="text-right py-3 px-2 cursor-pointer select-none hover:bg-[#004aad]"
                  onClick={() => handleSort('pct_atual')}
                >
                  <span className="flex items-center justify-end gap-1">
                    % Atual <SortIcon col="pct_atual" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th className="text-right py-3 px-2">% Ant.</th>
                <th
                  className="text-right py-3 px-2 rounded-tr-lg cursor-pointer select-none hover:bg-[#004aad]"
                  onClick={() => handleSort('delta')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Δ Variação <SortIcon col="delta" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m, i) => (
                <tr
                  key={m.motorista}
                  className={`border-b border-gray-50 hover:bg-[#FFF8DC] transition-colors ${
                    m.delta !== null && m.delta > 0 ? 'bg-[#FEF2F2]/30' :
                    m.delta !== null && m.delta < 0 ? 'bg-[#F0FDF4]/30' : ''
                  }`}
                >
                  <td className="py-2.5 px-2 text-[#D4A800] font-bold text-xs">{i + 1}</td>
                  <td className="py-2.5 px-2 text-[#111111] font-medium text-xs truncate max-w-0">{m.nome}</td>
                  <td className="py-2.5 px-2 text-right text-gray-500 text-xs">{m.fat_atual.toLocaleString('pt-BR')}</td>
                  <td className="py-2.5 px-2 text-right text-gray-600 text-xs font-semibold">{m.dev_atual.toLocaleString('pt-BR')}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-[#D4A800] text-xs">{m.pct_atual.toFixed(1)}%</td>
                  <td className="py-2.5 px-2 text-right text-gray-400 text-xs">
                    {m.pct_ant !== null ? `${m.pct_ant.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex justify-end">
                      <DeltaChip delta={m.delta} />
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                    {busca ? 'Nenhum motorista encontrado para esta busca.' : 'Nenhum motorista neste filtro.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
