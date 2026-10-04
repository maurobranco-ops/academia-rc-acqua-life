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
} from 'lucide-react'
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
  const [formDescription, setFormDescription] = useState('Mensalidade de Natação / Hidroginástica')
  const [formAmount, setFormAmount] = useState('160')
  const [formDueDate, setFormDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return d.toISOString().substring(0, 10)
  })
  const [formMethod, setFormMethod] = useState<'pix' | 'cartao' | 'boleto'>('pix')
  const [generateInfinitepayLink, setGenerateInfinitepayLink] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
    const st = students.find((s) => s.id === stId)
    if (st) {
      const pl = plans.find((p) => p.id === st.plan_id)
      if (pl) {
        setFormAmount(String(pl.monthly_price))
        setFormDescription(`Mensalidade — ${pl.name}`)
      }
    }
  }

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
      await academyService.createCharge({
        student_id: formStudentId,
        description: formDescription,
        amount: Number(formAmount),
        due_date: `${formDueDate} 00:00:00.000Z`,
        status: 'em_aberto',
        payment_method: formMethod,
        generateInfinitepay: generateInfinitepayLink,
      })

      toast({
        title: 'Cobrança Gerada!',
        description: 'Link Infinitepay criado com sucesso.',
      })
      setNewModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao emitir cobrança'
      toast({ title: 'Erro ao emitir cobrança', description: msg, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkAsPaid = async (chargeId: string) => {
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
            setFormStudentId(students[0]?.id || '')
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
                    <div className="flex items-center gap-2.5">
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
                    </div>

                    <p className="text-xs text-[#1E2A3A] font-medium">{charge.description}</p>
                    <p className="text-[11px] text-[#6C757D]">
                      Vencimento: <strong>{dueDate.toLocaleDateString('pt-BR')}</strong> • ID
                      Infinitepay:{' '}
                      <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">
                        {charge.infinipay_payment_id || 'inf_demo'}
                      </code>
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
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Aluno</Label>
                <Select value={formStudentId} onValueChange={handleStudentChange}>
                  <SelectTrigger className="focus:ring-[#D4AF37]">
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.name} ({st.cpf || st.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Label className="font-semibold text-[#1E2A3A]">Valor (R$)</Label>
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
    </div>
  )
}
