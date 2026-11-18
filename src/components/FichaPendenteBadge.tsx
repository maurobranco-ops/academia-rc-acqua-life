// Tarja/badge âmbar "Ficha desatualizada" — exibida no card do aluno na lista
// (/alunos) e na tela de detalhes (/alunos/:id) enquanto ficha_pendente = true
// (o cadastro foi editado e a ficha impressa precisa ser reimpressa para assinatura).

import { Badge } from '@/components/ui/badge'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FichaPendenteBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn(
        'bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[10px] inline-flex items-center gap-1',
        className,
      )}
      title="O cadastro do aluno foi editado — reimprima a ficha e registre a assinatura."
    >
      <Printer className="w-3 h-3 shrink-0" />
      Ficha desatualizada — reimprimir para assinatura
    </Badge>
  )
}
