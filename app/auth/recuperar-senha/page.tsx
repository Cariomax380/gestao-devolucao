'use client'

import { useState } from 'react'
import Link from 'next/link'
import { solicitarRecuperacao } from '@/app/auth/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RecuperarSenhaPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErro(null)
    const result = await solicitarRecuperacao(new FormData(e.currentTarget))
    if (result?.error) {
      setErro(result.error)
      setStatus('idle')
    } else {
      setStatus('success')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#002575] px-4">
      <div className="w-full max-w-[360px] bg-white rounded-2xl p-10 shadow-2xl">

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px w-6 bg-[#F2C800]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Recuperação de acesso
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#111] leading-tight">
            Esqueceu<br />sua senha?
          </h1>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            Informe o email cadastrado e enviaremos um link para redefinição.
          </p>
        </div>

        {status === 'success' ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700 leading-relaxed">
            Email enviado. Verifique sua caixa de entrada e clique no link para redefinir sua senha.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="bg-[#F9FAFB] border-gray-200 hover:border-gray-300 text-[#111] placeholder:text-gray-300 rounded-lg h-11 text-sm focus-visible:ring-0 focus-visible:border-[#F2C800] transition-colors"
              />
            </div>

            {erro && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-red-600 leading-snug">{erro}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full h-11 rounded-lg font-semibold text-[#002575] bg-[#F2C800] hover:bg-[#e8ba00] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enviando...
                </span>
              ) : 'Enviar link'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}
