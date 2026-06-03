'use client'

import { useState, useMemo } from 'react'
import {
  calcularReversao,
  type Agrupamento,
  type RegistroReversao,
} from '@/lib/calcular-reversao'

const AGRUPAMENTOS: { key: Agrupamento; label: string }[] = [
  { key: 'geral',     label: 'Geral'      },
  { key: 'motorista', label: 'Motorista'  },
  { key: 'cod_pdv',   label: 'PDV'        },
  { key: 'data',      label: 'Data'       },
  { key: 'motivo',    label: 'Motivo'     },
  { key: 'rota',      label: 'Rota'       },
]

interface Props {
  registros: RegistroReversao[]
}

export function ReversaoMemoria({ registros }: Props) {
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('motorista')

  const resultado = useMemo(
    () => calcularReversao(registros, agrupamento),
    [registros, agrupamento],
  )

  const totalRegistros = registros.filter(
    r => (r.pdv_repasse ?? 0) > 0 || (r.pdvs_devolvidos ?? 0) > 0,
  ).length

  const labelGrupo = AGRUPAMENTOS.find(a => a.key === agrupamento)?.label ?? 'Grupo'

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-[#003087]">
            Memória de Cálculo — % Reversão
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            % Reversão = QTD REV ÷ (QTD REV + QTD DEV)
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-[#10B981]">REV = repasse</span>
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-[#EF4444]">DEV = devolução não revertida</span>
          </p>
        </div>

        {/* Seletor de dimensão */}
        <div className="flex gap-1.5 flex-wrap">
          {AGRUPAMENTOS.map(a => (
            <button
              key={a.key}
              onClick={() => setAgrupamento(a.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                agrupamento === a.key
                  ? 'bg-[#003087] text-white border-[#003087]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#003087]'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#003087] text-white text-xs font-medium">
              <th className="text-left py-3 px-3 rounded-tl-lg w-8">#</th>
              <th className="text-left py-3 px-3">{labelGrupo}</th>
              <th className="text-right py-3 px-3 w-20">QTD REV</th>
              <th className="text-right py-3 px-3 w-20">QTD DEV</th>
              <th className="text-right py-3 px-3 w-24">Total Oport.</th>
              <th className="text-right py-3 px-3 w-36 rounded-tr-lg">% Reversão</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((r, i) => (
              <tr
                key={r.grupo}
                className="border-b border-gray-50 hover:bg-[#FFF8DC] transition-colors"
              >
                <td className="py-2.5 px-3 text-[#D4A800] font-bold text-xs">{i + 1}</td>
                <td className="py-2.5 px-3 text-[#111111] font-medium text-xs max-w-[180px] truncate">
                  {r.grupo}
                </td>
                <td className="py-2.5 px-3 text-right text-[#10B981] font-semibold text-xs">
                  {r.qtd_rev.toLocaleString('pt-BR')}
                </td>
                <td className="py-2.5 px-3 text-right text-[#EF4444] font-semibold text-xs">
                  {r.qtd_dev.toLocaleString('pt-BR')}
                </td>
                <td className="py-2.5 px-3 text-right text-gray-500 text-xs">
                  {r.total_oportunidades.toLocaleString('pt-BR')}
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* Mini barra de progresso */}
                    <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-[#7c3aed]"
                        style={{ width: `${r.percentual_reversao * 100}%` }}
                      />
                    </div>
                    <span className="text-[#7c3aed] font-bold text-xs w-14 text-right shrink-0">
                      {r.percentual_reversao_formatado}
                    </span>
                  </div>
                </td>
              </tr>
            ))}

            {resultado.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400 text-sm">
                  Sem dados de reversão para este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé */}
      {resultado.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-3 text-right">
          {resultado.length} grupo{resultado.length !== 1 ? 's' : ''}
          {' · '}
          {totalRegistros.toLocaleString('pt-BR')} registro{totalRegistros !== 1 ? 's' : ''} processado{totalRegistros !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
