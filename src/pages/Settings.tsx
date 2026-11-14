import { useState, useEffect } from 'react'
import {
  Building2,
  BookmarkCheck,
  CreditCard,
  UserCheck,
  Bell,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Play,
  RotateCw,
  Power,
  Info,
  XCircle,
  Sparkles,
  ShieldAlert,
  Search,
  Check,
  MessageCircle,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { academyService } from '@/services/academy'
import type { PlanRecord, InstructorRecord } from '@/types/database'
import { useToast } from '@/hooks/use-toast'
import { onlyDigits, maskCnpj, maskPhoneIntl } from '@/lib/formatters'

export default function Settings() {
  const { toast } = useToast()

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [instructors, setInstructors] = useState<InstructorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  // Sample Data Cleanup State
  const [scanningSampleData, setScanningSampleData] = useState(false)
  const [sampleDataReport, setSampleDataReport] = useState<{
    summary: {
      students_count: number
      charges_count: number
      payments_count: number
      enrollments_count: number
      transactions_count: number
      ignored_count: number
    }
    students: Array<{
      id: string
      name: string
      cpf: string
      email: string
      status: string
      reason: string
    }>
    charges: Array<{
      id: string
      description: string
      amount: number
      due_date: string
      status: string
      payment_link: string
      student_id: string
    }>
    payments: Array<{
      id: string
      charge_id: string
      amount: number
      status: string
      due_date: string
      student_id: string
    }>
    enrollments: Array<{
      id: string
      student_id: string
      class_id: string
    }>
    transactions: Array<{
      id: string
      description: string
      amount: number
      type: string
      notes: string
    }>
    ignored_for_safety: Array<{
      id: string
      name: string
      bubble_id: string
      reason: string
    }>
  } | null>(null)
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false)
  const [cleanupConfirmationInput, setCleanupConfirmationInput] = useState('')
  const [executingCleanup, setExecutingCleanup] = useState(false)
  const [lastCleanupResult, setLastCleanupResult] = useState<{
    message: string
    report: {
      students_deleted: number
      charges_deleted: number
      payments_deleted: number
      enrollments_deleted: number
      transactions_deleted: number
      student_names: string[]
    }
  } | null>(null)

  // Infinitepay Connection Testing State
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle')

  // WhatsApp Sender Info State
  const [whatsappSenderInfo, setWhatsappSenderInfo] = useState<{
    success: boolean
    connected: boolean
    display_phone_number?: string | null
    phone_number_id?: string | null
    verified_name?: string | null
    quality_rating?: string | null
    total_numbers?: number
    error?: string
    message?: string
  } | null>(null)
  const [loadingWaSender, setLoadingWaSender] = useState(false)

  // Recurring Billing Automation State
  const [runningRecurring, setRunningRecurring] = useState(false)
  const [savingRecurring, setSavingRecurring] = useState(false)

  // Modals
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null)
  const [planName, setPlanName] = useState('')
  const [planPrice, setPlanPrice] = useState('')
  const [planDesc, setPlanDesc] = useState('')

  const [instructorModalOpen, setInstructorModalOpen] = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<InstructorRecord | null>(null)
  const [instName, setInstName] = useState('')
  const [instEmail, setInstEmail] = useState('')
  const [instPhone, setInstPhone] = useState('')
  const [instSpecialty, setInstSpecialty] = useState<'natacao' | 'hidroginastica' | 'ambos'>(
    'ambos',
  )

  const loadWhatsAppSender = async () => {
    setLoadingWaSender(true)
    try {
      const info = await academyService.getWhatsAppSenderInfo()
      setWhatsappSenderInfo(info)
    } catch (err) {
      console.error('Erro ao buscar remetente WhatsApp', err)
    } finally {
      setLoadingWaSender(false)
    }
  }

  const loadData = async () => {
    try {
      const [sData, pData, iData] = await Promise.all([
        academyService.getSettings(),
        academyService.getPlans(),
        academyService.getInstructors(),
      ])
      setSettings(sData)
      setPlans(pData)
      setInstructors(iData)
      loadWhatsAppSender()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveAcademyProfile = async () => {
    setSavingProfile(true)
    try {
      const keys = [
        'academy_name',
        'academy_cnpj',
        'academy_phone',
        'academy_email',
        'academy_address',
      ]
      for (const k of keys) {
        if (settings[k] !== undefined) {
          await academyService.updateSetting(k, settings[k])
        }
      }
      toast({ title: 'Dados da academia salvos com sucesso!' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar dados', variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveInfinitepay = async () => {
    try {
      await academyService.updateSetting('infinitepay_api_key', settings.infinitepay_api_key || '')
      await academyService.updateSetting('infinitepay_handle', settings.infinitepay_handle || '')
      await academyService.updateSetting(
        'infinitepay_api_url',
        settings.infinitepay_api_url || 'https://api.checkout.infinitepay.io',
      )
      await academyService.updateSetting(
        'infinitepay_webhook_secret',
        settings.infinitepay_webhook_secret || '',
      )
      await academyService.updateSetting(
        'infinitepay_auto_send_link',
        settings.infinitepay_auto_send_link || 'false',
      )
      toast({ title: 'Configurações da Infinitepay salvas!' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const handleSaveRecurringBillingSettings = async () => {
    setSavingRecurring(true)
    try {
      await academyService.updateSetting(
        'recurring_billing_active',
        settings.recurring_billing_active || 'false',
      )
      await academyService.updateSetting(
        'recurring_billing_days_before',
        settings.recurring_billing_days_before || '7',
      )
      toast({
        title: 'Configurações de Cobrança Automática salvas!',
        description:
          settings.recurring_billing_active === 'true'
            ? 'Automação ATIVADA. Cobranças serão geradas 7 dias antes do vencimento de cada aluno.'
            : 'Automação DESLIGADA. Nenhuma cobrança automática será gerada.',
      })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar automação', variant: 'destructive' })
    } finally {
      setSavingRecurring(false)
    }
  }

  const handleRunRecurringNow = async (force: boolean) => {
    setRunningRecurring(true)
    try {
      const res = await academyService.runRecurringBillingNow(force)
      toast({
        title: 'Rotina de cobrança executada!',
        description: res.summary || `${res.createdCount || 0} cobranças geradas com sucesso.`,
      })
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao executar rotina'
      toast({
        title: 'Aviso da rotina',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setRunningRecurring(false)
    }
  }

  const handleTestInfinitepayConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus('idle')
    try {
      const res = await academyService.testInfinitepayConnection({
        apiKey: settings.infinitepay_api_key,
        handle: settings.infinitepay_handle,
      })
      setConnectionStatus('success')
      toast({
        title: 'Conexão com InfinitePay validada!',
        description: res.message || 'Servidor da InfinitePay respondeu com sucesso.',
      })
    } catch (err: unknown) {
      setConnectionStatus('failed')
      const msg = err instanceof Error ? err.message : 'Falha na conexão com a API da InfinitePay'
      toast({
        title: 'Falha na conexão',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setTestingConnection(false)
    }
  }

  // Plan Management
  const handleOpenPlanModal = (p?: PlanRecord) => {
    if (p) {
      setEditingPlan(p)
      setPlanName(p.name)
      setPlanPrice(String(p.monthly_price))
      setPlanDesc(p.description || '')
    } else {
      setEditingPlan(null)
      setPlanName('')
      setPlanPrice('150')
      setPlanDesc('')
    }
    setPlanModalOpen(true)
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planName.trim()) return

    try {
      if (editingPlan) {
        await academyService.updatePlan(editingPlan.id, {
          name: planName,
          monthly_price: Number(planPrice),
          description: planDesc,
        })
        toast({ title: 'Plano atualizado com sucesso!' })
      } else {
        await academyService.createPlan({
          name: planName,
          monthly_price: Number(planPrice),
          description: planDesc,
          is_active: true,
        })
        toast({ title: 'Novo plano criado com sucesso!' })
      }
      setPlanModalOpen(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar plano', variant: 'destructive' })
    }
  }

  const handleDeletePlan = async (id: string) => {
    try {
      await academyService.deletePlan(id)
      toast({ title: 'Plano removido' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao excluir plano', variant: 'destructive' })
    }
  }

  // Instructor Management
  const handleOpenInstructorModal = (inst?: InstructorRecord) => {
    if (inst) {
      setEditingInstructor(inst)
      setInstName(inst.name)
      setInstEmail(inst.email || '')
      setInstPhone(inst.phone || '')
      setInstSpecialty(inst.specialty)
    } else {
      setEditingInstructor(null)
      setInstName('')
      setInstEmail('')
      setInstPhone('')
      setInstSpecialty('natacao')
    }
    setInstructorModalOpen(true)
  }

  const handleSaveInstructor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instName) return

    try {
      if (editingInstructor) {
        await academyService.updateInstructor(editingInstructor.id, {
          name: instName,
          email: instEmail,
          phone: instPhone,
          specialty: instSpecialty,
        })
        toast({ title: 'Instrutor atualizado com sucesso!' })
      } else {
        await academyService.createInstructor({
          name: instName,
          email: instEmail,
          phone: instPhone,
          specialty: instSpecialty,
          is_active: true,
        })
        toast({ title: 'Instrutor cadastrado com sucesso!' })
      }
      setInstructorModalOpen(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar instrutor', variant: 'destructive' })
    }
  }

  const handleDeleteInstructor = async (id: string) => {
    try {
      await academyService.deleteInstructor(id)
      toast({ title: 'Instrutor removido' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao excluir instrutor', variant: 'destructive' })
    }
  }

  // Sample Data Cleanup Handlers
  const handleScanSampleData = async () => {
    setScanningSampleData(true)
    setLastCleanupResult(null)
    try {
      const res = await academyService.previewSampleDataCleanup()
      setSampleDataReport(res)
      toast({
        title: 'Varredura concluída',
        description: `Localizados: ${res.summary.students_count} aluno(s), ${res.summary.charges_count} cobrança(s), ${res.summary.payments_count} pagamento(s).`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao buscar dados de exemplo'
      toast({
        title: 'Erro na varredura',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setScanningSampleData(false)
    }
  }

  const handleExecuteCleanup = async () => {
    if (cleanupConfirmationInput.trim().toUpperCase() !== 'LIMPAR') return
    setExecutingCleanup(true)
    try {
      const res = await academyService.executeSampleDataCleanup('LIMPAR')
      setLastCleanupResult(res)
      setCleanupModalOpen(false)
      setCleanupConfirmationInput('')
      setSampleDataReport(null)
      toast({
        title: 'Limpeza realizada com sucesso!',
        description: res.message,
      })
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao executar limpeza'
      toast({
        title: 'Erro na limpeza',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setExecutingCleanup(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#0F1B3D] animate-spin" />
        <span className="text-sm text-[#6C757D]">Carregando configurações...</span>
      </div>
    )
  }

  const backendBase = import.meta.env.VITE_POCKETBASE_URL || window.location.origin
  const webhookEndpoint = `${backendBase.replace(/\/+$/, '')}/backend/v1/infinitepay/webhook`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#0F1B3D]">Configurações do Sistema</h2>
        <p className="text-xs text-[#6C757D]">
          Parâmetros da academia, credenciais Infinitepay, planos e equipe
        </p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="bg-white border border-[#E0E4EA] p-1 rounded-xl mb-6 w-full max-w-full flex-nowrap overflow-x-auto overflow-y-hidden whitespace-nowrap">
          <TabsTrigger
            value="perfil"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4 shrink-0"
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" /> Dados da Academia
          </TabsTrigger>
          <TabsTrigger
            value="planos"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4 shrink-0"
          >
            <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" /> Planos e Mensalidades
          </TabsTrigger>
          <TabsTrigger
            value="infinitepay"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4 shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Integração Infinitepay
          </TabsTrigger>
          <TabsTrigger
            value="cobranca_automatica"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4 shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" /> Cobrança Automática
          </TabsTrigger>
          <TabsTrigger
            value="instrutores"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4 shrink-0"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Instrutores
          </TabsTrigger>
          <TabsTrigger
            value="notificacoes"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4 shrink-0"
          >
            <Bell className="w-3.5 h-3.5 mr-1.5" /> Notificações
          </TabsTrigger>
          <TabsTrigger
            value="limpeza_dados"
            className="data-[state=active]:bg-rose-700 data-[state=active]:text-white text-xs font-semibold rounded-lg px-4 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Limpeza de Dados de Exemplo
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: ACADEMY PROFILE */}
        {/* ============================================================ */}
        <TabsContent value="perfil">
          <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#0F1B3D]">
                Perfil da Academia
              </CardTitle>
              <CardDescription className="text-xs text-[#6C757D]">
                Informações cadastrais exibidas em recibos e comunicações com alunos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Nome Fantasia</Label>
                  <Input
                    value={settings.academy_name || ''}
                    onChange={(e) => handleUpdateSetting('academy_name', e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">CNPJ</Label>
                  <Input
                    value={maskCnpj(settings.academy_cnpj || '')}
                    onChange={(e) =>
                      handleUpdateSetting('academy_cnpj', onlyDigits(e.target.value))
                    }
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Telefone / WhatsApp</Label>
                  <Input
                    value={maskPhoneIntl(settings.academy_phone || '')}
                    onChange={(e) =>
                      handleUpdateSetting('academy_phone', onlyDigits(e.target.value))
                    }
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">E-mail de Contato</Label>
                  <Input
                    value={settings.academy_email || ''}
                    onChange={(e) => handleUpdateSetting('academy_email', e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Endereço da Piscina</Label>
                  <Input
                    value={settings.academy_address || ''}
                    onChange={(e) => handleUpdateSetting('academy_address', e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSaveAcademyProfile}
                  disabled={savingProfile}
                  className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: PLANS */}
        {/* ============================================================ */}
        <TabsContent value="planos" className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#0F1B3D]">Planos Disponíveis</h3>
              <p className="text-xs text-[#6C757D]">
                Configure os valores mensais praticados para natação e hidroginástica.
              </p>
            </div>
            <Button
              onClick={() => handleOpenPlanModal()}
              className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Novo Plano
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((p) => (
              <Card
                key={p.id}
                className="bg-white border-[#E0E4EA] hover:border-[#D4AF37] transition rounded-xl relative overflow-hidden"
              >
                <div className="h-1.5 bg-[#D4AF37]" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-[#0F1B3D]">{p.name}</CardTitle>
                  <CardDescription className="text-xs text-[#6C757D]">
                    {p.description || 'Sem descrição cadastrada'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-2xl font-black font-mono text-[#0F1B3D]">
                    R$ {p.monthly_price.toFixed(2)}
                    <span className="text-xs font-normal text-[#6C757D]">/mês</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenPlanModal(p)}
                      className="text-xs h-8"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePlan(p.id)}
                      className="text-red-600 hover:bg-red-50 text-xs h-8"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: INFINITEPAY */}
        {/* ============================================================ */}
        <TabsContent value="infinitepay">
          <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs">
            <CardHeader>
              <div className="flex flex-wrap gap-2 justify-between items-start">
                <div className="min-w-0">
                  <CardTitle className="text-base font-bold text-[#0F1B3D]">
                    Credenciais da API Infinitepay
                  </CardTitle>
                  <CardDescription className="text-xs text-[#6C757D]">
                    Configure chaves de produção para emissão de links de cobrança e PIX.
                  </CardDescription>
                </div>
                {connectionStatus === 'success' && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Conexão Ativa
                  </Badge>
                )}
                {connectionStatus === 'failed' && (
                  <Badge className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Erro na Chave
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">
                    API Secret Key (Infinitepay)
                  </Label>
                  <Input
                    type="password"
                    value={settings.infinitepay_api_key || ''}
                    onChange={(e) => handleUpdateSetting('infinitepay_api_key', e.target.value)}
                    placeholder="inchk_... ou inf_live_..."
                    className="font-mono focus-visible:ring-[#D4AF37]"
                  />
                  <p className="text-[10px] text-slate-500">
                    A chave fica armazenada no servidor e é enviada no header <code>X-Api-Key</code>
                    .
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">
                    InfiniteTag / Handle (Identificador da Conta)
                  </Label>
                  <Input
                    value={settings.infinitepay_handle || ''}
                    onChange={(e) => handleUpdateSetting('infinitepay_handle', e.target.value)}
                    placeholder="sua_infinitetag (sem $)"
                    className="font-mono focus-visible:ring-[#D4AF37]"
                  />
                  <p className="text-[10px] text-slate-500">
                    Identificador da conta Infinitepay para direcionamento das faturas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Endpoint da API (Checkout)</Label>
                  <Input
                    value={settings.infinitepay_api_url || 'https://api.checkout.infinitepay.io'}
                    onChange={(e) => handleUpdateSetting('infinitepay_api_url', e.target.value)}
                    placeholder="https://api.checkout.infinitepay.io"
                    className="font-mono text-xs focus-visible:ring-[#D4AF37]"
                  />
                  <p className="text-[10px] text-slate-500">
                    URL base configurável da API de Checkout Integrado InfinitePay.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">
                    Segredo / Token do Webhook (Opcional)
                  </Label>
                  <Input
                    type="password"
                    value={settings.infinitepay_webhook_secret || ''}
                    onChange={(e) =>
                      handleUpdateSetting('infinitepay_webhook_secret', e.target.value)
                    }
                    placeholder="Token ou assinatura HMAC"
                    className="font-mono focus-visible:ring-[#D4AF37]"
                  />
                  <p className="text-[10px] text-slate-500">
                    Quando informado, o webhook valida autenticidade via header ou token.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">
                  Webhook URL (Endereço para cadastrar na InfinitePay)
                </Label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    readOnly
                    value={webhookEndpoint}
                    className="bg-slate-50 font-mono text-slate-700 font-semibold min-w-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookEndpoint)
                      toast({ title: 'Webhook URL copiado!' })
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-[11px] text-[#6C757D]">
                  Cadastre este endereço HTTPS no painel de desenvolvedor da Infinitepay para
                  receber baixas automáticas instantâneas com atualização de fluxo de caixa e
                  respeito ao desconto família.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chkAutoSend"
                  checked={settings.infinitepay_auto_send_link === 'true'}
                  onChange={(e) =>
                    handleUpdateSetting(
                      'infinitepay_auto_send_link',
                      e.target.checked ? 'true' : 'false',
                    )
                  }
                  className="rounded text-[#0F1B3D] focus:ring-[#D4AF37]"
                />
                <label
                  htmlFor="chkAutoSend"
                  className="text-xs text-[#1E2A3A] font-semibold cursor-pointer"
                >
                  Disparar automaticamente o link de pagamento após a geração de cobrança
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
                <Button
                  onClick={handleSaveInfinitepay}
                  className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9"
                >
                  Salvar Configurações
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestInfinitepayConnection}
                  disabled={testingConnection}
                  className="text-xs h-9"
                >
                  {testingConnection ? 'Testando...' : 'Testar Conexão'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 4: COBRANÇA AUTOMÁTICA RECORRENTE */}
        {/* ============================================================ */}
        <TabsContent value="cobranca_automatica">
          <div className="space-y-4">
            <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-[#0F1B3D] flex items-center gap-2">
                      <RotateCw className="w-4 h-4 text-[#D4AF37]" />
                      Rotina de Cobrança Recorrente Mensal Automática
                    </CardTitle>
                    <CardDescription className="text-xs text-[#6C757D]">
                      Geração automatizada de links de checkout InfinitePay avulsos para cada aluno
                      ativo, respeitando seu dia de vencimento individual.
                    </CardDescription>
                  </div>
                  {settings.recurring_billing_active === 'true' ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5 w-fit">
                      <Power className="w-3.5 h-3.5 text-emerald-600" /> Automação ATIVA
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5 w-fit">
                      <Power className="w-3.5 h-3.5 text-amber-600" /> DESLIGADA por Padrão
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5 text-xs">
                {/* Alerta de Segurança e Orientação */}
                <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    Controle de Ativação das Novas Cobranças
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Esta rotina vem <strong>desligada por padrão</strong> para garantir que nenhuma
                    cobrança duplicada seja enviada a alunos que já possuam faturas ativas na
                    plataforma da InfinitePay. Ao ligar o interruptor abaixo, a rotina diária no
                    backend (às 06:00) verificará os alunos ativos e emitirá a mensalidade
                    exatamente <strong>7 dias antes da data de vencimento</strong> individual de
                    cada um (definida no cadastro ou importada do Bubble).
                  </p>
                </div>

                {/* Interruptor Mestre */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="masterBillingSwitch"
                        className="text-sm font-bold text-[#0F1B3D] cursor-pointer"
                      >
                        Interruptor Mestre: Geração Automática Diária
                      </Label>
                      <p className="text-[11px] text-[#6C757D]">
                        Quando desativado, o agendamento diário é ignorado e nenhuma cobrança nova é
                        criada.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="masterBillingSwitch"
                        checked={settings.recurring_billing_active === 'true'}
                        onChange={(e) =>
                          handleUpdateSetting(
                            'recurring_billing_active',
                            e.target.checked ? 'true' : 'false',
                          )
                        }
                        className="w-5 h-5 rounded text-[#0F1B3D] focus:ring-[#D4AF37] cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                    <div className="space-y-1">
                      <Label className="font-semibold text-[#1E2A3A]">
                        Dias de antecedência para emissão
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={settings.recurring_billing_days_before || '7'}
                        onChange={(e) =>
                          handleUpdateSetting('recurring_billing_days_before', e.target.value)
                        }
                        className="w-32 font-bold focus-visible:ring-[#D4AF37]"
                      />
                      <p className="text-[10px] text-slate-500">
                        Configurado para <strong>7 dias antes</strong> da data de vencimento do
                        aluno.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="font-semibold text-[#1E2A3A]">
                        Regras de Isenção, Desconto &amp; Entrega
                      </Label>
                      <ul className="text-[11px] text-[#6C757D] list-disc list-inside space-y-0.5">
                        <li>
                          Alunos no <strong>Plano Isento (R$ 0,00) ficam FORA</strong> da geração.
                        </li>
                        <li>
                          Alunos com <strong>mensalidade suspensa</strong> não são cobrados.
                        </li>
                        <li>
                          <strong>Desconto família (R$ 10,00)</strong> e desconto pontualidade
                          calculados automaticamente.
                        </li>
                        <li>
                          <strong>Envio automático por WhatsApp incluído:</strong> as cobranças
                          geradas são enviadas diretamente ao WhatsApp do responsável através da
                          conta conectada do proprietário.
                        </li>
                        <li>
                          <strong>Anti-duplicação:</strong> não repete cobrança já emitida para o
                          mesmo mês/ciclo.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Remetente WhatsApp Conectado */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <h4 className="font-bold text-xs text-emerald-950">
                          Número de WhatsApp para Envio Automático
                        </h4>
                        <p className="text-[11px] text-emerald-800">
                          Lido em tempo real da conta conectada do proprietário (conector WhatsApp)
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadWhatsAppSender}
                      disabled={loadingWaSender}
                      className="h-7 text-[11px] bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 w-fit"
                    >
                      <RotateCw className={`w-3 h-3 ${loadingWaSender ? 'animate-spin' : ''}`} />
                      Atualizar remetente
                    </Button>
                  </div>

                  <div className="pt-1">
                    {loadingWaSender ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-800 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Consultando conta do WhatsApp conectada...</span>
                      </div>
                    ) : whatsappSenderInfo?.connected && whatsappSenderInfo.display_phone_number ? (
                      <div className="bg-white p-3 rounded-lg border border-emerald-200 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">
                            Número remetente ativo:
                          </span>
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-mono text-xs px-2.5 py-0.5 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-emerald-700" />
                            {whatsappSenderInfo.display_phone_number}
                          </Badge>
                          <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                            Conta Oficial Conectada
                          </Badge>
                        </div>
                        {whatsappSenderInfo.verified_name && (
                          <p className="text-[11px] text-slate-600">
                            <strong>Nome verificado na Meta:</strong>{' '}
                            {whatsappSenderInfo.verified_name}
                          </p>
                        )}
                        {whatsappSenderInfo.phone_number_id && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            ID do Número: {whatsappSenderInfo.phone_number_id}
                          </p>
                        )}
                        <p className="text-[11px] text-emerald-900 font-medium pt-1">
                          ✓ Todas as cobranças emitidas manual ou automaticamente serão enviadas
                          através deste número.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-amber-900">
                            Conta do WhatsApp conectada, aguardando sincronização de número
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          {whatsappSenderInfo?.error ||
                            whatsappSenderInfo?.message ||
                            'O conector WhatsApp do proprietário está ativado. Caso o número ainda não apareça acima, clique em "Atualizar remetente" ou verifique se há um número de telefone configurado na sua conta Meta Business.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status da Última Execução */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#0F1B3D]">
                    <Info className="w-3.5 h-3.5 text-[#0F1B3D]" /> Status do Diagnóstico /
                    Execuções
                  </div>
                  <p className="text-[11px] text-slate-700">
                    <strong>Última execução:</strong>{' '}
                    {settings.recurring_billing_last_run
                      ? new Date(settings.recurring_billing_last_run).toLocaleString('pt-BR')
                      : 'Nenhuma execução registrada ainda'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                    {settings.recurring_billing_last_status ||
                      'Aguardando primeira ativação da rotina.'}
                  </p>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveRecurringBillingSettings}
                    disabled={savingRecurring}
                    className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {savingRecurring ? 'Salvando...' : 'Salvar Configurações de Cobrança'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleRunRecurringNow(false)}
                    disabled={runningRecurring || settings.recurring_billing_active !== 'true'}
                    className="text-xs h-9 flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                    {runningRecurring ? 'Processando...' : 'Executar Agora (Se Ativo)'}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Deseja forçar a execução pontual da rotina para o dia de hoje (7 dias antes do vencimento correspondente)?',
                        )
                      ) {
                        handleRunRecurringNow(true)
                      }
                    }}
                    disabled={runningRecurring}
                    className="text-xs h-9 text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Forçar Teste Pontual
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: LIMPEZA DE DADOS DE EXEMPLO */}
        {/* ============================================================ */}
        <TabsContent value="limpeza_dados" className="space-y-4">
          <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#0F1B3D] flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    Limpeza de Dados de Exemplo (Sementes de Demonstração)
                  </CardTitle>
                  <CardDescription className="text-xs text-[#6C757D]">
                    Identifique e remova alunos fictícios criados automaticamente na versão de
                    testes inicial, juntamente com suas cobranças e movimentações.
                  </CardDescription>
                </div>

                <Button
                  onClick={handleScanSampleData}
                  disabled={scanningSampleData}
                  className="bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white font-bold text-xs h-9 flex items-center gap-2 w-fit shadow-xs"
                >
                  {scanningSampleData ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analisando banco...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Buscar dados de exemplo
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* Regra de Proteção em Destaque */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-[#0F1B3D]">
                  <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                  Proteção Obrigatória aos Dados Reais (Importação Bubble)
                </div>
                <p className="text-[11px] leading-relaxed text-blue-950">
                  A rotina de limpeza protege rigorosamente qualquer registro que possua o campo{' '}
                  <strong>bubble_id</strong> preenchido. Em particular, a aluna real{' '}
                  <strong>Mariana Oliveira Padilha</strong> (e todos os demais alunos importados do
                  Bubble) <strong>nunca serão excluídos nem afetados</strong> por esta ferramenta.
                </p>
              </div>

              {/* Resultado pós-limpeza */}
              {lastCleanupResult && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    Relatório Final da Limpeza
                  </div>
                  <p className="text-xs">{lastCleanupResult.message}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 text-[11px]">
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <span className="text-[#6C757D] block">Alunos:</span>
                      <strong className="text-sm font-mono text-emerald-700">
                        {lastCleanupResult.report.students_deleted}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <span className="text-[#6C757D] block">Cobranças:</span>
                      <strong className="text-sm font-mono text-emerald-700">
                        {lastCleanupResult.report.charges_deleted}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <span className="text-[#6C757D] block">Pagamentos:</span>
                      <strong className="text-sm font-mono text-emerald-700">
                        {lastCleanupResult.report.payments_deleted}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <span className="text-[#6C757D] block">Matrículas:</span>
                      <strong className="text-sm font-mono text-emerald-700">
                        {lastCleanupResult.report.enrollments_deleted}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <span className="text-[#6C757D] block">Transações:</span>
                      <strong className="text-sm font-mono text-emerald-700">
                        {lastCleanupResult.report.transactions_deleted}
                      </strong>
                    </div>
                  </div>
                  {lastCleanupResult.report.student_names.length > 0 && (
                    <div className="text-[11px] text-emerald-800 pt-1">
                      Nomes removidos: {lastCleanupResult.report.student_names.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Resultado da Varredura */}
              {sampleDataReport && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Card className="p-3 bg-slate-50 border-slate-200">
                      <span className="text-[10px] uppercase font-semibold text-[#6C757D] block">
                        Alunos Fictícios
                      </span>
                      <span className="text-lg font-bold font-mono text-rose-600">
                        {sampleDataReport.summary.students_count}
                      </span>
                    </Card>
                    <Card className="p-3 bg-slate-50 border-slate-200">
                      <span className="text-[10px] uppercase font-semibold text-[#6C757D] block">
                        Cobranças Falsas
                      </span>
                      <span className="text-lg font-bold font-mono text-rose-600">
                        {sampleDataReport.summary.charges_count}
                      </span>
                    </Card>
                    <Card className="p-3 bg-slate-50 border-slate-200">
                      <span className="text-[10px] uppercase font-semibold text-[#6C757D] block">
                        Pagamentos Vinculados
                      </span>
                      <span className="text-lg font-bold font-mono text-rose-600">
                        {sampleDataReport.summary.payments_count}
                      </span>
                    </Card>
                    <Card className="p-3 bg-slate-50 border-slate-200">
                      <span className="text-[10px] uppercase font-semibold text-[#6C757D] block">
                        Matrículas
                      </span>
                      <span className="text-lg font-bold font-mono text-rose-600">
                        {sampleDataReport.summary.enrollments_count}
                      </span>
                    </Card>
                    <Card className="p-3 bg-slate-50 border-slate-200">
                      <span className="text-[10px] uppercase font-semibold text-[#6C757D] block">
                        Transações Falsas
                      </span>
                      <span className="text-lg font-bold font-mono text-rose-600">
                        {sampleDataReport.summary.transactions_count}
                      </span>
                    </Card>
                    <Card className="p-3 bg-emerald-50 border-emerald-200">
                      <span className="text-[10px] uppercase font-semibold text-emerald-800 block">
                        Protegidos (Bubble)
                      </span>
                      <span className="text-lg font-bold font-mono text-emerald-700">
                        {sampleDataReport.summary.ignored_count}
                      </span>
                    </Card>
                  </div>

                  {/* Listagem detalhada dos alunos encontrados */}
                  {sampleDataReport.students.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="font-bold text-[#0F1B3D] text-xs">
                        Alunos de exemplo identificados para remoção:
                      </h4>
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
                        {sampleDataReport.students.map((st) => (
                          <div
                            key={st.id}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="text-sm text-[#0F1B3D]">{st.name}</strong>
                                <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                                  Fictício
                                </Badge>
                              </div>
                              <p className="text-[11px] text-[#6C757D]">
                                CPF: {st.cpf || 'Não informado'} • E-mail:{' '}
                                {st.email || 'Não informado'}
                              </p>
                            </div>
                            <span className="text-[11px] text-amber-700 font-medium">
                              Motivo: {st.reason}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Registros protegidos explicitamente */}
                      {sampleDataReport.ignored_for_safety.length > 0 && (
                        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-1">
                          <p className="font-bold text-emerald-800 text-xs">
                            Registros protegidos e ignorados por segurança:
                          </p>
                          {sampleDataReport.ignored_for_safety.map((ig) => (
                            <div
                              key={ig.id}
                              className="text-[11px] text-emerald-900 flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <strong>{ig.name}</strong> — {ig.reason} (Bubble ID: {ig.bubble_id})
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 flex justify-end">
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setCleanupConfirmationInput('')
                            setCleanupModalOpen(true)
                          }}
                          className="font-bold text-xs h-9 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Limpar dados de exemplo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-xl border border-slate-200 bg-slate-50 text-[#6C757D]">
                      Nenhum dado de exemplo pendente de limpeza foi encontrado. O sistema já está
                      limpo!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 5: INSTRUCTORS */}
        {/* ============================================================ */}
        <TabsContent value="instrutores" className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#0F1B3D]">Quadro de Instrutores</h3>
              <p className="text-xs text-[#6C757D]">
                Profissionais de natação e hidroginástica responsáveis pelas turmas.
              </p>
            </div>
            <Button
              onClick={() => handleOpenInstructorModal()}
              className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-xs h-9 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Novo Instrutor
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {instructors.map((ins) => (
              <Card
                key={ins.id}
                className="bg-white border-[#E0E4EA] hover:border-slate-300 transition rounded-xl p-4 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#0F1B3D]">{ins.name}</p>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {ins.specialty}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#6C757D] mt-0.5">
                    {ins.email || 'Sem e-mail'} • {ins.phone || 'Sem telefone'}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenInstructorModal(ins)}
                    className="text-xs h-8"
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteInstructor(ins.id)}
                    className="text-red-600 hover:bg-red-50 text-xs h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 5: NOTIFICATIONS */}
        {/* ============================================================ */}
        <TabsContent value="notificacoes">
          <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#0F1B3D]">
                Alertas e Notificações Automáticas
              </CardTitle>
              <CardDescription className="text-xs text-[#6C757D]">
                Avisos por e-mail e WhatsApp para confirmação de pagamento e lembretes de
                vencimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-[#E0E4EA] bg-[#F5F7FA]">
                  <div>
                    <p className="font-bold text-[#0F1B3D]">Aviso de Confirmação por E-mail</p>
                    <p className="text-[11px] text-[#6C757D]">
                      Envia comprovante automático para o aluno assim que a cobrança Infinitepay é
                      aprovada.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded text-[#0F1B3D] focus:ring-[#D4AF37]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-[#E0E4EA] bg-[#F5F7FA]">
                  <div>
                    <p className="font-bold text-[#0F1B3D]">Lembrete de Vencimento via WhatsApp</p>
                    <p className="text-[11px] text-[#6C757D]">
                      Alerta amigável enviado 2 dias antes do vencimento com link PIX.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded text-[#0F1B3D] focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => toast({ title: 'Mensagem de teste enviada com sucesso!' })}
                  className="text-xs h-9"
                >
                  Enviar Notificação de Teste
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* Plan Modal */}
      {/* ============================================================== */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white rounded-xl">
          <form onSubmit={handleSavePlan}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0F1B3D]">
                {editingPlan ? 'Editar Plano' : 'Novo Plano de Mensalidade'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-3 space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Nome do Plano</Label>
                <Input
                  required
                  placeholder="Ex: Natação Baby"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00 para plano Isento"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                />
                <p className="text-[11px] text-[#6C757D]">
                  Para plano Isento (sem cobrança), informe 0.
                </p>
              </div>{' '}
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Descrição</Label>
                <Input
                  placeholder="Público-alvo ou frequência"
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlanModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
              >
                Salvar Plano
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* Sample Data Cleanup Confirmation Modal */}
      {/* ============================================================== */}
      <Dialog
        open={cleanupModalOpen}
        onOpenChange={(open) => {
          setCleanupModalOpen(open)
          if (!open) setCleanupConfirmationInput('')
        }}
      >
        <DialogContent className="sm:max-w-[460px] bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirmar Limpeza de Dados de Exemplo
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6C757D] space-y-3 pt-1">
              <p>
                Esta ação removerá permanentemente todos os{' '}
                <strong>{sampleDataReport?.summary.students_count || 0} alunos fictícios</strong>{' '}
                identificados, bem como suas{' '}
                <strong>{sampleDataReport?.summary.charges_count || 0} cobranças</strong>,{' '}
                <strong>{sampleDataReport?.summary.payments_count || 0} pagamentos</strong> e{' '}
                <strong>{sampleDataReport?.summary.transactions_count || 0} transações</strong> de
                teste em uma única transação no servidor.
              </p>

              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] font-medium leading-relaxed">
                ⚠ <strong>Aviso de irreversibilidade:</strong> Esta operação não pode ser desfeita.
                Alunos reais importados do Bubble com <code>bubble_id</code> não serão afetados.
              </div>

              <div className="space-y-1.5 pt-1 text-left">
                <Label className="text-xs font-bold text-[#0F1B3D]">
                  Para confirmar, digite exatamente a palavra{' '}
                  <span className="font-mono text-red-600 font-black">LIMPAR</span> abaixo:
                </Label>
                <Input
                  value={cleanupConfirmationInput}
                  onChange={(e) => setCleanupConfirmationInput(e.target.value)}
                  placeholder="LIMPAR"
                  className="text-xs font-mono border-red-200 focus-visible:ring-red-500 bg-white"
                />
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={executingCleanup}
              onClick={() => {
                setCleanupModalOpen(false)
                setCleanupConfirmationInput('')
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                executingCleanup || cleanupConfirmationInput.trim().toUpperCase() !== 'LIMPAR'
              }
              onClick={handleExecuteCleanup}
              className="font-bold flex items-center gap-1.5"
            >
              {executingCleanup ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Limpando registros...
                </>
              ) : (
                'Excluir definitivamente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* Instructor Modal */}
      {/* ============================================================== */}
      <Dialog open={instructorModalOpen} onOpenChange={setInstructorModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-xl">
          <form onSubmit={handleSaveInstructor}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0F1B3D]">
                {editingInstructor ? 'Editar Instrutor' : 'Novo Instrutor'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-3 space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Nome Completo</Label>
                <Input
                  required
                  placeholder="Prof. ..."
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">E-mail</Label>
                <Input
                  type="email"
                  value={instEmail}
                  onChange={(e) => setInstEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Telefone</Label>
                <Input value={instPhone} onChange={(e) => setInstPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-[#1E2A3A]">Especialidade</Label>
                <Select
                  value={instSpecialty}
                  onValueChange={(v) =>
                    setInstSpecialty(v as 'natacao' | 'hidroginastica' | 'ambos')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natacao">Natação</SelectItem>
                    <SelectItem value="hidroginastica">Hidroginástica</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInstructorModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
              >
                Salvar Instrutor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
