import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard,
  Plus,
  Send,
  Copy,
  Check,
  RotateCcw,
  CheckCircle2,
  Share2,
  Loader2,
  ExternalLink,
  Users,
  Sparkles,
  Calendar,
  Search,
  X,
  UserCheck,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getStudentPhotoUrl, normalizeName } from '@/lib/studentPhoto'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { academyService } from '@/services/academy'
import { useRealtime } from '@/hooks/use-realtime'
import type { ChargeRecord, StudentRecord, PlanRecord } from '@/types/database'
import { useToast } from '@/hooks/use-toast'
import { calculateStudentCharge, getFamilyStudents } from '@/lib/familyRules'

export default function Charges() {
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const [charges, setCharges] = useState<ChargeRecord[]>([])
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Status Tabs
  const [statusTab, setStatusTab] = useState<'em_aberto' | 'paga' | 'vencida' | 'cancelada'>(
    'em_aberto',
  )

  // Confetti effect trigger
  const [showConfetti, setShowConfetti] = useState(false)

  // Modal State
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [formStudentId, setFormStudentId] = useState('')
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [formDescription, setFormDescription] = useState('Mensalidade de Natação')
  const [formAmount, setFormAmount] = useState('110')
  const [formDiscountAmount, setFormDiscountAmount] = useState('0')
  const [formDueDate, setFormDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return d.toISOString().substring(0, 10)
  })
  const [formMethod, setFormMethod] = useState<'pix' | 'cartao' | 'boleto'>('pix')
  const [isFamilyCharge, setIsFamilyCharge] = useState(false)
  const [generateInfinitepayLink, setGenerateInfinitepayLink] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Liquidate modal state (para escolher data de pagamento e checar desconto em dia)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedChargeToPay, setSelectedChargeToPay] = useState<ChargeRecord | null>(null)
  const [payDate, setPayDate] = useState(() => new Date().toISOString().substring(0, 10))
  const [liquidating, setLiquidating] = useState(false)

  const loadData = async () => {
    try {
      const [cData, sData, pData] = await Promise.all([
        academyService.getCharges(),
        academyService.getStudents(),
        academyService.getPlans(),
      ])
      setCharges(cData)
      setStudents(sData)
      setPlans(pData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Real-time synchronization for instant status changes
  useRealtime<ChargeRecord>('charges', (data) => {
    loadData()
    if (data.action === 'update' && data.record.status === 'paga') {
      triggerConfetti()
      toast({
        title: 'Pagamento Infinitepay Confirmado!',
        description: `A cobrança "${data.record.description}" foi liquidada com sucesso.`,
      })
    }
  })

  // Pre-fill from query params (e.g. from student detail or dashboard shortcut)
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      const alunoParam = searchParams.get('aluno')
      const valorParam = searchParams.get('valor')
      if (alunoParam) setFormStudentId(alunoParam)
      if (valorParam) setFormAmount(valorParam)
      setNewModalOpen(true)
    }
  }, [searchParams])

  const triggerConfetti = () => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 2500)
  }

  // Auto-fill amount when student changes
  const handleStudentChange = (stId: string) => {
    setFormStudentId(stId)
    setStudentSearchQuery('')
    const st = students.find((s) => s.id === stId)
    if (st) {
      const calc = calculateStudentCharge(st, plans, students)
      const pl = plans.find((p) => p.id === st.plan_id)
      setFormAmount(String(calc.baseAmount))
      setFormDiscountAmount(String(calc.discountAmount))
      setIsFamilyCharge(calc.isFamilyPlan)
      setFormDescription(
        `Mensalidade — ${pl?.name || (calc.isFamilyPlan ? 'Família' : 'Integral')}`,
      )
    }
  }

  // Clear selected student in new charge modal
  const handleClearSelectedStudent = () => {
    setFormStudentId('')
    setStudentSearchQuery('')
    setIsFamilyCharge(false)
    setFormDiscountAmount('0')
  }

  // Filter students for modal search
  const filteredModalStudents = useMemo(() => {
    const raw = studentSearchQuery.trim()
    if (!raw) return students.slice(0, 10)
    const norm = normalizeName(raw)
    const rawLower = raw.toLowerCase()
    return students
      .filter((s) => {
        const normName = normalizeName(s.name)
        const matchName = normName.includes(norm)
        const matchCpf = s.cpf ? s.cpf.replace(/\D/g, '').includes(raw.replace(/\D/g, '')) : false
        const matchEmail = s.email ? s.email.toLowerCase().includes(rawLower) : false
        const matchGuardian = s.guardian_name
          ? normalizeName(s.guardian_name).includes(norm)
          : false
        return matchName || matchCpf || matchEmail || matchGuardian
      })
      .slice(0, 8)
  }, [students, studentSearchQuery])

  // Selected student object for modal display
  const selectedModalStudent = useMemo(() => {
    return students.find((s) => s.id === formStudentId) || null
  }, [students, formStudentId])

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formStudentId || !formDescription || !formAmount || !formDueDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os dados da cobrança.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const created = await academyService.createCharge({
        student_id: formStudentId,
        description: formDescription,
        amount: Number(formAmount),
        discount_amount: Number(formDiscountAmount) || 0,
        due_date: `${formDueDate} 00:00:00.000Z`,
        status: 'em_aberto',
        payment_method: formMethod,
        generateInfinitepay: generateInfinitepayLink,
      })

      toast({
        title: 'Cobrança Gerada com Sucesso!',
        description: generateInfinitepayLink
          ? `Link InfinitePay integrado pronto para pagamento (${created.infinipay_payment_id || 'ativo'}).`
          : 'Cobrança cadastrada com sucesso.',
      })
      setNewModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao emitir cobrança'
      toast({
        title: 'Erro ao emitir cobrança',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenPayModal = (charge: ChargeRecord) => {
    setSelectedChargeToPay(charge)
    setPayDate(new Date().toISOString().substring(0, 10))
    setPayModalOpen(true)
  }

  const handleConfirmPayment = async () => {
    if (!selectedChargeToPay) return
    setLiquidating(true)
    try {
      const isoPaidDate = `${payDate}T12:00:00.000Z`
      await academyService.updateChargeStatus(selectedChargeToPay.id, 'paga', isoPaidDate)
      triggerConfetti()
      toast({
        title: 'Cobrança Liquidada!',
        description: 'Pagamento confirmado e registrado no histórico.',
      })
      setPayModalOpen(false)
      setSelectedChargeToPay(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao liquidar cobrança', variant: 'destructive' })
    } finally {
      setLiquidating(false)
    }
  }

  const handleMarkAsPaid = async (chargeId: string) => {
    const ch = charges.find((c) => c.id === chargeId)
    if (ch) {
      handleOpenPayModal(ch)
      return
    }
    try {
      await academyService.updateChargeStatus(chargeId, 'paga')
      triggerConfetti()
      toast({
        title: 'Cobrança Liquidada!',
        description: 'Pagamento confirmado e saldo adicionado ao fluxo de caixa.',
      })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao liquidar cobrança', variant: 'destructive' })
    }
  }

  const handleCancelCharge = async (chargeId: string) => {
    try {
      await academyService.updateChargeStatus(chargeId, 'cancelada')
      toast({ title: 'Cobrança cancelada' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao cancelar cobrança', variant: 'destructive' })
    }
  }

  const handleRefund = async (chargeId: string) => {
    try {
      await academyService.refundCharge(chargeId)
      toast({
        title: 'Estorno Infinitepay Solicitado',
        description: 'A cobrança foi estornada com sucesso.',
      })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Falha ao solicitar estorno', variant: 'destructive' })
    }
  }

  const handleCopyLink = (link?: string, id?: string) => {
    if (!link) return
    navigator.clipboard.writeText(link)
    if (id) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
    toast({ title: 'Link de pagamento copiado para a área de transferência!' })
  }

  const handleSendWhatsApp = (charge: ChargeRecord) => {
    const student = students.find((s) => s.id === charge.student_id)
    const phone = student?.phone ? student.phone.replace(/\D/g, '') : ''
    const studentName = student?.name || 'Prezado(a)'
    const dueFormatted = new Date(charge.due_date).toLocaleDateString('pt-BR')
    const link =
      charge.payment_link || `https://pay.infinitepay.io/link/${charge.infinipay_payment_id}`

    const message = encodeURIComponent(
      `Olá, ${studentName}! Aqui é da Academia Aquática. 🏊‍♂️\n\n` +
        `Sua fatura referente a "${charge.description}" no valor de R$ ${charge.amount.toFixed(2)} com vencimento em ${dueFormatted} já está disponível.\n\n` +
        `Pague com PIX ou Cartão pelo link Infinitepay com segurança e aprovação instantânea:\n${link}\n\n` +
        `Qualquer dúvida estamos à disposição!`,
    )

    const whatsappUrl = phone
      ? `https://api.whatsapp.com/send?phone=55${phone}&text=${message}`
      : `https://api.whatsapp.com/send?text=${message}`

    window.open(whatsappUrl, '_blank')
  }

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => c.status === statusTab)
  }, [charges, statusTab])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#0F1B3D] animate-spin" />
        <span className="text-sm text-[#6C757D]">Carregando faturas e cobranças...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Subtle Confetti Animation on Success */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
          <div className="flex gap-2 animate-bounce">
            <span className="text-4xl">🎉</span>
            <span className="text-4xl">✨</span>
            <span className="text-4xl">🏊</span>
            <span className="text-4xl">💳</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0F1B3D]">Gestão de Cobranças</h2>
          <p className="text-xs text-[#6C757D]">
            Emissão de faturas, links de pagamento Infinitepay e notificações por WhatsApp
          </p>
        </div>

        <Button
          onClick={() => {
            setFormStudentId('')
            setStudentSearchQuery('')
            setNewModalOpen(true)
          }}
          className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold shadow-md text-xs h-10 px-4 rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Cobrança
        </Button>
      </div>

      {/* Infinitepay Integration Banner */}
      <div className="bg-gradient-to-r from-[#0F1B3D] via-[#1B2A5B] to-[#17A2B8] rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Cobranças Infinitepay Conectadas
              <Badge className="bg-emerald-500 text-white text-[10px] uppercase font-bold">
                Online
              </Badge>
            </h3>
            <p className="text-xs text-slate-200 mt-0.5">
              Receba via PIX com liquidação instantânea ou Cartão de Crédito com taxas reduzidas.
            </p>
          </div>
        </div>

        <div className="text-right flex items-center gap-3">
          <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-xs">
            <span className="text-slate-300 block text-[10px]">Total de Cobranças</span>
            <span className="font-bold font-mono text-sm">{charges.length} emitidas</span>
          </div>
        </div>
      </div>

      {/* Status Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E0E4EA] pb-3">
        {[
          {
            id: 'em_aberto',
            label: 'Em aberto',
            count: charges.filter((c) => c.status === 'em_aberto').length,
          },
          {
            id: 'pagas',
            label: 'Pagas',
            count: charges.filter((c) => c.status === 'paga').length,
            val: 'paga',
          },
          {
            id: 'vencidas',
            label: 'Vencidas',
            count: charges.filter((c) => c.status === 'vencida').length,
            val: 'vencida',
          },
          {
            id: 'canceladas',
            label: 'Canceladas',
            count: charges.filter((c) => c.status === 'cancelada').length,
            val: 'cancelada',
          },
        ].map((tab) => {
          const tabVal = (tab.val || tab.id) as 'em_aberto' | 'paga' | 'vencida' | 'cancelada'
          const isActive = statusTab === tabVal

          return (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tabVal)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                isActive
                  ? 'bg-[#0F1B3D] text-white shadow-xs'
                  : 'bg-white text-[#6C757D] hover:bg-slate-100 border border-[#E0E4EA]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive ? 'bg-[#D4AF37] text-[#0F1B3D]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Charges Cards List */}
      <div className="space-y-3">
        {filteredCharges.length === 0 ? (
          <Card className="bg-white border-[#E0E4EA] rounded-xl p-10 text-center text-[#6C757D]">
            <p className="text-sm">
              Nenhuma cobrança nesta categoria ({statusTab.replace('_', ' ')}).
            </p>
          </Card>
        ) : (
          filteredCharges.map((charge) => {
            const student = students.find((s) => s.id === charge.student_id)
            const dueDate = new Date(charge.due_date)
            const link =
              charge.payment_link ||
              `https://pay.infinitepay.io/link/${charge.infinipay_payment_id}`

            return (
              <Card
                key={charge.id}
                className="bg-white border-[#E0E4EA] hover:border-[#D4AF37] transition-all rounded-xl shadow-xs overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-[#0F1B3D] text-base">
                        {student?.name || 'Aluno'}
                      </span>
                      <Badge
                        className={
                          charge.status === 'paga'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : charge.status === 'vencida'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : charge.status === 'em_aberto'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                        }
                      >
                        {charge.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase text-slate-500">
                        {charge.payment_method || 'PIX'}
                      </Badge>
                      {charge.discount_amount && charge.discount_amount > 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-700" />
                          Desconto Família -R$ {charge.discount_amount.toFixed(2)}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-xs text-[#1E2A3A] font-medium">{charge.description}</p>
                    <p className="text-[11px] text-[#6C757D]">
                      Vencimento: <strong>{dueDate.toLocaleDateString('pt-BR')}</strong> • ID
                      Infinitepay:{' '}
                      <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">
                        {charge.infinipay_payment_id || 'inf_demo'}
                      </code>
                      {student?.guardian_name && (
                        <span className="ml-2 inline-flex items-center gap-1 text-slate-600">
                          <Users className="w-3 h-3 text-[#17A2B8]" /> Resp: {student.guardian_name}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Middle: Amount */}
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-[#6C757D] uppercase font-bold block">
                      Valor
                    </span>
                    <span className="text-xl font-black font-mono text-[#0F1B3D]">
                      R$ {charge.amount.toFixed(2)}
                    </span>
                    {charge.discount_amount && charge.discount_amount > 0 ? (
                      <span className="text-[10px] text-emerald-600 font-semibold block">
                        R$ {(charge.amount - charge.discount_amount).toFixed(2)} se pago até o
                        vencimento
                      </span>
                    ) : null}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendWhatsApp(charge)}
                      className="h-8 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-lg flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" /> WhatsApp
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyLink(link, charge.id)}
                      className="h-8 text-xs font-semibold border-[#E0E4EA] text-[#0F1B3D] hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
                    >
                      {copiedId === charge.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar Link
                        </>
                      )}
                    </Button>

                    {charge.status !== 'paga' && charge.status !== 'cancelada' && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsPaid(charge.id)}
                        className="h-8 text-xs font-bold bg-[#17A2B8] hover:bg-[#138496] text-white rounded-lg flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pagar Agora
                      </Button>
                    )}

                    {/* Context menu for refunds and cancellation */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <span className="text-slate-400 font-bold">•••</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => window.open(link, '_blank')}>
                          <ExternalLink className="w-3.5 h-3.5 mr-2" /> Abrir Checkout Infinitepay
                        </DropdownMenuItem>

                        {charge.status === 'paga' && (
                          <DropdownMenuItem
                            onClick={() => handleRefund(charge.id)}
                            className="text-amber-600"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Estornar via Infinitepay
                          </DropdownMenuItem>
                        )}

                        {charge.status !== 'cancelada' && charge.status !== 'paga' && (
                          <DropdownMenuItem
                            onClick={() => handleCancelCharge(charge.id)}
                            className="text-red-600"
                          >
                            Cancelar Cobrança
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* ============================================================== */}
      {/* New Charge Modal */}
      {/* ============================================================== */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl">
          <form onSubmit={handleCreateCharge}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F1B3D]">
                Emitir Nova Cobrança
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6C757D]">
                Gere um link de pagamento Instantâneo com tecnologia Infinitepay.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-[#1E2A3A]">
                    Aluno <span className="text-red-500">*</span>
                  </Label>
                  {selectedModalStudent && (
                    <button
                      type="button"
                      onClick={handleClearSelectedStudent}
                      className="text-[11px] text-[#17A2B8] hover:text-[#0F1B3D] font-medium flex items-center gap-1 transition"
                    >
                      <RotateCcw className="w-3 h-3" /> Trocar aluno
                    </button>
                  )}
                </div>

                {selectedModalStudent ? (
                  /* Card do aluno selecionado com opção de limpar */
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-9 h-9 border border-slate-200 bg-white shrink-0">
                        {getStudentPhotoUrl(selectedModalStudent) ? (
                          <AvatarImage
                            src={getStudentPhotoUrl(selectedModalStudent)!}
                            alt={selectedModalStudent.name}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="text-[11px] bg-[#0F1B3D] text-white font-bold">
                          {selectedModalStudent.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-[#0F1B3D] truncate">
                            {selectedModalStudent.name}
                          </p>
                          <Badge
                            className={`text-[9px] px-1.5 py-0 ${
                              selectedModalStudent.status === 'ativo'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}
                          >
                            {selectedModalStudent.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {selectedModalStudent.cpf ? `CPF: ${selectedModalStudent.cpf}` : ''}
                          {selectedModalStudent.cpf && selectedModalStudent.email ? ' • ' : ''}
                          {selectedModalStudent.email || ''}
                          {selectedModalStudent.guardian_name
                            ? ` • Resp: ${selectedModalStudent.guardian_name}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearSelectedStudent}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition shrink-0 ml-2"
                      title="Remover e buscar outro aluno"
                      aria-label="Remover e buscar outro aluno"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Campo de busca por nome com sugestões em tempo real */
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="text"
                        autoFocus
                        placeholder="Buscar aluno por nome..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="pl-9 pr-8 bg-[#F5F7FA] border-[#E0E4EA] text-xs h-9 rounded-xl focus-visible:ring-[#D4AF37]"
                      />
                      {studentSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setStudentSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          aria-label="Limpar busca"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Lista de sugestões filtradas */}
                    <div className="border border-slate-200 rounded-xl bg-white max-h-48 overflow-y-auto divide-y divide-slate-100 shadow-inner">
                      {filteredModalStudents.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          Nenhum aluno encontrado para "{studentSearchQuery}".
                        </div>
                      ) : (
                        filteredModalStudents.map((st) => {
                          const photoUrl = getStudentPhotoUrl(st)
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => handleStudentChange(st.id)}
                              className="w-full text-left px-3 py-2 hover:bg-[#F5F7FA] flex items-center justify-between gap-2 transition group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar className="w-7 h-7 bg-slate-100 shrink-0">
                                  {photoUrl ? (
                                    <AvatarImage
                                      src={photoUrl}
                                      alt={st.name}
                                      className="object-cover"
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-[10px] bg-[#0F1B3D] text-white">
                                    {st.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-[#1E2A3A] group-hover:text-[#0F1B3D] truncate">
                                    {st.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {st.cpf ? `CPF: ${st.cpf}` : st.email || 'Sem CPF/E-mail'}
                                    {st.guardian_name ? ` • Resp: ${st.guardian_name}` : ''}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold text-[#17A2B8] opacity-0 group-hover:opacity-100 transition shrink-0">
                                Selecionar
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Descrição da Fatura</Label>
                <Input
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: Mensalidade - Outubro/2025"
                  className="focus-visible:ring-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Valor Cheio (R$)</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Vencimento</Label>
                  <Input
                    required
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Desconto Família */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1B3D]">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Desconto Família (R$ 10,00 por aluno até o vencimento)</span>
                  </div>
                  {isFamilyCharge && (
                    <Badge className="bg-emerald-600 text-white text-[10px]">Identificado</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                      Desconto em Dia (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formDiscountAmount}
                      onChange={(e) => setFormDiscountAmount(e.target.value)}
                      className="h-8 text-xs focus-visible:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="flex flex-col justify-end text-xs">
                    <span className="text-[10px] text-slate-500">Valor com desconto em dia:</span>
                    <span className="font-bold font-mono text-emerald-700 text-sm">
                      R${' '}
                      {Math.max(
                        0,
                        (Number(formAmount) || 0) - (Number(formDiscountAmount) || 0),
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">
                  Forma de Cobrança Preferencial
                </Label>
                <Select
                  value={formMethod}
                  onValueChange={(v) => setFormMethod(v as 'pix' | 'cartao' | 'boleto')}
                >
                  <SelectTrigger className="focus:ring-[#D4AF37]">
                    <SelectValue placeholder="Selecione o método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX Dinâmico (QR Code &amp; Copia e Cola)</SelectItem>
                    <SelectItem value="cartao">Cartão de Crédito Online</SelectItem>
                    <SelectItem value="boleto">Boleto Bancário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-200 rounded-xl mt-2">
                <input
                  type="checkbox"
                  id="chkInfinitepay"
                  checked={generateInfinitepayLink}
                  onChange={(e) => setGenerateInfinitepayLink(e.target.checked)}
                  className="rounded text-[#0F1B3D] focus:ring-[#D4AF37]"
                />
                <label
                  htmlFor="chkInfinitepay"
                  className="text-xs text-[#0F1B3D] font-semibold cursor-pointer"
                >
                  Gerar Link de Pagamento Infinitepay para envio direto
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setNewModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
              >
                {submitting ? 'Gerando Link...' : 'Emitir Cobrança'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* Liquidate / Pay Modal (Verifica se pago até o vencimento)      */}
      {/* ============================================================== */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F1B3D]">
              Liquidar Cobrança
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6C757D]">
              Confirme a data de pagamento para verificação das regras de desconto pontual.
            </DialogDescription>
          </DialogHeader>

          {selectedChargeToPay &&
            (() => {
              const dueDay = new Date(selectedChargeToPay.due_date).setHours(23, 59, 59, 999)
              const paidDay = new Date(payDate).setHours(0, 0, 0, 0)
              const isOnTime = paidDay <= dueDay
              const discount = selectedChargeToPay.discount_amount || 0
              const finalPayAmount =
                isOnTime && discount > 0
                  ? Math.max(0, selectedChargeToPay.amount - discount)
                  : selectedChargeToPay.amount

              return (
                <div className="space-y-3 py-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                    <p className="font-bold text-[#0F1B3D] text-sm">
                      {selectedChargeToPay.description}
                    </p>
                    <p className="text-slate-600">
                      Vencimento:{' '}
                      <strong>
                        {new Date(selectedChargeToPay.due_date).toLocaleDateString('pt-BR')}
                      </strong>
                    </p>
                    <p className="text-slate-600 font-mono">
                      Valor nominal: <strong>R$ {selectedChargeToPay.amount.toFixed(2)}</strong>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="font-semibold text-[#1E2A3A]">Data do Pagamento</Label>
                    <Input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="focus-visible:ring-[#D4AF37]"
                    />
                  </div>

                  {discount > 0 && (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        isOnTime
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {isOnTime ? (
                        <p className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Pago até o vencimento: Desconto Família de -R$ {discount.toFixed(2)}{' '}
                            aplicado!
                          </span>
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 font-semibold">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Pago após o vencimento: Desconto pontual não aplicável (valor cheio
                            cobrado).
                          </span>
                        </p>
                      )}
                      <p className="mt-1 font-mono font-bold text-sm">
                        Valor a liquidar: R$ {finalPayAmount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPayModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={liquidating}
              onClick={handleConfirmPayment}
              className="bg-[#17A2B8] hover:bg-[#138496] text-white font-bold"
            >
              {liquidating ? 'Confirmando...' : 'Confirmar Liquidação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
