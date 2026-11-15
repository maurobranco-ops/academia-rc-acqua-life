import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Por favor informe um e-mail válido')
      return
    }

    setError('')
    setLoading(true)

    try {
      await requestPasswordReset(email)
      setSent(true)
      toast({
        title: 'E-mail enviado',
        description: 'Se o e-mail estiver cadastrado, você receberá o link em instantes.',
      })
    } catch {
      // For security, don't reveal whether user exists
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1B3D] via-[#1B2A5B] to-[#0A122A] p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-fade-in-up">
        <div className="flex flex-col items-center mb-6 text-center">
          <LogoMark size={80} className="rounded-3xl mb-2" />
          <h1 className="text-3xl font-bold text-[#0F1B3D]">Recuperar Senha</h1>
          <p className="text-xs text-[#6C757D] mt-1">
            Informe seu e-mail para receber as instruções de recuperação
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-blue-50 text-[#17A2B8] rounded-full flex items-center justify-center mx-auto">
              <MailCheck className="w-8 h-8" />
            </div>
            <p className="text-sm text-[#1E2A3A]">
              Enviamos um link de redefinição para <strong>{email}</strong> caso ele exista em nossa
              base.
            </p>
            <div className="pt-4">
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-[#1E2A3A]">E-mail Cadastrado</Label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={error ? 'border-red-500' : 'focus-visible:ring-[#D4AF37]'}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold h-11"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                </span>
              ) : (
                'Enviar link de recuperação'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs font-semibold text-[#6C757D] hover:text-[#0F1B3D] inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
