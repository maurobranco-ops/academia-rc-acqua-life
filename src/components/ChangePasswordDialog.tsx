import React, { useEffect, useState } from 'react'
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MIN_PASSWORD_LENGTH = 8

export default function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { changePassword } = useAuth()
  const { toast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset fields whenever the dialog is opened fresh
  useEffect(() => {
    if (open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrent(false)
      setShowNew(false)
      setShowConfirm(false)
      setError('')
      setLoading(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentPassword) {
      setError('Informe a senha atual.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (newPassword === currentPassword) {
      setError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast({
        title: 'Senha alterada com sucesso',
        description: 'Sua senha de acesso foi atualizada. Use a nova senha no próximo login.',
      })
      onOpenChange(false)
    } catch (err: unknown) {
      const fallback =
        'Não foi possível alterar a senha. Verifique se a senha atual está correta e tente novamente.'
      const msg = getErrorMessage(err) || fallback
      // Friendly message when PocketBase rejects the old password (400: validation not valid)
      if (err instanceof Error && /failed to authenticate|invalid.*password|not valid/i.test(msg)) {
        setError('A senha atual está incorreta. Verifique e tente novamente. Nada foi alterado.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const renderPasswordInput = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    visible: boolean,
    toggle: () => void,
    placeholder = '••••••••',
    autoFocus = false,
  ) => (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-11 pr-10 bg-[#F5F7FA] border-[#E0E4EA] rounded-xl focus-visible:ring-[#D4AF37]"
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F1B3D] transition"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-[#E0E4EA] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#0F1B3D] to-[#1B2A5B] px-6 py-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-white">Alterar Senha</DialogTitle>
            <DialogDescription className="text-xs text-slate-300 mt-0.5">
              Atualize sua senha de acesso ao RC Acqua Life
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-sm font-semibold text-[#1E2A3A]">
              Senha Atual <span className="text-red-500">*</span>
            </Label>
            {renderPasswordInput(
              'current-password',
              currentPassword,
              setCurrentPassword,
              showCurrent,
              () => setShowCurrent(!showCurrent),
              'Digite sua senha atual',
              true,
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm font-semibold text-[#1E2A3A]">
              Nova Senha <span className="text-red-500">*</span>
            </Label>
            {renderPasswordInput(
              'new-password',
              newPassword,
              setNewPassword,
              showNew,
              () => setShowNew(!showNew),
              '••••••••',
            )}
            <p className="text-[11px] text-[#6C757D]">
              Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-semibold text-[#1E2A3A]">
              Confirmar Nova Senha <span className="text-red-500">*</span>
            </Label>
            {renderPasswordInput(
              'confirm-password',
              confirmPassword,
              setConfirmPassword,
              showConfirm,
              () => setShowConfirm(!showConfirm),
              '••••••••',
            )}
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-[11px] text-red-500 font-medium">As senhas não coincidem.</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-11 rounded-xl border-[#E0E4EA] text-[#1E2A3A] hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 rounded-xl bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </span>
              ) : (
                'Salvar Nova Senha'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
