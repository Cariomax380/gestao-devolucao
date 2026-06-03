import { AlertTriangle } from 'lucide-react'

interface Props {
  nome: string
  /** wrapper padding — páginas já têm p-6, use false para não duplicar */
  withPadding?: boolean
}

export function ErroRPC({ nome, withPadding = true }: Props) {
  return (
    <div className={withPadding ? 'p-6' : undefined}>
      <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-xl px-5 py-5 flex items-start gap-3">
        <AlertTriangle size={16} className="text-[#EF4444] mt-0.5 shrink-0" />
        <div>
          <p className="text-[#EF4444] font-semibold text-sm">Falha ao carregar dados</p>
          <p className="text-gray-500 text-xs mt-1">
            A função <code className="text-[#D4A800]">{nome}</code> retornou um erro.
            Verifique se ela está criada e com as permissões corretas no Supabase.
          </p>
        </div>
      </div>
    </div>
  )
}
