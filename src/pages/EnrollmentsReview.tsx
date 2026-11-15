// Tela de conferência das inscrições enviadas pelo formulário público /matricula.
// Mostra foto, RG do responsável, PAR-Q, anamnese e termo; permite APROVAR
// (cria/atualiza o aluno vinculado, copiando dados e foto) ou RECUSAR com motivo.

import { useCallback, useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { academyService } from '@/services/academy'
import type { ClassRecord, EnrollmentRequestRecord, StudentRecord } from '@/types/database'
import {
  PARQ_QUESTIONS,
  ANAMNESE_QUESTIONS,
  formatDateBR,
  PARQ_YES,
  PARQ_DETAIL_QUESTION,
  activityLabel,
  buildEnrollmentNotes,
  type ParqDetailKey,
} from '@/lib/matricula'
import { FICHA_LEGAL } from '@/lib/matricula'
import {
  requestToPrintable,
  PrintableFichaDialog,
  type PrintableFichaData,
} from '@/components/PrintableFicha'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  HeartPulse,
  IdCard,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  UserCheck,
  X,
} from 'lucide-react'

/** Dados dos DOIS exames coletados no diálogo de aprovação (Lei PB 9.863/2012). */
interface ApproveExamsForm {
  cardioDate: string
  cardioCrm: string
  cardioStatus: 'entregue' | 'pendente'
  dermatoDate: string
  dermatoStatus: 'entregue' | 'pendente'
}

const EMPTY_EXAMS_FORM: ApproveExamsForm = {
  cardioDate: '',
  cardioCrm: '',
  cardioStatus: 'entregue',
  dermatoDate: '',
  dermatoStatus: 'entregue',
}

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

/** Rótulo de turma na conferência: nome + dias + horário. */
function classRecordLabel(c: ClassRecord): string {
  const dayMap: Record<string, string> = {
    seg: 'Seg',
    ter: 'Ter',
    qua: 'Qua',
    qui: 'Qui',
    sex: 'Sex',
    sab: 'Sáb',
    dom: 'Dom',
  }
  const days = (c.schedule_days || []).map((x) => dayMap[String(x)] || String(x)).join(' · ')
  return [c.name, days, c.schedule_time].filter(Boolean).join(' — ')
}

export default function EnrollmentsReview() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<EnrollmentRequestRecord[]>([])
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<EnrollmentRequestRecord | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [fichaData, setFichaData] = useState<PrintableFichaData | null>(null)
  // Aprovação: diálogo que coleta os dados dos DOIS exames (cardiológico e
  // dermatológico) antes de confirmar — a inscrição só traz a declaração.
  const [approveTarget, setApproveTarget] = useState<EnrollmentRequestRecord | null>(null)
  const [examsForm, setExamsForm] = useState<ApproveExamsForm>(EMPTY_EXAMS_FORM)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [reqs, sts, cls] = await Promise.all([
        academyService.getEnrollmentRequests(),
        academyService.getStudents({ expand: '' }),
        pb.collection('classes').getFullList<ClassRecord>({ sort: 'name' }),
      ])
      setRequests(reqs)
      setStudents(sts)
      setClasses(cls)
    } catch (err) {
      console.error(err)
      // Mensagem amigável em pt-BR — nunca vazar o erro cru do backend na UI.
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

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

  /** Abre o diálogo de aprovação, coletando antes os dados dos DOIS exames. */
  const openApprove = (request: EnrollmentRequestRecord) => {
    setApproveTarget(request)
    setExamsForm({ ...EMPTY_EXAMS_FORM })
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
        // Detalhes escritos do PAR-Q (migration 0022) — copiados junto com as respostas.
        parq_5_detail: request.parq_5_detail || undefined,
        parq_6_detail: request.parq_6_detail || undefined,
        parq_7_detail: request.parq_7_detail || undefined,
        anamnese_medo_agua: request.anamnese_medo_agua || '',
        anamnese_convulsoes: request.anamnese_convulsoes || '',
        anamnese_alergia_cloro: request.anamnese_alergia_cloro || '',
        anamnese_medicamentos: request.anamnese_medicamentos || '',
        anamnese_objetivo: request.anamnese_objetivo || '',
        uso_imagem_autorizado: (request.uso_imagem_autorizado as 'sim' | 'nao') || undefined,
        // Endereço (migration 0016/0020) e atestado cardiológico (Lei PB 9.863/2012)
        cep: request.cep || undefined,
        street: request.street || undefined,
        street_number: request.street_number || undefined,
        complement: request.complement || undefined,
        neighborhood: request.neighborhood || undefined,
        city: request.city || undefined,
        uf: request.uf || undefined,
        // Exames (Lei PB 9.863/2012): lançados pelo administrador no diálogo de
        // aprovação — cardiológico (data + CRM + status) e dermatológico (data + status).
        cardio_date: examsForm.cardioDate || undefined,
        cardio_crm: examsForm.cardioCrm.trim() || undefined,
        cardio_status: examsForm.cardioStatus,
        dermato_date: examsForm.dermatoDate || undefined,
        dermato_status: examsForm.dermatoStatus,
        // Dia de vencimento escolhido no /matricula (migration 0023) — vai para o cadastro.
        due_day: request.due_day ? Number(request.due_day) : undefined,
        // Referência do admin: atividades/turmas pretendidas viram texto na ficha do aluno.
        observacoes_matricula: buildEnrollmentNotes(
          (request.activities || []).map(activityLabel),
          (request.preferred_classes || [])
            .map((id) => classes.find((c) => c.id === id))
            .filter((c): c is ClassRecord => !!c)
            .map(classRecordLabel),
          request.due_day,
        ),
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
      setApproveTarget(null)
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
    const preferredClasses = (r.preferred_classes || [])
      .map((id) => classes.find((c) => c.id === id))
      .filter((c): c is ClassRecord => !!c)
    const activities = (r.activities || []).map(activityLabel)

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

          <SectionCard title="Endereço" icon={MapPin}>
            <InfoRow label="CEP" value={r.cep} />
            <InfoRow
              label="Logradouro"
              value={[r.street, r.street_number].filter((v) => v && v.trim()).join(', ') || null}
            />
            <InfoRow label="Complemento" value={r.complement} />
            <InfoRow label="Bairro" value={r.neighborhood} />
            <InfoRow
              label="Cidade / UF"
              value={[r.city, r.uf].filter((v) => v && v.trim()).join(' - ') || null}
            />
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

          <SectionCard title="Preferências da matrícula" icon={UserCheck}>
            <div className="flex justify-between items-start gap-3 py-0.5">
              <span className="text-[11px] text-slate-700">Atividade(s) pretendida(s)</span>
              <span className="text-xs font-semibold text-[#0F1B3D] text-right">
                {activities.length > 0 ? activities.join(', ') : '—'}
              </span>
            </div>
            <div className="py-0.5">
              <span className="text-[11px] text-slate-500">Turma(s) pretendida(s)</span>
              {preferredClasses.length === 0 ? (
                <p className="text-xs font-semibold text-slate-400">—</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {preferredClasses.map((c) => (
                    <li key={c.id} className="text-xs font-semibold text-[#0F1B3D]">
                      {classRecordLabel(c)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <InfoRow
              label="Dia de vencimento escolhido"
              value={r.due_day ? `Dia ${r.due_day}` : null}
            />
          </SectionCard>

          <SectionCard title="PAR-Q (7 perguntas)" icon={ClipboardCheck}>
            {PARQ_QUESTIONS.map((q, i) => {
              const detailKey = (
                Object.entries(PARQ_DETAIL_QUESTION) as Array<[ParqDetailKey, typeof q.key]>
              ).find(([, qk]) => qk === q.key)?.[0]
              return (
                <div key={q.key} className="py-0.5 space-y-1">
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-[11px] text-slate-700">
                      {i + 1}. {q.text}
                    </span>
                    <YesNo v={r[q.key]} />
                  </div>
                  {detailKey && r[q.key] === PARQ_YES && (
                    <div className="pl-4 border-l-2 border-amber-200">
                      <p className="text-[10px] font-semibold text-slate-500">Resposta escrita:</p>
                      <p className="text-[11px] text-[#0F1B3D] whitespace-pre-line break-words">
                        {r[detailKey] && r[detailKey].trim() ? r[detailKey] : '(não informado)'}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </SectionCard>

          <SectionCard title="Anamnese aquática" icon={ClipboardCheck}>
            {ANAMNESE_QUESTIONS.map((q) => (
              <div key={q.key} className="flex justify-between items-start gap-3 py-0.5">
                <span className="text-[11px] text-slate-700">{q.text}</span>
                <YesNo v={r[q.key]} />
              </div>
            ))}
            <InfoRow label="Medicamentos em uso" value={r.anamnese_medicamentos} />
            <InfoRow label="Objetivo com a atividade escolhida" value={r.anamnese_objetivo} />
          </SectionCard>

          <SectionCard title="Exames — Lei Estadual nº 9.863/2012-PB" icon={HeartPulse}>
            {/* Declarações de entrega: DUAS caixas separadas (com fallback p/ inscrições antigas) */}
            <div className="flex justify-between items-start gap-3 py-0.5">
              <span className="text-[11px] text-slate-700">
                Declarou a entrega do atestado cardiológico
              </span>
              <YesNo v={r.exams_cardio_delivered ?? r.exams_delivered} />
            </div>
            <div className="flex justify-between items-start gap-3 py-0.5">
              <span className="text-[11px] text-slate-700">
                Declarou a entrega do exame dermatológico
              </span>
              <YesNo v={r.exams_dermato_delivered ?? r.exams_delivered} />
            </div>
            <InfoRow
              label="Atestado Cardiológico — lançado"
              value={
                r.cardio_date
                  ? `${formatDateBR(r.cardio_date)} · ${r.cardio_status === 'entregue' ? 'Entregue' : 'Pendente'}`
                  : null
              }
            />
            <InfoRow label="Atestado Cardiológico — CRM" value={r.cardio_crm} />
            <InfoRow
              label="Exame Dermatológico — lançado"
              value={
                r.dermato_date
                  ? `${formatDateBR(r.dermato_date)} · ${r.dermato_status === 'entregue' ? 'Entregue' : 'Pendente'}`
                  : null
              }
            />
            <InfoRow
              label="Termo de ciência — leu e concordou"
              value={r.term_agreed === 'sim' ? 'Sim' : r.term_agreed === 'nao' ? 'Não' : null}
            />
            <p className="text-[10px] text-slate-500 pt-1">
              Validade de 6 meses da emissão — dados técnicos lançados pelo administrador na
              aprovação.
            </p>
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
                onClick={() => openApprove(r)}
              >
                <Check className="w-4 h-4 mr-1" />
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

      {loadError ? (
        <Card className="rounded-xl border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700">
            Não foi possível carregar as inscrições.
          </p>
          <p className="mt-1 text-xs text-red-600">Verifique a conexão e tente novamente.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="mt-4 border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className={loading ? 'w-4 h-4 mr-1 animate-spin' : 'w-4 h-4 mr-1'} />
            Tentar novamente
          </Button>
        </Card>
      ) : loading && requests.length === 0 ? (
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

      {/* Diálogo de aprovação: coleta os dados dos DOIS exames (Lei PB 9.863/2012) */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovar inscrição — lançar exames</DialogTitle>
            <DialogDescription>
              A inscrição de <strong>{approveTarget?.student_name}</strong> declarou a entrega dos
              exames. Lance agora os dados técnicos dos DOIS exames obrigatórios — eles vão para a
              ficha do aluno (Lei Estadual nº 9.863/2012-PB, validade de 6 meses).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D]">
                Atestado cardiológico
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="appr-cardio-date" className="text-xs">
                    Data de emissão
                  </Label>
                  <Input
                    id="appr-cardio-date"
                    type="date"
                    value={examsForm.cardioDate}
                    onChange={(e) => setExamsForm((f) => ({ ...f, cardioDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="appr-cardio-crm" className="text-xs">
                    CRM
                  </Label>
                  <Input
                    id="appr-cardio-crm"
                    placeholder="Ex.: 12345-PB"
                    value={examsForm.cardioCrm}
                    onChange={(e) => setExamsForm((f) => ({ ...f, cardioCrm: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <div className="flex gap-4">
                  {(['entregue', 'pendente'] as const).map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-xs font-medium">
                      <input
                        type="radio"
                        name="appr-cardio-status"
                        checked={examsForm.cardioStatus === s}
                        onChange={() => setExamsForm((f) => ({ ...f, cardioStatus: s }))}
                      />
                      {s === 'entregue' ? 'Entregue' : 'Pendente'}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#0F1B3D]">
                Exame dermatológico
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="appr-dermato-date" className="text-xs">
                    Data de emissão
                  </Label>
                  <Input
                    id="appr-dermato-date"
                    type="date"
                    value={examsForm.dermatoDate}
                    onChange={(e) => setExamsForm((f) => ({ ...f, dermatoDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <div className="flex gap-4">
                    {(['entregue', 'pendente'] as const).map((s) => (
                      <label key={s} className="flex items-center gap-1.5 text-xs font-medium">
                        <input
                          type="radio"
                          name="appr-dermato-status"
                          checked={examsForm.dermatoStatus === s}
                          onChange={() => setExamsForm((f) => ({ ...f, dermatoStatus: s }))}
                        />
                        {s === 'entregue' ? 'Entregue' : 'Pendente'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApproveTarget(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={busyId === approveTarget?.id}
              onClick={() => approveTarget && handleApprove(approveTarget)}
            >
              {busyId === approveTarget?.id ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Confirmar aprovação
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
