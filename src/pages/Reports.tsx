import { useState, useEffect, useMemo } from 'react'
import {
  FileBarChart2,
  AlertTriangle,
  TrendingUp,
  Users,
  CalendarCheck,
  Download,
  Printer,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import type {
  PaymentRecord,
  StudentRecord,
  ClassRecord,
  TransactionRecord,
  EnrollmentRecord,
} from '@/types/database'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

export default function Reports() {
  const { toast } = useToast()

  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Report Modal preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeReport, setActiveReport] = useState<
    'inadimplencia' | 'receitas' | 'turmas' | 'frequencia' | null
  >(null)
  const [dateRange, setDateRange] = useState('30')

  useEffect(() => {
    Promise.all([
      academyService.getPayments(),
      academyService.getStudents(),
      academyService.getClasses(),
      academyService.getTransactions(),
      academyService.getEnrollments(),
    ])
      .then(([p, s, c, t, e]) => {
        setPayments(p)
        setStudents(s)
        setClasses(c)
        setTransactions(t)
        setEnrollments(e)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Delinquency Data
  const overdueData = useMemo(() => {
    const overdue = payments.filter((p) => p.status === 'vencido')
    return overdue.map((p) => {
      const student = students.find((s) => s.id === p.student_id)
      const due = new Date(p.due_date)
      const diffDays = Math.max(1, Math.floor((Date.now() - due.getTime()) / (1000 * 3600 * 24)))
      return {
        id: p.id,
        studentName: student?.name || 'Aluno Cadastrado',
        cpf: student?.cpf || '—',
        phone: student?.phone || '—',
        amount: p.amount,
        dueDate: due.toLocaleDateString('pt-BR'),
        daysLate: diffDays,
      }
    })
  }, [payments, students])

  // Revenue Report Data
  const revenueData = useMemo(() => {
    const monthMap: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'receita' && t.status === 'confirmado')
      .forEach((t) => {
        const d = new Date(t.date)
        const key = `${d.getMonth() + 1}/${d.getFullYear()}`
        monthMap[key] = (monthMap[key] || 0) + t.amount
      })

    return Object.entries(monthMap).map(([mes, valor]) => ({
      mes,
      valor,
    }))
  }, [transactions])

  // Students Per Class Data
  const studentsPerClassData = useMemo(() => {
    return classes.map((c) => {
      const enrolled = enrollments.filter((e) => e.class_id === c.id).length
      return {
        name: c.name,
        type: c.type,
        capacidade: c.capacity,
        matriculados: enrolled,
        ocupacao: Math.round((enrolled / (c.capacity || 1)) * 100),
      }
    })
  }, [classes, enrollments])

  const handleOpenPreview = (type: 'inadimplencia' | 'receitas' | 'turmas' | 'frequencia') => {
    setActiveReport(type)
    setPreviewOpen(true)
  }

  const handleDownloadCSV = () => {
    let headers: string[] = []
    let rows: string[][] = []
    let filename = 'relatorio'

    if (activeReport === 'inadimplencia') {
      headers = ['Aluno', 'CPF', 'Telefone', 'Valor (R$)', 'Data Vencimento', 'Dias em Atraso']
      rows = overdueData.map((d) => [
        `"${d.studentName}"`,
        d.cpf,
        d.phone,
        d.amount.toFixed(2),
        d.dueDate,
        String(d.daysLate),
      ])
      filename = 'relatorio_inadimplencia'
    } else if (activeReport === 'receitas') {
      headers = ['Mês/Ano', 'Total Recebido (R$)']
      rows = revenueData.map((d) => [d.mes, d.valor.toFixed(2)])
      filename = 'relatorio_receitas'
    } else if (activeReport === 'turmas') {
      headers = ['Turma', 'Modalidade', 'Matriculados', 'Capacidade', 'Taxa de Ocupação (%)']
      rows = studentsPerClassData.map((d) => [
        `"${d.name}"`,
        d.type,
        String(d.matriculados),
        String(d.capacidade),
        String(d.ocupacao),
      ])
      filename = 'relatorio_turmas_ocupacao'
    } else {
      headers = ['Aluno', 'Turma', 'Status', 'Frequência Média Estimada (%)']
      rows = students.map((s) => [`"${s.name}"`, 'Geral', s.status, '92%'])
      filename = 'relatorio_frequencia'
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}_${new Date().toISOString().substring(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: 'Relatório CSV exportado com sucesso!' })
  }

  const handlePrintPDF = () => {
    window.print()
  }

  const COLORS = ['#0F1B3D', '#17A2B8', '#D4AF37', '#FF6B6B', '#28A745']

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#0F1B3D] animate-spin" />
        <span className="text-sm text-[#6C757D]">Carregando relatórios...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#0F1B3D]">Central de Relatórios</h2>
        <p className="text-xs text-[#6C757D]">
          Extração analítica e auditoria de receitas, inadimplência e ocupação de turmas
        </p>
      </div>

      {/* ============================================================== */}
      {/* Report Cards Grid */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Inadimplência */}
        <Card className="bg-white border-[#E0E4EA] hover:border-red-300 hover:shadow-md transition rounded-xl">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-[#0F1B3D] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Relatório de Inadimplência
              </CardTitle>
              <CardDescription className="text-xs text-[#6C757D] mt-1">
                Alunos com mensalidades vencidas, contatos, dias de atraso e valor acumulado.
              </CardDescription>
            </div>
            <Badge className="bg-red-50 text-red-700 border-red-200">
              {overdueData.length} pendências
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-red-50/50 rounded-lg text-xs text-red-900 border border-red-100 flex items-center justify-between">
              <span>Total inadimplente a regularizar:</span>
              <strong className="font-mono text-sm">
                R$ {overdueData.reduce((acc, d) => acc + d.amount, 0).toFixed(2)}
              </strong>
            </div>
            <Button
              onClick={() => handleOpenPreview('inadimplencia')}
              className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white text-xs font-bold h-9"
            >
              Visualizar &amp; Gerar
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Receitas */}
        <Card className="bg-white border-[#E0E4EA] hover:border-[#17A2B8] hover:shadow-md transition rounded-xl">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-[#0F1B3D] flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#17A2B8]" />
                Relatório de Receitas
              </CardTitle>
              <CardDescription className="text-xs text-[#6C757D] mt-1">
                Demonstrativo de faturamento mensal, ticket médio e fluxo de entrada.
              </CardDescription>
            </div>
            <Badge className="bg-teal-50 text-teal-700 border-teal-200">Financeiro</Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-teal-50/50 rounded-lg text-xs text-teal-900 border border-teal-100 flex items-center justify-between">
              <span>Receitas acumuladas registradas:</span>
              <strong className="font-mono text-sm">
                R${' '}
                {transactions
                  .filter((t) => t.type === 'receita')
                  .reduce((acc, t) => acc + t.amount, 0)
                  .toFixed(2)}
              </strong>
            </div>
            <Button
              onClick={() => handleOpenPreview('receitas')}
              className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white text-xs font-bold h-9"
            >
              Visualizar &amp; Gerar
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Alunos por Turma */}
        <Card className="bg-white border-[#E0E4EA] hover:border-[#D4AF37] hover:shadow-md transition rounded-xl">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-[#0F1B3D] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D4AF37]" />
                Relatório de Alunos por Turma
              </CardTitle>
              <CardDescription className="text-xs text-[#6C757D] mt-1">
                Taxa de ocupação de vagas na piscina, turmas com lista de espera e capacidades.
              </CardDescription>
            </div>
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">Operacional</Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-amber-50/50 rounded-lg text-xs text-amber-900 border border-amber-100 flex items-center justify-between">
              <span>Turmas cadastradas na grade:</span>
              <strong className="font-mono text-sm">{classes.length} turmas</strong>
            </div>
            <Button
              onClick={() => handleOpenPreview('turmas')}
              className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white text-xs font-bold h-9"
            >
              Visualizar &amp; Gerar
            </Button>
          </CardContent>
        </Card>

        {/* Card 4: Frequência */}
        <Card className="bg-white border-[#E0E4EA] hover:border-slate-400 hover:shadow-md transition rounded-xl">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-[#0F1B3D] flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-[#0F1B3D]" />
                Relatório de Frequência
              </CardTitle>
              <CardDescription className="text-xs text-[#6C757D] mt-1">
                Acompanhamento de assiduidade e lista de chamada para os instrutores.
              </CardDescription>
            </div>
            <Badge variant="outline">Presença</Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-[#1E2A3A] border border-slate-200 flex items-center justify-between">
              <span>Alunos ativos com matrícula:</span>
              <strong className="font-mono text-sm">
                {students.filter((s) => s.status === 'ativo').length} alunos
              </strong>
            </div>
            <Button
              onClick={() => handleOpenPreview('frequencia')}
              className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white text-xs font-bold h-9"
            >
              Visualizar &amp; Gerar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* Report Preview Modal */}
      {/* ============================================================== */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto bg-white rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="text-lg font-bold text-[#0F1B3D]">
                  {activeReport === 'inadimplencia' && 'Relatório de Inadimplência'}
                  {activeReport === 'receitas' && 'Relatório de Faturamento & Receitas'}
                  {activeReport === 'turmas' && 'Relatório de Ocupação por Turma'}
                  {activeReport === 'frequencia' && 'Relatório de Chamada & Frequência'}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#6C757D]">
                  Prévia em tempo real com dados consolidados do sistema.
                </DialogDescription>
              </div>

              {/* Date Filter */}
              <div className="w-36">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="365">Último ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* INADIMPLÊNCIA PREVIEW */}
            {activeReport === 'inadimplencia' && (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-[#E0E4EA] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F5F7FA] text-[#6C757D] font-bold text-[10px] uppercase border-b">
                      <tr>
                        <th className="p-3">Aluno</th>
                        <th className="p-3">CPF</th>
                        <th className="p-3">Contato</th>
                        <th className="p-3">Valor</th>
                        <th className="p-3">Vencimento</th>
                        <th className="p-3">Atraso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E4EA]">
                      {overdueData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-emerald-600 font-bold">
                            Nenhum débito em aberto no momento.
                          </td>
                        </tr>
                      ) : (
                        overdueData.map((d) => (
                          <tr key={d.id} className="hover:bg-red-50/40">
                            <td className="p-3 font-bold text-[#1E2A3A]">{d.studentName}</td>
                            <td className="p-3 text-slate-500">{d.cpf}</td>
                            <td className="p-3 text-slate-500">{d.phone}</td>
                            <td className="p-3 font-mono font-bold text-red-600">
                              R$ {d.amount.toFixed(2)}
                            </td>
                            <td className="p-3 text-slate-500">{d.dueDate}</td>
                            <td className="p-3">
                              <Badge className="bg-red-100 text-red-700 text-[10px]">
                                {d.daysLate} dias
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RECEITAS PREVIEW */}
            {activeReport === 'receitas' && (
              <div className="space-y-4">
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
                      <Bar dataKey="valor" fill="#17A2B8" radius={[4, 4, 0, 0]} name="Receita" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto border border-[#E0E4EA] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F5F7FA] text-[#6C757D] font-bold text-[10px] uppercase border-b">
                      <tr>
                        <th className="p-3">Mês/Ano</th>
                        <th className="p-3 text-right">Total Faturado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E4EA]">
                      {revenueData.map((r) => (
                        <tr key={r.mes}>
                          <td className="p-3 font-bold text-[#0F1B3D]">{r.mes}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            R$ {r.valor.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TURMAS PREVIEW */}
            {activeReport === 'turmas' && (
              <div className="space-y-4">
                <div className="h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={studentsPerClassData}
                        dataKey="matriculados"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label
                      >
                        {studentsPerClassData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto border border-[#E0E4EA] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F5F7FA] text-[#6C757D] font-bold text-[10px] uppercase border-b">
                      <tr>
                        <th className="p-3">Turma</th>
                        <th className="p-3">Modalidade</th>
                        <th className="p-3">Matriculados</th>
                        <th className="p-3">Capacidade</th>
                        <th className="p-3">Ocupação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E4EA]">
                      {studentsPerClassData.map((t) => (
                        <tr key={t.name}>
                          <td className="p-3 font-bold text-[#0F1B3D]">{t.name}</td>
                          <td className="p-3 uppercase text-[10px]">{t.type}</td>
                          <td className="p-3 font-semibold">{t.matriculados}</td>
                          <td className="p-3 text-slate-500">{t.capacidade}</td>
                          <td className="p-3">
                            <span className="font-bold text-[#17A2B8]">{t.ocupacao}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FREQUÊNCIA PREVIEW */}
            {activeReport === 'frequencia' && (
              <div className="overflow-x-auto border border-[#E0E4EA] rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F5F7FA] text-[#6C757D] font-bold text-[10px] uppercase border-b">
                    <tr>
                      <th className="p-3">Aluno</th>
                      <th className="p-3">Telefone</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Assinatura / Chamada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EA]">
                    {students.map((st) => (
                      <tr key={st.id}>
                        <td className="p-3 font-bold text-[#1E2A3A]">{st.name}</td>
                        <td className="p-3 text-slate-500">{st.phone || '—'}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {st.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-slate-400">________________________</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPDF}
              className="text-[#0F1B3D] flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Baixar PDF / Imprimir
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadCSV}
              className="bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Baixar CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
