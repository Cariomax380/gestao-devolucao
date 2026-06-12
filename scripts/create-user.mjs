import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://plxlhwvxloynwoyogdsf.supabase.co',
  'sb_secret_-GrzIEbrrnuuGEYocb39Sg_SrxBCQsC',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.createUser({
  email: 'admin@gestao.com',
  password: 'Admin@2026',
  email_confirm: true,
})

if (error) {
  console.error('Erro:', error.message)
} else {
  console.log('Usuário criado:', data.user.email, '| ID:', data.user.id)
}
