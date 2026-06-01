export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { PlanoAcaoClient } from './PlanoAcaoClient'

export default async function PlanoAcaoPage() {
  const supabase = await createClient()

  const { data: acoes } = await supabase
    .from('plano_acao')
    .select('*')
    .order('criado_em', { ascending: false })

  return <PlanoAcaoClient acoes={acoes ?? []} />
}
