'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts'

interface DadoDiario    { data: string; dev: number; fat: number; pct: number }
interface DadoMotivo    { motivo: string; qtd: number; pct: number }
interface DadoMotorista { nome: string; dev: number; fat: number; pct: number }
interface DadoCls       { cls: string; dev: number; pct: number; cor: string }

interface Props {
  diarios:        DadoDiario[]
  motivos:        DadoMotivo[]
  motoristas:     DadoMotorista[]
  classificacoes: DadoCls[]
}

const OURO = '#C9A84C'

const TooltipCustom = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: OURO }}>
          {p.name}: <strong>{typeof p.value === 'number' ? `${p.value.toFixed(2)}%` : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141414] border border-white/5 rounded-xl p-4">
      <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-4">{titulo}</p>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-gray-600 text-xs text-center py-6">Sem dados</p>
}

export function GraficosTabs({ diarios, motivos, motoristas, classificacoes }: Props) {
  return (
    <div className="space-y-3">

      {/* Por Dia — largura total */}
      <Card titulo="% Devolução por dia">
        {diarios.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={diarios} margin={{ top: 16, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis
                dataKey="data"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickFormatter={v => new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip content={<TooltipCustom />} />
              <Bar dataKey="pct" name="% Dev." fill={OURO} radius={[2, 2, 0, 0]}>
                <LabelList
                  dataKey="pct"
                  position="top"
                  formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''}
                  style={{ fill: '#6B7280', fontSize: 9 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Motivo + Classificação — 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card titulo="Por motivo">
          {motivos.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={motivos.length * 36 + 8}>
              <BarChart layout="vertical" data={motivos} margin={{ top: 0, right: 52, left: 4, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="motivo" width={155} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="pct" name="% Dev." radius={[0, 2, 2, 0]}>
                  {motivos.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? OURO : `${OURO}${Math.max(55, 220 - i * 18).toString(16).padStart(2, '0')}`} />
                  ))}
                  <LabelList
                    dataKey="pct"
                    position="right"
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                    style={{ fill: '#6B7280', fontSize: 10 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card titulo="Por classificação">
          {classificacoes.length === 0 ? <Empty /> : (
            <div className="space-y-4 pt-1">
              {classificacoes.map(c => (
                <div key={c.cls}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: c.cor }}>{c.cls}</span>
                    <span className="text-sm font-bold" style={{ color: c.cor }}>{c.pct.toFixed(1)}%</span>
                  </div>
                  <div className="bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.cor }} />
                  </div>
                  <p className="text-gray-600 text-[10px] mt-0.5">{c.dev.toLocaleString('pt-BR')} devoluções</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Por Motorista — largura total */}
      <Card titulo="% Devolução por motorista">
        {motoristas.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
            {motoristas.map((m, i) => (
              <div key={m.nome} className="flex items-center gap-2">
                <span className="text-gray-600 text-[10px] w-4 text-right shrink-0">{i + 1}</span>
                <span className="text-gray-300 text-xs w-40 truncate shrink-0">{m.nome}</span>
                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${motoristas[0].pct > 0 ? (m.pct / motoristas[0].pct) * 100 : 0}%`, backgroundColor: OURO }}
                  />
                </div>
                <span className="text-[#C9A84C] text-xs font-bold w-10 text-right shrink-0">{m.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}
