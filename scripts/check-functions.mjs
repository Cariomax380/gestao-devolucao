import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://plxlhwvxloynwoyogdsf.supabase.co',
  'sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Buscar definições das funções via pg_proc
const { data, error } = await supabase
  .from('pg_proc')
  .select('proname, prosrc')
  .in('proname', [
    'resumo_motivos',
    'resumo_por_classificacao',
    'resumo_dashboard',
    'resumo_ofensores',
    'resumo_raio',
    'resumo_por_data',
    'resumo_pdvs_reincidentes',
    'periodos_disponiveis',
  ])

if (error) {
  console.log('Erro:', error.message)
} else {
  console.log(JSON.stringify(data, null, 2))
}
