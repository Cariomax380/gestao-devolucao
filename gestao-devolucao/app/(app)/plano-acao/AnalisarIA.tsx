'use client'

import { useState } from 'react'
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Zap, ChevronDown, ChevronUp } from 'lucide-react'

interface Acao   { descricao: string; prioridade: 'alta' | 'media' | 'baixa' }
interface Analise {
  padroes:        string[]
  kpis_sugeridos: string[]
  acoes:          Acao[]
  anomalias:      string[]
}

const PRI_COR: Record<string, { bg: string; text: string }> = {
  alta:  { bg: '#DC262618', text: '#DC2626' },
  media: { bg: '#D9770618', text: '#D97706' },
  baixa: { bg: '#2563EB18', text: '#2563EB' },
}

export function AnalisarIA() {
  const [loading,  setLoading]  = useState(false)
  const [analise,  setAnalise]  = useState<Analise | null>(null)
  const [erro,     setErro]     = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function analisar() {
    setLoading(true)
    setErro(null)
    try {
      const res  = await fetch('/api/analisar', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalise(data)
      setExpanded(true)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#141414] border border-[#C9A84C]/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center">
            <Sparkles size={16} className="text-[#C9A84C]" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Análise com IA</p>
            <p className="text-gray-500 text-xs">Padrões, anomalias e ações recomendadas pela Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analise && (
            <button onClick={() => setExpanded(v => !v)} className="text-gray-500 hover:text-gray-300 p-1">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          <button
            onClick={analisar}
            disabled={loading}
            className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#b8933d] disabled:opacity-50 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Analisando…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {analise ? 'Reanalisar' : 'Analisar base'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="px-5 pb-5">
          <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{erro}</p>
        </div>
      )}

      {/* Resultado */}
      {analise && expanded && (
        <div className="border-t border-white/5 p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Secao icon={<TrendingUp size={14} />} titulo="Padrões identificados" cor="#C9A84C">
            {analise.padroes.map((p, i) => <Item key={i} text={p} />)}
          </Secao>

          <Secao icon={<AlertTriangle size={14} />} titulo="Anomalias" cor="#DC2626">
            {analise.anomalias.map((a, i) => <Item key={i} text={a} />)}
          </Secao>

          <Secao icon={<Zap size={14} />} titulo="KPIs sugeridos" cor="#60a5fa">
            {analise.kpis_sugeridos.map((k, i) => <Item key={i} text={k} />)}
          </Secao>

          <Secao icon={<Lightbulb size={14} />} titulo="Ações recomendadas" cor="#a78bfa">
            <div className="space-y-2">
              {analise.acoes.map((a, i) => {
                const cor = PRI_COR[a.prioridade] ?? PRI_COR.baixa
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0 uppercase"
                      style={{ backgroundColor: cor.bg, color: cor.text }}
                    >
                      {a.prioridade}
                    </span>
                    <p className="text-gray-300 text-xs leading-relaxed">{a.descricao}</p>
                  </div>
                )
              })}
            </div>
          </Secao>
        </div>
      )}
    </div>
  )
}

function Secao({ icon, titulo, cor, children }: { icon: React.ReactNode; titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0a] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3" style={{ color: cor }}>
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wider">{titulo}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Item({ text }: { text: string }) {
  return (
    <p className="text-gray-400 text-xs leading-relaxed flex items-start gap-1.5">
      <span className="text-gray-600 mt-0.5 shrink-0">·</span>
      {text}
    </p>
  )
}
