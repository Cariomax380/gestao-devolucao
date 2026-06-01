import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://plxlhwvxloynwoyogdsf.supabase.co',
  'sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const sql = `
drop policy if exists "auth_all" on importacoes;
drop policy if exists "auth_all" on devolucoes;
create policy "auth_insert" on importacoes for insert to authenticated with check (true);
create policy "auth_select" on importacoes for select to authenticated using (true);
create policy "auth_update" on importacoes for update to authenticated using (true) with check (true);
create policy "auth_insert" on devolucoes for insert to authenticated with check (true);
create policy "auth_select" on devolucoes for select to authenticated using (true);
create policy "auth_update" on devolucoes for update to authenticated using (true) with check (true);
`

const { error } = await supabase.rpc('exec_sql', { query: sql })

if (error) {
  // exec_sql não existe — tentar via pg direto não é possível aqui
  // Usar o postgres REST endpoint
  console.log('Tentando via query direta...')

  const statements = sql.trim().split(';').filter(s => s.trim())
  for (const stmt of statements) {
    const { error: e } = await supabase.from('_sql').select(stmt.trim()).single()
    if (e && !e.message.includes('does not exist')) console.log('Erro:', e.message)
  }
} else {
  console.log('✓ Políticas atualizadas com sucesso')
}
