import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Loader2, UserCheck, PenLine } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { academyService } from '@/services/academy'
import { formatDateBR } from '@/lib/matricula'
import { useToast } from '@/hooks/use-toast'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'
import type { StudentRecord } from '@/types/database'

interface StudentUpdatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Alunos atualizados pelo próprio link (atualizado_pelo_aluno_em preenchido). */
  students: StudentRecord[]
  loading: boolean
  onReload: () => void
}

/**
 * FILA DE PENDÊNCIAS do painel "Atualizações" de /alunos: somente alunos cuja
 * atualização ainda não foi lida pelo admin (atualizacao_vista_pelo_admin =
 * false — o filtro vem do getStudentUpdates). Quem já foi lido, ou teve a
 * assinatura da ficha registrada, sai da lista. Mesmo padrão visual do painel
 * de solicitações de /matriculas. Abrir, fechar e CLICAR em um card NÃO altera
 * a fila nem o badge: clicar apenas navega ao detalhe do aluno. O card só sai
 * da fila quando o admin registra a assinatura da ficha
 * (registrarAssinaturaFicha quita atualizacao_vista_pelo_admin).
 *
 * ATALHO NO CARD (0.0.93): cada card tem o botão "Registrar assinatura" com a
 * MESMA semântica da ficha imprimível — grava ficha_assinada_em, limpa
 * ficha_pendente E quita atualizacao_vista_pelo_admin — sem abrir telas.
 * O clique no botão não navega (stopPropagation); o restante do card continua
 * apenas navegando ao detalhe do aluno.
 *
 * signedIds (saída otimista da fila) é limpo para ids que não voltam na lista:
 * se o mesmo aluno reenviar a atualização pelo link, ele volta a aparecer.
 */
export function StudentUpdatesDialog({
  open,
  onOpenChange,
  students,
  loading,
  onReload,
}: StudentUpdatesDialogProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [signingId, setSigningId] = useState<string | null>(null)
  const [signedIds, setSignedIds] = useState<Set<string>>(() => new Set())

  const updated = useMemo(
    () =>
      students
        .filter((s) => !!s.atualizado_pelo_aluno_em && !signedIds.has(s.id))
        .sort(
          (a, b) =>
            new Date(b.atualizado_pelo_aluno_em || 0).getTime() -
            new Date(a.atualizado_pelo_aluno_em || 0).getTime(),
        ),
    [students, signedIds],
  )

  // signedIds (saída otimista da fila) é limpo para ids que não voltam na
  // lista do backend: se o mesmo aluno reenviar a atualização pelo link
  // (flag atualizacao_vista_pelo_admin volta a false), ele reaparece na fila.
  useEffect(() => {
    setSignedIds((prev) => {
      if (prev.size === 0) return prev
      const alive = new Set(students.map((s) => s.id))
      const next = new Set([...prev].filter((id) => alive.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [students])

  // Clicar em um card APENAS navega ao detalhe do aluno: nada é marcado como
  // visto e o card permanece na fila. A saída da fila acontece quando o admin
  // registra a assinatura da ficha do aluno — pelo atalho no próprio card ou
  // pelo botão da ficha imprimível.
  const openStudent = (student: StudentRecord) => {
    onOpenChange(false)
    navigate(`/alunos/${student.id}`)
  }

  // Atalho do card: mesma chamada da ficha imprimível — quita os DOIS flags
  // (atualizacao_vista_pelo_admin = true e ficha_pendente = false) e grava
  // ficha_assinada_em. O realtime de students recarrega a lista na página
  // (/alunos) e o card sai da fila; a recontagem do badge é refeita no efeito.
  const handleRegisterSignature = async (student: StudentRecord) => {
    if (signingId || signedIds.has(student.id)) return
    setSigningId(student.id)
    try {
      await academyService.registrarAssinaturaFicha(student.id)
      setSignedIds((prev) => {
        const next = new Set(prev)
        next.add(student.id)
        return next
      })
      toast({
        title: 'Assinatura registrada!',
        description: `Ficha de ${student.name} assinada em ${new Date().toLocaleDateString('pt-BR')} — atualização encerrada.`,
      })
      // Recontagem imediata da fila e do contador do botão "Atualizações":
      // o aluno não entra mais no filtro atualizacao_vista_pelo_admin = false.
      onReload()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao registrar assinatura',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSigningId(null)
    }
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
            Alunos com atualização pendente de leitura — enviada pelo próprio link seguro, da mais
            recente para a mais antiga. Registrar a assinatura da ficha do aluno encerra o aviso.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando atualizações...
          </div>
        ) : updated.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl">
            Nenhuma atualização pendente.
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {updated.map((s) => {
              const photoUrl = getStudentPhotoUrl(s)
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openStudent(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openStudent(s)
                    }
                  }}
                  className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white hover:border-[#17A2B8]/60 hover:bg-sky-50/40 transition p-3 flex items-center gap-3"
                >
                  <Avatar className="w-10 h-10 shrink-0 border-2 border-slate-200 bg-slate-100">
                    {photoUrl ? (
                      <AvatarImage src={photoUrl} alt={s.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-[#0F1B3D] text-white font-bold text-xs">
                      {(s.name || '??').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#0F1B3D] text-sm truncate">{s.name}</p>
                      <Badge className="bg-[#17A2B8]/10 text-[#0F7C8A] border-[#17A2B8]/30 text-[10px] font-bold shrink-0">
                        Nova
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Atualizado pelo aluno em {formatDateBR(s.atualizado_pelo_aluno_em)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white font-bold text-[11px] h-8 px-2.5 shrink-0"
                    variant="outline"
                    disabled={signingId !== null}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRegisterSignature(s)
                    }}
                  >
                    {signingId === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <PenLine className="w-3.5 h-3.5 mr-1" />
                    )}
                    {signingId === s.id ? 'Registrando...' : 'Registrar assinatura'}
                  </Button>
                </div>
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
