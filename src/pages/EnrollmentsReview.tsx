// Tela de conferência das inscrições enviadas pelo formulário público /matricula.
// Mostra foto, RG do responsável, PAR-Q, anamnese e termo; permite APROVAR
// (cria/atualiza o aluno vinculado, copiando dados e foto) ou RECUSAR com motivo.

import { useCallback, useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { academyService } from '@/services/academy'
import type { EnrollmentRequestRecord, StudentRecord } from '@/types/database'
import { PARQ_QUESTIONS, ANAMNESE_QUESTIONS, formatDateBR } from '@/lib/matricula'
import {
  requestToPrintable,
  PrintableFichaDialog,
  type PrintableFichaData,
} from '@/components/PrintableFicha'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Check,
  ClipboardCheck,
  FileText,
  IdCard,
  Loader2,
  Printer,
  RefreshCw,
  UserCheck,
  X,
} from 'lucide-react'

/** URL pública de um arquivo (foto/RG) do registro de inscrição. */
function requestFileUrl(record: EnrollmentRequestRecord, filename?: string): string | null {
  if (!filename) return null
  try {
    return pb.files.getURL(record as unknown as RecordModel, filename)
  } catch {
    return null
  }
}

function YesNo({ v }: { v?: string }) {
  if (v === 'sim') return <span className="text-xs font-bold text-red-600 shrink-0">SIM</span>
  if (v === 'nao')
    return <span className="text-xs font-semibold text-emerald-700 shrink-0">Não</span>
  return <span className="text-xs text-slate-400 shrink-0">—</span>
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-[#0F1B3D] text-right break-all">
        {value && value.trim() ? value : '—'}
      </span>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-xl border-slate-200 shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <Icon className="w-4 h-4 text-[#D4AF37]" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D]">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </Card>
  )
}

export default function EnrollmentsReview() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<EnrollmentRequestRecord[]>([])
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<EnrollmentRequestRecord | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [fichaData, setFichaData] = useState<PrintableFichaData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqs, sts] = await Promise.all([
        academyService.getEnrollmentRequests(),
        academyService.getStudents({ expand: '' }),
      ])
      setRequests(reqs)
      setStudents(sts)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar inscrições',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const pending = requests.filter((r) => r.status === 'pendente')
  const reviewed = requests.filter((r) => r.status !== 'pendente')

  /** Copia a foto (e dados) da inscrição para o aluno e retorna o id do aluno. */
  const copyPhotoToStudent = async (
    request: EnrollmentRequestRecord,
    studentId: string,
  ): Promise<void> => {
    const url = requestFileUrl(request, request.photo_file)
    if (!url) return
    const res = await fetch(url)
    if (!res.ok) throw new Error('Falha ao baixar a foto da inscrição')
    const blob = await res.blob()
    await academyService.uploadStudentPhoto(studentId, blob, request.photo_file)
  }

  const handleApprove = async (request: EnrollmentRequestRecord) => {
    setBusyId(request.id)
    try {
      let studentId = request.student_id || ''
      const baseData: Partial<StudentRecord> = {
        name: request.student_name,
        birth_date: request.student_birth_date || undefined,
        cpf: request.student_cpf || undefined,
        phone: request.student_phone || undefined,
        guardian_name: request.guardian_name || undefined,
        guardian_cpf: request.guardian_cpf || undefined,
        guardian_phone: request.guardian_phone || undefined,
        parq_1: request.parq_1 || '',
        parq_2: request.parq_2 || '',
        parq_3: request.parq_3 || '',
        parq_4: request.parq_4 || '',
        parq_5: request.parq_5 || '',
        parq_6: request.parq_6 || '',
        parq_7: request.parq_7 || '',
        anamnese_medo_agua: request.anamnese_medo_agua || '',
        anamnese_convulsoes: request.anamnese_convulsoes || '',
        anamnese_alergia_cloro: request.anamnese_alergia_cloro || '',
        anamnese_medicamentos: request.anamnese_medicamentos || '',
        anamnese_objetivo: request.anamnese_objetivo || '',
        uso_imagem_autorizado: (request.uso_imagem_autorizado as 'sim' | 'nao') || undefined,
      }

      if (studentId) {
        await academyService.updateStudent(studentId, baseData)
      } else {
        const created = await academyService.createStudent(baseData)
        studentId = created.id
      }

      await copyPhotoToStudent(request, studentId)

      await academyService.updateEnrollmentRequest(request.id, {
        status: 'aprovada',
        student_id: studentId,
        reviewed_at: new Date().toISOString(),
      })

      toast({
        title: 'Inscrição aprovada',
        description: `${request.student_name} agora consta na lista de alunos.`,
      })
      await load()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao aprovar inscrição',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    setBusyId(rejectTarget.id)
    try {
      await academyService.updateEnrollmentRequest(rejectTarget.id, {
        status: 'recusada',
        review_notes: rejectNotes.trim(),
        reviewed_at: new Date().toISOString(),
      })
      toast({ title: 'Inscrição recusada' })
      setRejectTarget(null)
      setRejectNotes('')
      await load()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao recusar inscrição',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const renderRequest = (r: EnrollmentRequestRecord) => {
    const photoUrl = requestFileUrl(r, r.photo_file)
    const rgUrl = requestFileUrl(r, r.guardian_rg_file)
    const linkedStudent = r.student_id ? students.find((s) => s.id === r.student_id) : undefined
    const isBusy = busyId === r.id

    return (
      <Card key={r.id} className="rounded-xl border-slate-200 shadow-xs overflow-hidden">
        {/* Cabeçalho do card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-12 h-12 border-2 border-slate-200 bg-slate-100">
              {photoUrl ? (
                <AvatarImage src={photoUrl} alt={r.student_name} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-[#0F1B3D] text-white font-bold text-sm">
                {(r.student_name || '??').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold text-[#0F1B3D] truncate">{r.student_name || 'Sem nome'}</p>
              <p className="text-[11px] text-slate-500">
                Enviada em {formatDateBR(r.created as string)}
                {r.student_age != null ? ` · ${r.student_age} anos` : ''}
                {linkedStudent ? ' · aluno vinculado' : ''}
              </p>
            </div>
          </div>
          {r.status === 'pendente' ? (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 w-fit">Pendente</Badge>
          ) : r.status === 'aprovada' ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 w-fit">
              Aprovada
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 border-red-300 w-fit">Recusada</Badge>
          )}
        </div>

        {/* Grade 2 colunas (empilha no mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          <SectionCard title="Dados do aluno" icon={UserCheck}>
            <InfoRow label="Nome" value={r.student_name} />
            <InfoRow
              label="Nascimento"
              value={r.student_birth_date ? formatDateBR(r.student_birth_date) : null}
            />
            <InfoRow label="CPF" value={r.student_cpf} />
            <InfoRow label="Telefone" value={r.student_phone} />
            <InfoRow
              label="Uso de imagem"
              value={
                r.uso_imagem_autorizado === 'sim'
                  ? 'Autorizado'
                  : r.uso_imagem_autorizado === 'nao'
                    ? 'Não autorizado'
                    : null
              }
            />
            {photoUrl && (
              <a
                href={photoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#17A2B8] hover:underline"
              >
                <FileText className="w-3.5 h-3.5" /> Ver foto enviada
              </a>
            )}
          </SectionCard>

          <SectionCard title="Responsável" icon={IdCard}>
            <InfoRow label="Nome" value={r.guardian_name} />
            <InfoRow label="CPF" value={r.guardian_cpf} />
            <InfoRow label="Telefone" value={r.guardian_phone} />
            {rgUrl ? (
              <a
                href={rgUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#17A2B8] hover:underline"
              >
                <IdCard className="w-3.5 h-3.5" /> Ver RG do responsável
              </a>
            ) : (
              <InfoRow label="RG do responsável" value="(não enviado)" />
            )}
          </SectionCard>

          <SectionCard title="PAR-Q (7 perguntas)" icon={ClipboardCheck}>
            {PARQ_QUESTIONS.map((q, i) => (
              <div key={q.key} className="flex justify-between items-start gap-3 py-0.5">
                <span className="text-[11px] text-slate-700">
                  {i + 1}. {q.text}
                </span>
                <YesNo v={r[q.key]} />
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Anamnese aquática" icon={ClipboardCheck}>
            {ANAMNESE_QUESTIONS.map((q) => (
              <div key={q.key} className="flex justify-between items-start gap-3 py-0.5">
                <span className="text-[11px] text-slate-700">{q.text}</span>
                <YesNo v={r[q.key]} />
              </div>
            ))}
            <InfoRow label="Medicamentos em uso" value={r.anamnese_medicamentos} />
            <InfoRow label="Objetivo com a natação" value={r.anamnese_objetivo} />
          </SectionCard>
        </div>

        {r.review_notes && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-600">
              <strong>Motivo da recusa:</strong> {r.review_notes}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setFichaData(requestToPrintable(r))}
          >
            <Printer className="w-4 h-4 mr-1" /> Imprimir ficha
          </Button>
          {r.status === 'pendente' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                disabled={isBusy}
                onClick={() => {
                  setRejectTarget(r)
                  setRejectNotes('')
                }}
              >
                <X className="w-4 h-4 mr-1" /> Recusar
              </Button>
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                disabled={isBusy}
                onClick={() => handleApprove(r)}
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                Aprovar
              </Button>
            </>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0F1B3D]">Conferência de Inscrições</h2>
          <p className="text-xs text-slate-500">
            Inscrições enviadas pelo formulário público /matricula — confira foto, RG, PAR-Q e
            anamnese antes de aprovar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="w-fit">
          <RefreshCw className={loading ? 'w-4 h-4 mr-1 animate-spin' : 'w-4 h-4 mr-1'} />
          Atualizar
        </Button>
      </div>

      {loading && requests.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando inscrições...
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0F1B3D]">Pendentes ({pending.length})</h3>
            {pending.length === 0 ? (
              <Card className="rounded-xl border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Nenhuma inscrição pendente de conferência.
              </Card>
            ) : (
              pending.map(renderRequest)
            )}
          </div>

          {reviewed.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-slate-500">Concluídas ({reviewed.length})</h3>
              {reviewed.map(renderRequest)}
            </div>
          )}
        </>
      )}

      {/* Diálogo de recusa com motivo */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar inscrição</DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa de <strong>{rejectTarget?.student_name}</strong>. O motivo
              fica registrado na inscrição.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex.: exame dermatológico ausente; dados incompletos..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
              disabled={busyId === rejectTarget?.id}
              onClick={handleRejectConfirm}
            >
              {busyId === rejectTarget?.id ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-1" />
              )}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintableFichaDialog
        open={!!fichaData}
        onOpenChange={(open) => {
          if (!open) setFichaData(null)
        }}
        data={fichaData}
      />
    </div>
  )
}
