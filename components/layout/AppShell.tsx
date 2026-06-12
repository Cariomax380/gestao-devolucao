'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#FAFAFA] overflow-hidden" suppressHydrationWarning>
      <Sidebar isMobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
        {/* Top bar visível apenas em mobile */}
        <div className="sticky top-0 z-30 flex items-center h-12 px-4 bg-white border-b border-gray-100 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-[#003087] hover:bg-gray-100 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="ml-3 text-base font-black tracking-widest text-[#003087]">
            Painel<span className="text-[#F2C800]">.</span>
          </span>
        </div>

        {children}
      </main>
    </div>
  )
}
