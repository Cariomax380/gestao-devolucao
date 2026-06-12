'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  AlertTriangle,
  RefreshCw,
  ClipboardList,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  TrendingUp,
  Grid3x3,
  Repeat2,
  ArrowUpDown,
  PackageMinus,
  X,
} from 'lucide-react'
import { useState, Suspense } from 'react'
import { logout } from '@/app/auth/actions'
import { ImportDrawer } from './ImportDrawer'
import { BotaoRelatorio } from './BotaoRelatorio'

/* ----------------------------------------------------------------
   Estrutura de grupos — para adicionar um novo módulo/acompanhamento
   basta acrescentar um novo objeto aqui.
---------------------------------------------------------------- */
type NavItem = {
  type: 'link'
  href: string
  icon: React.ElementType
  label: string
} | {
  type: 'button'
  icon: React.ElementType
  label: string
  onClick: () => void
}

interface NavGroup {
  key: string
  label: string
  icon: React.ElementType
  items: NavItem[]
}

interface SidebarProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed,    setCollapsed]    = useState(false)
  const [importOpen,   setImportOpen]   = useState(false)
  // expansão de cada grupo, keyed por group.key
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ gd: true })

  function toggleGroup(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const navGroups: NavGroup[] = [
    {
      key:   'gd',
      label: 'Gestão da Devolução',
      icon:  PackageMinus,
      items: [
        { type: 'link',   href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'      },
        { type: 'link',   href: '/ofensores',    icon: AlertTriangle,   label: 'Ofensores & PDVs' },
        { type: 'link',   href: '/variacao',     icon: ArrowUpDown,     label: 'Variação'       },
        { type: 'link',   href: '/reversoes',    icon: RefreshCw,       label: 'Reversões'      },
        { type: 'link',   href: '/tendencia',    icon: TrendingUp,      label: 'Tendência'      },
        { type: 'link',   href: '/calor',        icon: Grid3x3,         label: 'Mapa de Calor'  },
        { type: 'link',   href: '/gatilho',       icon: Repeat2,         label: 'Gestão de Gatilho' },
        { type: 'link',   href: '/plano-acao',   icon: ClipboardList,   label: 'Plano de Ação'  },
        { type: 'link',   href: '/configuracoes',icon: Settings,        label: 'Configurações'  },
        { type: 'button', icon: Upload, label: 'Importação', onClick: () => setImportOpen(true) },
      ],
    },
    // Adicione futuros módulos aqui:
    // { key: 'outro', label: 'Outro Módulo', icon: SomeIcon, items: [...] },
  ]

  return (
    <>
      {/* Overlay mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        'flex flex-col h-screen bg-[#003087] transition-all duration-300 shrink-0',
        // Desktop: posição normal no fluxo
        'md:relative md:translate-x-0',
        // Mobile: drawer fixo, oculto por padrão
        'fixed inset-y-0 left-0 z-50 md:static',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'w-16' : 'w-56'
      )}>

        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 border-b border-white/10 px-4 shrink-0',
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
          {/* Botão fechar — mobile */}
          {isMobileOpen && (
            <button
              onClick={onMobileClose}
              className="text-white/50 hover:text-[#F2C800] transition-colors ml-2 md:hidden"
              aria-label="Fechar menu"
            >
              <X size={16} />
            </button>
          )}
          {/* Botão collapse — desktop */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="text-white/50 hover:text-[#F2C800] transition-colors ml-2 hidden md:block"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navGroups.map(group => {
            const isOpen = expanded[group.key] ?? true
            const GroupIcon = group.icon

            return (
              <div key={group.key} className="mb-1">

                {/* Cabeçalho do grupo — só aparece quando sidebar expandida */}
                {!collapsed ? (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="flex items-center justify-between w-full px-4 py-2 text-white/40 hover:text-white/60 transition-colors"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                      {group.label}
                    </span>
                    <ChevronDown
                      size={12}
                      className={cn('shrink-0 transition-transform duration-200', !isOpen && '-rotate-90')}
                    />
                  </button>
                ) : (
                  /* Ícone do grupo na sidebar recolhida */
                  <button
                    onClick={() => toggleGroup(group.key)}
                    title={group.label}
                    className={cn(
                      'flex items-center justify-center w-full py-2 mb-1 transition-colors',
                      isOpen ? 'text-[#F2C800]/60' : 'text-white/30 hover:text-white/50'
                    )}
                  >
                    <GroupIcon size={14} />
                  </button>
                )}

                {/* Itens do grupo */}
                {(collapsed || isOpen) && (
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const Icon = item.icon

                      if (item.type === 'button') {
                        return (
                          <button
                            key={item.label}
                            onClick={item.onClick}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150 w-[calc(100%-16px)]',
                              'text-white/70 hover:text-white hover:bg-white/10'
                            )}
                          >
                            <Icon size={18} className="shrink-0" />
                            {!collapsed && <span>{item.label}</span>}
                          </button>
                        )
                      }

                      const active = pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150',
                            active
                              ? 'bg-[#F2C800]/15 text-[#F2C800] border border-[#F2C800]/30'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          )}
                        >
                          <Icon size={18} className="shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Relatório PDF — fora dos grupos pois usa useSearchParams */}
          <div className="mt-1 pt-1 border-t border-white/10">
            <Suspense fallback={null}>
              <BotaoRelatorio collapsed={collapsed} />
            </Suspense>
          </div>
        </nav>

        {/* Logout */}
        <div className="border-t border-white/10 p-3 shrink-0">
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
