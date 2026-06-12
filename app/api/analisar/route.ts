import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 5 análises por minuto por usuário (evita abuso da API Anthropic)
  const rl = checkRateLimit(`analisar:${user.id}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite atingido. Tente novamente em ${Math.ceil(rl.resetMs / 1000)} segundo(s).` },
      {
        status: 429,
        headers: {
          'Retry-After':          String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit':    '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':    String(Date.now() + rl.resetMs),
        },
      },
    )
  }

  let body: { periodo?: string | null } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido: JSON malformado' }, { status: 400 })
  }
  const periodo: string | null = body.periodo ?? null

  const rpcParams = { p_periodo: periodo, p_data_inicio: null, p_data_fim: null, p_motorista: null, p_motivo: null }

  const [
    { data: resumo },
    { data: motivos },
    { data: ofensores },
    { data: porCls },
  ] = await Promise.all([
    supabase.rpc('resumo_dashboard_filtrado',         rpcParams),
    supabase.rpc('resumo_por_motivo_filtrado',        rpcParams),
    supabase.rpc('resumo_ofensores',                  { p_periodo: periodo }),
    supabase.rpc('resumo_por_classificacao_filtrado', rpcParams),
  ])

  const dados = {
    periodo: periodo ?? 'todos',
    resumo_geral: resumo?.[0] ?? null,
    top_motivos: (motivos ?? []).slice(0, 10),
    top_ofensores: (ofensores ?? []).slice(0, 10),
    por_classificacao: porCls ?? [],
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' }, { status: 500 })
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Você é um analista de logística e devoluções de bebidas (CDD — Centro de Distribuição Direta).
Analise os dados a seguir e retorne APENAS um JSON válido (sem markdown, sem texto adicional) com exatamente estas chaves:
{
  "padroes": ["string"],
  "kpis_sugeridos": ["string"],
  "acoes": [{ "descricao": "string", "prioridade": "alta"|"media"|"baixa" }],
  "anomalias": ["string"]
}

Dados da operação:
${JSON.stringify(dados, null, 2)}`,
      }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return NextResponse.json({ error: `Erro na API Claude: ${err}` }, { status: 500 })
  }

  const result = await resp.json()
  const text: string = result.content?.[0]?.text ?? '{}'

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Resposta inesperada da IA', raw: text }, { status: 500 })
  }
}
