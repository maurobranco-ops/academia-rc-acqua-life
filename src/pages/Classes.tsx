import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Users,
  Clock,
  LayoutGrid,
  Calendar as CalendarIcon,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  UserPlus,
  Loader2,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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
import type {
  ClassRecord,
  InstructorRecord,
  StudentRecord,
  EnrollmentRecord,
} from '@/types/database'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'
import { getStudentStatusDisplay } from '@/lib/studentStatus'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ClassEnrollmentRowProps {
  enrollment: EnrollmentRecord
  onOpenStudent: () => void
  onRemove: () => void
}

/**
 * Linha de aluno matriculado no modal "Gerenciar Matrículas":
 * tocar na tarja/linha inteira abre a edição do aluno; o botão Remover
 * continua desvinculando apenas a matrícula (sem abrir o aluno).
 */
function ClassEnrollmentRow({ enrollment, onOpenStudent, onRemove }: ClassEnrollmentRowProps) {
  const student = enrollment.expand?.student_id
  const photoUrl = student ? getStudentPhotoUrl(student) : null
  const status = getStudentStatusDisplay(student)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenStudent}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenStudent()
        }
      }}
      className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17A2B8]"
      title="Abrir ficha do aluno"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
          {photoUrl ? (
            <AvatarImage
              src={photoUrl}
              alt={student?.name || ''}
              className="object-cover rounded-lg"
            />
          ) : null}
          <AvatarFallback className="text-xs bg-[#0F1B3D] text-[#D4AF37] font-bold rounded-lg">
            {(student?.name || 'AL').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#0F1B3D] truncate">{student?.name || 'Aluno'}</p>
          <p className="text-[11px] text-[#6C757D] truncate">
            {student?.phone || student?.email || 'Sem contato'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={`text-[10px] border ${status.badgeClass}`}>
          {status.label}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Remover
        </Button>
      </div>
    </div>
  )
}

const DAYS_OF_WEEK = [
  { id: 'seg', label: 'Segunda' },
  { id: 'ter', label: 'Terça' },
  { id: 'qua', label: 'Quarta' },
  { id: 'qui', label: 'Quinta' },
  { id: 'sex', label: 'Sexta' },
  { id: 'sab', label: 'Sábado' },
  { id: 'dom', label: 'Domingo' },
]

// Grade semanal: exibe apenas estes dias (pedido do usuário — terça, quinta e
// domingo ficam ocultos na grade; os dados das turmas continuam intactos).
const SCHEDULE_DAYS = [
  { id: 'seg', label: 'Segunda' },
  { id: 'qua', label: 'Quarta' },
  { id: 'sex', label: 'Sexta' },
  { id: 'sab', label: 'Sábado' },
]
const HIDDEN_SCHEDULE_DAY_IDS = ['ter', 'qui', 'dom']

export default function Classes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [instructors, setInstructors] = useState<InstructorRecord[]>([])
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [loading, setLoading] = useState(true)

  // View toggle: grid or schedule
  const [viewMode, setViewMode] = useState<'grid' | 'schedule'>('grid')

  // Modals state
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false)
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'natacao' | 'hidroginastica' | 'funcional'>('natacao')
  const [formInstructorId, setFormInstructorId] = useState('')
  const [formScheduleDays, setFormScheduleDays] = useState<string[]>(['seg', 'qua', 'sex'])
  const [formScheduleTime, setFormScheduleTime] = useState('08:00')
  const [formDuration, setFormDuration] = useState('50')
  const [formCapacity, setFormCapacity] = useState('10')
  const [formMonthlyPrice, setFormMonthlyPrice] = useState('160')
  const [submitting, setSubmitting] = useState(false)

  // Turmas que só acontecem nos dias ocultos da grade (ter/qui/dom) — dados
  // intactos, apenas não exibidos na grade semanal (aviso discreto acima dela).
  const hiddenDaysClasses = useMemo(
    () =>
      classes.filter(
        (c) =>
          (c.schedule_days || []).length > 0 &&
          (c.schedule_days || []).every((d) => HIDDEN_SCHEDULE_DAY_IDS.includes(d)),
      ),
    [classes],
  )

  const loadData = async () => {
    try {
      const [cData, iData, sData, eData] = await Promise.all([
        academyService.getClasses(),
        academyService.getInstructors(),
        academyService.getStudents(),
        academyService.getEnrollments(),
      ])
      setClasses(cData)
      setInstructors(iData)
      setStudents(sData)
      setEnrollments(eData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<ClassRecord>('classes', () => loadData())
  useRealtime<EnrollmentRecord>('enrollments', () => loadData())

  // Check URL query param for quick open
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      handleOpenCreateModal()
    }
  }, [searchParams])

  // Deep-link do botão "Voltar para Turma" da ficha do aluno (derivado das
  // matrículas do aluno): abre o modal "Gerenciar Matrículas" da turma
  // indicada por ?turma=<id> (via /turmas?turma=...)
  useEffect(() => {
    const turmaId = searchParams.get('turma')
    if (!turmaId) return
    // Aguarda o carregamento das turmas para encontrar o registro correspondente
    if (loading) return
    const cls = classes.find((c) => c.id === turmaId)
    if (cls) {
      handleOpenDetailModal(cls)
    }
    // Limpa o parâmetro para reabrir no clique futuro sem fechar o modal manualmente
    searchParams.delete('turma')
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, classes])

  const handleOpenCreateModal = () => {
    setSelectedClass(null)
    setFormName('')
    setFormType('natacao')
    setFormInstructorId(instructors[0]?.id || '')
    setFormScheduleDays(['seg', 'qua', 'sex'])
    setFormScheduleTime('08:00')
    setFormDuration('50')
    setFormCapacity('10')
    setFormMonthlyPrice('160')
    setClassModalOpen(true)
  }

  const handleOpenEditModal = (c: ClassRecord) => {
    setSelectedClass(c)
    setFormName(c.name)
    setFormType(c.type)
    setFormInstructorId(c.instructor_id || '')
    setFormScheduleDays(c.schedule_days || [])
    setFormScheduleTime(c.schedule_time)
    setFormDuration(String(c.duration_minutes || 50))
    setFormCapacity(String(c.capacity))
    setFormMonthlyPrice(String(c.monthly_price || 160))
    setClassModalOpen(true)
  }

  const handleOpenDetailModal = (c: ClassRecord) => {
    setSelectedClass(c)
    setDetailModalOpen(true)
  }

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formScheduleTime) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha o nome da turma e horário.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: formName,
        type: formType,
        instructor_id: formInstructorId || undefined,
        schedule_days: formScheduleDays,
        schedule_time: formScheduleTime,
        duration_minutes: Number(formDuration),
        capacity: Number(formCapacity),
        monthly_price: Number(formMonthlyPrice),
      }

      if (selectedClass) {
        await academyService.updateClass(selectedClass.id, payload)
        toast({ title: 'Turma atualizada com sucesso!' })
      } else {
        await academyService.createClass(payload)
        toast({ title: 'Turma cadastrada com sucesso!' })
      }
      setClassModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar turma'
      toast({
        title: 'Erro ao salvar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDuplicateClass = async (c: ClassRecord) => {
    try {
      await academyService.createClass({
        name: `${c.name} (Cópia)`,
        type: c.type,
        instructor_id: c.instructor_id,
        schedule_days: c.schedule_days,
        schedule_time: c.schedule_time,
        duration_minutes: c.duration_minutes,
        capacity: c.capacity,
        monthly_price: c.monthly_price,
      })
      toast({ title: 'Turma duplicada com sucesso!' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao duplicar', variant: 'destructive' })
    }
  }

  const handleDeleteClass = async () => {
    if (!selectedClass || isDeleting) return
    setIsDeleting(true)
    try {
      await academyService.deleteClass(selectedClass.id)
      toast({ title: 'Turma removida com sucesso' })
      setDeleteConfirmOpen(false)
      setSelectedClass(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Falha ao remover turma',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddStudentToClass = async () => {
    if (!selectedClass || !selectedStudentToAdd) return
    try {
      await academyService.createEnrollment(selectedStudentToAdd, selectedClass.id)
      toast({ title: 'Aluno matriculado na turma com sucesso!' })
      setSelectedStudentToAdd('')
      setAddStudentModalOpen(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao matricular aluno', variant: 'destructive' })
    }
  }

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    try {
      await academyService.deleteEnrollment(enrollmentId)
      toast({ title: 'Matrícula desvinculada com sucesso' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao desvincular aluno',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const toggleDay = (day: string) => {
    if (formScheduleDays.includes(day)) {
      setFormScheduleDays(formScheduleDays.filter((d) => d !== day))
    } else {
      setFormScheduleDays([...formScheduleDays, day])
    }
  }

  // Count enrolled students per class
  const classEnrollmentsMap = useMemo(() => {
    const map: Record<string, EnrollmentRecord[]> = {}
    enrollments.forEach((e) => {
      if (!map[e.class_id]) map[e.class_id] = []
      map[e.class_id].push(e)
    })
    return map
  }, [enrollments])

  // Get enrolled students for selected detail modal.
  // Ordenado por nome; separado em ativos (ativo/isento) e inativos/trancados, cada grupo com contagem.
  const selectedClassEnrollments = useMemo(() => {
    if (!selectedClass) return { active: [], inactive: [] }
    const list = enrollments
      .filter((e) => e.class_id === selectedClass.id)
      .slice()
      .sort((a, b) => {
        const na = (a.expand?.student_id?.name || '').toLocaleLowerCase('pt-BR')
        const nb = (b.expand?.student_id?.name || '').toLocaleLowerCase('pt-BR')
        return na.localeCompare(nb, 'pt-BR')
      })
    const isActiveLike = (e: EnrollmentRecord) => {
      const st = e.expand?.student_id
      if (!st) return true
      return getStudentStatusDisplay(st).key !== 'inativo'
    }
    const active: EnrollmentRecord[] = list.filter(isActiveLike)
    const inactive: EnrollmentRecord[] = list.filter((e) => !isActiveLike(e))
    return { active, inactive }
  }, [selectedClass, enrollments])

  const navigateToStudent = (studentId?: string) => {
    if (!studentId || !selectedClass) return
    // Origem gravada na URL (?de=turma:<id>) para o botão "Voltar para Turma"
    // sobreviver à edição do aluno e ao refresh da ficha.
    const params = new URLSearchParams({ de: `turma:${selectedClass.id}` })
    if (selectedClass.name) params.set('nome', selectedClass.name)
    navigate(`/alunos/${studentId}?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#0F1B3D] animate-spin" />
        <span className="text-sm text-[#6C757D]">Carregando turmas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0F1B3D]">Gestão de Turmas</h2>
          <p className="text-xs text-[#6C757D]">
            Organize horários, instrutores e capacidades para natação e hidroginástica
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle View Mode */}
          <div className="bg-white border border-[#E0E4EA] p-1 rounded-xl flex items-center shadow-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'grid'
                  ? 'bg-[#0F1B3D] text-white shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
              aria-label="Visualização em grade"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'schedule'
                  ? 'bg-[#0F1B3D] text-white shadow-xs'
                  : 'text-[#6C757D] hover:text-[#0F1B3D]'
              }`}
              aria-label="Visualização semanal da agenda"
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Grade Semanal</span>
            </button>
          </div>

          <Button
            onClick={handleOpenCreateModal}
            className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold shadow-md text-xs h-10 px-4 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Turma
          </Button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Cards Grid View */}
      {/* ============================================================== */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((c) => {
            const enrolled = classEnrollmentsMap[c.id] || []
            const occupancy = Math.round((enrolled.length / (c.capacity || 1)) * 100)
            const isNatacao = c.type === 'natacao'

            return (
              <Card
                key={c.id}
                className="bg-white border-[#E0E4EA] hover:border-[#D4AF37] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 rounded-xl overflow-hidden group"
              >
                <div className={`h-2 ${isNatacao ? 'bg-[#0F1B3D]' : 'bg-[#17A2B8]'}`} />
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <Badge
                      className={
                        isNatacao
                          ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold uppercase'
                          : 'bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold uppercase'
                      }
                    >
                      {isNatacao ? 'Natação' : 'Hidroginástica'}
                    </Badge>
                    <CardTitle
                      onClick={() => handleOpenDetailModal(c)}
                      className="text-base font-bold text-[#0F1B3D] hover:text-[#17A2B8] cursor-pointer transition pt-1"
                    >
                      {c.name}
                    </CardTitle>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded-lg hover:bg-slate-100 text-[#6C757D]">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem onClick={() => handleOpenDetailModal(c)}>
                        <Users className="w-3.5 h-3.5 mr-2" /> Ver Alunos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenEditModal(c)}>
                        <Edit2 className="w-3.5 h-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateClass(c)}>
                        <Copy className="w-3.5 h-3.5 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedClass(c)
                          setDeleteConfirmOpen(true)
                        }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  <div className="space-y-2 text-xs text-[#6C757D]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Instrutor:</span>
                      <span className="font-semibold text-[#1E2A3A]">
                        {c.expand?.instructor_id?.name || 'Não atribuído'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium">Horário:</span>
                      <div className="flex items-center gap-1 font-semibold text-[#1E2A3A]">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {c.schedule_time} ({c.duration_minutes || 50} min)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium">Dias:</span>
                      <div className="flex items-center gap-1">
                        {(c.schedule_days || []).map((d) => (
                          <span
                            key={d}
                            className="px-1.5 py-0.5 bg-[#F5F7FA] border border-[#E0E4EA] text-[10px] rounded uppercase font-semibold text-[#0F1B3D]"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Capacity Progress Bar */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#6C757D]">Ocupação:</span>
                      <span className="font-bold text-[#0F1B3D]">
                        {enrolled.length} / {c.capacity} alunos ({occupancy}%)
                      </span>
                    </div>
                    <Progress
                      value={occupancy}
                      className="h-2 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-[#17A2B8] [&>div]:to-[#D4AF37]"
                    />
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleOpenDetailModal(c)}
                    className="w-full text-xs font-bold text-[#0F1B3D] border-[#E0E4EA] hover:border-[#0F1B3D] h-9"
                  >
                    Gerenciar Matrículas
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* Weekly Schedule View */}
      {/* ============================================================== */}
      {viewMode === 'schedule' && (
        <Card className="bg-white border-[#E0E4EA] rounded-xl overflow-hidden shadow-xs">
          <CardHeader className="pb-3 border-b border-[#E0E4EA]">
            <CardTitle className="text-base font-bold text-[#0F1B3D]">
              Grade Semanal de Aulas
            </CardTitle>
          </CardHeader>
          {hiddenDaysClasses.length > 0 && (
            <div className="px-4 pt-3">
              <p className="text-[11px] text-[#6C757D] bg-[#F5F7FA] border border-[#E0E4EA] rounded-lg px-3 py-2">
                Turmas de terça, quinta e domingo não aparecem nesta grade (
                {hiddenDaysClasses.length} turma
                {hiddenDaysClasses.length > 1 ? 's' : ''}). Elas continuam na lista "Turmas" e na
                ficha de cada aluno.
              </p>
            </div>
          )}
          <div className="p-4 overflow-x-auto">
            <div className="grid grid-cols-4 gap-3 min-w-[640px]">
              {SCHEDULE_DAYS.map((day) => {
                const dayClasses = classes
                  .filter((c) => (c.schedule_days || []).includes(day.id))
                  .slice()
                  .sort((a, b) => (a.schedule_time || '').localeCompare(b.schedule_time || ''))
                return (
                  <div key={day.id} className="bg-[#F5F7FA] rounded-xl p-3 border border-[#E0E4EA]">
                    <div className="text-center font-bold text-xs text-[#0F1B3D] pb-2 border-b border-[#E0E4EA] uppercase tracking-wide">
                      {day.label}
                    </div>

                    <div className="mt-3 space-y-2">
                      {dayClasses.length === 0 ? (
                        <p className="text-[11px] text-[#6C757D] text-center py-6 italic">
                          Sem aulas
                        </p>
                      ) : (
                        dayClasses.map((dc) => {
                          const isNat = dc.type === 'natacao'
                          return (
                            <div
                              key={dc.id}
                              onClick={() => handleOpenDetailModal(dc)}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer hover:shadow-md transition ${
                                isNat
                                  ? 'bg-blue-50/80 border-blue-200 hover:border-blue-400'
                                  : 'bg-teal-50/80 border-teal-200 hover:border-teal-400'
                              }`}
                            >
                              <div className="font-bold text-[#0F1B3D] [overflow-wrap:anywhere] [word-break:normal] leading-snug whitespace-normal">
                                {dc.name}
                              </div>
                              <div className="text-[11px] font-semibold text-[#17A2B8] mt-0.5">
                                {dc.schedule_time}
                              </div>
                              <div className="text-[10px] text-[#6C757D] truncate mt-1">
                                {dc.expand?.instructor_id?.name || 'Instrutor'}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* New / Edit Class Modal */}
      {/* ============================================================== */}
      <Dialog open={classModalOpen} onOpenChange={setClassModalOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white rounded-2xl">
          <form onSubmit={handleSaveClass}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F1B3D]">
                {selectedClass ? 'Editar Turma' : 'Cadastrar Nova Turma'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6C757D]">
                Informe os parâmetros da modalidade, instrutor e horários.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 text-xs">
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Nome da Turma</Label>
                <Input
                  required
                  placeholder="Ex: Natação Adulto - Noturno"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="focus-visible:ring-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Modalidade</Label>
                  <Select
                    value={formType}
                    onValueChange={(v) => setFormType(v as 'natacao' | 'hidroginastica')}
                  >
                    <SelectTrigger className="focus:ring-[#D4AF37]">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natacao">Natação</SelectItem>
                      <SelectItem value="hidroginastica">Hidroginástica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Instrutor Responsável</Label>
                  <Select value={formInstructorId} onValueChange={setFormInstructorId}>
                    <SelectTrigger className="focus:ring-[#D4AF37]">
                      <SelectValue placeholder="Selecione o instrutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {instructors.map((ins) => (
                        <SelectItem key={ins.id} value={ins.id}>
                          {ins.name} ({ins.specialty})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Days multi-select */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1E2A3A]">Dias da Semana</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = formScheduleDays.includes(day.id)
                    return (
                      <button
                        type="button"
                        key={day.id}
                        onClick={() => toggleDay(day.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-[#0F1B3D] text-[#D4AF37] border-[#0F1B3D]'
                            : 'bg-white text-[#6C757D] border-[#E0E4EA] hover:border-slate-400'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Horário Início</Label>
                  <Input
                    required
                    type="time"
                    value={formScheduleTime}
                    onChange={(e) => setFormScheduleTime(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Duração (min)</Label>
                  <Input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Capacidade (Vagas)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Mensalidade Padrão (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formMonthlyPrice}
                  onChange={(e) => setFormMonthlyPrice(e.target.value)}
                  className="focus-visible:ring-[#D4AF37]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setClassModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
              >
                {submitting ? 'Salvando...' : 'Salvar Turma'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* Class Detail / Students Enrolled Modal */}
      {/* ============================================================== */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-[650px] bg-white rounded-2xl">
          <DialogHeader>
            <div className="pr-6">
              <DialogTitle className="text-xl font-bold text-[#0F1B3D]">
                {selectedClass?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6C757D]">
                Instrutor: {selectedClass?.expand?.instructor_id?.name || 'Geral'} • Horário:{' '}
                {selectedClass?.schedule_time}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-sm font-bold text-[#1E2A3A] break-words">
                Alunos Matriculados (
                {selectedClassEnrollments.active.length + selectedClassEnrollments.inactive.length}{' '}
                de {selectedClass?.capacity})
              </span>
              <Button
                size="sm"
                onClick={() => setAddStudentModalOpen(true)}
                className="self-start bg-[#17A2B8] hover:bg-[#138496] text-white text-xs font-bold h-8 rounded-lg flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" /> Adicionar Aluno
              </Button>
            </div>

            {selectedClassEnrollments.active.length === 0 &&
            selectedClassEnrollments.inactive.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded-xl border-[#E0E4EA]">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-[#6C757D]">
                  Nenhum aluno matriculado nesta turma ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bloco 1: alunos ativos (inclui "Isento" — mensalidade congelada) */}
                <div>
                  {selectedClassEnrollments.active.length === 0 ? (
                    <p className="text-xs text-[#6C757D] italic px-3 py-3 border border-dashed rounded-xl border-[#E0E4EA]">
                      Nenhum aluno ativo matriculado nesta turma.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#E0E4EA] border border-[#E0E4EA] rounded-xl">
                      {selectedClassEnrollments.active.map((enr) => (
                        <ClassEnrollmentRow
                          key={enr.id}
                          enrollment={enr}
                          onOpenStudent={() => navigateToStudent(enr.expand?.student_id?.id)}
                          onRemove={() => handleRemoveEnrollment(enr.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Bloco 2: alunos inativos/trancados, logo abaixo, com contagem */}
                {selectedClassEnrollments.inactive.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-[#1E2A3A] mb-2">
                      Alunos Inativos/Trancados ({selectedClassEnrollments.inactive.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#E0E4EA] border border-[#E0E4EA] rounded-xl bg-slate-50/40">
                      {selectedClassEnrollments.inactive.map((enr) => (
                        <ClassEnrollmentRow
                          key={enr.id}
                          enrollment={enr}
                          onOpenStudent={() => navigateToStudent(enr.expand?.student_id?.id)}
                          onRemove={() => handleRemoveEnrollment(enr.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* Add Student To Class Modal */}
      {/* ============================================================== */}
      <Dialog open={addStudentModalOpen} onOpenChange={setAddStudentModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F1B3D]">
              Matricular Aluno
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6C757D]">
              Selecione um aluno da base para vincular à turma {selectedClass?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <Label className="text-xs font-semibold text-[#1E2A3A]">Aluno</Label>
            <Select value={selectedStudentToAdd} onValueChange={setSelectedStudentToAdd}>
              <SelectTrigger className="focus:ring-[#D4AF37] text-xs">
                <SelectValue placeholder="Escolha um aluno" />
              </SelectTrigger>
              <SelectContent>
                {students.map((st) => (
                  <SelectItem key={st.id} value={st.id} className="text-xs">
                    {st.name} ({st.cpf || st.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddStudentModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!selectedStudentToAdd}
              onClick={handleAddStudentToClass}
              className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
            >
              Confirmar Matrícula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* Delete Confirmation Dialog */}
      {/* ============================================================== */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600">Excluir Turma</DialogTitle>
            <DialogDescription className="text-xs text-[#6C757D]">
              Tem certeza de que deseja excluir a turma{' '}
              <strong className="text-[#1E2A3A]">{selectedClass?.name}</strong>? Esta ação removerá
              os vínculos de alunos desta grade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteClass}
              className="font-bold"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir Turma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
