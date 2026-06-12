'use client'

import { useState } from 'react'
import {
  ComposedChart, AreaChart, Area, Bar, Line, Cell,
  BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Semana, SemanaReversao, MesResumo, MesReversao } from './page'

/* ── Tipos das KPI cards ─────────────────────────────── */
type KPI = {
  label: string; value: string; borderColor: string; valueColor: string
  sub?: string; subColor?: string
}

interface Props {
  kpisDev:         KPI[]
  kpisRev:         KPI[]
  dados:           Semana[]
  media:           number
  dadosMensais:    MesResumo[]
  dadosRev:        SemanaReversao[]
  mediaRev:        number
  dadosMensaisRev: MesReversao[]
}

/* ── Cores ───────────────────────────────────────────── */
const AMARELO = '#F2C800'
const AZUL    = '#003087'
const AZUL_C  = '#93C5FD'
const ROXO    = '#7c3aed'
const ROXO_C  = '#c4b5fd'
const VERDE   = '#10B981'
const VERM    = '#EF4444'
const CINZA   = '#9CA3AF'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtSemana(v: string) {
  const d = new Date(v + 'T12:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}
function fmtMes(m: string) {
  const partes = m.split('-')
  return MESES_PT[(parseInt(partes[1] ?? '1') - 1)] ?? m
}

/* ── Dot personalizado ─────────────────────────────────
   Para devolução: pior = vermelho (maior %), melhor = verde (menor %)
   Para reversão : pior = vermelho (menor %), melhor = verde (maior %)   */
function CustomDot({ cx, cy, value, piorVal, melhorVal }: any) {
  if (value == null) return null
  if (value === piorVal)   return <circle cx={cx} cy={cy} r={5} fill={VERM}  stroke="white" strokeWidth={1.5} />
  if (value === melhorVal) return <circle cx={cx} cy={cy} r={5} fill={VERDE} stroke="white" strokeWidth={1.5} />
  return <circle cx={cx} cy={cy} r={3} fill={AMARELO} />
}
function CustomDotRev({ cx, cy, value, piorVal, melhorVal }: any) {
  if (value == null) return null
  if (value === piorVal)   return <circle cx={cx} cy={cy} r={5} fill={VERM}  stroke="white" strokeWidth={1.5} />
  if (value === melhorVal) return <circle cx={cx} cy={cy} r={5} fill={VERDE} stroke="white" strokeWidth={1.5} />
  return <circle cx={cx} cy={cy} r={3} fill={ROXO} />
}

/* ── KPI cards ───────────────────────────────────────── */
function KpiRow({ kpis }: { kpis: KPI[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map(c => (
        <div
          key={c.label}
          className="bg-white border border-gray-100 rounded-xl px-4 py-4"
          style={{ borderLeftWidth: 4, borderLeftColor: c.borderColor }}
        >
          <p className="text-xs text-gray-500 font-medium mb-1 leading-tight">{c.label}</p>
          <p className="text-base font-bold leading-tight" style={{ color: c.valueColor }}>{c.value}</p>
          {c.sub && (
            <p className="text-xs mt-1 font-medium" style={{ color: c.subColor }}>{c.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Legenda inline ──────────────────────────────────── */
function LegendaItem({ cor, label, dashed }: { cor: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400">
      {dashed
        ? <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: cor }} />
        : <span className="inline-block w-4 h-0.5" style={{ backgroundColor: cor }} />}
      {label}
    </span>
  )
}

/* ── Ranking (mini lista com progress bar) ───────────── */
function RankingRow({
  semana, posicao, valor, sufixo, corBarra, corValor, dev, devLabel,
  maxVal,
}: {
  semana: string; posicao: number; valor: number; sufixo: string
  corBarra: string; corValor: string; dev: number; devLabel: string; maxVal: number
}) {
  const barW = maxVal > 0 ? Math.min(100, (valor / maxVal) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-gray-300 w-4 text-right shrink-0">{posicao}</span>
      <span className="text-xs text-gray-600 w-10 shrink-0 font-medium">{fmtSemana(semana)}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: corBarra }} />
      </div>
      <span className="text-xs font-bold w-10 text-right shrink-0" style={{ color: corValor }}>
        {valor.toFixed(1)}{sufixo}
      </span>
      <span className="text-xs text-gray-400 w-16 text-right shrink-0">
        {dev.toLocaleString('pt-BR')} {devLabel}
      </span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   PAINEL DEVOLUÇÃO
   ════════════════════════════════════════════════════════ */
function PainelDevolucao({
  dados, media, dadosMensais,
}: {
  dados: Semana[]; media: number; dadosMensais: MesResumo[]
}) {
  const pctValues = dados.map(d => d.pct)
  const piorPct   = Math.max(...pctValues)
  const melhorPct = Math.min(...pctValues)

  const sorted  = [...dados].sort((a, b) => b.pct - a.pct)
  const piores  = sorted.slice(0, 5)
  // evita sobreposição quando há menos de 10 semanas
  const pioresSet = new Set(piores.map(d => d.semana))
  const melhores  = [...dados].sort((a, b) => a.pct - b.pct)
    .filter(d => !pioresSet.has(d.semana))
    .slice(0, 5)
  const pctRange = piorPct - melhorPct

  return (
    <div className="space-y-4">

      {/* Gráfico principal */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm font-medium text-gray-700">% Devolução por Semana</p>
          <div className="flex flex-wrap items-center gap-4">
            <LegendaItem cor={AMARELO} label="% Devolução" />
            <LegendaItem cor={CINZA} label="Tendência" dashed />
            <LegendaItem cor={CINZA} label={`Média ${media.toFixed(1)}%`} dashed />
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Pior
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" /> Melhor
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={dados} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={AMARELO} stopOpacity={0.18} />
                <stop offset="95%" stopColor={AMARELO} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="semana" tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={fmtSemana} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as Semana
                return (
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs space-y-1 shadow-sm">
                    <p className="font-medium text-gray-700">Semana {fmtSemana(d.semana)}</p>
                    <p className="text-yellow-600">% Dev: <strong>{d.pct.toFixed(2)}%</strong></p>
                    <p className="text-gray-500">Faturados: <strong>{d.fat.toLocaleString('pt-BR')}</strong></p>
                    <p style={{ color: AZUL }}>Devolvidos: <strong>{d.dev.toLocaleString('pt-BR')}</strong></p>
                    {d.tendencia != null && <p className="text-gray-400">Tendência: {d.tendencia.toFixed(2)}%</p>}
                  </div>
                )
              }}
            />
            {media > 0 && (
              <ReferenceLine y={media} stroke={CINZA} strokeDasharray="4 4"
                label={{ value: `Média ${media.toFixed(1)}%`, fill: CINZA, fontSize: 9, position: 'insideTopRight' }} />
            )}
            <Area dataKey="pct" stroke={AMARELO} strokeWidth={2.5} fill="url(#gradPct)" name="% Dev."
              dot={(p: any) => <CustomDot {...p} piorVal={piorPct} melhorVal={melhorPct} />}
              activeDot={{ r: 5, fill: AMARELO }} />
            {dados[0]?.tendencia != null && (
              <Line dataKey="tendencia" stroke={CINZA} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume + mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-1">Volume de Devolvidos por Semana</p>
          <p className="text-xs text-gray-400 mb-4">Barras escuras = acima da média de devolução</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dados} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="semana" tick={{ fill: '#6B7280', fontSize: 9 }} tickFormatter={fmtSemana} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as Semana
                  return (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
                      <p className="text-gray-500 mb-1">Semana {fmtSemana(d.semana)}</p>
                      <p style={{ color: AZUL }}>Devolvidos: <strong>{d.dev.toLocaleString('pt-BR')}</strong></p>
                      <p className="text-yellow-600">% Dev: <strong>{d.pct.toFixed(1)}%</strong></p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="dev" name="Devolvidos" radius={[2, 2, 0, 0]}>
                {dados.map((d, i) => <Cell key={i} fill={d.pct > media ? AZUL : AZUL_C} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-1">% Devolução por Mês</p>
          <p className="text-xs text-gray-400 mb-4">
            <span className="text-green-600 font-medium">Verde</span> = abaixo da média &nbsp;·&nbsp;
            <span className="text-red-500 font-medium">Vermelho</span> = acima da média
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={dadosMensais} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={fmtMes} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as MesResumo
                  return (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium text-gray-700 mb-1">{fmtMes(label)} {label?.slice(0,4)}</p>
                      <p className="text-yellow-600">% Dev: <strong>{d.pct.toFixed(1)}%</strong></p>
                      <p className="text-gray-500">Faturados: <strong>{d.fat.toLocaleString('pt-BR')}</strong></p>
                      <p style={{ color: AZUL }}>Devolvidos: <strong>{d.dev.toLocaleString('pt-BR')}</strong></p>
                    </div>
                  )
                }}
              />
              <ReferenceLine y={media} stroke={CINZA} strokeDasharray="4 4"
                label={{ value: `${media.toFixed(1)}%`, fill: CINZA, fontSize: 9, position: 'insideTopRight' }} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {dadosMensais.map((d, i) => <Cell key={i} fill={d.pct > media ? VERM : VERDE} fillOpacity={0.8} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />
            5 Piores Semanas
          </p>
          <div className="space-y-3">
            {piores.map((d, i) => (
              <RankingRow key={d.semana} semana={d.semana} posicao={i+1}
                valor={d.pct} sufixo="%" corBarra={VERM} corValor="#DC2626"
                dev={d.dev} devLabel="dev." maxVal={piorPct} />
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
            5 Melhores Semanas
          </p>
          <div className="space-y-3">
            {melhores.map((d, i) => {
              const barW = pctRange > 0
                ? (1 - (d.pct - melhorPct) / pctRange) * 100
                : 100
              return (
                <div key={d.semana} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4 text-right shrink-0">{i+1}</span>
                  <span className="text-xs text-gray-600 w-10 shrink-0 font-medium">{fmtSemana(d.semana)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-green-400" style={{ width: `${Math.min(100,barW)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-green-600 w-10 text-right shrink-0">{d.pct.toFixed(1)}%</span>
                  <span className="text-xs text-gray-400 w-16 text-right shrink-0">{d.dev.toLocaleString('pt-BR')} dev.</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

/* ════════════════════════════════════════════════════════
   PAINEL REVERSÃO
   Para reversão: % maior = melhor. Cores invertidas.
   ════════════════════════════════════════════════════════ */
function PainelReversao({
  dados, media, dadosMensais,
}: {
  dados: SemanaReversao[]; media: number; dadosMensais: MesReversao[]
}) {
  if (!dados.length) return (
    <div className="bg-[#F5F3FF] border border-purple-200 rounded-xl px-4 py-8 text-center text-sm text-gray-500">
      Nenhum dado de reversão disponível para o período selecionado.
    </div>
  )

  const pctValues = dados.map(d => d.pct_reversao)
  // pior = menor % de reversão; melhor = maior % de reversão
  const piorPct   = Math.min(...pctValues)
  const melhorPct = Math.max(...pctValues)

  const sorted    = [...dados].sort((a, b) => b.pct_reversao - a.pct_reversao)
  const melhores  = sorted.slice(0, 5)
  // evita sobreposição quando há menos de 10 semanas
  const melhoresSet = new Set(melhores.map(d => d.semana))
  const piores      = [...dados].sort((a, b) => a.pct_reversao - b.pct_reversao)
    .filter(d => !melhoresSet.has(d.semana))
    .slice(0, 5)
  const pctRange = melhorPct - piorPct

  return (
    <div className="space-y-4">

      {/* Gráfico principal */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm font-medium text-gray-700">% Reversão por Semana</p>
          <div className="flex flex-wrap items-center gap-4">
            <LegendaItem cor={ROXO} label="% Reversão" />
            <LegendaItem cor={CINZA} label="Tendência" dashed />
            <LegendaItem cor={CINZA} label={`Média ${media.toFixed(1)}%`} dashed />
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" /> Melhor
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Pior
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={dados} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={ROXO} stopOpacity={0.15} />
                <stop offset="95%" stopColor={ROXO} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="semana" tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={fmtSemana} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as SemanaReversao
                const total = d.qtd_rev + d.qtd_dev
                return (
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs space-y-1 shadow-sm">
                    <p className="font-medium text-gray-700">Semana {fmtSemana(d.semana)}</p>
                    <p style={{ color: ROXO }}>% Reversão: <strong>{d.pct_reversao.toFixed(2)}%</strong></p>
                    <p className="text-green-600">Revertidos: <strong>{d.qtd_rev.toLocaleString('pt-BR')}</strong></p>
                    <p className="text-red-500">Não revertidos: <strong>{d.qtd_dev.toLocaleString('pt-BR')}</strong></p>
                    <p className="text-gray-400">Oportunidades: <strong>{total.toLocaleString('pt-BR')}</strong></p>
                    {d.tendencia != null && <p className="text-gray-400">Tendência: {d.tendencia.toFixed(2)}%</p>}
                  </div>
                )
              }}
            />
            {media > 0 && (
              <ReferenceLine y={media} stroke={CINZA} strokeDasharray="4 4"
                label={{ value: `Média ${media.toFixed(1)}%`, fill: CINZA, fontSize: 9, position: 'insideTopRight' }} />
            )}
            <Area dataKey="pct_reversao" stroke={ROXO} strokeWidth={2.5} fill="url(#gradRev)" name="% Reversão"
              dot={(p: any) => <CustomDotRev {...p} piorVal={piorPct} melhorVal={melhorPct} />}
              activeDot={{ r: 5, fill: ROXO }} />
            {dados[0]?.tendencia != null && (
              <Line dataKey="tendencia" stroke={CINZA} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume (barras empilhadas: revertidos + não revertidos) + mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-1">Oportunidades por Semana</p>
          <p className="text-xs text-gray-400 mb-4">
            <span className="text-green-600 font-medium">Verde</span> = revertidos &nbsp;·&nbsp;
            <span className="text-red-400 font-medium">Vermelho</span> = não revertidos
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dados} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="semana" tick={{ fill: '#6B7280', fontSize: 9 }} tickFormatter={fmtSemana} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as SemanaReversao
                  return (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm space-y-1">
                      <p className="text-gray-500">Semana {fmtSemana(d.semana)}</p>
                      <p className="text-green-600">Revertidos: <strong>{d.qtd_rev.toLocaleString('pt-BR')}</strong></p>
                      <p className="text-red-500">Não revertidos: <strong>{d.qtd_dev.toLocaleString('pt-BR')}</strong></p>
                      <p style={{ color: ROXO }}>% Rev: <strong>{d.pct_reversao.toFixed(1)}%</strong></p>
                    </div>
                  )
                }}
              />
              {/* Empilhadas: revertidos (verde) em baixo, não revertidos (vermelho) em cima */}
              <Bar dataKey="qtd_rev" stackId="a" fill={VERDE} fillOpacity={0.8} name="Revertidos" />
              <Bar dataKey="qtd_dev" stackId="a" fill="#FCA5A5" radius={[2, 2, 0, 0]} name="Não revertidos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-1">% Reversão por Mês</p>
          <p className="text-xs text-gray-400 mb-4">
            <span className="text-green-600 font-medium">Verde</span> = acima da média &nbsp;·&nbsp;
            <span className="text-red-500 font-medium">Vermelho</span> = abaixo da média
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={dadosMensais} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={fmtMes} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as MesReversao
                  return (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium text-gray-700 mb-1">{fmtMes(label)} {label?.slice(0,4)}</p>
                      <p style={{ color: ROXO }}>% Rev: <strong>{d.pct_reversao.toFixed(1)}%</strong></p>
                      <p className="text-green-600">Revertidos: <strong>{d.qtd_rev.toLocaleString('pt-BR')}</strong></p>
                      <p className="text-red-500">Não revertidos: <strong>{d.qtd_dev.toLocaleString('pt-BR')}</strong></p>
                    </div>
                  )
                }}
              />
              <ReferenceLine y={media} stroke={CINZA} strokeDasharray="4 4"
                label={{ value: `${media.toFixed(1)}%`, fill: CINZA, fontSize: 9, position: 'insideTopRight' }} />
              <Bar dataKey="pct_reversao" radius={[4, 4, 0, 0]}>
                {/* inversão: acima da média de reversão = verde (bom) */}
                {dadosMensais.map((d, i) => (
                  <Cell key={i} fill={d.pct_reversao >= media ? VERDE : VERM} fillOpacity={0.8} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rankings (inversão de lógica: melhor = maior %) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
            5 Melhores Semanas de Reversão
          </p>
          <div className="space-y-3">
            {melhores.map((d, i) => (
              <RankingRow key={d.semana} semana={d.semana} posicao={i+1}
                valor={d.pct_reversao} sufixo="%" corBarra={VERDE} corValor="#059669"
                dev={d.qtd_rev} devLabel="rev." maxVal={melhorPct} />
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />
            5 Piores Semanas de Reversão
          </p>
          <div className="space-y-3">
            {piores.map((d, i) => {
              const barW = pctRange > 0
                ? (1 - (d.pct_reversao - piorPct) / pctRange) * 100
                : 100
              return (
                <div key={d.semana} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4 text-right shrink-0">{i+1}</span>
                  <span className="text-xs text-gray-600 w-10 shrink-0 font-medium">{fmtSemana(d.semana)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(100,barW)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-red-600 w-10 text-right shrink-0">
                    {d.pct_reversao.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-400 w-16 text-right shrink-0">
                    {d.qtd_dev.toLocaleString('pt-BR')} n/rev.
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

/* ════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL com tabs
   ════════════════════════════════════════════════════════ */
type Tab = 'devolucao' | 'reversao'

export function GraficoTendencia({
  kpisDev, kpisRev,
  dados, media, dadosMensais,
  dadosRev, mediaRev, dadosMensaisRev,
}: Props) {
  const [tab, setTab] = useState<Tab>('devolucao')

  // Bloqueia apenas quando AMBAS as séries estão vazias
  if (!dados.length && !dadosRev.length) return (
    <p className="text-gray-400 text-xs text-center py-10">Sem dados suficientes.</p>
  )

  return (
    <div className="space-y-4">

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('devolucao')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'devolucao'
              ? 'bg-white text-[#003087] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Devolução
        </button>
        <button
          onClick={() => setTab('reversao')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'reversao'
              ? 'bg-white text-[#7c3aed] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Reversão
        </button>
      </div>

      {/* ── KPIs do tab ativo ── */}
      <KpiRow kpis={tab === 'devolucao' ? kpisDev : kpisRev} />

      {/* ── Painéis ── */}
      {tab === 'devolucao' ? (
        <PainelDevolucao dados={dados} media={media} dadosMensais={dadosMensais} />
      ) : (
        <PainelReversao dados={dadosRev} media={mediaRev} dadosMensais={dadosMensaisRev} />
      )}

    </div>
  )
}
