import { createClient } from '@supabase/supabase-js'

const s = createClient(
  'https://plxlhwvxloynwoyogdsf.supabase.co',
  'sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Testar se conseguimos criar funções via REST
const sql = `
CREATE OR REPLACE FUNCTION resumo_dashboard()
RETURNS TABLE (
  pdvs_faturados bigint,
  pdvs_devolvidos bigint,
  pdv_repasse bigint,
  vol_faturado numeric,
  vol_devolvido numeric
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    SUM(pdvs_faturados),
    SUM(pdvs_devolvidos),
    SUM(pdv_repasse),
    SUM(volume_faturado_hl),
    SUM(volume_devolvido_hl)
  FROM devolucoes;
$$;
`

const res = await fetch('https://plxlhwvxloynwoyogdsf.supabase.co/rest/v1/', {
  method: 'POST',
  headers: {
    'apikey': 'sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC',
    'Authorization': 'Bearer sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC',
  }
})
console.log(res.status)
