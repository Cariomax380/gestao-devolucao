import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      {/* filtros */}
      <div className="grid grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl px-3 py-3 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      {/* gráfico */}
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}
