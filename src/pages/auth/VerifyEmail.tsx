import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmVerification } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Token de verificação ausente na URL.')
      return
    }

    confirmVerification(token)
      .then(() => {
        setStatus('success')
      })
      .catch((err: unknown) => {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Falha ao confirmar verificação.')
      })
  }, [token, confirmVerification])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1B3D] via-[#1B2A5B] to-[#0A122A] p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center animate-fade-in-up">
        <div className="flex flex-col items-center mb-6">
          <LogoMark size={56} className="rounded-2xl mb-2" />
          <h1 className="text-2xl font-bold text-[#0F1B3D]">Verificação de E-mail</h1>
        </div>

        {status === 'verifying' && (
          <div className="space-y-4 py-6">
            <Loader2 className="w-10 h-10 text-[#17A2B8] animate-spin mx-auto" />
            <p className="text-sm text-[#6C757D]">Verificando seu e-mail junto ao servidor...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[#1E2A3A]">E-mail Confirmado com Sucesso!</h2>
            <p className="text-sm text-[#6C757D]">Sua conta agora está ativa e pronta para uso.</p>
            <Button
              onClick={() => navigate('/login')}
              className="w-full mt-4 bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
            >
              Fazer Login
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[#1E2A3A]">Falha na Verificação</h2>
            <p className="text-sm text-red-600">{errorMsg}</p>
            <Button onClick={() => navigate('/login')} variant="outline" className="w-full mt-4">
              Ir para o Login
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
