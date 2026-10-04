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
  const pageSize = 10

  // Modal states
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formCpf, setFormCpf] = useState('')
  const [formBirthDate, setFormBirthDate] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formPlanId, setFormPlanId] = useState('')
  const [formClassId, setFormClassId] = useState('')
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
    // Check if student has outstanding / overdue payments
    const studentPayments = payments.filter((p) => p.student_id === st.id)
    const hasPending = studentPayments.some(
      (p) => p.status === 'pendente' || p.status === 'vencido',
    )

    if (hasPending) {
      setDeleteBlockedReason(
        'Não é possível remover este aluno: existem pagamentos pendentes ou vencidos.',
      )
    } else {
      setDeleteBlockedReason(null)
    }
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedStudent || deleteBlockedReason) return
    try {
      await academyService.deleteStudent(selectedStudent.id)
      toast({ title: 'Aluno removido com sucesso' })
      setDeleteConfirmOpen(false)
      setSelectedStudent(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao remover aluno', variant: 'destructive' })
    }
  }

  // Filter students by name, email, or CPF
  const filteredStudents = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return students

    return students.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(q)
      const emailMatch = s.email && s.email.toLowerCase().includes(q)
      const cpfMatch = s.cpf && s.cpf.includes(q)
      return nameMatch || emailMatch || cpfMatch
    })
  }, [students, searchTerm])

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

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Filtrar por nome, CPF..."
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

      {/* ============================================================== */}
      {/* Students Table */}
      {/* ============================================================== */}
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
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8 border border-slate-200 bg-slate-100">
                              {photoUrl ? (
                                <AvatarImage
                                  src={photoUrl}
                                  alt={st.name}
                                  className="object-cover"
                                />
                              ) : null}
                              <AvatarFallback className="bg-[#0F1B3D] text-white font-bold text-xs">
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
                              <p className="text-[11px] text-[#6C757D]">
                                {st.cpf || st.email || 'Sem contato cadastrado'}
                              </p>
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
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
              Fechar
            </Button>
            {!deleteBlockedReason && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                className="font-bold"
              >
                Confirmar Exclusão
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
