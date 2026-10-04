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
  X,
  Camera,
  Upload,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { academyService } from '@/services/academy'
import type {
  StudentRecord,
  PlanRecord,
  PaymentRecord,
  EnrollmentRecord,
  ClassRecord,
} from '@/types/database'
import { useToast } from '@/hooks/use-toast'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [student, setStudent] = useState<StudentRecord | null>(null)
  const [plan, setPlan] = useState<PlanRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    if (!id) return
    try {
      const [sData, pList, payList, enrList, clsList] = await Promise.all([
        academyService.getStudent(id),
        academyService.getPlans(),
        academyService.getPayments(),
        academyService.getEnrollments(),
        academyService.getClasses(),
      ])
      setStudent(sData)
      setPlan(pList.find((p) => p.id === sData.plan_id) || null)
      setPayments(payList.filter((pay) => pay.student_id === id))
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

  const getStatusBadge = (status: PaymentRecord['status']) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Pago</Badge>
      case 'pendente':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>
      case 'vencido':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold">Vencido</Badge>
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
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/alunos')}
          className="text-xs font-semibold text-[#6C757D] hover:text-[#0F1B3D]"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar para Alunos
        </Button>

        <Button
          onClick={() =>
            navigate(`/cobrancas?novo=1&aluno=${student.id}&valor=${plan?.monthly_price || 160}`)
          }
          className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9 rounded-xl flex items-center gap-1.5 shadow-sm"
        >
          <CreditCard className="w-4 h-4" /> Emitir Cobrança Infinitepay
        </Button>
      </div>

      {/* Header Profile Card */}
      <Card className="bg-white border-[#E0E4EA] rounded-2xl shadow-xs overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#0F1B3D] via-[#1B2A5B] to-[#17A2B8]" />
        <CardContent className="relative px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 mb-4">
            <div className="flex items-end gap-4">
              <div className="relative group">
                <Avatar className="w-24 h-24 border-4 border-white shadow-lg bg-slate-100">
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

                {/* Botão de Trocar Foto Sobreposto */}
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
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer border-4 border-transparent"
                  title="Trocar foto do aluno"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[10px] font-bold">Trocar foto</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mb-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-[#0F1B3D]">{student.name}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#17A2B8]" />
                    {uploadingPhoto ? 'Enviando...' : 'Trocar foto'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={
                      student.status === 'ativo'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]'
                        : 'bg-slate-100 text-slate-500 border-slate-200 text-[10px]'
                    }
                  >
                    {student.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {student.raw_situation && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-slate-50 text-slate-700 border-slate-300"
                    >
                      Situação: {student.raw_situation}
                    </Badge>
                  )}
                  {student.fee_suspended && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-300"
                    >
                      Mensalidade Trancada
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[#6C757D] font-medium mt-0.5">
                  {student.discounted_fee ? (
                    <>
                      Mensalidade com Desconto:{' '}
                      <strong className="text-emerald-700 font-bold">
                        R$ {student.discounted_fee.toFixed(2)}
                      </strong>{' '}
                      {student.monthly_fee && student.monthly_fee > student.discounted_fee && (
                        <span className="line-through text-slate-400 text-[11px] ml-1">
                          (R$ {student.monthly_fee.toFixed(2)})
                        </span>
                      )}
                      {student.due_day ? ` • Vencimento dia ${student.due_day}` : ''}
                    </>
                  ) : (
                    <>
                      Plano Vigente:{' '}
                      <strong className="text-[#0F1B3D]">{plan?.name || 'Padrão'}</strong> (R${' '}
                      {(plan?.monthly_price || 160).toFixed(2)}/mês)
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs text-[#6C757D]">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#17A2B8]" />
              <span>{student.email || student.guardian_email || 'E-mail não cadastrado'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#17A2B8]" />
              <span>
                {student.whatsapp || student.phone || student.guardian_phone || 'Sem telefone'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#17A2B8]" />
              <span>CPF: {student.cpf || student.guardian_cpf || 'Não informado'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="bg-white border border-[#E0E4EA] p-1 rounded-xl mb-6">
          <TabsTrigger
            value="geral"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="pagamentos"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
          >
            Histórico Financeiro ({payments.length})
          </TabsTrigger>
          <TabsTrigger
            value="turmas"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
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
        {/* TAB 2: PAGAMENTOS */}
        {/* ============================================================ */}
        <TabsContent value="pagamentos" className="space-y-4">
          <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F5F7FA] text-[#6C757D] uppercase font-semibold text-[10px] border-b border-[#E0E4EA]">
                  <tr>
                    <th className="px-5 py-3">Vencimento</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Data de Pagamento</th>
                    <th className="px-4 py-3 text-right">Infinitepay Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E4EA]">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#6C757D]">
                        Nenhum pagamento registrado para este aluno.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5 font-medium text-[#1E2A3A]">
                          {new Date(p.due_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-[#0F1B3D]">
                          <div>
                            <span>R$ {p.amount.toFixed(2)}</span>
                            {p.discount_amount && p.discount_amount > 0 ? (
                              <Badge className="ml-2 bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[9px] inline-flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-700" />
                                Desconto família -R$ {p.discount_amount.toFixed(2)}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 uppercase text-slate-500 font-semibold text-[10px]">
                          {p.payment_method || 'PIX'}
                        </td>
                        <td className="px-4 py-3.5">{getStatusBadge(p.status)}</td>
                        <td className="px-4 py-3.5 text-[#6C757D]">
                          {p.paid_date ? new Date(p.paid_date).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {p.payment_link ? (
                            <a
                              href={p.payment_link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-[#17A2B8] hover:underline"
                            >
                              Abrir link
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
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
    </div>
  )
}
