import { createClient } from '@/lib/supabase-server'

/** Retorna um Map de codigo → nome para resolver motoristas nas páginas. */
export async function getMotoristaMap(): Promise<Map<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('motoristas').select('codigo, nome')
  const map = new Map<string, string>()
  for (const m of data ?? []) map.set(String(m.codigo).trim(), m.nome.trim())
  return map
}

/** Resolve o nome do motorista ou retorna o código como fallback. */
export function resolveMotorista(map: Map<string, string>, codigo: string | null | undefined): string {
  if (!codigo || String(codigo).trim() === '') return 'Sem motorista'
  return map.get(String(codigo).trim()) ?? `#${codigo}`
}
