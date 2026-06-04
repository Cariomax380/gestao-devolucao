import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()

  // 1. Contagens de campos de horário preenchidos
  const { data: counts } = await supabase
    .from('devolucoes')
    .select('horario_apontamento, horario_finalizacao, janela_entrega')
    .eq('pdvs_devolvidos', 1)
    .limit(50000)

  const total = counts?.length ?? 0
  const comApontamento  = counts?.filter(r => r.horario_apontamento  != null && r.horario_apontamento  !== '').length ?? 0
  const comFinalizacao  = counts?.filter(r => r.horario_finalizacao  != null && r.horario_finalizacao  !== '').length ?? 0
  const comJanela       = counts?.filter(r => r.janela_entrega        != null && r.janela_entrega        !== '').length ?? 0

  // 2. Amostras de valores não nulos de cada campo
  const { data: amostras } = await supabase
    .from('devolucoes')
    .select('horario_apontamento, horario_finalizacao, janela_entrega, status_final, motivo')
    .eq('pdvs_devolvidos', 1)
    .limit(20)

  // 3. Distribuição de horario_apontamento (top valores)
  const distApontamento: Record<string, number> = {}
  for (const r of counts ?? []) {
    const v = (r.horario_apontamento ?? 'NULL') as string
    distApontamento[v] = (distApontamento[v] ?? 0) + 1
  }
  const distApontamentoTop = Object.entries(distApontamento)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // 4. Distribuição de horario_finalizacao (top valores)
  const distFinalizacao: Record<string, number> = {}
  for (const r of counts ?? []) {
    const v = (r.horario_finalizacao ?? 'NULL') as string
    distFinalizacao[v] = (distFinalizacao[v] ?? 0) + 1
  }
  const distFinalizacaoTop = Object.entries(distFinalizacao)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return NextResponse.json({
    total_devolvidos: total,
    campos: {
      horario_apontamento: { preenchidos: comApontamento, pct: total > 0 ? ((comApontamento/total)*100).toFixed(1)+'%' : '0%' },
      horario_finalizacao: { preenchidos: comFinalizacao, pct: total > 0 ? ((comFinalizacao/total)*100).toFixed(1)+'%' : '0%' },
      janela_entrega:      { preenchidos: comJanela,      pct: total > 0 ? ((comJanela/total)*100).toFixed(1)+'%'      : '0%' },
    },
    distribuicao_apontamento: distApontamentoTop,
    distribuicao_finalizacao: distFinalizacaoTop,
    amostras: amostras?.slice(0, 5),
  })
}
