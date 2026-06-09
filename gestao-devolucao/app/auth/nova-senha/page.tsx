'use client'

import { useState } from 'react'
import { atualizarSenha } from '@/app/auth/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function EyeOpen() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function EyeClosed() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  )
}

export default function NovaSenhaPage() {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const senha = formData.get('password') as string
    const confirmar = formData.get('confirm') as string

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setLoading(true)
    setErro(null)
    const result = await atualizarSenha(formData)
    if (result?.error) {
      setErro(result.error)
      setLoading(false)
    }
  }

  const inputCls = 'bg-[#F9FAFB] border-gray-200 hover:border-gray-300 text-[#111] placeholder:text-gray-300 rounded-lg h-11 text-sm pr-10 focus-visible:ring-0 focus-visible:border-[#F2C800] transition-colors'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#002575] px-4">
      <div className="w-full max-w-[360px] bg-white rounded-2xl p-10 shadow-2xl">

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px w-6 bg-[#F2C800]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Nova senha
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#111] leading-tight">
            Defina sua<br />nova senha.
          </h1>
          <p className="text-sm text-gray-400 mt-2">Mínimo de 6 caracteres.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
              Nova senha
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showSenha ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className={inputCls}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showSenha ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
              Confirmar senha
            </Label>
            <div className="relative">
              <Input
                id="confirm"
                name="confirm"
                type={showConfirm ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className={inputCls}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirm ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
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
            disabled={loading}
            className="w-full h-11 rounded-lg font-semibold text-[#002575] bg-[#F2C800] hover:bg-[#e8ba00] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Salvando...
              </span>
            ) : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
