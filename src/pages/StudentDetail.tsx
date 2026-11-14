import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Calendar,
  CreditCard,
  Plus,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  X,
  Camera,
  Sparkles,
  Edit,
  Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { academyService } from '@/services/academy'
import type {
  StudentRecord,
  PlanRecord,
  PaymentRecord,
  ChargeRecord,
  EnrollmentRecord,
  ClassRecord,
} from '@/types/database'
import { useToast } from '@/hooks/use-toast'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'
import { formatPhoneDisplay } from '@/lib/formatters'
import { getStudentStatusDisplay } from '@/lib/studentStatus'

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [student, setStudent] = useState<StudentRecord | null>(null)
  const [plan, setPlan] = useState<PlanRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [charges, setCharges] = useState<ChargeRecord[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Cancel charge modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedChargeToCancel, setSelectedChargeToCancel] = useState<ChargeRecord | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null)
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number>(0)
  const [deleteWithHistory, setDeleteWithHistory] = useState(false)
  const [confirmationNameInput, setConfirmationNameInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const [sData, pList, payList, chgList, enrList, clsList] = await Promise.all([
        academyService.getStudent(id),
        academyService.getPlans(),
        academyService.getPayments(),
        academyService.getCharges(),
        academyService.getEnrollments(),
        academyService.getClasses(),
      ])
      setStudent(sData)
      setPlan(pList.find((p) => p.id === sData.plan_id) || null)
      setPayments(payList.filter((pay) => pay.student_id === id))
      setCharges(chgList.filter((c) => c.student_id === id))
      setEnrollments(enrList.filter((e) => e.student_id === id))
      setClasses(clsList)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Aluno não encontrado ou falha de conexão.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleOpenCancelModal = (charge: ChargeRecord) => {
    setSelectedChargeToCancel(charge)
    setCancelModalOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!selectedChargeToCancel) return
    setCancelling(true)
    try {
      const res = await academyService.cancelCharge(selectedChargeToCancel.id)
      toast({
        title: 'Cobrança cancelada!',
        description: res.message || 'O link de pagamento foi desativado e o status atualizado.',
      })
      setCancelModalOpen(false)
      setSelectedChargeToCancel(null)
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar cobrança'
      toast({
        title: 'Erro ao cancelar cobrança',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setCancelling(false)
    }
  }

  const handleRequestDelete = () => {
    if (!student) return
    setDeleteWithHistory(false)
    setConfirmationNameInput('')

    const pending = payments.filter((p) => p.status === 'pendente' || p.status === 'vencido')
    setPendingPaymentsCount(pending.length)

    if (pending.length > 0) {
      setDeleteBlockedReason(
        `Não é possível remover este aluno diretamente: existem ${pending.length} mensalidade(s)/pagamento(s) pendente(s) ou vencido(s). Regularize essas pendências ou marque a opção de excluir com histórico financeiro abaixo.`,
      )
    } else {
      setDeleteBlockedReason(null)
    }
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!student || isDeleting) return
    if (deleteBlockedReason && !deleteWithHistory) return

    setIsDeleting(true)
    try {
      if (deleteWithHistory) {
        const res = await academyService.deleteStudentWithHistory(student.id, confirmationNameInput)
        toast({
          title: 'Aluno e histórico excluídos!',
          description: res.message || `O aluno ${student.name} e suas cobranças foram apagados.`,
        })
      } else {
        await academyService.deleteStudent(student.id)
        toast({
          title: 'Aluno removido com sucesso',
          description: `O registro de ${student.name} foi excluído permanentemente.`,
        })
      }
      setDeleteModalOpen(false)
      navigate('/alunos')
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Falha ao remover aluno'
      toast({
        title: 'Erro ao remover aluno',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRemoveClassEnrollment = async (enrollmentId: string) => {
    try {
      await academyService.deleteEnrollment(enrollmentId)
      toast({ title: 'Aluno desvinculado da turma com sucesso' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Falha ao desvincular da turma', variant: 'destructive' })
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!student) return
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo de imagem (.jpg, .jpeg, .png, .webp).',
        variant: 'destructive',
      })
      return
    }

    setUploadingPhoto(true)
    try {
      const updated = await academyService.uploadStudentPhoto(student.id, file, file.name)
      setStudent(updated)
      toast({
        title: 'Foto atualizada!',
        description: 'A nova foto do aluno foi salva com sucesso no armazenamento.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro no envio da foto',
        description: err?.message || 'Não foi possível atualizar a foto.',
        variant: 'destructive',
      })
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }
    }
  }

  // Summary Metrics
  const paidPayments = useMemo(() => payments.filter((p) => p.status === 'pago'), [payments])
  const overduePayments = useMemo(() => payments.filter((p) => p.status === 'vencido'), [payments])
  const totalPaid = useMemo(
    () => paidPayments.reduce((acc, p) => acc + p.amount, 0),
    [paidPayments],
  )
  const totalOverdue = useMemo(
    () => overduePayments.reduce((acc, p) => acc + p.amount, 0),
    [overduePayments],
  )

  const getStatusBadge = (status: PaymentRecord['status'] | string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Pago</Badge>
      case 'pendente':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>
      case 'vencido':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold">Vencido</Badge>
      case 'cancelado':
      case 'cancelada':
        return (
          <Badge className="bg-rose-50/80 text-rose-700 border-rose-200 font-semibold">
            Cancelado
          </Badge>
        )
      case 'reembolsado':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-300">Reembolsado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#0F1B3D] animate-spin" />
        <span className="text-sm text-[#6C757D]">Carregando prontuário do aluno...</span>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-lg font-bold text-[#0F1B3D]">Aluno não localizado</p>
        <Button onClick={() => navigate('/alunos')} variant="outline">
          Voltar para Alunos
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Back Navigation — mobile: tudo empilhado em coluna e largura total; sm+: linha única, como antes */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/alunos')}
          className="text-xs font-semibold text-[#6C757D] hover:text-[#0F1B3D] w-full justify-center sm:w-auto sm:justify-start"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar para Alunos
        </Button>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/alunos?editar=${student.id}&origem=detalhe`)}
            className="border-[#0F1B3D] text-[#0F1B3D] hover:bg-slate-100 font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-xs w-full sm:w-auto"
          >
            <Edit className="w-4 h-4 text-[#0F1B3D]" /> Editar Aluno
          </Button>

          <Button
            onClick={() =>
              navigate(`/cobrancas?novo=1&aluno=${student.id}&valor=${plan?.monthly_price || 0}`)
            }
            className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto"
          >
            <CreditCard className="w-4 h-4" /> Emitir Cobrança Infinitepay
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestDelete}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-xs w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4 text-red-600" /> Excluir Aluno
          </Button>
        </div>
      </div>

      {/* Header Profile Card */}
      <Card className="bg-white border-[#E0E4EA] rounded-2xl shadow-xs overflow-hidden">
        {/* Nome do aluno SEMPRE visível sobre o banner azul (mobile e desktop) — o banner cresce se o nome quebrar */}
        <div className="min-h-[6rem] bg-gradient-to-r from-[#0F1B3D] via-[#1B2A5B] to-[#17A2B8] flex items-end px-4 pt-4 pb-3 sm:px-6">
          <h2 className="text-xl leading-tight sm:text-2xl font-bold text-white break-words hyphens-auto sm:ml-28">
            {student.name}
          </h2>
        </div>
        <CardContent className="relative px-4 pb-6 sm:px-6">
          {/* Foto à ESQUERDA em ambas as resoluções (espelhando o mobile); sm+: quadro de dados ao lado da foto; mobile: dados abaixo */}
          {/* sm+: SOMENTE a foto sobe (sm:-mt-12) sobre o banner — o quadro de dados fica abaixo do banner,
              para os badges de status nunca sobreporem o nome do aluno */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 pt-4 sm:pt-0">
            <div className="shrink-0 sm:-mt-12">
              {/* Foto do aluno — a própria foto é o botão de troca (mobile e desktop) */}
              <input
                type="file"
                ref={photoInputRef}
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePhotoUpload(e.target.files[0])
                  }
                }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="group relative block cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed"
                title="Trocar foto do aluno"
                aria-label="Trocar foto do aluno"
              >
                <Avatar className="w-24 h-24 border-4 border-white shadow-lg bg-slate-100 transition-all group-hover:ring-2 group-hover:ring-[#D4AF37]/70 group-focus-visible:ring-2 group-focus-visible:ring-[#D4AF37]">
                  {getStudentPhotoUrl(student) ? (
                    <AvatarImage
                      src={getStudentPhotoUrl(student) || ''}
                      alt={student.name}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-[#0F1B3D] text-[#D4AF37] text-2xl font-black">
                    {student.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Dica visual 1: ícone de câmera discreto no canto da foto */}
                <span className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#D4AF37] text-[#0F1B3D] shadow-md ring-2 ring-white">
                  {uploadingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </span>

                {/* Dica visual 2: véu escuro com ícone apenas no hover/focus (desktop) */}
                <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-bold">Trocar foto</span>
                </span>
              </button>
            </div>

            {/* Quadro de dados: badges de status + mensalidade + contatos
                (mobile: abaixo da foto, com separador; sm+: ao lado da foto, à direita) */}
            <div className="min-w-0 flex-1 space-y-3 pt-4 border-t border-slate-100 sm:border-t-0 sm:pt-6">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  // Semântica única de status: TR do Bubble = Inativo (nunca "Ativo" + "Trancada");
                  // fee_suspended (mensalidade congelada) = "Isento" (aluno frequente que não paga).
                  const st = getStudentStatusDisplay(student)
                  return <Badge className={st.badgeClass}>{st.label}</Badge>
                })()}
                {student.situation === 'atestado' && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                  >
                    Atestado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#6C757D] font-medium">
                {student.monthly_fee || student.discounted_fee ? (
                  <>
                    Mensalidade:{' '}
                    <strong className="text-[#0F1B3D] font-bold">
                      R$ {(student.monthly_fee ?? plan?.monthly_price ?? 110).toFixed(2)}
                    </strong>
                    {student.discounted_fee ? (
                      <>
                        {' '}
                        • Com Desconto:{' '}
                        <strong className="text-emerald-700 font-bold">
                          R$ {student.discounted_fee.toFixed(2)}
                        </strong>
                      </>
                    ) : null}
                    {student.due_day ? ` • Vencimento dia ${student.due_day}` : ''}
                  </>
                ) : (
                  <>
                    Plano Vigente:{' '}
                    <strong className="text-[#0F1B3D]">{plan?.name || 'Padrão'}</strong>
                    {plan?.monthly_price === 0 ? (
                      <span className="text-emerald-700 font-bold ml-1">
                        (Isento de mensalidade)
                      </span>
                    ) : (
                      ` (R$ ${(plan?.monthly_price ?? 110).toFixed(2)}/mês)`
                    )}
                    {student.due_day ? ` • Vencimento dia ${student.due_day}` : ''}
                  </>
                )}
              </p>
              <div className="flex flex-col gap-3 text-xs text-[#6C757D] sm:grid sm:grid-cols-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#17A2B8]" />
                  <span>{student.email || student.guardian_email || 'E-mail não cadastrado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#17A2B8]" />
                  <span className="break-all">
                    {formatPhoneDisplay(
                      student.whatsapp || student.phone || student.guardian_phone || '',
                    ) || 'Sem telefone'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#17A2B8]" />
                  <span>CPF: {student.cpf || student.guardian_cpf || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        {/* Mobile: grade de 2 colunas com todas as abas visíveis (padrão das Configurações, v0.0.35); md+: linha única com rolagem */}
        <TabsList className="bg-white border border-[#E0E4EA] p-1 rounded-xl mb-6 w-full max-w-full h-auto grid grid-cols-2 gap-1 md:h-10 md:inline-flex md:flex-nowrap md:gap-0 md:overflow-x-auto md:overflow-y-hidden md:whitespace-nowrap">
          <TabsTrigger
            value="geral"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-2 py-2 min-w-0 w-full leading-snug whitespace-normal md:w-auto md:px-4 md:py-1.5 md:shrink-0 md:leading-normal md:whitespace-nowrap"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="pagamentos"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-2 py-2 min-w-0 w-full leading-snug whitespace-normal md:w-auto md:px-4 md:py-1.5 md:shrink-0 md:leading-normal md:whitespace-nowrap"
          >
            Cobranças &amp; Pagamentos ({charges.length || payments.length})
          </TabsTrigger>
          <TabsTrigger
            value="turmas"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-2 py-2 min-w-0 w-full leading-snug whitespace-normal md:w-auto md:px-4 md:py-1.5 md:shrink-0 md:leading-normal md:whitespace-nowrap"
          >
            Turmas Matriculadas ({enrollments.length})
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: VISÃO GERAL */}
        {/* ============================================================ */}
        <TabsContent value="geral" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs p-4">
              <span className="text-xs text-[#6C757D] font-semibold uppercase">Total Pago</span>
              <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
                R$ {totalPaid.toFixed(2)}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">
                {paidPayments.length} mensalidades quitadas
              </span>
            </Card>

            <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs p-4">
              <span className="text-xs text-[#6C757D] font-semibold uppercase">Em Atraso</span>
              <p className="text-xl font-bold font-mono text-rose-600 mt-1">
                R$ {totalOverdue.toFixed(2)}
              </p>
              <span className="text-[11px] text-rose-500 font-medium">
                {overduePayments.length} títulos pendentes
              </span>
            </Card>

            <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs p-4">
              <span className="text-xs text-[#6C757D] font-semibold uppercase">
                Turmas Matriculadas
              </span>
              <p className="text-xl font-bold font-mono text-[#0F1B3D] mt-1">
                {enrollments.length}
              </p>
              <span className="text-[11px] text-[#6C757D]">Presença regular</span>
            </Card>
          </div>

          <Card className="bg-white border-[#E0E4EA] rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-[#0F1B3D] mb-4">
              Informações Complementares &amp; Responsável
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[#6C757D] block mb-1">Data de Nascimento</span>
                <p className="font-semibold text-[#1E2A3A]">
                  {student.birth_date
                    ? new Date(student.birth_date).toLocaleDateString('pt-BR')
                    : 'Não informada'}
                </p>
              </div>
              <div>
                <span className="text-[#6C757D] block mb-1">Endereço Residencial</span>
                <p className="font-semibold text-[#1E2A3A]">
                  {student.address || 'Não cadastrado'}
                </p>
              </div>
              {student.guardian_name && (
                <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[#6C757D] block mb-0.5 text-[11px] font-semibold">
                    Responsável Legal (Agrupamento Família)
                  </span>
                  <p className="font-bold text-[#0F1B3D] text-xs">{student.guardian_name}</p>
                  <div className="text-[10px] text-slate-600 mt-0.5 space-y-0.5">
                    {student.guardian_cpf && <div>CPF: {student.guardian_cpf}</div>}
                    {student.guardian_phone && <div>Tel: {student.guardian_phone}</div>}
                    {student.guardian_email && <div>E-mail: {student.guardian_email}</div>}
                  </div>
                </div>
              )}
              {student.whatsapp && (
                <div>
                  <span className="text-[#6C757D] block mb-1">WhatsApp</span>
                  <p className="font-semibold text-[#1E2A3A]">{student.whatsapp}</p>
                </div>
              )}
              {student.atestado_validade && (
                <div>
                  <span className="text-[#6C757D] block mb-1">Validade do Atestado</span>
                  <p className="font-semibold text-[#1E2A3A]">
                    {new Date(student.atestado_validade).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {student.trancamento_validade && (
                <div>
                  <span className="text-[#6C757D] block mb-1">Validade do Trancamento</span>
                  <p className="font-semibold text-[#1E2A3A]">
                    {new Date(student.trancamento_validade).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {student.validade_do_ultimo_pagamento && (
                <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-emerald-800 block mb-0.5 text-[11px] font-semibold">
                    Validade do Último Pagamento
                  </span>
                  <p className="font-bold text-emerald-950 text-xs">
                    {new Date(student.validade_do_ultimo_pagamento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {student.bubble_id && (
                <div>
                  <span className="text-[#6C757D] block mb-1">Bubble ID</span>
                  <p className="font-mono text-[11px] text-slate-500 truncate">
                    {student.bubble_id}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: COBRANÇAS & PAGAMENTOS */}
        {/* ============================================================ */}
        <TabsContent value="pagamentos" className="space-y-4">
          <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F5F7FA] text-[#6C757D] uppercase font-semibold text-[10px] border-b border-[#E0E4EA]">
                  <tr>
                    <th className="px-5 py-3">Vencimento</th>
                    <th className="px-4 py-3">Descrição / Ref</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pagamento / Link</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E4EA]">
                  {charges.length === 0 && payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#6C757D]">
                        Nenhuma cobrança registrada para este aluno.
                      </td>
                    </tr>
                  ) : charges.length > 0 ? (
                    charges.map((c) => {
                      const linkedPmt = payments.find((p) => p.charge_id === c.id)
                      const isEmAberto = c.status === 'em_aberto'
                      const isPaga = c.status === 'paga'
                      const isCancelada = c.status === 'cancelada'
                      const payLink = c.payment_link || linkedPmt?.payment_link

                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-3.5 font-medium text-[#1E2A3A]">
                            {new Date(c.due_date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-[#0F1B3D]">{c.description}</div>
                            {c.order_nsu && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                NSU: {c.order_nsu}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-[#0F1B3D]">
                            <div>
                              <span>R$ {c.amount.toFixed(2)}</span>
                              {linkedPmt?.discount_amount && linkedPmt.discount_amount > 0 ? (
                                <Badge className="ml-2 bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[9px] inline-flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-700" />
                                  -R$ {linkedPmt.discount_amount.toFixed(2)}
                                </Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {isPaga ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                Paga
                              </Badge>
                            ) : isCancelada ? (
                              <Badge className="bg-rose-50/80 text-rose-700 border-rose-200 font-semibold">
                                Cancelada
                              </Badge>
                            ) : isEmAberto ? (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                                Em Aberto
                              </Badge>
                            ) : (
                              getStatusBadge(c.status)
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-[#6C757D]">
                            {isPaga && linkedPmt?.paid_date ? (
                              <span className="text-emerald-700 font-medium">
                                Pago em {new Date(linkedPmt.paid_date).toLocaleDateString('pt-BR')}
                              </span>
                            ) : payLink && !isCancelada ? (
                              <a
                                href={payLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-[#17A2B8] hover:underline inline-flex items-center gap-1"
                              >
                                Abrir Link InfinitePay
                              </a>
                            ) : isCancelada ? (
                              <span className="text-rose-600/70 text-[11px] italic">
                                Link cancelado
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {isEmAberto ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCancelModal(c)}
                                className="h-7 text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1.5"
                              >
                                <Ban className="w-3 h-3 text-rose-600" /> Cancelar
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5 font-medium text-[#1E2A3A]">
                          {new Date(p.due_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-600">Mensalidade</td>
                        <td className="px-4 py-3.5 font-mono font-bold text-[#0F1B3D]">
                          R$ {p.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5">{getStatusBadge(p.status)}</td>
                        <td className="px-4 py-3.5 text-[#6C757D]">
                          {p.paid_date ? new Date(p.paid_date).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-400">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: TURMAS */}
        {/* ============================================================ */}
        <TabsContent value="turmas" className="space-y-4">
          <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs p-6">
            <h3 className="text-sm font-bold text-[#0F1B3D] mb-4">
              Turmas em que está Matriculado
            </h3>
            {enrollments.length === 0 ? (
              <div className="text-center py-8 text-[#6C757D]">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>O aluno não está vinculado a nenhuma turma no momento.</p>
                <Button
                  onClick={() => navigate('/turmas')}
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                >
                  Ir para Turmas
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {enrollments.map((enr) => {
                  const cls = classes.find((c) => c.id === enr.class_id)
                  if (!cls) return null

                  return (
                    <div
                      key={enr.id}
                      className="p-4 rounded-xl border border-[#E0E4EA] bg-[#F5F7FA] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg text-white font-bold text-xs ${
                            cls.type === 'natacao' ? 'bg-[#0F1B3D]' : 'bg-[#17A2B8]'
                          }`}
                        >
                          {cls.type === 'natacao' ? 'NAT' : 'HID'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#0F1B3D]">{cls.name}</p>
                          <p className="text-xs text-[#6C757D]">
                            Horário: {cls.schedule_time} • Dias:{' '}
                            {(cls.schedule_days || []).join(', ')}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveClassEnrollment(enr.id)}
                        className="text-red-600 hover:bg-red-50 text-xs font-semibold h-8"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Desvincular
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      {/* ============================================================== */}
      {/* Cancel Charge Modal                                            */}
      {/* ============================================================== */}
      <Dialog
        open={cancelModalOpen}
        onOpenChange={(open) => {
          setCancelModalOpen(open)
          if (!open) setSelectedChargeToCancel(null)
        }}
      >
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Cancelar Cobrança
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6C757D] pt-1">
              Confirme o cancelamento desta cobrança em aberto do aluno.
            </DialogDescription>
          </DialogHeader>

          {selectedChargeToCancel && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F1B3D] text-sm">
                    {selectedChargeToCancel.description}
                  </span>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    EM ABERTO
                  </Badge>
                </div>
                <p className="text-slate-600">
                  Aluno: <strong>{student.name}</strong>
                </p>
                <p className="text-slate-600">
                  Vencimento:{' '}
                  <strong>
                    {new Date(selectedChargeToCancel.due_date).toLocaleDateString('pt-BR')}
                  </strong>
                </p>
                <p className="text-slate-700 font-mono font-bold text-sm">
                  Valor: R$ {selectedChargeToCancel.amount.toFixed(2)}
                </p>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-rose-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                  Aviso importante:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800 leading-relaxed">
                  <li>
                    O link de pagamento da InfinitePay será <strong>desativado</strong> para que o
                    aluno não consiga mais efetuar o pagamento.
                  </li>
                  <li>O status da cobrança e do pagamento vinculado mudará para "Cancelada".</li>
                  <li>
                    <strong>Esta ação não pode ser desfeita.</strong>
                  </li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={() => {
                setCancelModalOpen(false)
                setSelectedChargeToCancel(null)
              }}
            >
              Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={cancelling}
              onClick={handleConfirmCancel}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  Sim, Cancelar Cobrança
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Safeguard Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open)
          if (!open) {
            setDeleteWithHistory(false)
            setConfirmationNameInput('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Remover Aluno
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6C757D] space-y-3 pt-1">
              {deleteBlockedReason && !deleteWithHistory ? (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 font-medium text-xs">
                  {deleteBlockedReason}
                </div>
              ) : (
                <p>
                  Tem certeza que deseja remover o aluno{' '}
                  <strong className="text-[#1E2A3A]">{student.name}</strong>?
                </p>
              )}

              {/* Opção para exclusão de histórico quando houver pendências */}
              {pendingPaymentsCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 space-y-2.5 text-left">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="detail-delete-with-history"
                      checked={deleteWithHistory}
                      onChange={(e) => setDeleteWithHistory(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-amber-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <label
                      htmlFor="detail-delete-with-history"
                      className="text-xs text-amber-950 font-medium cursor-pointer leading-snug"
                    >
                      <strong className="block text-red-700 font-bold">
                        Excluir também o histórico financeiro deste aluno
                      </strong>
                      Remove permanentemente todas as cobranças, pagamentos e matrículas vinculados
                      em uma única ação no servidor.
                    </label>
                  </div>
                  <p className="text-[11px] text-amber-800 font-semibold pl-6">
                    ⚠ Esta ação é permanente e não pode ser desfeita.
                  </p>
                </div>
              )}

              {/* Confirmação reforçada: digitar o nome do aluno */}
              {deleteWithHistory && (
                <div className="space-y-2 pt-1 text-left">
                  <Label className="text-xs font-bold text-[#0F1B3D]">
                    Para confirmar a exclusão com histórico, digite o nome completo do aluno:{' '}
                    <span className="font-mono text-red-600">{student.name}</span>
                  </Label>
                  <Input
                    placeholder="Digite o nome do aluno exatamente como exibido"
                    value={confirmationNameInput}
                    onChange={(e) => setConfirmationNameInput(e.target.value)}
                    className="text-xs border-red-200 focus-visible:ring-red-500 bg-white"
                  />
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                setDeleteModalOpen(false)
                setDeleteWithHistory(false)
                setConfirmationNameInput('')
              }}
            >
              Cancelar
            </Button>

            {deleteWithHistory ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  isDeleting ||
                  confirmationNameInput.trim().toLowerCase().replace(/\s+/g, ' ') !==
                    student.name.trim().toLowerCase().replace(/\s+/g, ' ')
                }
                onClick={handleConfirmDelete}
                className="font-bold flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Excluindo com histórico...
                  </>
                ) : (
                  'Excluir definitivamente'
                )}
              </Button>
            ) : !deleteBlockedReason ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="font-bold flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Confirmar Exclusão'
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
