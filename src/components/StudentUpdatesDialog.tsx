import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Loader2, UserCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { academyService } from '@/services/academy'
import { formatDateBR } from '@/lib/matricula'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'
import type { StudentRecord } from '@/types/database'

interface StudentUpdatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Alunos atualizados pelo próprio link (atualizado_pelo_aluno_em preenchido). */
  students: StudentRecord[]
  loading: boolean
  onReload: () => void
  /** Chamado quando o admin abriu a lista — marca como vistas e zera o badge. */
  onMarkAsSeen: () => void
}

/**
 * Painel "Atualizações" de /alunos: lista os alunos que se atualizaram pelo
 * próprio link seguro (/atualizar/TOKEN), ordenados do mais recente para o mais
 * antigo — mesmo padrão visual do painel de solicitações de /matriculas.
 * Abrir a lista marca as atualizações como vistas pelo admin (zera o badge).
 */
export function StudentUpdatesDialog({
  open,
  onOpenChange,
  students,
  loading,
  onReload,
  onMarkAsSeen,
}: StudentUpdatesDialogProps) {
  const navigate = useNavigate()

  const updated = useMemo(
    () =>
      students
        .filter((s) => !!s.atualizado_pelo_aluno_em)
        .sort(
          (a, b) =>
            new Date(b.atualizado_pelo_aluno_em || 0).getTime() -
            new Date(a.atualizado_pelo_aluno_em || 0).getTime(),
        ),
    [students],
  )

  // Toda abertura da lista marca como vista: o badge da navegação zera.
  useEffect(() => {
    if (open) onMarkAsSeen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const markSeenAndOpen = (student: StudentRecord) => {
    onMarkAsSeen()
    onOpenChange(false)
    navigate(`/alunos/${student.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#17A2B8]" />
            Atualizações de alunos
          </DialogTitle>
          <DialogDescription>
            Alunos que enviaram atualização do próprio cadastro pelo link seguro, da mais recente
            para a mais antiga. Ao ler, o aviso da navegação é encerrado.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando atualizações...
          </div>
        ) : updated.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl">
            Nenhum aluno se atualizou pelo link seguro até agora.
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {updated.map((s) => {
              const photoUrl = getStudentPhotoUrl(s)
              const seen = s.atualizacao_vista_pelo_admin !== false
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => markSeenAndOpen(s)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white hover:border-[#17A2B8]/60 hover:bg-sky-50/40 transition p-3 flex items-center gap-3"
                >
                  <Avatar className="w-10 h-10 border-2 border-slate-200 bg-slate-100">
                    {photoUrl ? (
                      <AvatarImage src={photoUrl} alt={s.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-[#0F1B3D] text-white font-bold text-xs">
                      {(s.name || '??').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0F1B3D] text-sm truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Atualizado pelo aluno em {formatDateBR(s.atualizado_pelo_aluno_em)}
                    </p>
                  </div>
                  {!seen && (
                    <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px] font-bold shrink-0">
                      Nova
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onReload} disabled={loading}>
            <RefreshCw className={loading ? 'w-4 h-4 mr-1 animate-spin' : 'w-4 h-4 mr-1'} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default StudentUpdatesDialog
