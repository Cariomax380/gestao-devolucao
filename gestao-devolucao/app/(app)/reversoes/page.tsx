export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct } from '@/lib/utils'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'

export default async function ReversaoPage() {
  const supabase = await createClient()

  const [{ data: rows }, motMap] = await Promise.all([
    supabase
      .from('devolucoes')
      .select('status_final, pdvs_devolvidos, pdv_repasse, devolucoes_revertidas, alertas_apontados, repasses_programados, repasses_informados, repasses_realizados, horario_apontamento, horario_atendimento_cme, horario_finalizacao, motorista, cliente, motivo, data_rota'),
    getMotoristaMap(),
  ])

  const all = rows ?? []

  const total_dev      = all.reduce((s, r) => s + (r.pdvs_devolvidos ?? 0), 0)
  const total_repasse  = all.reduce((s, r) => s + (r.pdv_repasse ?? 0), 0)
  const total_revert   = all.reduce((s, r) => s + (r.devolucoes_revertidas ?? 0), 0)
  const total_apontado = all.reduce((s, r) => s + (r.alertas_apontados ?? 0), 0)

  const pct_repasse = (total_dev + total_repasse) > 0
    ? (total_repasse / (total_dev + total_repasse)) * 100
    : null

  const tratativas_abertas = all.filter(r => r.status_final === 'tratativa_aberta')

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Reversões e Repasses</h1>
        <p className="text-gray-500 text-sm mt-1">Acumulado total da base</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Devolvidos',   value: total_dev,                 cor: 'branco' },
          { label: 'Repasses',           value: total_repasse,             cor: 'dourado' },
          { label: '% Repasse',          value: formatPct(pct_repasse),    cor: 'dourado' },
          { label: 'Tratativas Abertas', value: tratativas_abertas.length, cor: 'alerta' },
        ].map(c => (
          <div key={c.label} className="bg-[#141414] border border-white/5 rounded-xl p-5 hover:border-[#C9A84C]/20 transition-all">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{c.label}</p>
            <p className={`text-3xl font-bold ${c.cor === 'dourado' ? 'text-[#C9A84C]' : c.cor === 'alerta' ? 'text-red-400' : 'text-white'}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {tratativas_abertas.length > 0 && (
        <div className="bg-[#141414] border border-red-500/10 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Fila de Tratativas Abertas
          </h2>
          <div className="overflow-y-auto max-h-96 pr-4">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-24" />
                <col className="w-40" />
                <col />
                <col className="w-32" />
              </colgroup>
              <thead className="sticky top-0 bg-[#141414] z-10">
                <tr className="text-gray-500 text-xs uppercase border-b border-white/5">
                  <th className="text-left pb-3">Data</th>
                  <th className="text-left pb-3">Motorista</th>
                  <th className="text-left pb-3">Cliente</th>
                  <th className="text-left pb-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {tratativas_abertas.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 text-gray-500 text-xs">{r.data_rota ? new Date(r.data_rota + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="py-2 text-gray-300 truncate">{resolveMotorista(motMap, r.motorista)}</td>
                    <td className="py-2 text-gray-400 max-w-[200px] truncate">{r.cliente}</td>
                    <td className="py-2 text-[#C9A84C] text-xs">{r.motivo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
