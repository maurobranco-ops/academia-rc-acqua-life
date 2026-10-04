import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  List,
  Sparkles,
  Layers,
  GraduationCap,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { academyService } from '@/services/academy'
import { useRealtime } from '@/hooks/use-realtime'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'
import { groupStudentsByGuardian } from '@/lib/familyRules'
import type {
  StudentRecord,
  PlanRecord,
  PaymentRecord,
  EnrollmentRecord,
  ClassRecord,
} from '@/types/database'
import { useToast } from '@/hooks/use-toast'

export default function Students() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const [students, setStudents] = useState<StudentRecord[]>([])
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters and Pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'lista' | 'familia' | 'turma'>('lista')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('ativo')
  const pageSize = 10

  // Modal states
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Form states
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formCpf, setFormCpf] = useState('')
  const [formBirthDate, setFormBirthDate] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formPlanId, setFormPlanId] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formGuardianName, setFormGuardianName] = useState('')
  const [formGuardianCpf, setFormGuardianCpf] = useState('')
  const [formGuardianPhone, setFormGuardianPhone] = useState('')
  const [formGuardianEmail, setFormGuardianEmail] = useState('')
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    try {
      const [sData, pData, payData, eData, cData] = await Promise.all([
        academyService.getStudents(),
        academyService.getPlans(),
        academyService.getPayments(),
        academyService.getEnrollments(),
        academyService.getClasses(),
      ])
      setStudents(sData)
      setPlans(pData)
      setPayments(payData)
      setEnrollments(eData)
      setClasses(cData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<StudentRecord>('students', () => loadData())
  useRealtime<PaymentRecord>('payments', () => loadData())

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      handleOpenCreateModal()
    }
  }, [searchParams, plans])

  const handleOpenCreateModal = () => {
    setSelectedStudent(null)
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormCpf('')
    setFormBirthDate('')
    setFormAddress('')
    setFormPlanId(plans[0]?.id || '')
    setFormClassId('')
    setFormGuardianName('')
    setFormGuardianCpf('')
    setFormGuardianPhone('')
    setFormGuardianEmail('')
    setFormStatus('ativo')
    setStudentModalOpen(true)
  }

  const handleOpenEditModal = (st: StudentRecord) => {
    setSelectedStudent(st)
    setFormName(st.name)
    setFormEmail(st.email || '')
    setFormPhone(st.phone || '')
    setFormCpf(st.cpf || '')
    setFormBirthDate(st.birth_date ? st.birth_date.substring(0, 10) : '')
    setFormAddress(st.address || '')
    setFormPlanId(st.plan_id || '')
    const enrolledClass = enrollments.find((e) => e.student_id === st.id)
    setFormClassId(enrolledClass ? enrolledClass.class_id : '')
    setFormGuardianName(st.guardian_name || '')
    setFormGuardianCpf(st.guardian_cpf || '')
    setFormGuardianPhone(st.guardian_phone || '')
    setFormGuardianEmail(st.guardian_email || '')
    setFormStatus(st.status || 'ativo')
    setStudentModalOpen(true)
  }

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formPlanId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome do aluno e selecione um plano.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload: Partial<StudentRecord> = {
        name: formName,
        email: formEmail,
        phone: formPhone,
        cpf: formCpf,
        birth_date: formBirthDate ? `${formBirthDate} 00:00:00.000Z` : undefined,
        address: formAddress,
        plan_id: formPlanId,
        guardian_name: formGuardianName.trim() || undefined,
        guardian_cpf: formGuardianCpf.trim() || undefined,
        guardian_phone: formGuardianPhone.trim() || undefined,
        guardian_email: formGuardianEmail.trim() || undefined,
        status: formStatus,
      }

      let studentId = selectedStudent?.id
      if (selectedStudent) {
        await academyService.updateStudent(selectedStudent.id, payload)
        toast({ title: 'Aluno atualizado com sucesso!' })
      } else {
        const created = await academyService.createStudent(payload)
        studentId = created.id
        toast({ title: 'Aluno cadastrado com sucesso!' })
      }

      // If a class was picked during modal, associate enrollment
      if (studentId && formClassId) {
        const existing = enrollments.find((e) => e.student_id === studentId)
        if (!existing || existing.class_id !== formClassId) {
          if (existing) {
            await academyService.deleteEnrollment(existing.id)
          }
          await academyService.createEnrollment(studentId, formClassId)
        }
      }

      setStudentModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar aluno'
      toast({
        title: 'Erro ao salvar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestDelete = (st: StudentRecord) => {
    setSelectedStudent(st)
    // Check if student has outstanding / overdue payments or open/overdue charges
    const studentPayments = payments.filter((p) => p.student_id === st.id)
    const pendingPayments = studentPayments.filter(
      (p) => p.status === 'pendente' || p.status === 'vencido',
    )

    if (pendingPayments.length > 0) {
      setDeleteBlockedReason(
        `Não é possível remover este aluno: existem ${pendingPayments.length} mensalidade(s)/pagamento(s) pendente(s) ou vencido(s). Regularize ou cancele essas cobranças antes de excluir.`,
      )
    } else {
      setDeleteBlockedReason(null)
    }
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedStudent || deleteBlockedReason || isDeleting) return
    setIsDeleting(true)
    try {
      await academyService.deleteStudent(selectedStudent.id)
      toast({
        title: 'Aluno removido com sucesso',
        description: `O registro de ${selectedStudent.name} foi excluído permanentemente.`,
      })
      setDeleteConfirmOpen(false)
      setSelectedStudent(null)
      await loadData()
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

  // Filter students by status and by search term (name, email, CPF or guardian info)
  const filteredStudents = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()

    return students.filter((s) => {
      // Status filter
      if (statusFilter === 'ativo' && s.status !== 'ativo') return false
      if (statusFilter === 'inativo' && s.status === 'ativo') return false

      if (!q) return true

      const nameMatch = s.name.toLowerCase().includes(q)
      const emailMatch = s.email && s.email.toLowerCase().includes(q)
      const cpfMatch = s.cpf && s.cpf.includes(q)
      const guardianMatch = s.guardian_name && s.guardian_name.toLowerCase().includes(q)
      const guardianCpfMatch = s.guardian_cpf && s.guardian_cpf.includes(q)
      return nameMatch || emailMatch || cpfMatch || guardianMatch || guardianCpfMatch
    })
  }, [students, searchTerm, statusFilter])

  // Family groups based on filtered students
  const familyGroups = useMemo(() => {
    return groupStudentsByGuardian(filteredStudents, plans)
  }, [filteredStudents, plans])

  // Class groups based on filtered students and enrollments
  const classGroups = useMemo(() => {
    const studentMap = new Map<string, StudentRecord>()
    filteredStudents.forEach((s) => studentMap.set(s.id, s))

    // Map each class to its enrolled students (from the filtered pool)
    const grouped: {
      cls: ClassRecord
      students: StudentRecord[]
    }[] = classes.map((c) => {
      const classEnrollments = enrollments.filter(
        (e) => e.class_id === c.id && studentMap.has(e.student_id),
      )
      const classStudents = classEnrollments
        .map((e) => studentMap.get(e.student_id)!)
        // remove potential duplicates if a student has double enrollment in same class
        .filter((st, idx, arr) => arr.findIndex((x) => x.id === st.id) === idx)

      return {
        cls: c,
        students: classStudents,
      }
    })

    // Also collect students without any class enrollment
    const enrolledStudentIds = new Set(enrollments.map((e) => e.student_id))
    const unassignedStudents = filteredStudents.filter((s) => !enrolledStudentIds.has(s.id))

    return {
      classes: grouped,
      unassigned: unassignedStudents,
    }
  }, [filteredStudents, classes, enrollments])

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredStudents.slice(start, start + pageSize)
  }, [filteredStudents, currentPage])

  // Map student ID to their enrolled classes
  const studentEnrollmentsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    enrollments.forEach((e) => {
      if (!map[e.student_id]) map[e.student_id] = []
      const c = classes.find((cl) => cl.id === e.class_id)
      if (c) map[e.student_id].push(c.name)
    })
    return map
  }, [enrollments, classes])

  // Map student ID to their latest payment date
  const latestPaymentMap = useMemo(() => {
    const map: Record<string, string> = {}
    payments.forEach((p) => {
      if (p.status === 'pago' && p.paid_date) {
        if (!map[p.student_id] || new Date(p.paid_date) > new Date(map[p.student_id])) {
          map[p.student_id] = p.paid_date
        }
      }
    })
    return map
  }, [payments])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#0F1B3D] animate-spin" />
        <span className="text-sm text-[#6C757D]">Carregando alunos...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0F1B3D]">Quadro de Alunos</h2>
          <p className="text-xs text-[#6C757D]">
            Gestão cadastral, planos e acompanhamento de matrículas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle: Lista vs Por Família vs Por Turma */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'lista'
                  ? 'bg-white text-[#0F1B3D] shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('familia')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'familia'
                  ? 'bg-[#0F1B3D] text-white shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Por Família</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('turma')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'turma'
                  ? 'bg-[#0F1B3D] text-white shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Turma</span>
            </button>
          </div>

          {/* Status Filter Toggle: Ativos vs Inativos vs Todos */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ativo')
                setCurrentPage(1)
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'ativo'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
            >
              <span>Ativos</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-emerald-100/70 text-emerald-800">
                {students.filter((s) => s.status === 'ativo').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('inativo')
                setCurrentPage(1)
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'inativo'
                  ? 'bg-red-50 text-red-600 border border-red-200 shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
            >
              <span>Inativos</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-red-100/70 text-red-700">
                {students.filter((s) => s.status !== 'ativo').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('todos')
                setCurrentPage(1)
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'todos'
                  ? 'bg-white text-[#0F1B3D] shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {students.length}
              </span>
            </button>
          </div>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por aluno, responsável, CPF..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9 h-10 rounded-xl bg-white border-[#E0E4EA] text-xs focus-visible:ring-[#D4AF37]"
            />
          </div>

          <Button
            onClick={handleOpenCreateModal}
            className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold shadow-md text-xs h-10 px-4 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Aluno
          </Button>
        </div>
      </div>

      {viewMode === 'familia' && (
        /* ============================================================== */
        /* FAMILY VIEW (Agrupamento por Responsável)                      */
        /* ============================================================== */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 text-xs text-[#0F1B3D]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>
                <strong>Regra Plano Família:</strong> R$ 100,00 por aluno com{' '}
                <strong>desconto de R$ 10,00 por aluno</strong> quando a mensalidade é paga até o
                vencimento (líquido: R$ 90,00/aluno).
              </span>
            </div>
            <span className="font-semibold text-slate-600">
              {familyGroups.length}{' '}
              {familyGroups.length === 1 ? 'família/responsável' : 'famílias/responsáveis'}
            </span>
          </div>

          {familyGroups.length === 0 ? (
            <Card className="bg-white border-[#E0E4EA] rounded-xl p-10 text-center text-[#6C757D]">
              Nenhum grupo familiar encontrado para a busca.
            </Card>
          ) : (
            familyGroups.map((group, groupIdx) => {
              const isMulti = group.students.length > 1

              return (
                <Card
                  key={groupIdx}
                  className="bg-white border-[#E0E4EA] hover:border-slate-300 transition-all rounded-xl overflow-hidden shadow-xs"
                >
                  {/* Family Header */}
                  <div className="p-4 bg-[#F8FAFC] border-b border-[#E0E4EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0F1B3D] text-[#D4AF37] flex items-center justify-center font-bold text-sm shadow-xs">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[#0F1B3D] text-sm sm:text-base">
                            {group.guardianName}
                          </h3>
                          {isMulti && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                              Família ({group.students.length} alunos)
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6C757D]">
                          {group.guardianCpf ? `CPF: ${group.guardianCpf}` : ''}
                          {group.guardianCpf && group.guardianPhone ? ' • ' : ''}
                          {group.guardianPhone ? `Tel: ${group.guardianPhone}` : ''}
                          {(group.guardianCpf || group.guardianPhone) && group.guardianEmail
                            ? ' • '
                            : ''}
                          {group.guardianEmail ? group.guardianEmail : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white px-3.5 py-2 rounded-xl border border-[#E0E4EA] text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#6C757D] block">
                          Total Família (Cheio)
                        </span>
                        <span className="font-bold font-mono text-[#0F1B3D] text-sm">
                          R$ {group.totalMonthlyFee.toFixed(2)}
                        </span>
                      </div>
                      {group.hasFamilyDiscount && (
                        <div className="pl-3 border-l border-slate-200">
                          <span className="text-[10px] uppercase font-semibold text-emerald-700 block">
                            Até Vencimento (-R$ {(group.students.length * 10).toFixed(2)})
                          </span>
                          <span className="font-bold font-mono text-emerald-700 text-sm">
                            R$ {group.totalDiscountedFeeOnTime.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Family Students List */}
                  <div className="divide-y divide-[#E0E4EA]">
                    {group.students.map((st) => {
                      const plan = plans.find((p) => p.id === st.plan_id)
                      const studentClasses = studentEnrollmentsMap[st.id] || []
                      const lastPay = latestPaymentMap[st.id]
                      const photoUrl = getStudentPhotoUrl(st)
                      const isFam = (plan && plan.name.toLowerCase().includes('fam')) || isMulti

                      return (
                        <div
                          key={st.id}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-16 h-16 border-2 border-slate-200 bg-slate-100 shadow-xs">
                              {photoUrl ? (
                                <AvatarImage
                                  src={photoUrl}
                                  alt={st.name}
                                  className="object-cover"
                                />
                              ) : null}
                              <AvatarFallback className="bg-[#0F1B3D] text-white font-bold text-base">
                                {st.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p
                                onClick={() => navigate(`/alunos/${st.id}`)}
                                className="font-bold text-[#1E2A3A] hover:text-[#17A2B8] cursor-pointer transition text-sm"
                              >
                                {st.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <Badge className="bg-[#0F1B3D]/5 text-[#0F1B3D] border-[#0F1B3D]/20 text-[10px]">
                                  {plan?.name || (isFam ? 'Plano Família' : 'Plano Integral')}
                                </Badge>
                                <Badge
                                  className={
                                    st.status === 'ativo'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                      : 'bg-red-50 text-red-600 border-red-200 text-[10px]'
                                  }
                                >
                                  {st.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                </Badge>
                                {studentClasses.length > 0 && (
                                  <span className="text-[11px] text-[#6C757D]">
                                    Turma: <strong>{studentClasses.join(', ')}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                            <div className="text-left md:text-right text-xs">
                              <span className="text-[10px] text-[#6C757D] uppercase block">
                                Mensalidade
                              </span>
                              <span className="font-bold font-mono text-[#0F1B3D]">
                                R${' '}
                                {(
                                  st.monthly_fee ||
                                  plan?.monthly_price ||
                                  (isFam ? 100 : 110)
                                ).toFixed(2)}
                              </span>
                              {isFam && (
                                <span className="block text-[10px] text-emerald-600 font-semibold">
                                  R$ 90,00 em dia (-R$ 10)
                                </span>
                              )}
                            </div>

                            <div className="text-left md:text-right text-xs">
                              <span className="text-[10px] text-[#6C757D] uppercase block">
                                Último Pagto
                              </span>
                              <span className="text-[#6C757D]">
                                {lastPay ? new Date(lastPay).toLocaleDateString('pt-BR') : '—'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => navigate(`/alunos/${st.id}`)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F1B3D] hover:bg-slate-100 transition"
                                title="Visualizar detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/cobrancas?aluno=${st.id}`)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                title="Registrar pagamento / cobrança"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(st)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition"
                                title="Editar aluno"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRequestDelete(st)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Remover aluno"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}

      {viewMode === 'lista' && (
        /* ============================================================== */
        /* STANDARD LIST VIEW (com avatares 2x maiores)                   */
        /* ============================================================== */
        <Card className="bg-white border-[#E0E4EA] rounded-xl overflow-hidden shadow-xs">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F5F7FA] text-[#6C757D] uppercase font-semibold text-[10px] border-b border-[#E0E4EA]">
                  <tr>
                    <th className="px-5 py-3.5">Aluno</th>
                    <th className="px-4 py-3.5">Plano</th>
                    <th className="px-4 py-3.5">Turma(s)</th>
                    <th className="px-3 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Mensalidade</th>
                    <th className="px-4 py-3.5">Último Pagamento</th>
                    <th className="px-4 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E4EA]">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-[#6C757D]">
                        Nenhum aluno encontrado para os critérios de busca.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((st) => {
                      const plan = plans.find((p) => p.id === st.plan_id)
                      const studentClasses = studentEnrollmentsMap[st.id] || []
                      const lastPay = latestPaymentMap[st.id]

                      const photoUrl = getStudentPhotoUrl(st)

                      return (
                        <tr key={st.id} className="hover:bg-slate-50 transition group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3.5">
                              {/* Avatar com o DOBRO do tamanho atual (era w-8 h-8 = 32px, agora w-16 h-16 = 64px) */}
                              <Avatar className="w-16 h-16 rounded-xl border-2 border-slate-200 bg-slate-100 shrink-0 shadow-xs">
                                {photoUrl ? (
                                  <AvatarImage
                                    src={photoUrl}
                                    alt={st.name}
                                    className="object-cover rounded-xl"
                                  />
                                ) : null}
                                <AvatarFallback className="bg-[#0F1B3D] text-[#D4AF37] font-bold text-base rounded-xl">
                                  {st.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p
                                  onClick={() => navigate(`/alunos/${st.id}`)}
                                  className="font-bold text-[#1E2A3A] hover:text-[#17A2B8] cursor-pointer transition text-sm truncate"
                                >
                                  {st.name}
                                </p>
                                <p className="text-[11px] text-[#6C757D] truncate">
                                  {st.cpf || st.email || 'Sem contato cadastrado'}
                                </p>
                                {st.guardian_name && (
                                  <p className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                                    <Users className="w-3 h-3 text-[#17A2B8]" />
                                    <span>Resp: {st.guardian_name}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <Badge className="bg-[#0F1B3D]/5 text-[#0F1B3D] border-[#0F1B3D]/20 font-semibold">
                              {plan?.name || 'Plano Padrão'}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5">
                            {studentClasses.length > 0 ? (
                              <span className="text-[#1E2A3A] font-medium truncate max-w-[150px] block">
                                {studentClasses.join(', ')}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Sem turma</span>
                            )}
                          </td>

                          <td className="px-3 py-3.5">
                            <Badge
                              className={
                                st.status === 'ativo'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                                  : 'bg-red-50 text-red-600 border-red-200'
                              }
                            >
                              {st.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 font-mono font-bold text-[#0F1B3D]">
                            R$ {(plan?.monthly_price || 160).toFixed(2)}
                          </td>

                          <td className="px-4 py-3.5 text-[#6C757D]">
                            {lastPay ? new Date(lastPay).toLocaleDateString('pt-BR') : '—'}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => navigate(`/alunos/${st.id}`)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F1B3D] hover:bg-slate-100 transition"
                                title="Visualizar detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/cobrancas?aluno=${st.id}`)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                title="Registrar pagamento / cobrança"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(st)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition"
                                title="Editar aluno"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRequestDelete(st)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Remover aluno"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E0E4EA] text-xs text-[#6C757D]">
              <span>
                Mostrando {filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} a{' '}
                {Math.min(currentPage * pageSize, filteredStudents.length)} de{' '}
                {filteredStudents.length} alunos
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 font-bold text-[#0F1B3D]">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'turma' && (
        /* ============================================================== */
        /* CLASS VIEW (Agrupamento por Turma)                             */
        /* ============================================================== */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 text-xs text-[#0F1B3D]">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#17A2B8]" />
              <span>
                <strong>Quadro de Alunos por Turma:</strong> agrupamento dos alunos com base em suas
                matrículas ativas.
              </span>
            </div>
            <span className="font-semibold text-slate-600">
              {classes.length} {classes.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}
            </span>
          </div>

          {classGroups.classes.map(({ cls, students: classStudents }) => {
            return (
              <Card
                key={cls.id}
                className="bg-white border-[#E0E4EA] hover:border-slate-300 transition-all rounded-xl overflow-hidden shadow-xs"
              >
                {/* Class Header */}
                <div className="p-4 bg-[#F8FAFC] border-b border-[#E0E4EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
                        cls.type === 'natacao'
                          ? 'bg-[#0F1B3D] text-[#D4AF37]'
                          : 'bg-[#17A2B8] text-white'
                      }`}
                    >
                      {cls.type === 'natacao' ? 'NAT' : 'HID'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#0F1B3D] text-sm sm:text-base">
                          {cls.name}
                        </h3>
                        <Badge
                          className={`text-[10px] font-bold ${
                            classStudents.length > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {classStudents.length}{' '}
                          {classStudents.length === 1 ? 'aluno matriculado' : 'alunos matriculados'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#6C757D] flex flex-wrap items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#17A2B8]" />
                          {cls.schedule_time || 'Horário a definir'}
                        </span>
                        {cls.schedule_days && cls.schedule_days.length > 0 && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-[#17A2B8]" />
                            {cls.schedule_days.join(', ')}
                          </span>
                        )}
                        {cls.capacity ? (
                          <span>
                            Capacidade: <strong>{cls.capacity}</strong> vagas
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/turmas')}
                      className="text-xs h-8 border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Gerenciar Turma
                    </Button>
                  </div>
                </div>

                {/* Class Students List */}
                <div className="divide-y divide-[#E0E4EA]">
                  {classStudents.length === 0 ? (
                    <div className="p-6 text-center text-[#6C757D] text-xs">
                      Nenhum aluno matriculado nesta turma correspondente ao filtro.
                    </div>
                  ) : (
                    classStudents.map((st) => {
                      const plan = plans.find((p) => p.id === st.plan_id)
                      const lastPay = latestPaymentMap[st.id]
                      const photoUrl = getStudentPhotoUrl(st)

                      return (
                        <div
                          key={st.id}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-16 h-16 border-2 border-slate-200 bg-slate-100 shadow-xs">
                              {photoUrl ? (
                                <AvatarImage
                                  src={photoUrl}
                                  alt={st.name}
                                  className="object-cover"
                                />
                              ) : null}
                              <AvatarFallback className="bg-[#0F1B3D] text-white font-bold text-base">
                                {st.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p
                                onClick={() => navigate(`/alunos/${st.id}`)}
                                className="font-bold text-[#1E2A3A] hover:text-[#17A2B8] cursor-pointer transition text-sm"
                              >
                                {st.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <Badge className="bg-[#0F1B3D]/5 text-[#0F1B3D] border-[#0F1B3D]/20 text-[10px]">
                                  {plan?.name || 'Plano Padrão'}
                                </Badge>
                                <Badge
                                  className={
                                    st.status === 'ativo'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                      : 'bg-red-50 text-red-600 border-red-200 text-[10px]'
                                  }
                                >
                                  {st.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                </Badge>
                                {st.guardian_name && (
                                  <span className="text-[11px] text-[#6C757D]">
                                    Resp: <strong>{st.guardian_name}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                            <div className="text-left md:text-right text-xs">
                              <span className="text-[10px] text-[#6C757D] uppercase block">
                                Mensalidade
                              </span>
                              <span className="font-bold font-mono text-[#0F1B3D]">
                                R$ {(st.monthly_fee || plan?.monthly_price || 110).toFixed(2)}
                              </span>
                            </div>

                            <div className="text-left md:text-right text-xs">
                              <span className="text-[10px] text-[#6C757D] uppercase block">
                                Último Pagto
                              </span>
                              <span className="text-[#6C757D]">
                                {lastPay ? new Date(lastPay).toLocaleDateString('pt-BR') : '—'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => navigate(`/alunos/${st.id}`)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F1B3D] hover:bg-slate-100 transition"
                                title="Visualizar detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/cobrancas?aluno=${st.id}`)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                title="Registrar pagamento / cobrança"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(st)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition"
                                title="Editar aluno"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRequestDelete(st)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Remover aluno"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>
            )
          })}

          {/* Unassigned Students Section */}
          {classGroups.unassigned.length > 0 && (
            <Card className="bg-white border-amber-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-xs">
                    Sem Turma ({classGroups.unassigned.length})
                  </Badge>
                  <span className="text-xs text-amber-900 font-medium">
                    Alunos cadastrados mas ainda não vinculados a nenhuma turma
                  </span>
                </div>
              </div>

              <div className="divide-y divide-[#E0E4EA]">
                {classGroups.unassigned.map((st) => {
                  const plan = plans.find((p) => p.id === st.plan_id)
                  const lastPay = latestPaymentMap[st.id]
                  const photoUrl = getStudentPhotoUrl(st)

                  return (
                    <div
                      key={st.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-16 h-16 border-2 border-slate-200 bg-slate-100 shadow-xs">
                          {photoUrl ? (
                            <AvatarImage src={photoUrl} alt={st.name} className="object-cover" />
                          ) : null}
                          <AvatarFallback className="bg-[#0F1B3D] text-white font-bold text-base">
                            {st.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p
                            onClick={() => navigate(`/alunos/${st.id}`)}
                            className="font-bold text-[#1E2A3A] hover:text-[#17A2B8] cursor-pointer transition text-sm"
                          >
                            {st.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <Badge className="bg-[#0F1B3D]/5 text-[#0F1B3D] border-[#0F1B3D]/20 text-[10px]">
                              {plan?.name || 'Plano Padrão'}
                            </Badge>
                            <Badge
                              className={
                                st.status === 'ativo'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                  : 'bg-red-50 text-red-600 border-red-200 text-[10px]'
                              }
                            >
                              {st.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </Badge>
                            <span className="text-[11px] text-amber-700 font-medium italic">
                              Não matriculado em turma
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="text-left md:text-right text-xs">
                          <span className="text-[10px] text-[#6C757D] uppercase block">
                            Mensalidade
                          </span>
                          <span className="font-bold font-mono text-[#0F1B3D]">
                            R$ {(st.monthly_fee || plan?.monthly_price || 110).toFixed(2)}
                          </span>
                        </div>

                        <div className="text-left md:text-right text-xs">
                          <span className="text-[10px] text-[#6C757D] uppercase block">
                            Último Pagto
                          </span>
                          <span className="text-[#6C757D]">
                            {lastPay ? new Date(lastPay).toLocaleDateString('pt-BR') : '—'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/alunos/${st.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F1B3D] hover:bg-slate-100 transition"
                            title="Visualizar detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(st)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition"
                            title="Matricular em turma / Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRequestDelete(st)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Remover aluno"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* New / Edit Student Modal */}
      {/* ============================================================== */}
      <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white rounded-2xl">
          <form onSubmit={handleSaveStudent}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F1B3D]">
                {selectedStudent ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6C757D]">
                Insira as informações cadastrais e de plano do aluno.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4 text-xs">
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Nome Completo</Label>
                <Input
                  required
                  placeholder="Ex: Mariana Silva"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="focus-visible:ring-[#D4AF37]"
                />
              </div>

              {/* Informações do Responsável (para Plano Família e Agrupamento) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1B3D]">
                  <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Dados do Responsável (Agrupamento Família)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Nome do Responsável
                    </Label>
                    <Input
                      placeholder="Ex: Maria Oliveira"
                      value={formGuardianName}
                      onChange={(e) => setFormGuardianName(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      CPF do Responsável
                    </Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={formGuardianCpf}
                      onChange={(e) => setFormGuardianCpf(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Celular / WhatsApp do Resp.
                    </Label>
                    <Input
                      placeholder="(83) 9 9999-9999"
                      value={formGuardianPhone}
                      onChange={(e) => setFormGuardianPhone(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      E-mail do Responsável
                    </Label>
                    <Input
                      type="email"
                      placeholder="responsavel@email.com"
                      value={formGuardianEmail}
                      onChange={(e) => setFormGuardianEmail(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="aluno@email.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Telefone / WhatsApp</Label>
                  <Input
                    placeholder="(11) 98765-4321"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={formCpf}
                    onChange={(e) => setFormCpf(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formBirthDate}
                    onChange={(e) => setFormBirthDate(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Endereço Completo</Label>
                <Input
                  placeholder="Rua, Número, Bairro, Cidade"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="focus-visible:ring-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Plano de Matrícula</Label>
                  <Select value={formPlanId} onValueChange={setFormPlanId}>
                    <SelectTrigger className="focus:ring-[#D4AF37]">
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (R$ {p.monthly_price.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Matricular na Turma</Label>
                  <Select value={formClassId} onValueChange={setFormClassId}>
                    <SelectTrigger className="focus:ring-[#D4AF37]">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.schedule_time})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Status do Aluno</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v) => setFormStatus(v as 'ativo' | 'inativo')}
                >
                  <SelectTrigger className="focus:ring-[#D4AF37]">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setStudentModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
              >
                {submitting ? 'Salvando...' : 'Salvar Aluno'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* Delete Safeguard Confirmation Modal */}
      {/* ============================================================== */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600">Remover Aluno</DialogTitle>
            <DialogDescription className="text-xs text-[#6C757D]">
              {deleteBlockedReason ? (
                <div className="p-3 mt-2 rounded-lg bg-red-50 text-red-700 font-medium">
                  {deleteBlockedReason}
                </div>
              ) : (
                <>
                  Tem certeza que deseja remover o aluno{' '}
                  <strong className="text-[#1E2A3A]">{selectedStudent?.name}</strong>? Esta operação
                  apagará permanentemente o registro.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Fechar
            </Button>
            {!deleteBlockedReason && (
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
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
