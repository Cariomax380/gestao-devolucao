import { Sidebar } from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0D0D0D] overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
        {children}
      </main>
    </div>
  )
}
