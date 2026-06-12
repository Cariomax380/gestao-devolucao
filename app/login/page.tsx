'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/auth/actions'
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

const BARS = [38, 62, 48, 80, 55, 90, 44, 72, 35, 68, 82, 50, 74, 42, 86, 58, 95, 46, 70, 40]

export default function LoginPage() {
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (result?.error) {
      setErro(result.error)
      setLoading(false)
    }
  }

  const inputBase = 'bg-[#F9FAFB] text-[#111] placeholder:text-gray-300 rounded-lg h-11 text-sm focus-visible:ring-0 focus-visible:border-[#F2C800] transition-colors'
  const inputNormal = 'border-gray-200 hover:border-gray-300'
  const inputErro = 'border-red-300 bg-red-50/60'

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — dark brand ── */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-between overflow-hidden bg-[#002575] p-16">

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #F2C800 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        {/* Fade bottom */}
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#001540] to-transparent" />

        {/* CDD Maceió watermark */}
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none opacity-[0.04] gap-3">
          <span className="text-[11rem] font-black text-[#F2C800] leading-none tracking-tighter">CDD</span>
          <span className="text-[4rem] font-black text-[#F2C800] leading-none tracking-[0.28em] uppercase">Maceió</span>
        </div>

        {/* Bar chart silhouette */}
        <div className="absolute bottom-[88px] left-16 right-16 flex items-end gap-[3px]">
          {BARS.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[2px]"
              style={{
                height: `${h * 1.4}px`,
                background: `rgba(242,200,0,${0.07 + (h / 100) * 0.15})`,
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F2C800]/50 mb-3">
            Ambev · CDD Maceió
          </p>
          <div className="flex items-baseline gap-0.5">
            <span className="text-4xl font-black tracking-widest text-white">Painel</span>
            <span className="text-4xl font-black text-[#F2C800]">.</span>
          </div>
        </div>

        {/* Tagline + stats */}
        <div className="relative z-10">
          <p className="text-white/60 text-xl font-light leading-relaxed mb-10">
            Visibilidade total<br />
            sobre cada processo.<br />
            <span className="text-white font-semibold">Decisões mais rápidas.</span>
          </p>

          <div className="flex gap-10 pt-8 border-t border-white/[0.08]">
            {[
              { v: '355+', l: 'Rotas' },
              { v: '6.4k+', l: 'PDVs' },
              { v: '9',     l: 'Módulos' },
            ].map(({ v, l }) => (
              <div key={l}>
                <div className="text-2xl font-bold text-[#F2C800]">{v}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="w-full lg:w-[460px] flex items-center justify-center bg-white px-10 py-16">
        <div className="w-full max-w-[340px]">

          {/* Logo mobile */}
          <div className="mb-10 lg:hidden">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-2">Ambev · CDD Maceió</p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black tracking-widest text-[#002575]">Painel</span>
              <span className="text-2xl font-black text-[#F2C800]">.</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px w-6 bg-[#F2C800]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Acesso restrito</span>
            </div>
            <h1 className="text-[1.85rem] font-bold text-[#111] leading-[1.2]">
              Bem-vindo<br />de volta.
            </h1>
          </div>

          {/* Form */}
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
                placeholder="usuario@ambev.com.br"
                className={`${inputBase} ${erro ? inputErro : inputNormal}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showSenha ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${inputBase} pr-10 ${erro ? inputErro : inputNormal}`}
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

            {erro && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm leading-snug text-red-600">{erro}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Link
                href="/auth/recuperar-senha"
                className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full h-11 rounded-lg font-semibold text-[#002575] bg-[#F2C800] hover:bg-[#e8ba00] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>

          <p className="mt-12 text-center text-[11px] text-gray-300">
            {new Date().getFullYear()} · Painel · CDD Maceió
          </p>
        </div>
      </div>
    </div>
  )
}
