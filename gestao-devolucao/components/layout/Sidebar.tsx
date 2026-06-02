'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  AlertTriangle,
  RefreshCw,
  MapPin,
  ClipboardList,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  TrendingUp,
  Grid3x3,
  Repeat2,
  ArrowUpDown,
} from 'lucide-react'
import { useState } from 'react'
import { logout } from '@/app/auth/actions'
import { ImportDrawer } from './ImportDrawer'

const navItems = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/ofensores',    icon: AlertTriangle,   label: 'Ofensores & PDVs' },
  { href: '/variacao',     icon: ArrowUpDown,     label: 'Variação' },
  { href: '/reversoes',    icon: RefreshCw,       label: 'Reversões' },
  { href: '/raio',         icon: MapPin,          label: 'Raio' },
  { href: '/tendencia',    icon: TrendingUp,      label: 'Tendência' },
  { href: '/calor',        icon: Grid3x3,         label: 'Mapa de Calor' },
  { href: '/reincidencia', icon: Repeat2,         label: 'Reincidência' },
  { href: '/plano-acao',   icon: ClipboardList,   label: 'Plano de Ação' },
  { href: '/configuracoes',icon: Settings,        label: 'Configurações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <aside className={cn(
        'flex flex-col h-screen bg-[#003087] transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 border-b border-white/10 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <span className="text-lg font-black tracking-widest text-white">
              Painel<span className="text-[#F2C800]">.</span>
            </span>
          )}
          {collapsed && (
            <span className="text-lg font-black text-[#F2C800]">P</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/50 hover:text-[#F2C800] transition-colors ml-2"
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
                    ? 'bg-[#F2C800]/15 text-[#F2C800] border border-[#F2C800]/30'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
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
              'text-white/70 hover:text-white hover:bg-white/10'
            )}
            title={collapsed ? 'Importação' : undefined}
          >
            <Upload size={18} className="shrink-0" />
            {!collapsed && <span>Importação</span>}
          </button>
        </nav>

        {/* Logout */}
        <div className="border-t border-white/10 p-3">
          <form action={logout}>
            <button
              type="submit"
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/50 hover:text-red-300 hover:bg-red-400/10 transition-all',
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
