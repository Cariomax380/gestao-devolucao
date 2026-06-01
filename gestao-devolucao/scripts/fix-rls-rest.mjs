// Usar REST API via Node.js fetch (não é browser, não tem restrição)
const URL = 'https://plxlhwvxloynwoyogdsf.supabase.co/rest/v1/rpc/exec_sql'
const SERVICE_KEY = 'sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC'

// Testar insert direto via REST com service role
const res = await fetch('https://plxlhwvxloynwoyogdsf.supabase.co/rest/v1/importacoes', {
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  },
  body: JSON.stringify({
    nome_arquivo: 'teste.xlsx',
    total_linhas: 1,
    status: 'processando'
  })
})

const text = await res.text()
console.log('Status:', res.status)
console.log('Resposta:', text)
