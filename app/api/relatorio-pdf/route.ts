export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase-server'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'
import { RelatorioPDF, type RelatorioDados } from '@/lib/pdf/RelatorioPDF'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return new NextResponse('Não autorizado', { status: 401 })
  }

  const periodo = req.nextUrl.searchParams.get('periodo') || null

  const allParams = {
    p_periodo:     periodo,
    p_data_inicio: null,
    p_data_fim:    null,
    p_motorista:   null,
    p_motivo:      null,
  }

  const [
    { data: resumoRaw,     error: errResumo },
    { data: motivosRaw,    error: errMotivos },
    { data: motoristasRaw, error: errMotoristas },
    { data: gatilhoRaw,    error: errGatilho },
    { data: acoesRaw,      error: errAcoes },
    motMap,
  ] = await Promise.all([
    supabase.rpc('resumo_dashboard_filtrado',      allParams),
    supabase.rpc('resumo_por_motivo_filtrado',     allParams),
    supabase.rpc('resumo_por_motorista_filtrado',  allParams),
    supabase.rpc('resumo_gatilho_geral',           { p_periodo: periodo }),
    supabase
      .from('plano_acao')
      .select('descricao, responsavel, prazo, status, prioridade')
      .eq('user_id', user.id)
      .in('status', ['aberto', 'em_andamento'])
      .order('prioridade')
      .limit(25),
    getMotoristaMap(),
  ])

  const rpcError = errResumo ?? errMotivos ?? errMotoristas ?? errGatilho ?? errAcoes
  if (rpcError) {
    console.error('[relatorio-pdf] erro ao buscar dados:', rpcError.message)
    return new NextResponse('Erro ao gerar relatório: falha ao buscar dados', { status: 500 })
  }

  const r0 = (resumoRaw as any[])?.[0] ?? null
  const resumo = r0 ? {
    pdvs_faturados:  Number(r0.pdvs_faturados  ?? 0),
    pdvs_devolvidos: Number(r0.pdvs_devolvidos ?? 0),
    pdv_repasse:     Number(r0.pdv_repasse     ?? 0),
    vol_faturado:    r0.vol_faturado  != null ? Number(r0.vol_faturado)  : null,
    vol_devolvido:   r0.vol_devolvido != null ? Number(r0.vol_devolvido) : null,
  } : null

  const motivos = ((motivosRaw as any[]) ?? []).map(m => ({
    motivo: String(m.motivo ?? ''),
    qtd:    Number(m.qtd   ?? 0),
    pct:    Number(m.pct   ?? 0),
  }))

  const motoristas = ((motoristasRaw as any[]) ?? []).map(m => ({
    nome: resolveMotorista(motMap, String(m.motorista ?? '')),
    dev:  Number(m.dev ?? 0),
    fat:  Number(m.fat ?? 0),
    pct:  Number(m.pct ?? 0),
  }))

  const gatilho = ((gatilhoRaw as any[]) ?? []).map(g => ({
    data_rota:   String(g.data_rota),
    pdvs_fat:    Number(g.pdvs_fat    ?? 0),
    pdvs_dev:    Number(g.pdvs_dev    ?? 0),
    pct_dev:     Number(g.pct_dev     ?? 0),
    media_prev:  Number(g.media_prev  ?? 0),
    desvio_prev: Number(g.desvio_prev ?? 0),
    periodo_ref: String(g.periodo_ref ?? ''),
  }))

  const acoes = ((acoesRaw as any[]) ?? []).map(a => ({
    descricao:   String(a.descricao   ?? ''),
    responsavel: a.responsavel ? String(a.responsavel) : null,
    prazo:       a.prazo       ? String(a.prazo)       : null,
    status:      String(a.status     ?? 'aberto'),
    prioridade:  String(a.prioridade ?? 'media'),
  }))

  const now = new Date()
  const geradoEm = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const dados: RelatorioDados = { resumo, motivos, motoristas, gatilho, acoes, periodo, geradoEm }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(RelatorioPDF, { dados }) as any)

  const filename = periodo
    ? `relatorio-${periodo}.pdf`
    : 'relatorio-geral.pdf'

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
