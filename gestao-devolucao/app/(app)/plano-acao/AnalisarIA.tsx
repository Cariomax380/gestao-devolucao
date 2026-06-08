'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const [loading,  setLoading]  = useState(false)
  const [analise,  setAnalise]  = useState<Analise | null>(null)
  const [erro,     setErro]     = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function analisar() {
    setLoading(true)
    setErro(null)
    try {
      const periodo = searchParams.get('periodo') ?? null
      const res  = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ periodo }),
      })
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
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FFF8DC] flex items-center justify-center">
            <Sparkles size={16} className="text-[#D4A800]" />
          </div>
          <div>
            <p className="text-[#003087] font-semibold text-sm">Análise com IA</p>
            <p className="text-gray-400 text-xs">Padrões, anomalias e ações recomendadas pela Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analise && (
            <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600 p-1">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          <button
            onClick={analisar}
            disabled={loading}
            className="flex items-center gap-2 bg-[#F2C800] hover:bg-[#D4A800] disabled:opacity-50 text-[#003087] text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#003087]/30 border-t-[#003087] rounded-full animate-spin" />
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
          <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>
        </div>
      )}

      {/* Resultado */}
      {analise && expanded && (
        <div className="border-t border-gray-100 p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Secao icon={<TrendingUp size={14} />} titulo="Padrões identificados" cor="#0057A8">
            {analise.padroes.map((p, i) => <Item key={i} text={p} />)}
          </Secao>

          <Secao icon={<AlertTriangle size={14} />} titulo="Anomalias" cor="#DC2626">
            {analise.anomalias.map((a, i) => <Item key={i} text={a} />)}
          </Secao>

          <Secao icon={<Zap size={14} />} titulo="KPIs sugeridos" cor="#D4A800">
            {analise.kpis_sugeridos.map((k, i) => <Item key={i} text={k} />)}
          </Secao>

          <Secao icon={<Lightbulb size={14} />} titulo="Ações recomendadas" cor="#7c3aed">
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
                    <p className="text-gray-600 text-xs leading-relaxed">{a.descricao}</p>
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
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
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
    <p className="text-gray-500 text-xs leading-relaxed flex items-start gap-1.5">
      <span className="text-gray-300 mt-0.5 shrink-0">·</span>
      {text}
    </p>
  )
}
