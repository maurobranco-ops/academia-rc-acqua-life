import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Link2, Copy, Check, Ban, RefreshCw, ShieldCheck, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { academyService } from '@/services/academy'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useToast } from '@/hooks/use-toast'
import { formatDateBR } from '@/lib/matricula'
import type { StudentRecord } from '@/types/database'

// Diálogo "Link de atualização" (detalhe do aluno): gera token no SERVIDOR com
// validade de 5 DIAS, mostra o link /atualizar/TOKEN para copiar/enviar por
// WhatsApp, e permite revogar ou gerar novo (novo token invalida o anterior).

interface Props {
  student: StudentRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado quando o link é revogado — permite recarregar o aluno no pai. */
  onChanged?: () => void
}

interface TokenState {
  token: string
  expires_at: string
}

export function UpdateLinkDialog({ student, open, onOpenChange, onChanged }: Props) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [token, setToken] = useState<TokenState | null>(null)
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const link = token ? `${window.location.origin}/atualizar/${token.token}` : ''

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await academyService.generateUpdateLink(student.id)
      setToken({ token: res.token, expires_at: res.expires_at })
      setCopied(false)
      toast({
        title: 'Link gerado!',
        description: `Válido até ${formatDateBR(res.expires_at)}. Envie para o aluno por WhatsApp.`,
      })
    } catch (err) {
      toast({
        title: 'Erro ao gerar o link',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    setRevoking(true)
    try {
      await academyService.revokeUpdateLink(student.id)
      setToken(null)
      onChanged?.()
      toast({ title: 'Link revogado', description: 'O link anterior deixou de funcionar.' })
    } catch (err) {
      toast({
        title: 'Erro ao revogar',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setRevoking(false)
    }
  }

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch (_) {
      // Fallback para ambientes sem clipboard API (http, webview antigo).
      const el = document.createElement('textarea')
      el.value = link
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Link copiado!', description: 'Cole na conversa do WhatsApp com o aluno.' })
  }

  const handleOpen = (next: boolean) => {
    if (!next) setToken(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0F1B3D]">
            <Link2 className="w-5 h-5 text-[#D4AF37]" /> Link de atualização
          </DialogTitle>
          <DialogDescription>
            Gera um link seguro (sem senha) para <strong>{student.name}</strong> atualizar sozinho
            PAR-Q, exames, anamnese, uso de imagem e endereço. Válido por 5 dias; nome, CPF,
            nascimento e dados financeiros ficam travados.
          </DialogDescription>
        </DialogHeader>

        {!token ? (
          <div className="space-y-3 py-2">
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white font-bold h-10 rounded-xl"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Gerar link de atualização
            </Button>
            <p className="text-[11px] text-slate-500">
              Se já existir um link ativo, gerar um novo o invalida imediatamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[#1E2A3A]">
                Link seguro (copie e envie ao aluno)
              </Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={link} className="h-9 text-[11px] font-mono" />
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold h-9"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
              <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              Válido até <strong>{formatDateBR(token.expires_at)}</strong> (5 dias). O aluno pode
              revisar e reenviar quantas vezes quiser até lá.
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              Ao enviar, o cadastro marca a ficha como desatualizada e registra &quot;Atualizado
              pelo aluno em …&quot;.
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                onClick={handleGenerate}
                disabled={loading}
                variant="outline"
                className="flex-1 border-[#0F1B3D] text-[#0F1B3D] hover:bg-slate-100 font-bold h-9 rounded-xl text-xs"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                Gerar novo (invalida o atual)
              </Button>
              <Button
                onClick={handleRevoke}
                disabled={revoking}
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-bold h-9 rounded-xl text-xs"
              >
                {revoking ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4 mr-1.5" />
                )}
                Revogar agora
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => handleOpen(false)}>
            Fechar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#17A2B8] hover:text-[#0F1B3D]"
            onClick={() => navigate('/configuracoes')}
          >
            Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
