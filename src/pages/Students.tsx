import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Printer,
  Users,
  List,
  Sparkles,
  Layers,
  GraduationCap,
  Clock,
  Calendar as CalendarIcon,
  AlertTriangle,
  User as UserIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
import { MapPin } from 'lucide-react'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'
import { getStudentStatusDisplay } from '@/lib/studentStatus'
import { groupStudentsByGuardian } from '@/lib/familyRules'
import type {
  StudentRecord,
  PlanRecord,
  PaymentRecord,
  EnrollmentRecord,
  ClassRecord,
} from '@/types/database'
import { useToast } from '@/hooks/use-toast'
import { maskCpf, maskPhone, maskCep, isValidCpf, isValidEmail } from '@/lib/formatters'
import { fetchAddressByCep } from '@/lib/viacep'
import { compressImage } from '@/lib/imageCompression'
import { StudentPhotoPicker } from '@/components/StudentPhotoPicker'
import {
  EMPTY_PARQ,
  EMPTY_ANAMNESE,
  getParq,
  getAnamnese,
  type ParqValues,
  type AnamneseValues,
} from '@/lib/matricula'
import { MatriculaExamsSection, MatriculaHealthSection } from '@/components/MatriculaFormSections'
import { PrintableFichaDialog, studentToPrintable } from '@/components/PrintableFicha'

// Rota de retorno à ficha do aluno após a edição aberta a partir do detalhe.
// O botão "Voltar para Turma" da ficha é derivado dos dados de matrícula do aluno
// (enrollments + turmas), então nenhum parâmetro de origem precisa ser preservado.
const buildDetailReturnPath = (studentId?: string | null): string =>
  studentId ? `/alunos/${studentId}` : '/alunos'

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
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number>(0)
  const [deleteWithHistory, setDeleteWithHistory] = useState(false)
  const [confirmationNameInput, setConfirmationNameInput] = useState('')
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
  const [formMonthlyFee, setFormMonthlyFee] = useState<string>('')
  const [formDiscountedFee, setFormDiscountedFee] = useState<string>('')
  const [formDueDay, setFormDueDay] = useState<string>('5')
  const [formValidadePagto, setFormValidadePagto] = useState<string>('')
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo')
  // Matrícula aquática: exames obrigatórios, PAR-Q, anamnese e uso de imagem
  const [formAptidaoDate, setFormAptidaoDate] = useState('')
  const [formAptidaoCrm, setFormAptidaoCrm] = useState('')
  const [formAptidaoStatus, setFormAptidaoStatus] = useState<'entregue' | 'pendente'>('pendente')
  const [formDermatoDate, setFormDermatoDate] = useState('')
  const [formDermatoStatus, setFormDermatoStatus] = useState<'entregue' | 'pendente'>('pendente')
  const [formParq, setFormParq] = useState<ParqValues>(EMPTY_PARQ)
  const [formAnamnese, setFormAnamnese] = useState<AnamneseValues>(EMPTY_ANAMNESE)
  const [formUsoImagem, setFormUsoImagem] = useState<'sim' | 'nao' | ''>('')
  const [submitting, setSubmitting] = useState(false)

  // Foto individual do aluno (formulário cadastrar/editar)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [fichaOpen, setFichaOpen] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Endereço (CEP com busca automática ViaCEP)
  const [formCep, setFormCep] = useState('')
  const [formStreet, setFormStreet] = useState('')
  const [formStreetNumber, setFormStreetNumber] = useState('')
  const [formComplement, setFormComplement] = useState('')
  const [formNeighborhood, setFormNeighborhood] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formUf, setFormUf] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
  const lastSearchedCepRef = useRef('')

  // Erros de validação do formulário (exibidos abaixo de cada campo)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Checkbox "O aluno é o próprio responsável": copia os dados do aluno para o
  // responsável (evitando duplo preenchimento) e permite restaurar ao desmarcar
  const [formSelfResponsible, setFormSelfResponsible] = useState(false)
  const guardianSnapshotRef = useRef<{
    name: string
    cpf: string
    phone: string
    email: string
  } | null>(null)

  // Reaplica máscara quando um aluno existente é carregado no modal de edição
  const reapplyMasksOnEdit = (st: StudentRecord) => {
    setFormCpf(maskCpf(st.cpf || ''))
    setFormPhone(maskPhone(st.phone || ''))
    setFormGuardianCpf(maskCpf(st.guardian_cpf || ''))
    setFormGuardianPhone(maskPhone(st.guardian_phone || ''))
  }

  // Verifica se os dados do responsável já são idênticos aos do aluno
  // (usado para marcar o checkbox automaticamente ao abrir a edição)
  const guardianMatchesStudent = (st: StudentRecord) => {
    const guardianName = (st.guardian_name || '').trim().toLowerCase()
    const studentName = (st.name || '').trim().toLowerCase()
    if (!guardianName || guardianName !== studentName) return false
    if ((st.guardian_cpf || '').replace(/\D/g, '') !== (st.cpf || '').replace(/\D/g, ''))
      return false
    if ((st.guardian_phone || '').replace(/\D/g, '') !== (st.phone || '').replace(/\D/g, ''))
      return false
    if ((st.guardian_email || '').trim().toLowerCase() !== (st.email || '').trim().toLowerCase())
      return false
    return true
  }

  // Ao marcar: guarda o estado atual do responsável e copia os dados do aluno.
  // Ao desmarcar: restaura exatamente o estado anterior dos campos do responsável.
  const handleSelfResponsibleChange = (checked: boolean) => {
    if (checked) {
      guardianSnapshotRef.current = {
        name: formGuardianName,
        cpf: formGuardianCpf,
        phone: formGuardianPhone,
        email: formGuardianEmail,
      }
      setFormGuardianName(formName)
      setFormGuardianCpf(formCpf)
      setFormGuardianPhone(formPhone)
      setFormGuardianEmail(formEmail)
    } else if (guardianSnapshotRef.current) {
      const snapshot = guardianSnapshotRef.current
      setFormGuardianName(snapshot.name)
      setFormGuardianCpf(snapshot.cpf)
      setFormGuardianPhone(snapshot.phone)
      setFormGuardianEmail(snapshot.email)
      guardianSnapshotRef.current = null
    }
    setFormSelfResponsible(checked)
  }

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
    } else {
      const editId = searchParams.get('editar')
      if (editId && students.length > 0) {
        const target = students.find((s) => s.id === editId)
        if (target) {
          handleOpenEditModal(target)
        }
      }
    }
  }, [searchParams, plans, students])

  const handleOpenCreateModal = () => {
    setSelectedStudent(null)
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormCpf('')
    setFormBirthDate('')
    setFormAddress('')
    setFormCep('')
    setFormStreet('')
    setFormStreetNumber('')
    setFormComplement('')
    setFormNeighborhood('')
    setFormCity('')
    setFormUf('')
    setCepError(null)
    setPhotoFile(null)
    setPhotoPreview(null)
    const initialPlan = plans[0]
    const initialPrice = initialPlan?.monthly_price ?? 110
    const initialIsIsento =
      initialPrice === 0 || (initialPlan?.name || '').toLowerCase().includes('isento')
    setFormPlanId(initialPlan?.id || '')
    setFormClassId('')
    setFormGuardianName('')
    setFormGuardianCpf('')
    setFormGuardianPhone('')
    setFormGuardianEmail('')
    setFormSelfResponsible(false)
    guardianSnapshotRef.current = null
    setFormMonthlyFee(initialIsIsento ? '0' : String(initialPrice))
    setFormDiscountedFee(initialIsIsento ? '0' : String(Math.max(0, initialPrice - 10)))
    setFormDueDay('5')
    setFormValidadePagto('')
    setFormStatus('ativo')
    setFormErrors({})
    setFormAptidaoDate('')
    setFormAptidaoCrm('')
    setFormAptidaoStatus('pendente')
    setFormDermatoDate('')
    setFormDermatoStatus('pendente')
    setFormParq({ ...EMPTY_PARQ })
    setFormAnamnese({ ...EMPTY_ANAMNESE })
    setFormUsoImagem('')
    setStudentModalOpen(true)
  }

  const handleOpenEditModal = (st: StudentRecord) => {
    setSelectedStudent(st)
    setFormName(st.name)
    setFormEmail(st.email || '')
    setFormBirthDate(st.birth_date ? st.birth_date.substring(0, 10) : '')
    reapplyMasksOnEdit(st)
    setFormAddress(st.address || '')
    setFormCep(maskCep(st.cep || ''))
    setFormStreet(st.street || '')
    setFormStreetNumber(st.street_number || '')
    setFormComplement(st.complement || '')
    setFormNeighborhood(st.neighborhood || '')
    setFormCity(st.city || '')
    setFormUf(st.uf || '')
    setCepError(null)
    setPhotoFile(null)
    setPhotoPreview(null)
    setFormPlanId(st.plan_id || '')
    const enrolledClass = enrollments.find((e) => e.student_id === st.id)
    setFormClassId(enrolledClass ? enrolledClass.class_id : '')
    setFormGuardianName(st.guardian_name || '')
    setFormGuardianCpf(st.guardian_cpf || '')
    setFormGuardianPhone(st.guardian_phone || '')
    setFormGuardianEmail(st.guardian_email || '')
    // Checkbox "aluno é o próprio responsável": marcado somente se os dados do
    // responsável já estão idênticos aos do aluno ao abrir a edição
    const selfResponsible = guardianMatchesStudent(st)
    setFormSelfResponsible(selfResponsible)
    guardianSnapshotRef.current = selfResponsible
      ? {
          name: st.guardian_name || '',
          cpf: st.guardian_cpf || '',
          phone: st.guardian_phone || '',
          email: st.guardian_email || '',
        }
      : null
    const studentPlan = plans.find((p) => p.id === st.plan_id)
    const planFee = studentPlan ? studentPlan.monthly_price : 110
    const isPlanIsento =
      studentPlan &&
      (studentPlan.monthly_price === 0 || studentPlan.name.toLowerCase().includes('isento'))

    if (typeof st.monthly_fee === 'number') {
      setFormMonthlyFee(String(st.monthly_fee))
    } else if (isPlanIsento) {
      setFormMonthlyFee('0')
    } else if (studentPlan) {
      setFormMonthlyFee(String(planFee))
    } else {
      setFormMonthlyFee('')
    }

    if (typeof st.discounted_fee === 'number') {
      setFormDiscountedFee(String(st.discounted_fee))
    } else if (isPlanIsento) {
      setFormDiscountedFee('0')
    } else if (studentPlan) {
      setFormDiscountedFee(String(Math.max(0, planFee - 10)))
    } else if (typeof st.monthly_fee === 'number') {
      setFormDiscountedFee(String(Math.max(0, st.monthly_fee - 10)))
    } else {
      setFormDiscountedFee('')
    }
    setFormDueDay(typeof st.due_day === 'number' ? String(st.due_day) : '5')
    setFormValidadePagto(
      st.validade_do_ultimo_pagamento ? st.validade_do_ultimo_pagamento.substring(0, 10) : '',
    )
    setFormStatus(st.status || 'ativo')
    setFormAptidaoDate(st.aptidao_date ? st.aptidao_date.substring(0, 10) : '')
    setFormAptidaoCrm(st.aptidao_crm || '')
    setFormAptidaoStatus(st.aptidao_status === 'entregue' ? 'entregue' : 'pendente')
    setFormDermatoDate(st.dermato_date ? st.dermato_date.substring(0, 10) : '')
    setFormDermatoStatus(st.dermato_status === 'entregue' ? 'entregue' : 'pendente')
    setFormParq(getParq(st))
    setFormAnamnese(getAnamnese(st))
    setFormUsoImagem((st.uso_imagem_autorizado as 'sim' | 'nao' | '') || '')
    setStudentModalOpen(true)
  }

  // Busca automática de endereço na ViaCEP quando o CEP fica completo.
  // Erros NUNCA bloqueiam o salvamento: viram apenas um aviso (cepError).
  const handleCepChange = async (value: string) => {
    const masked = maskCep(value)
    setFormCep(masked)
    const digits = masked.replace(/\D/g, '')

    if (digits.length !== 8) {
      setCepError(null)
      return
    }
    if (digits === lastSearchedCepRef.current) return
    lastSearchedCepRef.current = digits

    setCepLoading(true)
    setCepError(null)
    try {
      const addr = await fetchAddressByCep(digits)
      setFormStreet(addr.logradouro)
      setFormNeighborhood(addr.bairro)
      setFormCity(addr.localidade)
      setFormUf(addr.uf.toUpperCase())
      toast({
        title: 'Endereço encontrado',
        description: 'Logradouro, bairro, cidade e UF preenchidos automaticamente.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'CEP inválido ou não encontrado.'
      setCepError(msg)
    } finally {
      setCepLoading(false)
    }
  }

  // Reexecuta a busca (ex.: botão/Enter) mesmo que o CEP já tenha sido consultado
  const handleCepSearchRetry = () => {
    lastSearchedCepRef.current = ''
    handleCepChange(formCep)
  }

  // Seleção de foto individual no formulário (cadastro/edição)
  const handlePhotoSelect = (file: File | null) => {
    setPhotoFile(file)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
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

    // Validação: CPF/e-mail/telefone são validados SOMENTE quando preenchidos.
    // Campos vazios passam (dados importados do Bubble podem vir incompletos).
    const errors: Record<string, string> = {}
    const cpfValue = formCpf.trim()
    if (cpfValue && !isValidCpf(cpfValue)) {
      errors.cpf = 'CPF inválido'
    }
    const guardianCpfValue = formGuardianCpf.trim()
    if (guardianCpfValue && !isValidCpf(guardianCpfValue)) {
      errors.guardianCpf = 'CPF do responsável inválido'
    }
    const emailValue = formEmail.trim()
    if (emailValue && !isValidEmail(emailValue)) {
      errors.email = 'Digite um e-mail válido'
    }
    const guardianEmailValue = formGuardianEmail.trim()
    if (guardianEmailValue && !isValidEmail(guardianEmailValue)) {
      errors.guardianEmail = 'Digite um e-mail válido'
    }
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast({
        title: 'Dados de contato inválidos',
        description: 'Corrija os campos destacados antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const parsedMonthlyFee = formMonthlyFee.trim()
        ? parseFloat(formMonthlyFee.replace(',', '.'))
        : undefined
      const parsedDiscountedFee = formDiscountedFee.trim()
        ? parseFloat(formDiscountedFee.replace(',', '.'))
        : undefined
      const parsedDueDay = formDueDay.trim() ? parseInt(formDueDay, 10) : undefined

      // Mantém o campo legado "address" sincronizado com os novos campos estruturados
      const composedAddress = [
        formStreet.trim(),
        formStreetNumber.trim(),
        formComplement.trim(),
        formNeighborhood.trim(),
        formCity.trim(),
        formUf.trim().toUpperCase(),
      ]
        .filter(Boolean)
        .join(', ')

      const payload: Partial<StudentRecord> = {
        name: formName,
        email: formEmail.trim(),
        phone: formPhone.trim(),
        cpf: formCpf.trim(),
        birth_date: formBirthDate ? `${formBirthDate} 00:00:00.000Z` : undefined,
        address: composedAddress || formAddress,
        cep: formCep.replace(/\D/g, '') || undefined,
        street: formStreet.trim() || undefined,
        street_number: formStreetNumber.trim() || undefined,
        complement: formComplement.trim() || undefined,
        neighborhood: formNeighborhood.trim() || undefined,
        city: formCity.trim() || undefined,
        uf: formUf.trim().toUpperCase() || undefined,
        plan_id: formPlanId,
        guardian_name: formGuardianName.trim() || undefined,
        guardian_cpf: formGuardianCpf.trim() || undefined,
        guardian_phone: formGuardianPhone.trim() || undefined,
        guardian_email: formGuardianEmail.trim() || undefined,
        monthly_fee: !isNaN(parsedMonthlyFee as number) ? parsedMonthlyFee : undefined,
        discounted_fee: !isNaN(parsedDiscountedFee as number) ? parsedDiscountedFee : undefined,
        due_day: !isNaN(parsedDueDay as number) ? parsedDueDay : undefined,
        validade_do_ultimo_pagamento: formValidadePagto
          ? `${formValidadePagto} 00:00:00.000Z`
          : undefined,
        status: formStatus,
        aptidao_date: formAptidaoDate ? `${formAptidaoDate} 00:00:00.000Z` : undefined,
        aptidao_crm: formAptidaoCrm.trim() || undefined,
        aptidao_status: formAptidaoStatus,
        dermato_date: formDermatoDate ? `${formDermatoDate} 00:00:00.000Z` : undefined,
        dermato_status: formDermatoStatus,
        parq_1: formParq.parq_1 || '',
        parq_2: formParq.parq_2 || '',
        parq_3: formParq.parq_3 || '',
        parq_4: formParq.parq_4 || '',
        parq_5: formParq.parq_5 || '',
        parq_6: formParq.parq_6 || '',
        parq_7: formParq.parq_7 || '',
        anamnese_medo_agua: formAnamnese.anamnese_medo_agua || '',
        anamnese_convulsoes: formAnamnese.anamnese_convulsoes || '',
        anamnese_alergia_cloro: formAnamnese.anamnese_alergia_cloro || '',
        anamnese_medicamentos: formAnamnese.anamnese_medicamentos.trim() || undefined,
        anamnese_objetivo: formAnamnese.anamnese_objetivo.trim() || undefined,
        uso_imagem_autorizado: formUsoImagem || undefined,
      }

      let studentId = selectedStudent?.id
      if (selectedStudent) {
        const updated = await academyService.updateStudent(selectedStudent.id, payload)
        // Atualização instantânea em memória no estado
        setStudents((prev) =>
          prev.map((s) => (s.id === selectedStudent.id ? { ...s, ...updated } : s)),
        )
        toast({ title: 'Aluno atualizado com sucesso!' })
      } else {
        const created = await academyService.createStudent(payload)
        studentId = created.id
        setStudents((prev) => [created, ...prev])
        toast({ title: 'Aluno cadastrado com sucesso!' })
      }

      // Upload da foto individual (após criar/atualizar o aluno, para ter o ID)
      if (studentId && photoFile) {
        setPhotoUploading(true)
        try {
          const { file: fileToSend } = await compressImage(photoFile, photoFile.name, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.82,
            mimeType: 'image/jpeg',
          })
          const updatedPhoto = await academyService.uploadStudentPhoto(
            studentId,
            fileToSend,
            photoFile.name,
          )
          setStudents((prev) =>
            prev.map((s) => (s.id === studentId ? { ...s, ...updatedPhoto } : s)),
          )
        } catch (photoErr: unknown) {
          const photoMsg =
            photoErr instanceof Error ? photoErr.message : 'Não foi possível enviar a foto.'
          toast({
            title: 'Aviso: foto não enviada',
            description: `Os demais dados foram salvos, mas houve falha no upload da foto: ${photoMsg}`,
            variant: 'destructive',
          })
        } finally {
          setPhotoUploading(false)
          setPhotoFile(null)
          setPhotoPreview(null)
        }
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
      setSelectedStudent(null)

      const editId = searchParams.get('editar')
      const origem = searchParams.get('origem')
      if (origem === 'detalhe' && (editId || selectedStudent?.id)) {
        navigate(buildDetailReturnPath(editId || selectedStudent?.id))
      } else if (editId) {
        // Limpa os parâmetros de busca da URL para não reabrir o modal em renderizações subsequentes
        navigate('/alunos', { replace: true })
      }

      await loadData()
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
    setDeleteWithHistory(false)
    setConfirmationNameInput('')

    // Check if student has outstanding / overdue payments or open/overdue charges
    const studentPayments = payments.filter((p) => p.student_id === st.id)
    const pending = studentPayments.filter((p) => p.status === 'pendente' || p.status === 'vencido')
    setPendingPaymentsCount(pending.length)

    if (pending.length > 0) {
      setDeleteBlockedReason(
        `Não é possível remover este aluno diretamente: existem ${pending.length} mensalidade(s)/pagamento(s) pendente(s) ou vencido(s). Regularize essas pendências ou marque a opção de excluir com histórico financeiro abaixo.`,
      )
    } else {
      setDeleteBlockedReason(null)
    }
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedStudent || isDeleting) return

    // Se há bloqueio e a opção de excluir histórico não foi marcada, não prossegue
    if (deleteBlockedReason && !deleteWithHistory) return

    setIsDeleting(true)
    try {
      const studentToDeleteId = selectedStudent.id
      if (deleteWithHistory) {
        const res = await academyService.deleteStudentWithHistory(
          studentToDeleteId,
          confirmationNameInput,
        )
        // Atualização instantânea em memória: remove o aluno da lista
        setStudents((prev) => prev.filter((s) => s.id !== studentToDeleteId))
        toast({
          title: 'Aluno e histórico excluídos!',
          description:
            res.message || `Aluno ${selectedStudent.name} e suas cobranças foram apagados.`,
        })
      } else {
        await academyService.deleteStudent(studentToDeleteId)
        // Atualização instantânea em memória: remove o aluno da lista
        setStudents((prev) => prev.filter((s) => s.id !== studentToDeleteId))
        toast({
          title: 'Aluno removido com sucesso',
          description: `O registro de ${selectedStudent.name} foi excluído permanentemente.`,
        })
      }
      setDeleteConfirmOpen(false)
      setSelectedStudent(null)
      setDeleteWithHistory(false)
      setConfirmationNameInput('')
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

  // Family groups: montados a partir de TODOS os alunos conhecidos (ou filtrados apenas pela busca de texto),
  // ignorando o statusFilter para não esconder membros inativos de uma família e nunca quebrar o grupo familiar.
  const familyGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const pool = q
      ? students.filter((s) => {
          const nameMatch = s.name.toLowerCase().includes(q)
          const emailMatch = s.email && s.email.toLowerCase().includes(q)
          const cpfMatch = s.cpf && s.cpf.includes(q)
          const guardianMatch = s.guardian_name && s.guardian_name.toLowerCase().includes(q)
          const guardianCpfMatch = s.guardian_cpf && s.guardian_cpf.includes(q)
          return nameMatch || emailMatch || cpfMatch || guardianMatch || guardianCpfMatch
        })
      : students

    return groupStudentsByGuardian(pool, plans)
  }, [students, searchTerm, plans])

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
                          {isMulti ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                              Família ({group.students.length} alunos
                              {group.inactiveCount > 0 ? ` • ${group.activeCount} ativos` : ''})
                            </Badge>
                          ) : group.inactiveCount > 0 ? (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-semibold">
                              1 aluno (Inativo)
                            </Badge>
                          ) : null}
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
                            Até Vencimento (-R$ {(group.activeCount * 10).toFixed(2)})
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
                                  className={`text-[10px] border ${getStudentStatusDisplay(st).badgeClass}`}
                                >
                                  {getStudentStatusDisplay(st).label}
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
                                onClick={() => {
                                  setSelectedStudent(st)
                                  setFichaOpen(true)
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#D4AF37] hover:bg-amber-50 transition"
                                title="Imprimir ficha"
                              >
                                <Printer className="w-4 h-4" />
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
                    <th className="px-4 py-3.5">Validade / Pagto</th>
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
                      const validadePagto = st.validade_do_ultimo_pagamento

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
                            <Badge className={getStudentStatusDisplay(st).badgeClass}>
                              {getStudentStatusDisplay(st).label}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 font-mono font-bold text-[#0F1B3D]">
                            R$ {(st.monthly_fee || plan?.monthly_price || 110).toFixed(2)}
                            {st.discounted_fee &&
                            st.discounted_fee < (st.monthly_fee || plan?.monthly_price || 110) ? (
                              <span className="block text-[10px] text-emerald-600 font-semibold">
                                R$ {st.discounted_fee.toFixed(2)} em dia
                              </span>
                            ) : null}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-[#6C757D]">
                            {validadePagto ? (
                              <div>
                                <span className="font-semibold text-emerald-800">
                                  {new Date(validadePagto).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                  Validade Últ. Pagto
                                </span>
                              </div>
                            ) : lastPay ? (
                              <div>
                                <span>{new Date(lastPay).toLocaleDateString('pt-BR')}</span>
                                <span className="block text-[10px] text-slate-400">
                                  Pago no sistema
                                </span>
                              </div>
                            ) : (
                              '—'
                            )}
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
                                onClick={() => {
                                  setSelectedStudent(st)
                                  setFichaOpen(true)
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#D4AF37] hover:bg-amber-50 transition"
                                title="Imprimir ficha"
                              >
                                <Printer className="w-4 h-4" />
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
                                <Badge className={getStudentStatusDisplay(st).badgeClass}>
                                  {getStudentStatusDisplay(st).label}
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
                                onClick={() => {
                                  setSelectedStudent(st)
                                  setFichaOpen(true)
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#D4AF37] hover:bg-amber-50 transition"
                                title="Imprimir ficha"
                              >
                                <Printer className="w-4 h-4" />
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
                            <Badge className={getStudentStatusDisplay(st).badgeClass}>
                              {getStudentStatusDisplay(st).label}
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
                            onClick={() => {
                              setSelectedStudent(st)
                              setFichaOpen(true)
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#D4AF37] hover:bg-amber-50 transition"
                            title="Imprimir ficha"
                          >
                            <Printer className="w-4 h-4" />
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
      <Dialog
        open={studentModalOpen}
        onOpenChange={(open) => {
          setStudentModalOpen(open)
          if (!open) {
            const editId = searchParams.get('editar')
            const origem = searchParams.get('origem')
            if (origem === 'detalhe' && (editId || selectedStudent?.id)) {
              navigate(buildDetailReturnPath(editId || selectedStudent?.id))
            }
          }
        }}
      >
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
              <StudentPhotoPicker
                currentPhotoUrl={getStudentPhotoUrl(selectedStudent)}
                previewUrl={photoPreview}
                selectedFile={photoFile}
                studentName={selectedStudent?.name || formName}
                uploading={photoUploading}
                onFileSelect={handlePhotoSelect}
              />

              {/* ============================================================== */}
              {/* Quadro "Dados do Aluno" — mesmo visual do quadro do responsável */}
              {/* ============================================================== */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1B3D]">
                  <UserIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Dados do Aluno</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Nome Completo
                    </Label>
                    <Input
                      required
                      placeholder="Ex: Mariana Silva"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Data de Nascimento
                    </Label>
                    <Input
                      type="date"
                      value={formBirthDate}
                      onChange={(e) => setFormBirthDate(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">CPF</Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={formCpf}
                      onChange={(e) => setFormCpf(maskCpf(e.target.value))}
                      className={
                        formErrors.cpf
                          ? 'h-8 text-xs border-red-500 focus-visible:ring-red-500'
                          : 'h-8 text-xs focus-visible:ring-[#D4AF37]'
                      }
                    />
                    {formErrors.cpf && (
                      <p className="text-[10px] text-red-600 font-medium">{formErrors.cpf}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Telefone / WhatsApp
                    </Label>
                    <Input
                      placeholder="(84) 98830-9717"
                      value={formPhone}
                      onChange={(e) => setFormPhone(maskPhone(e.target.value))}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">E-mail</Label>
                    <Input
                      type="text"
                      inputMode="email"
                      placeholder="aluno@email.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className={
                        formErrors.email
                          ? 'h-8 text-xs border-red-500 focus-visible:ring-red-500'
                          : 'h-8 text-xs focus-visible:ring-[#D4AF37]'
                      }
                    />
                    {formErrors.email && (
                      <p className="text-[10px] text-red-600 font-medium">{formErrors.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Exames obrigatórios (Lei 9.863/2012-PB): aptidão física + dermatológico */}
              <MatriculaExamsSection
                aptidaoDate={formAptidaoDate}
                aptidaoCrm={formAptidaoCrm}
                aptidaoStatus={formAptidaoStatus}
                dermatoDate={formDermatoDate}
                dermatoStatus={formDermatoStatus}
                onAptidaoDate={setFormAptidaoDate}
                onAptidaoCrm={setFormAptidaoCrm}
                onAptidaoStatus={setFormAptidaoStatus}
                onDermatoDate={setFormDermatoDate}
                onDermatoStatus={setFormDermatoStatus}
              />

              {/* PAR-Q e anamnese aquática (frente 2) */}
              <MatriculaHealthSection
                parq={formParq}
                anamnese={formAnamnese}
                usoImagem={formUsoImagem}
                onParq={(key, v) => setFormParq((p) => ({ ...p, [key]: v }))}
                onAnamnese={(key, v) => setFormAnamnese((p) => ({ ...p, [key]: v }))}
                onUsoImagem={setFormUsoImagem}
              />

              {/* Checkbox: aproveitar os dados do aluno para o responsável */}
              <label
                htmlFor="self-responsible-check"
                className="flex items-start gap-2 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl cursor-pointer"
              >
                <Checkbox
                  id="self-responsible-check"
                  checked={formSelfResponsible}
                  onCheckedChange={(v) => handleSelfResponsibleChange(v === true)}
                  className="mt-0.5"
                />
                <span className="text-[11px] leading-snug text-[#1E2A3A]">
                  <span className="font-bold">O aluno é o próprio responsável</span>
                  <span className="block text-slate-500">
                    Aproveita nome, CPF, telefone e e-mail do aluno nos dados do responsável,
                    evitando o duplo preenchimento (comum em alunos adultos).
                  </span>
                </span>
              </label>

              {/* Informações do Responsável (para Plano Família e Agrupamento) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1B3D]">
                  <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Dados do Responsável (Agrupamento Família)</span>
                </div>
                {formSelfResponsible && (
                  <p className="text-[10px] text-emerald-700 font-medium">
                    Utilizando os mesmos dados do aluno — desmarque a caixa acima para editar
                    manualmente.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Nome do Responsável
                    </Label>
                    <Input
                      placeholder="Ex: Maria Oliveira"
                      value={formGuardianName}
                      onChange={(e) => setFormGuardianName(e.target.value)}
                      disabled={formSelfResponsible}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      CPF do Responsável
                    </Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={formGuardianCpf}
                      onChange={(e) => setFormGuardianCpf(maskCpf(e.target.value))}
                      disabled={formSelfResponsible}
                      className={
                        formErrors.guardianCpf
                          ? 'h-8 text-xs border-red-500 focus-visible:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100'
                          : 'h-8 text-xs focus-visible:ring-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100'
                      }
                    />
                    {formErrors.guardianCpf && (
                      <p className="text-[10px] text-red-600 font-medium">
                        {formErrors.guardianCpf}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Celular / WhatsApp do Resp.
                    </Label>
                    <Input
                      placeholder="(84) 98830-9717"
                      value={formGuardianPhone}
                      onChange={(e) => setFormGuardianPhone(maskPhone(e.target.value))}
                      disabled={formSelfResponsible}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      E-mail do Responsável
                    </Label>
                    <Input
                      type="text"
                      inputMode="email"
                      placeholder="responsavel@email.com"
                      value={formGuardianEmail}
                      onChange={(e) => setFormGuardianEmail(e.target.value)}
                      disabled={formSelfResponsible}
                      className={
                        formErrors.guardianEmail
                          ? 'h-8 text-xs border-red-500 focus-visible:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100'
                          : 'h-8 text-xs focus-visible:ring-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100'
                      }
                    />
                    {formErrors.guardianEmail && (
                      <p className="text-[10px] text-red-600 font-medium">
                        {formErrors.guardianEmail}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Endereço com busca automática de CEP (ViaCEP) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1B3D]">
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Endereço (busca automática pelo CEP)</span>
                  {cepLoading && <Loader2 className="w-3 h-3 text-[#17A2B8] animate-spin ml-1" />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">CEP</Label>
                    <Input
                      placeholder="00000-000"
                      inputMode="numeric"
                      value={formCep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      onBlur={handleCepSearchRetry}
                      className={
                        cepError
                          ? 'h-8 text-xs border-amber-500 focus-visible:ring-amber-500 bg-white'
                          : 'h-8 text-xs focus-visible:ring-[#D4AF37] bg-white'
                      }
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">Logradouro</Label>
                    <Input
                      placeholder="Rua, Avenida, Travessa..."
                      value={formStreet}
                      onChange={(e) => setFormStreet(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white"
                    />
                  </div>
                </div>

                {cepError && (
                  <p className="text-[11px] text-amber-700 font-medium flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{cepError}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">Número</Label>
                    <Input
                      placeholder="Ex: 123"
                      value={formStreetNumber}
                      onChange={(e) => setFormStreetNumber(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">Complemento</Label>
                    <Input
                      placeholder="Ex: Apto 302 / Bloco B"
                      value={formComplement}
                      onChange={(e) => setFormComplement(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">Bairro</Label>
                    <Input
                      placeholder="Ex: Centro"
                      value={formNeighborhood}
                      onChange={(e) => setFormNeighborhood(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2 space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">Cidade</Label>
                    <Input
                      placeholder="Ex: Natal"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">UF</Label>
                    <Input
                      placeholder="Ex: RN"
                      maxLength={2}
                      value={formUf}
                      onChange={(e) => setFormUf(e.target.value.toUpperCase())}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white uppercase"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Digite o CEP para preencher automaticamente. Número e complemento são sempre
                  digitados por você.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Plano de Matrícula</Label>
                  <Select
                    value={formPlanId}
                    onValueChange={(pId) => {
                      setFormPlanId(pId)
                      const picked = plans.find((p) => p.id === pId)
                      if (picked) {
                        const price =
                          typeof picked.monthly_price === 'number' ? picked.monthly_price : 0
                        const isIsento = price === 0 || picked.name.toLowerCase().includes('isento')
                        if (isIsento) {
                          setFormMonthlyFee('0')
                          setFormDiscountedFee('0')
                        } else {
                          setFormMonthlyFee(String(price))
                          setFormDiscountedFee(String(Math.max(0, price - 10)))
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="focus:ring-[#D4AF37]">
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans
                        .filter((p) => p.is_active !== false)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{' '}
                            {p.monthly_price === 0
                              ? '(Sem custo)'
                              : `(R$ ${p.monthly_price.toFixed(2)})`}
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

              {/* Informações Financeiras da Mensalidade */}
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1B3D]">
                    <DollarSign className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Mensalidade &amp; Condições de Pagamento</span>
                  </div>
                  <span className="text-[10px] text-[#17A2B8] font-semibold">
                    Valores preenchidos pelo plano (ajustáveis à mão)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Valor Mensalidade (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 100.00"
                      value={formMonthlyFee}
                      onChange={(e) => setFormMonthlyFee(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white font-mono"
                    />
                    <p className="text-[9px] text-slate-500">Valor cheio da mensalidade</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Com Desconto Pontualidade (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 90.00"
                      value={formDiscountedFee}
                      onChange={(e) => setFormDiscountedFee(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white font-mono text-emerald-700 font-bold"
                    />
                    <p className="text-[9px] text-emerald-700 font-medium">
                      ★ Cobrado até o vencimento
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Dia de Vencimento
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 5"
                      value={formDueDay}
                      onChange={(e) => setFormDueDay(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white font-mono"
                    />
                    <p className="text-[9px] text-slate-500">Dia do mês para fatura</p>
                  </div>
                </div>

                {/* Destaque explícito de qual valor será efetivamente cobrado */}
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex items-center justify-between">
                  <span className="text-[11px] text-emerald-900 font-medium">
                    Valor efetivo na cobrança até o vencimento:
                  </span>
                  <span className="font-mono font-bold text-sm text-emerald-800">
                    R${' '}
                    {(formDiscountedFee && !isNaN(Number(formDiscountedFee))
                      ? Number(formDiscountedFee)
                      : formMonthlyFee && !isNaN(Number(formMonthlyFee))
                        ? Number(formMonthlyFee)
                        : 0
                    ).toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                    Data de Validade do Último Pagamento
                  </Label>
                  <Input
                    type="date"
                    value={formValidadePagto}
                    onChange={(e) => setFormValidadePagto(e.target.value)}
                    className="h-8 text-xs focus-visible:ring-[#D4AF37] bg-white"
                  />
                  <p className="text-[10px] text-slate-500">
                    Controla a validade da mensalidade atual no quadro de alunos.
                  </p>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStudentModalOpen(false)
                  const editId = searchParams.get('editar')
                  const origem = searchParams.get('origem')
                  if (origem === 'detalhe' && (editId || selectedStudent?.id)) {
                    navigate(buildDetailReturnPath(editId || selectedStudent?.id))
                  }
                }}
              >
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

      <PrintableFichaDialog
        open={fichaOpen}
        onOpenChange={setFichaOpen}
        data={selectedStudent ? studentToPrintable(selectedStudent) : null}
        studentId={selectedStudent?.id}
      />

      {/* ============================================================== */}
      {/* Delete Safeguard Confirmation Modal */}
      {/* ============================================================== */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open)
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
                  <strong className="text-[#1E2A3A]">{selectedStudent?.name}</strong>?
                </p>
              )}

              {/* Opção para exclusão de histórico quando houver pendências */}
              {pendingPaymentsCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 space-y-2.5 text-left">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="students-delete-with-history"
                      checked={deleteWithHistory}
                      onChange={(e) => setDeleteWithHistory(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-amber-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <label
                      htmlFor="students-delete-with-history"
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
              {deleteWithHistory && selectedStudent && (
                <div className="space-y-2 pt-1 text-left">
                  <Label className="text-xs font-bold text-[#0F1B3D]">
                    Para confirmar a exclusão com histórico, digite o nome completo do aluno:{' '}
                    <span className="font-mono text-red-600">{selectedStudent.name}</span>
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
                setDeleteConfirmOpen(false)
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
                    (selectedStudent?.name || '').trim().toLowerCase().replace(/\s+/g, ' ')
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
