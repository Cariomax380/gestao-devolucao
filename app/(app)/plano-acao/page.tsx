export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { PlanoAcaoClient } from './PlanoAcaoClient'

export default async function PlanoAcaoPage() {
  const supabase = await createClient()

  const { data: acoes, error } = await supabase
    .from('plano_acao')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(500)

  if (error) console.error('[plano-acao]', error.message)

  return <PlanoAcaoClient acoes={acoes ?? []} />
}
