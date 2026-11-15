import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [email, setEmail] = useState('maurobranco@incidesolar.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { email?: string; password?: string } = {}

    if (!email) newErrors.email = 'E-mail é obrigatório'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Informe um e-mail válido'

    if (!password) newErrors.password = 'Senha é obrigatória'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      await login(email, password)
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login realizado com sucesso.',
      })
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar'
      setErrors({ form: 'E-mail ou senha incorretos. Verifique suas credenciais.' })
      toast({
        title: 'Erro de Autenticação',
        description: msg.includes('Failed to authenticate')
          ? 'E-mail ou senha inválidos'
          : 'Não foi possível entrar. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#0F1B3D] via-[#1B2A5B] to-[#0A122A] p-4">
      {/* Decorative Water Pattern Circles */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#17A2B8]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-white/20 p-8 animate-fade-in-up">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-8 text-center">
          <LogoMark size={140} className="rounded-3xl mb-3" />
          <h1 className="text-3xl font-bold tracking-tight text-[#0F1B3D]">RC Acqua Life</h1>
          <p className="text-xs text-[#6C757D] mt-1 font-medium tracking-wide uppercase">
            Natação &amp; Hidroginástica
          </p>
        </div>

        {errors.form && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-semibold text-[#1E2A3A]">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={
                errors.email
                  ? 'border-red-500 focus-visible:ring-red-400'
                  : 'focus-visible:ring-[#D4AF37]'
              }
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-semibold text-[#1E2A3A]">
                Senha
              </Label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#17A2B8] hover:text-[#0F1B3D] transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`pr-10 ${errors.password ? 'border-red-500 focus-visible:ring-red-400' : 'focus-visible:ring-[#D4AF37]'}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold text-sm h-11 transition-all shadow-md active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Entrando...
              </span>
            ) : (
              'Entrar no Sistema'
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-[#6C757D]">
            Não tem uma conta?{' '}
            <Link to="/signup" className="font-semibold text-[#0F1B3D] hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
