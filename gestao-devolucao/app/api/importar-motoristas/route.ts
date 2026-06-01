import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// Variantes aceitas de nome de coluna para código e nome (lowercase, sem acentos)
const ALIAS_CODIGO = ['cod.motorista', 'codigo', 'code', 'driver_external_id', 'cod', 'id_motorista', 'matricula', 'cód.motorista']
const ALIAS_NOME   = ['nome motorista', 'nome', 'name', 'driver_name', 'motorista', 'nome_motorista', 'driver']

function normalize(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function findCol(keys: string[], aliases: string[]): string | null {
  for (const key of keys) {
    if (aliases.includes(normalize(key))) return key
  }
  return null
}

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!file.name.match(/\.csv$/i)) return NextResponse.json({ error: 'Formato inválido. Envie um arquivo .csv' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  // Detectar separador: se o arquivo tiver ponto-e-vírgula na primeira linha, usar FS=;
  const text = buffer.toString('latin1')
  const firstLine = text.split('\n')[0] ?? ''
  const separator = firstLine.includes(';') ? ';' : ','
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, FS: separator, codepage: 1252 })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  if (!rows.length) return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 })

  const keys = Object.keys(rows[0])
  const colCodigo = findCol(keys, ALIAS_CODIGO)
  const colNome   = findCol(keys, ALIAS_NOME)

  if (!colCodigo || !colNome) {
    return NextResponse.json({
      error: `Colunas não identificadas. Esperado: código (${ALIAS_CODIGO.join('/')}) e nome (${ALIAS_NOME.join('/')})`,
    }, { status: 400 })
  }

  // Tentar localizar coluna de CDD (filial)
  const colCdd = findCol(keys, ['cod.filial', 'cdd', 'filial', 'distribution_center_id', 'descricao filial', 'descrição filial'])

  const registros = rows
    .map(r => ({
      codigo: String(r[colCodigo!] ?? '').trim(),
      nome:   String(r[colNome!]   ?? '').trim(),
      cdd:    colCdd ? String(r[colCdd] ?? '*').trim() : '*',
    }))
    .filter(r => r.codigo && r.nome)

  if (!registros.length) {
    return NextResponse.json({ error: 'Nenhuma linha válida encontrada.' }, { status: 400 })
  }

  // Buscar total antes para calcular histórico preservado
  const { count: totalAntes } = await supabase
    .from('motoristas')
    .select('*', { count: 'exact', head: true })

  // Upsert: atualiza existentes, insere novos, NUNCA deleta
  const { error } = await supabase
    .from('motoristas')
    .upsert(registros, { onConflict: 'codigo,cdd' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count: totalDepois } = await supabase
    .from('motoristas')
    .select('*', { count: 'exact', head: true })

  const inseridos  = Math.max(0, (totalDepois ?? 0) - (totalAntes ?? 0))
  const atualizados = registros.length - inseridos
  const historico  = (totalDepois ?? 0) - registros.length

  return NextResponse.json({
    ok: true,
    total: registros.length,
    inseridos,
    atualizados,
    historico_preservado: Math.max(0, historico),
  })
}
