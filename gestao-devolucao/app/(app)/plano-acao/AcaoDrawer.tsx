'use client'

import { useState, useTransition } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ClipboardList } from 'lucide-react'
import { criarAcao, editarAcao } from './actions'
import type { PlanoAcao } from '@/types'

const INDICADORES = [
  'devolucao_pdv_pct', 'devolucao_hl_pct', 'reversao_pct',
  'repasses_apontados_pct', 'repasses_efetivos_pct', 'devolucoes_apontadas_pct',
  'aderencia_raio_pct', 'devolucao_antes_horario_pct', 'tempo_medio_cme', 'tempo_medio_tratativa',
]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  acao?: PlanoAcao | null
}

export function AcaoDrawer({ open, onOpenChange, acao }: Props) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const editando = !!acao

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setErro(null)
    startTransition(async () => {
      const res = editando
        ? await editarAcao(acao!.id, formData)
        : await criarAcao(formData)
      if ('error' in res) { setErro(res.error!); return }
      onOpenChange(false)
    })
  }

  const inputCls = 'w-full bg-[#0a0a0a] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-2 focus:border-[#C9A84C]/50 focus:outline-none'
  const labelCls = 'text-gray-500 text-xs mb-1 block'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] bg-[#0D0D0D] border-l border-white/5 text-white p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <SheetTitle className="text-white font-bold flex items-center gap-2">
            <ClipboardList size={18} className="text-[#C9A84C]" />
            {editando ? 'Editar ação' : 'Nova ação'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 px-6 py-6 space-y-4">
            <div>
              <label className={labelCls}>Descrição *</label>
              <textarea
                name="descricao"
                required
                rows={3}
                defaultValue={acao?.descricao ?? ''}
                className={`${inputCls} resize-none`}
                placeholder="Descreva a ação a ser executada..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Prioridade</label>
                <select name="prioridade" defaultValue={acao?.prioridade ?? 'media'} className={inputCls}>
                  <option value="critica">Crítica</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="monitoramento">Monitoramento</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select name="status" defaultValue={acao?.status ?? 'aberto'} className={inputCls}>
                  <option value="aberto">Aberto</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Responsável</label>
                <input
                  name="responsavel"
                  type="text"
                  defaultValue={acao?.responsavel ?? ''}
                  className={inputCls}
                  placeholder="Nome do responsável"
                />
              </div>
              <div>
                <label className={labelCls}>Prazo</label>
                <input
                  name="prazo"
                  type="date"
                  defaultValue={acao?.prazo ?? ''}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Indicador impactado</label>
              <select name="indicador_impactado" defaultValue={acao?.indicador_impactado ?? ''} className={inputCls}>
                <option value="">Nenhum</option>
                {INDICADORES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Comentários</label>
              <textarea
                name="comentarios"
                rows={2}
                defaultValue={acao?.comentarios ?? ''}
                className={`${inputCls} resize-none`}
                placeholder="Observações adicionais..."
              />
            </div>

            {erro && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">{erro}</p>
            )}
          </div>

          <div className="px-6 pb-6 pt-4 border-t border-white/5 flex gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-11 rounded-xl font-semibold text-sm text-black bg-[#C9A84C] hover:bg-[#b8933d] disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar ação'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
