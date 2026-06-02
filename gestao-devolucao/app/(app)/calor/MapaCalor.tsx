'use client'

import { useState } from 'react'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const AMARELO = '#F2C800'

interface Celula { motivo: string; dia: number; qtd: number }

interface Props {
  dados: Celula[]
}

export function MapaCalor({ dados }: Props) {
  const [escala, setEscala] = useState<'global' | 'motivo' | 'log'>('motivo')

  if (!dados.length) return <p className="text-gray-400 text-xs text-center py-10">Sem dados.</p>

  const motivos = [...new Set(dados.map(d => d.motivo))].sort()
  const maxGlobal = Math.max(...dados.map(d => d.qtd), 1)

  function get(motivo: string, dia: number) {
    return dados.find(d => d.motivo === motivo && d.dia === dia)?.qtd ?? 0
  }

  function intensidade(qtd: number, motivo: string) {
    if (qtd === 0) return '#F9FAFB'
    let ratio: number
    if (escala === 'global') {
      ratio = qtd / maxGlobal
    } else if (escala === 'motivo') {
      const maxMotivo = Math.max(...[1,2,3,4,5,6,7].map(d => get(motivo, d)), 1)
      ratio = qtd / maxMotivo
    } else {
      ratio = Math.log1p(qtd) / Math.log1p(maxGlobal)
    }
    const alpha = Math.round(ratio * 200 + 30)
    return `${AMARELO}${Math.min(255, alpha).toString(16).padStart(2, '0')}`
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500">Motivo × Dia da semana (devoluções)</p>
        <div className="flex gap-1">
          {([['motivo', 'Por motivo'], ['log', 'Logarítmica'], ['global', 'Global']] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setEscala(v)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
                escala === v
                  ? 'bg-[#F2C800] text-[#003087]'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-[540px]">
        {/* Cabeçalho dias */}
        <div className="grid mb-1" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
          <div />
          {DIAS.map(d => (
            <p key={d} className="text-center text-gray-500 text-[10px] font-medium uppercase tracking-wider pb-1">{d}</p>
          ))}
        </div>

        {/* Linhas */}
        {motivos.map(motivo => (
          <div key={motivo} className="grid items-center gap-1 mb-1" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
            <p className="text-gray-600 text-xs truncate pr-2">{motivo}</p>
            {[1, 2, 3, 4, 5, 6, 7].map(dia => {
              const qtd = get(motivo, dia)
              return (
                <div
                  key={dia}
                  title={`${motivo} — ${DIAS[dia-1]}: ${qtd} dev.`}
                  className="h-8 rounded-lg flex items-center justify-center transition-opacity border border-gray-50"
                  style={{ backgroundColor: intensidade(qtd, motivo) }}
                >
                  {qtd > 0 && (
                    <span className="text-[10px] font-bold text-[#003087]/70">{qtd}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Legenda */}
        <div className="flex items-center gap-2 mt-4">
          <p className="text-gray-400 text-[10px]">Intensidade:</p>
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <div
              key={v}
              className="w-6 h-4 rounded"
              style={{ backgroundColor: v === 0 ? '#F9FAFB' : `${AMARELO}${Math.round(v * 200 + 30).toString(16).padStart(2,'0')}` }}
            />
          ))}
          <p className="text-gray-400 text-[10px]">alto</p>
        </div>
      </div>
    </div>
  )
}
