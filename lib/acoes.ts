import type { SupabaseClient } from '@supabase/supabase-js'
import { getMotoristaMap } from './motoristas'

/**
 * Gera ações automáticas no plano de ação após cada importação.
 * Cria ações de "Crítica" para motoristas com ≥20% de devolução
 * e "Alta" para motoristas com ≥10%, além de uma ação geral se % geral ≥5%.
 */
export async function gerarPlanoAcao(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  importacaoId: string,
  periodo: string,
  userId: string,
): Promise<void> {
  const [{ data: ofensores, error: ofensoresErr }, motMap] = await Promise.all([
    supabase
      .from('devolucoes')
      .select('motorista, pdvs_faturados, pdvs_devolvidos, volume_devolvido_hl')
      .eq('importacao_id', importacaoId),
    getMotoristaMap(),
  ])

  if (ofensoresErr) {
    console.error('[gerarPlanoAcao] erro ao buscar ofensores:', ofensoresErr.message)
    return
  }
  if (!ofensores?.length) return

  const porMotorista: Record<string, { fat: number; dev: number; vol: number }> = {}
  for (const r of ofensores) {
    const k = r.motorista
    if (!k) continue
    if (!porMotorista[k]) porMotorista[k] = { fat: 0, dev: 0, vol: 0 }
    porMotorista[k].fat += r.pdvs_faturados    ?? 0
    porMotorista[k].dev += r.pdvs_devolvidos   ?? 0
    porMotorista[k].vol += r.volume_devolvido_hl ?? 0
  }

  const acoes: object[] = []

  for (const [motorista, d] of Object.entries(porMotorista)) {
    if (d.fat < 5 || !motorista || motorista === 'desconhecido') continue
    const pct  = d.fat > 0 ? (d.dev / d.fat) * 100 : 0
    const nome = motMap.get(String(motorista).trim()) ?? `cód. ${motorista}`

    if (pct >= 20) {
      acoes.push({
        descricao:           `Motorista ${nome} com ${pct.toFixed(1)}% de devolução no período ${periodo} — realizar acompanhamento individual e identificar causa raiz`,
        responsavel:         'Supervisor',
        prazo:               new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        status:              'aberto',
        prioridade:          'critica',
        indicador_impactado: 'devolucao_pdv',
        criado_por:          userId,
        user_id:             userId,
      })
    } else if (pct >= 10) {
      acoes.push({
        descricao:           `Motorista ${nome} com ${pct.toFixed(1)}% de devolução — monitorar nas próximas rotas`,
        responsavel:         'Coordenador',
        prazo:               new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        status:              'aberto',
        prioridade:          'alta',
        indicador_impactado: 'devolucao_pdv',
        criado_por:          userId,
        user_id:             userId,
      })
    }
  }

  const totalFat = Object.values(porMotorista).reduce((s, d) => s + d.fat, 0)
  const totalDev = Object.values(porMotorista).reduce((s, d) => s + d.dev, 0)
  const pctGeral = totalFat > 0 ? (totalDev / totalFat) * 100 : 0

  if (pctGeral >= 5) {
    acoes.push({
      descricao:           `Taxa geral de devolução em ${pctGeral.toFixed(1)}% no período ${periodo} — revisar processos operacionais`,
      responsavel:         'Coordenador',
      prazo:               new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      status:              'aberto',
      prioridade:          pctGeral >= 10 ? 'critica' : 'alta',
      indicador_impactado: 'devolucao_pdv',
      criado_por:          userId,
      user_id:             userId,
    })
  }

  if (acoes.length > 0) {
    const { error: insertErr } = await supabase.from('plano_acao').insert(acoes)
    if (insertErr) {
      console.error('[gerarPlanoAcao] erro ao inserir plano de ação:', insertErr.message)
    }
  }
}
