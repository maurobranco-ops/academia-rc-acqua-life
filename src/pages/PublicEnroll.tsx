// Formulário público de matrícula (frente 3) — sem login, enviável por WhatsApp.
// Envia para a collection enrollment_requests (regras públicas só para create/list view
// do próprio registro via @request.query.id — conferência fica na área autenticada).

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Loader2, Upload, Waves } from 'lucide-react'
import { academyService } from '@/services/academy'
import { maskCpf, maskPhone } from '@/lib/formatters'
import { LogoFull } from '@/components/Logo'
import { calcAge } from '@/types/database'
import { ParqSection, AnamneseSection } from '@/components/MatriculaFormSections'
import { PARQ_EMPTY, ANAMNESE_EMPTY } from '@/lib/matricula'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const MAX_FILE_MB = 10

export default function PublicEnroll() {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [rgFile, setRgFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    student_name: '',
    student_birth_date: '',
    student_cpf: '',
    student_phone: '',
    guardian_name: '',
    guardian_cpf: '',
    guardian_phone: '',
    anamnese_medicamentos: '',
    anamnese_objetivo: '',
    uso_imagem_autorizado: '',
  })
  const [parq, setParq] = useState<ParqValues>({ ...PARQ_EMPTY })
  const [anamnese, setAnamnese] = useState<Partial<Record<AnamneseKey, string>>>({
    ...ANAMNESE_EMPTY,
  })

  const age = useMemo(() => calcAge(form.student_birth_date), [form.student_birth_date])
  const isMinor = age !== null && age < 18

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!photoFile) {
      setError('Envie a foto do rosto do aluno — ela é obrigatória.')
      return
    }
    if (isMinor && (!rgFile || !form.guardian_name || !form.guardian_cpf || !form.guardian_phone)) {
      setError(
        'Para menores de 18 anos, os dados do responsável e a imagem do RG são obrigatórios.',
      )
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('student_name', form.student_name)
      if (form.student_birth_date) fd.append('student_birth_date', form.student_birth_date)
      fd.append('student_cpf', form.student_cpf)
      fd.append('student_phone', form.student_phone)
      if (isMinor) {
        fd.append('guardian_name', form.guardian_name)
        fd.append('guardian_cpf', form.guardian_cpf)
        fd.append('guardian_phone', form.guardian_phone)
      }
      fd.append('student_age', String(age ?? ''))
      PARQ_QUESTIONS.forEach((q) => fd.append(q.key, parq[q.key] || ''))
      ANAMNESE_QUESTIONS.forEach((q) => fd.append(q.key, anamnese[q.key] || ''))
      fd.append('anamnese_medicamentos', form.anamnese_medicamentos)
      fd.append('anamnese_objetivo', form.anamnese_objetivo)
      fd.append('uso_imagem_autorizado', form.uso_imagem_autorizado)
      fd.append('photo_file', photoFile)
      if (isMinor && rgFile) fd.append('guardian_rg_file', rgFile)
      await academyService.createEnrollmentRequest(fd)
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(
        getErrorMessage(err) || 'Não foi possível enviar. Verifique os dados e tente de novo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function FileField({
    label,
    hint,
    accept,
    file,
    onSelect,
    required,
  }: {
    label: string
    hint: string
    accept: string
    file: File | null
    onSelect: (f: File | null) => void
    required?: boolean
  }) {
    return (
      <div className="space-y-1">
        <Label className="font-semibold text-[11px] text-[#1E2A3A]">
          {label} {required && <span className="text-red-600">*</span>}
        </Label>
        <label className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-input bg-white cursor-pointer hover:border-[#D4AF37] transition">
          <span className="text-xs text-[#1E2A3A] truncate">
            {file ? file.name : 'Selecionar imagem...'}
          </span>
          <Upload className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <input
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-[10px] text-slate-500">{hint}</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F1B3D] to-[#1a2b57] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white rounded-2xl p-8 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold text-[#0F1B3D]">Inscrição enviada!</h1>
          <p className="text-sm text-[#6C757D]">
            Recebemos sua solicitação de matrícula. A academia fará a conferência dos dados e dos
            exames obrigatórios e entrará em contato para confirmar a vaga.
          </p>
          <p className="text-[11px] text-slate-500">
            RC Acqua Life — Natação e Hidroginástica · Bayeux - PB
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F1B3D] to-[#1a2b57] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center space-y-2 text-white">
          <Waves className="w-8 h-8 text-[#D4AF37] mx-auto" />
          <h1 className="text-2xl font-bold">Ficha de Matrícula</h1>
          <p className="text-xs text-white/80">
            RC Acqua Life — Natação e Hidroginástica · Bayeux - PB
          </p>
        </div>

        <Card className="bg-white rounded-2xl p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dados do aluno */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="text-xs font-bold text-[#0F1B3D]">Dados do Aluno</div>
              <div className="space-y-1">
                <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                  Nome Completo <span className="text-red-600">*</span>
                </Label>
                <Input
                  required
                  placeholder="Ex: Mariana Silva"
                  value={form.student_name}
                  onChange={(e) => set('student_name', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                    Data de Nascimento <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    type="date"
                    required
                    value={form.student_birth_date}
                    onChange={(e) => set('student_birth_date', e.target.value)}
                    className="h-8 text-xs"
                  />
                  {age !== null && (
                    <p className="text-[10px] text-slate-500">
                      {age} ano{age === 1 ? '' : 's'}
                      {isMinor && ' — menor de idade: dados do responsável obrigatórios'}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                    CPF (se houver)
                  </Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={form.student_cpf}
                    onChange={(e) => set('student_cpf', maskCpf(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                  Telefone / WhatsApp
                </Label>
                <Input
                  placeholder="(84) 90000-0000"
                  value={form.student_phone}
                  onChange={(e) => set('student_phone', maskPhone(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <FileField
                label="Foto do rosto do aluno"
                hint={`Obrigatória · até ${MAX_FILE_MB}MB (JPG ou PNG)`}
                accept="image/jpeg,image/png,image/webp"
                file={photoFile}
                onSelect={setPhotoFile}
                required
              />
            </div>

            {/* Responsável (obrigatório se menor) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="text-xs font-bold text-[#0F1B3D]">
                Dados do Responsável{' '}
                {isMinor && <span className="text-red-600">(obrigatório — menor de 18 anos)</span>}
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                  Nome do responsável {isMinor && <span className="text-red-600">*</span>}
                </Label>
                <Input
                  required={isMinor}
                  value={form.guardian_name}
                  onChange={(e) => set('guardian_name', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                    CPF do responsável {isMinor && <span className="text-red-600">*</span>}
                  </Label>
                  <Input
                    required={isMinor}
                    placeholder="000.000.000-00"
                    value={form.guardian_cpf}
                    onChange={(e) => set('guardian_cpf', maskCpf(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-semibold text-[11px] text-[#1E2A3A]">
                    Celular do responsável {isMinor && <span className="text-red-600">*</span>}
                  </Label>
                  <Input
                    required={isMinor}
                    placeholder="(84) 90000-0000"
                    value={form.guardian_phone}
                    onChange={(e) => set('guardian_phone', maskPhone(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <FileField
                label="Imagem do RG do responsável"
                hint={
                  isMinor
                    ? `Obrigatória para menores — comprova nome e CPF · até ${MAX_FILE_MB}MB`
                    : 'Opcional — enviada apenas quando o aluno é menor de idade'
                }
                accept="image/jpeg,image/png,image/webp"
                file={rgFile}
                onSelect={setRgFile}
                required={isMinor}
              />
            </div>

            {/* PAR-Q + Anamnese */}
            <ParqSection
              values={parq}
              onChange={(key, v) => setParq((p) => ({ ...p, [key!]: v }))}
            />
            <AnamneseSection
              values={anamnese}
              onChange={(key, v) => setAnamnese((a) => ({ ...a, [key]: v }))}
            />

            {/* Uso de imagem */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-[#0F1B3D]">
                Autorização de uso de imagem (LGPD — Lei nº 13.709/2018)
              </div>
              <p className="text-[11px] text-slate-600">
                Concorda com o uso da imagem do(a) aluno(a) em fotos e vídeos institucionais da
                academia (redes sociais e divulgação)?
              </p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="uso_imagem"
                    checked={form.uso_imagem_autorizado === 'sim'}
                    onChange={() => set('uso_imagem_autorizado', 'sim')}
                  />
                  Autorizo
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="uso_imagem"
                    checked={form.uso_imagem_autorizado === 'nao'}
                    onChange={() => set('uso_imagem_autorizado', 'nao')}
                  />
                  Não autorizo
                </label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-10 bg-[#D4AF37] hover:bg-[#B8953A] text-[#0F1B3D] font-bold"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Enviando...' : 'Enviar inscrição'}
            </Button>
            <p className="text-center text-[10px] text-slate-400">
              Lei Estadual nº 9.863/2012-PB · Atestado de aptidão física e exame dermatológico
              obrigatórios (validade de 6 meses)
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}
