'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingDown,
  AlertTriangle,
  Store,
  RefreshCw,
  MapPin,
  PieChart,
  ClipboardList,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { logout } from '@/app/auth/actions'
import { ImportDrawer } from './ImportDrawer'

const navItems = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/ofensores',     icon: AlertTriangle,   label: 'Ofensores' },
  { href: '/pdvs',          icon: Store,           label: 'PDVs' },
  { href: '/reversoes',     icon: RefreshCw,       label: 'Reversões' },
  { href: '/raio',          icon: MapPin,          label: 'Raio' },
  { href: '/motivos',       icon: PieChart,        label: 'Motivos' },
  { href: '/plano-acao',    icon: ClipboardList,   label: 'Plano de Ação' },
  { href: '/configuracoes', icon: Settings,        label: 'Configurações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <aside className={cn(
        'flex flex-col h-screen bg-[#0A0A0A] border-r border-white/5 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 border-b border-white/5 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <span className="text-lg font-black tracking-widest text-white">
              GD<span className="text-[#C9A84C]">.</span>
            </span>
          )}
          {collapsed && (
            <span className="text-lg font-black text-[#C9A84C]">G</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-500 hover:text-[#C9A84C] transition-colors ml-2"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
                title={collapsed ? label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}

          {/* Importação — abre drawer */}
          <button
            onClick={() => setImportOpen(true)}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150 w-[calc(100%-16px)]',
              'text-gray-400 hover:text-white hover:bg-white/5'
            )}
            title={collapsed ? 'Importação' : undefined}
          >
            <Upload size={18} className="shrink-0" />
            {!collapsed && <span>Importação</span>}
          </button>
        </nav>

        {/* Logout */}
        <div className="border-t border-white/5 p-3">
          <form action={logout}>
            <button
              type="submit"
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-400/5 transition-all',
                collapsed && 'justify-center'
              )}
              title={collapsed ? 'Sair' : undefined}
            >
              <LogOut size={18} className="shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </form>
        </div>
      </aside>

      <ImportDrawer open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}
