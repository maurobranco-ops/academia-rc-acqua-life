import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  DollarSign,
  CreditCard,
  FileBarChart2,
  Settings as SettingsIcon,
  UploadCloud,
  LogOut,
  Waves,
  Menu,
  X,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { academyService } from '@/services/academy'
import type { PaymentRecord, StudentRecord } from '@/types/database'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Turmas', icon: CalendarDays, path: '/turmas' },
  { label: 'Alunos', icon: Users, path: '/alunos' },
  { label: 'Financeiro', icon: DollarSign, path: '/financeiro' },
  { label: 'Cobranças', icon: CreditCard, path: '/cobrancas' },
  { label: 'Relatórios', icon: FileBarChart2, path: '/relatorios' },
  { label: 'Importar', icon: UploadCloud, path: '/importar' },
  { label: 'Configurações', icon: SettingsIcon, path: '/configuracoes' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([])
  const [filteredStudents, setFilteredStudents] = useState<StudentRecord[]>([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [overduePayments, setOverduePayments] = useState<PaymentRecord[]>([])

  // Load students for quick search & overdue count
  useEffect(() => {
    academyService.getStudents().then(setAllStudents).catch(console.error)
    academyService
      .getPayments()
      .then((payments) => {
        const overdue = payments.filter((p) => p.status === 'vencido')
        setOverdueCount(overdue.length)
        setOverduePayments(overdue)
      })
      .catch(console.error)
  }, [location.pathname])

  // Handle live student search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStudents([])
      return
    }
    const query = searchTerm.toLowerCase()
    const matches = allStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.cpf && s.cpf.includes(query)) ||
        (s.email && s.email.toLowerCase().includes(query)),
    )
    setFilteredStudents(matches.slice(0, 5))
  }, [searchTerm, allStudents])

  // Derive current page title
  const getPageTitle = () => {
    const current = navItems.find((item) => {
      if (item.path === '/') return location.pathname === '/'
      return location.pathname.startsWith(item.path)
    })
    if (location.pathname.startsWith('/alunos/')) return 'Detalhes do Aluno'
    if (location.pathname.startsWith('/turmas/')) return 'Detalhes da Turma'
    return current ? current.label : 'Academia Aquática'
  }

  const handleSelectStudent = (id: string) => {
    setSearchTerm('')
    setFilteredStudents([])
    navigate(`/alunos/${id}`)
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex text-[#1E2A3A]">
      {/* ============================================================== */}
      {/* Desktop Sidebar (Fixed left) */}
      {/* ============================================================== */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-[#0F1B3D] text-white transition-all duration-300 select-none shadow-xl border-r border-[#1B2A5B]',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        {/* Academy Brand */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-[#1B2A5B]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-[#17A2B8] to-[#0F1B3D] border border-[#D4AF37] flex items-center justify-center shadow-md">
              <Waves className="w-6 h-6 text-[#D4AF37]" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <span className="font-bold text-sm text-white tracking-wide block">AquaGestão</span>
                <span className="text-[10px] text-[#D4AF37] tracking-wider uppercase font-semibold">
                  Natação &amp; Hidro
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative group',
                  isActive
                    ? 'bg-[#1B2A5B] text-white font-semibold shadow-inner'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#D4AF37] rounded-r-full shadow-[0_0_8px_#D4AF37]" />
                )}
                <Icon
                  className={cn(
                    'w-5 h-5 shrink-0 transition-colors',
                    isActive ? 'text-[#D4AF37]' : 'text-slate-400 group-hover:text-white',
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-[#1B2A5B] bg-[#0A122A]">
          <div
            className={cn(
              'flex items-center gap-3',
              collapsed ? 'justify-center' : 'justify-between',
            )}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Avatar className="w-9 h-9 border border-[#D4AF37]/50">
                <AvatarFallback className="bg-[#17A2B8] text-white font-bold text-xs">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.name || 'Administrador'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {user?.email || 'admin@aquagestao.com'}
                  </p>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition"
                title="Sair da conta"
                aria-label="Sair da conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* Mobile Top Bar (Screens < 1024px) */}
      {/* ============================================================== */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-16 bg-[#0F1B3D] text-white z-40 flex items-center justify-between px-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#17A2B8] flex items-center justify-center border border-[#D4AF37]">
            <Waves className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <span className="font-bold text-base text-white">AquaGestão</span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg text-slate-200 hover:bg-white/10"
          aria-label="Abrir menu lateral"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Drawer Backdrop and Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-[280px] bg-[#0F1B3D] text-white h-full flex flex-col z-10 shadow-2xl animate-fade-in">
            <div className="h-16 flex items-center justify-between px-4 border-b border-[#1B2A5B]">
              <div className="flex items-center gap-2.5">
                <Waves className="w-6 h-6 text-[#D4AF37]" />
                <span className="font-bold text-base">AquaGestão</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-300 hover:text-white"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path)

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm transition',
                      isActive
                        ? 'bg-[#1B2A5B] text-white font-semibold'
                        : 'text-slate-300 hover:bg-white/5',
                    )}
                  >
                    <Icon
                      className={cn('w-5 h-5', isActive ? 'text-[#D4AF37]' : 'text-slate-400')}
                    />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="p-4 border-t border-[#1B2A5B] bg-[#0A122A] flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-[#17A2B8] text-white text-xs">
                    {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                  </AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.name || 'Administrador'}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-slate-300 hover:text-red-400"
                title="Sair"
                aria-label="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Main Content Area */}
      {/* ============================================================== */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]',
          'pt-16 lg:pt-0',
        )}
      >
        {/* Sticky Desktop/Mobile Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E0E4EA] h-20 px-6 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-4">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#0F1B3D]">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Global Student Search */}
            <div className="relative w-48 sm:w-64 md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Buscar aluno por nome, CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[#F5F7FA] border-[#E0E4EA] text-xs md:text-sm h-10 rounded-xl focus-visible:ring-[#D4AF37]"
              />

              {/* Autocomplete Dropdown */}
              {filteredStudents.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in-up">
                  <p className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Alunos encontrados
                  </p>
                  {filteredStudents.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handleSelectStudent(st.id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition"
                    >
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-[10px] bg-[#0F1B3D] text-white">
                          {st.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-[#1E2A3A] truncate">{st.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{st.cpf || st.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Bell with Overdue Alert Badge */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-[#0F1B3D] hover:bg-slate-50 transition"
                  aria-label="Notificações e alertas"
                >
                  <Bell className="w-5 h-5" />
                  {overdueCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF6B6B] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
                      {overdueCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2 shadow-xl rounded-xl">
                <DropdownMenuLabel className="font-bold text-sm text-[#0F1B3D] flex items-center justify-between">
                  <span>Alertas de Cobrança</span>
                  {overdueCount > 0 && (
                    <Badge variant="destructive" className="bg-[#FF6B6B] text-xs">
                      {overdueCount} em atraso
                    </Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {overdueCount === 0 ? (
                  <div className="p-4 text-center text-xs text-[#6C757D]">
                    Nenhuma pendência ou mensalidade em atraso.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5 py-1">
                    {overduePayments.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => navigate('/cobrancas')}
                        className="p-2.5 rounded-lg bg-red-50 hover:bg-red-100/70 border border-red-200/60 cursor-pointer transition flex items-start gap-2.5"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-red-900 truncate">
                            {p.expand?.student_id?.name || 'Aluno'}
                          </p>
                          <p className="text-[11px] text-red-700">
                            R$ {p.amount.toFixed(2)} • Vencido em{' '}
                            {new Date(p.due_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/cobrancas')}
                  className="justify-center text-xs font-bold text-[#0F1B3D] cursor-pointer hover:bg-slate-100"
                >
                  Gerenciar Todas as Cobranças
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Global Minimal Footer */}
        <footer className="border-t border-[#E0E4EA] bg-white py-4 px-6 text-center text-xs text-[#6C757D]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1400px] mx-auto">
            <span>
              &copy; {new Date().getFullYear()} Academia Aquática — Natação &amp; Hidroginástica.
              Todos os direitos reservados.
            </span>
            <span className="text-slate-400">
              Desenvolvido com <strong className="text-slate-600">Skip Cloud</strong> &amp;
              Infinitepay
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
