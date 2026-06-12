'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function login(formData: FormData) {
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const rl = checkRateLimit(`login:${email}`, 5, 60_000)
  if (!rl.allowed) {
    return { error: 'Muitas tentativas. Aguarde um momento e tente novamente.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get('password') as string,
  })

  if (error) return { error: 'Email ou senha incorretos.' }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function solicitarRecuperacao(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const email = (formData.get('email') as string).trim()
  if (!email) return { error: 'Email obrigatório.' }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?type=recovery`,
  })

  if (error) return { error: 'Não foi possível enviar o email. Verifique se o SMTP está configurado.' }
  return { ok: true }
}

export async function atualizarSenha(
  formData: FormData,
): Promise<{ error?: string }> {
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  redirect('/login')
}
