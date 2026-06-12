'use client'

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-[#003087] mb-1">Algo deu errado</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Ocorreu um erro inesperado nesta página. Tente novamente.
      </p>
      <button
        onClick={reset}
        className="h-9 px-5 rounded-lg bg-[#F2C800] text-[#003087] text-sm font-semibold hover:bg-[#e8ba00] transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  )
}
