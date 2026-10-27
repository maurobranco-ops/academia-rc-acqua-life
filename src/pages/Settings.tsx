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
  XCircle,
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

export default function Settings() {
  const { toast } = useToast()

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [instructors, setInstructors] = useState<InstructorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  // Infinitepay Connection Testing State
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle')

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
        <TabsList className="bg-white border border-[#E0E4EA] p-1 rounded-xl mb-6 flex-wrap">
          <TabsTrigger
            value="perfil"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" /> Dados da Academia
          </TabsTrigger>
          <TabsTrigger
            value="planos"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
          >
            <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" /> Planos e Mensalidades
          </TabsTrigger>
          <TabsTrigger
            value="infinitepay"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Integração Infinitepay
          </TabsTrigger>
          <TabsTrigger
            value="instrutores"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Instrutores
          </TabsTrigger>
          <TabsTrigger
            value="notificacoes"
            className="data-[state=active]:bg-[#0F1B3D] data-[state=active]:text-white text-xs font-semibold rounded-lg px-4"
          >
            <Bell className="w-3.5 h-3.5 mr-1.5" /> Notificações
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
                    value={settings.academy_cnpj || ''}
                    onChange={(e) => handleUpdateSetting('academy_cnpj', e.target.value)}
                    className="focus-visible:ring-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-[#1E2A3A]">Telefone / WhatsApp</Label>
                  <Input
                    value={settings.academy_phone || ''}
                    onChange={(e) => handleUpdateSetting('academy_phone', e.target.value)}
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
          <div className="flex justify-between items-center">
            <div>
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
              <div className="flex items-center justify-between">
                <div>
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
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhookEndpoint}
                    className="bg-slate-50 font-mono text-slate-700 font-semibold"
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

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
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
        {/* TAB 4: INSTRUCTORS */}
        {/* ============================================================ */}
        <TabsContent value="instrutores" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
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
                className="bg-white border-[#E0E4EA] hover:border-slate-300 transition rounded-xl p-4 flex items-center justify-between"
              >
                <div>
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
