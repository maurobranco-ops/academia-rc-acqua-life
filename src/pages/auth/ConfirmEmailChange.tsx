import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmEmailChange } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Token de confirmação não encontrado na URL.')
      return
    }
    if (!password) {
      setError('Por favor digite sua senha atual para confirmar a alteração.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await confirmEmailChange(token, password)
      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao confirmar novo e-mail'
      setError(msg || 'Erro na confirmação. Senha incorreta ou token expirado.')
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
          <h2 className="text-xl font-bold text-[#0F1B3D]">E-mail Atualizado!</h2>
          <p className="text-sm text-[#6C757D] mt-2">
            Seu endereço de e-mail foi alterado com sucesso. Por favor, autentique-se novamente com
            o novo e-mail.
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
          <LogoMark size={64} className="rounded-2xl mb-2" />
          <h1 className="text-2xl font-bold text-[#0F1B3D]">Confirmar Novo E-mail</h1>
          <p className="text-xs text-[#6C757D] mt-1">
            Digite sua senha para autorizar a troca do seu endereço de e-mail
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#1E2A3A]">Sua Senha Atual</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                <Loader2 className="w-4 h-4 animate-spin" /> Confirmando...
              </span>
            ) : (
              'Confirmar Mudança de E-mail'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
