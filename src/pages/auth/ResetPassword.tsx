import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Waves, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmPasswordReset } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Token de recuperação inválido ou expirado.')
      return
    }
    if (password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (password !== passwordConfirm) {
      setError('As senhas não coincidem.')
      return
    }

    setError('')
    setLoading(true)

    try {
      await confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
      toast({
        title: 'Senha redefinida',
        description: 'Sua senha foi alterada com sucesso.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao redefinir senha'
      setError(msg || 'Token expirado ou inválido. Solicite uma nova recuperação.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1B3D] via-[#1B2A5B] to-[#0A122A] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center animate-fade-in-up">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-[#0F1B3D]">Senha Atualizada!</h2>
          <p className="text-sm text-[#6C757D] mt-2">
            Sua senha foi redefinida com sucesso. Faça login agora com sua nova credencial.
          </p>
          <div className="mt-6">
            <Button
              onClick={() => navigate('/login')}
              className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white"
            >
              Ir para o Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1B3D] via-[#1B2A5B] to-[#0A122A] p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-fade-in-up">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0F1B3D] to-[#17A2B8] flex items-center justify-center shadow-lg mb-2 border border-[#D4AF37]">
            <Waves className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F1B3D]">Criar Nova Senha</h1>
          <p className="text-xs text-[#6C757D] mt-1">Digite sua nova senha de acesso</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#1E2A3A]">Nova Senha</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-visible:ring-[#D4AF37]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#1E2A3A]">Confirmar Nova Senha</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="focus-visible:ring-[#D4AF37]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold h-11"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Atualizando...
              </span>
            ) : (
              'Salvar Nova Senha'
            )}
          </Button>

          <div className="text-center pt-2">
            <Link to="/login" className="text-xs font-semibold text-[#6C757D] hover:underline">
              Voltar ao Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
