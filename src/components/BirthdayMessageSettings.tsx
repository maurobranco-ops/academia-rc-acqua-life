import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { academyService } from '@/services/academy'
import {
  BIRTHDAY_AUTO_SEND_KEY,
  BIRTHDAY_MESSAGE_KEY,
  DEFAULT_BIRTHDAY_MESSAGE,
  buildBirthdayMessage,
} from '@/lib/birthday'

/** Modelo da mensagem de aniversário e feature flag de envio automático (envio automático ainda desligado). */
export function BirthdayMessageSettings() {
  const { toast } = useToast()
  const [template, setTemplate] = useState(DEFAULT_BIRTHDAY_MESSAGE)
  const [autoSend, setAutoSend] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    academyService
      .getSettings()
      .then((s) => {
        setTemplate(s[BIRTHDAY_MESSAGE_KEY] || DEFAULT_BIRTHDAY_MESSAGE)
        setAutoSend(s[BIRTHDAY_AUTO_SEND_KEY] === 'true')
      })
      .catch(console.error)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await academyService.updateSetting(BIRTHDAY_MESSAGE_KEY, template)
      await academyService.updateSetting(BIRTHDAY_AUTO_SEND_KEY, autoSend ? 'true' : 'false')
      toast({ title: 'Configurações de aniversário salvas!' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const preview = buildBirthdayMessage(template, {
    nome: 'Mauro Silva',
    idade: 34,
    turma: 'Sábados 8h',
  })

  return (
    <Card className="bg-white border-[#E0E4EA] rounded-xl shadow-xs mt-4">
      <CardHeader>
        <CardTitle className="text-base font-bold text-[#0F1B3D]">
          Mensagem de Aniversário
        </CardTitle>
        <CardDescription className="text-xs text-[#6C757D]">
          Modelo usado para parabenizar alunos que fazem aniversário. Variáveis: {'{nome}'},{' '}
          {'{idade}'} e {'{turma}'} são preenchidas pelo sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="space-y-1">
          <Label className="font-semibold text-[#1E2A3A]">Modelo da mensagem</Label>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            className="focus-visible:ring-[#D4AF37] text-xs"
          />
          <p className="text-[11px] text-[#6C757D]">Exemplo: {preview}</p>
        </div>

        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[#E0E4EA] bg-[#F5F7FA]">
          <div>
            <p className="font-bold text-[#0F1B3D]">Envio automático de parabéns</p>
            <p className="text-[11px] text-[#6C757D]">
              Desligado por padrão. O envio automático ainda não está ativo; por enquanto o envio é
              manual pelo painel de aniversariantes.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            className="mt-1 rounded text-[#0F1B3D] focus:ring-[#D4AF37]"
          />
        </div>

        <div className="pt-1">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#0F1B3D] hover:bg-[#1B2A5B] text-white text-xs h-9"
          >
            {saving ? 'Salvando...' : 'Salvar mensagem de aniversário'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
