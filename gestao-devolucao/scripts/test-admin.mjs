import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://plxlhwvxloynwoyogdsf.supabase.co',
  'sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Testar insert direto com service role
const { data, error } = await supabase
  .from('importacoes')
  .insert({ nome_arquivo: 'teste.xlsx', total_linhas: 1, status: 'processando' })
  .select('id')
  .single()

if (error) {
  console.log('ERRO:', error.message)
  console.log('Código:', error.code)
} else {
  console.log('✓ Insert funcionou! ID:', data.id)
  // Limpar
  await supabase.from('importacoes').delete().eq('id', data.id)
}
