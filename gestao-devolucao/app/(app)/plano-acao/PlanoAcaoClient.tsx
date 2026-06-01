'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { AcaoDrawer } from './AcaoDrawer'
import { excluirAcao } from './actions'
import type { PlanoAcao } from '@/types'

const PRIORIDADE_COR: Record<string, string> = {
  critica:       '#DC2626',
  alta:          '#D97706',
  media:         '#2563eb',
  monitoramento: '#6B7280',
}

const STATUS_COR: Record<string, string> = {
  aberto:        '#D97706',
  em_andamento:  '#2563eb',
  concluido:     '#16A34A',
  cancelado:     '#6B7280',
}

const STATUS_LABEL: Record<string, string> = {
  aberto:        'Aberto',
  em_andamento:  'Em andamento',
  concluido:     'Concluído',
  cancelado:     'Cancelado',
}

interface Props {
  acoes: PlanoAcao[]
}

export function PlanoAcaoClient({ acoes }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [acaoEditando, setAcaoEditando] = useState<PlanoAcao | null>(null)
  const [isPending, startTransition] = useTransition()

  const porStatus = {
    aberto:       acoes.filter(a => a.status === 'aberto'),
    em_andamento: acoes.filter(a => a.status === 'em_andamento'),
    concluido:    acoes.filter(a => a.status === 'concluido'),
    cancelado:    acoes.filter(a => a.status === 'cancelado'),
  }

  const vencidas = acoes.filter(a =>
    a.prazo && new Date(a.prazo) < new Date() && a.status !== 'concluido' && a.status !== 'cancelado'
  )

  function abrirNova() {
    setAcaoEditando(null)
    setDrawerOpen(true)
  }

  function abrirEdicao(acao: PlanoAcao) {
    setAcaoEditando(acao)
    setDrawerOpen(true)
  }

  function handleExcluir(id: string) {
    if (!confirm('Excluir esta ação?')) return
    startTransition(async () => { await excluirAcao(id) })
  }

  return (
    <>
      <div className="p-8 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Plano de Ação</h1>
            <p className="text-gray-500 text-sm mt-1">{acoes.length} ações · {porStatus.aberto.length} abertas</p>
          </div>
          <button
            onClick={abrirNova}
            className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#b8933d] text-black text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nova ação
          </button>
        </div>

        {/* Resumo por status */}
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(porStatus).map(([status, items]) => (
            <div key={status} className="bg-[#141414] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COR[status] }} />
                <span className="text-gray-400 text-xs uppercase tracking-wider">{STATUS_LABEL[status]}</span>
              </div>
              <p className="text-2xl font-bold text-white">{items.length}</p>
            </div>
          ))}
        </div>

        {/* Alertas vencidos */}
        {vencidas.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
            <p className="text-red-400 text-sm">
              <strong>{vencidas.length} ações vencidas</strong> sem conclusão — revisão necessária.
            </p>
          </div>
        )}

        {/* Lista de ações */}
        <div className="space-y-3 max-h-[36rem] overflow-y-auto pr-1">
          {acoes.map((acao) => {
            const vencida = acao.prazo && new Date(acao.prazo) < new Date() && acao.status !== 'concluido' && acao.status !== 'cancelado'
            return (
              <div
                key={acao.id}
                className="bg-[#141414] border border-white/5 rounded-xl p-5 hover:border-[#C9A84C]/10 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: PRIORIDADE_COR[acao.prioridade] + '20', color: PRIORIDADE_COR[acao.prioridade] }}>
                        {acao.prioridade?.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: STATUS_COR[acao.status] + '15', color: STATUS_COR[acao.status] }}>
                        {STATUS_LABEL[acao.status]}
                      </span>
                      {acao.indicador_impactado && (
                        <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
                          {acao.indicador_impactado}
                        </span>
                      )}
                      {vencida && (
                        <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">⚠ Vencida</span>
                      )}
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed">{acao.descricao}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      {acao.responsavel && <span>👤 {acao.responsavel}</span>}
                      {acao.prazo && (
                        <span className={vencida ? 'text-red-400' : ''}>
                          📅 {new Date(acao.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <span>🕐 {new Date(acao.criado_em).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {acao.comentarios && (
                      <p className="text-gray-500 text-xs mt-2 italic">{acao.comentarios}</p>
                    )}
                  </div>

                  {/* Botões de ação — visíveis no hover */}
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => abrirEdicao(acao)}
                      className="p-2 rounded-lg text-gray-500 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleExcluir(acao.id)}
                      disabled={isPending}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {acoes.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-lg">Nenhuma ação cadastrada.</p>
              <p className="text-sm mt-1">Clique em "Nova ação" para começar.</p>
            </div>
          )}
        </div>
      </div>

      <AcaoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        acao={acaoEditando}
      />
    </>
  )
}
