import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function Signup() {
  const { signup } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { [key: string]: string } = {}

    if (!name.trim()) newErrors.name = 'Nome completo é obrigatório'
    if (!email) newErrors.email = 'E-mail é obrigatório'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Informe um e-mail válido'

    if (!password) newErrors.password = 'Senha é obrigatória'
    else if (password.length < 8) newErrors.password = 'A senha deve ter no mínimo 8 caracteres'

    if (password !== passwordConfirm) newErrors.passwordConfirm = 'As senhas não conferem'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      await signup(email, password, name)
      setSubmitted(true)
      toast({
        title: 'Conta criada!',
        description: 'Um e-mail de verificação foi enviado.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar'
      setErrors({ form: msg })
      toast({
        title: 'Erro no cadastro',
        description: 'Não foi possível cadastrar a conta. Verifique os dados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1B3D] via-[#1B2A5B] to-[#0A122A] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F1B3D]">Verifique seu E-mail</h2>
          <p className="text-sm text-[#6C757D] mt-3">
            Enviamos um link de confirmação para <strong className="text-[#1E2A3A]">{email}</strong>
            . Por favor, acerte seu cadastro clicando no link enviado antes de acessar.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <Link to="/login">
              <Button className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white">
                Ir para o Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1B3D] via-[#1B2A5B] to-[#0A122A] p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-white/20 p-8 animate-fade-in-up">
        <div className="flex flex-col items-center mb-6 text-center">
          <LogoMark size={80} className="rounded-3xl mb-2" />
          <h1 className="text-3xl font-bold text-[#0F1B3D]">Criar Nova Conta</h1>
          <p className="text-xs text-[#6C757D] mt-1 font-medium">
            Gestão de Academia de Natação e Hidroginástica
          </p>
        </div>

        {errors.form && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#1E2A3A]">Nome Completo</Label>
            <Input
              type="text"
              placeholder="Prof. Carlos Mendes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? 'border-red-500' : 'focus-visible:ring-[#D4AF37]'}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#1E2A3A]">E-mail</Label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? 'border-red-500' : 'focus-visible:ring-[#D4AF37]'}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#1E2A3A]">
              Senha (mínimo 8 caracteres)
            </Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? 'border-red-500' : 'focus-visible:ring-[#D4AF37]'}
            />
            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#1E2A3A]">Confirmar Senha</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={errors.passwordConfirm ? 'border-red-500' : 'focus-visible:ring-[#D4AF37]'}
            />
            {errors.passwordConfirm && (
              <p className="text-xs text-red-500">{errors.passwordConfirm}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold h-11 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Registrando...
              </span>
            ) : (
              'Cadastrar'
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-[#6C757D]">
            Já possui cadastro?{' '}
            <Link to="/login" className="font-semibold text-[#0F1B3D] hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
