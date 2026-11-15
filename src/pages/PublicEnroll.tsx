// Formulário público de matrícula (/matricula) da RC Acqua Life.
// Envia a inscrição para a collection enrollment_requests, conferida em /matriculas.
// Melhorias: checkbox "aluno é o próprio responsável", responsável obrigatório para
// menor de 18, endereço com busca ViaCEP + edição manual e a declaração de entrega
// dos DOIS exames (cardiológico + dermatológico — Lei Estadual nº 9.863/2012-PB).
// Os dados técnicos dos exames (datas, CRM, status) são lançados pelo administrador
// na aprovação da matrícula em /matriculas — o formulário público não os coleta.

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Send, UserCheck } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogoFull } from '@/components/Logo'
import {
  ParqSection,
  AnamneseSection,
  type ParqKey,
  type AnamneseKey,
} from '@/components/MatriculaFormSections'
import {
  EnrollAddressSection,
  EMPTY_ADDRESS,
  type EnrollAddressValue,
} from '@/components/EnrollAddressSection'
import { maskCpf, maskPhone } from '@/lib/formatters'
import { FICHA_LEGAL } from '@/lib/matricula'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface GuardianData {
  name: string
  cpf: string
  phone: string
  email: string
}

const EMPTY_GUARDIAN: GuardianData = { name: '', cpf: '', phone: '', email: '' }

/** Idade a partir da data de nascimento (YYYY-MM-DD), considerando o aniversário do ano. */
function calcAge(birthDate: string): number | null {
  if (!birthDate) return null
  const b = new Date(`${birthDate}T12:00:00`)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '')
}

export default function PublicEnroll() {
  const [studentName, setStudentName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [studentCpf, setStudentCpf] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [studentEmail, setStudentEmail] = useState('')

  // Responsável
  const [isSelf, setIsSelf] = useState(false)
  const [guardian, setGuardian] = useState<GuardianData>(EMPTY_GUARDIAN)
  const [rgFile, setRgFile] = useState<File | null>(null)

  // Endereço (CEP com busca ViaCEP + edição manual)
  const [address, setAddress] = useState<EnrollAddressValue>({ ...EMPTY_ADDRESS })

  // Saúde (PAR-Q + anamnese)
  const [parq, setParq] = useState<Record<string, string>>({})
  const [anamnese, setAnamnese] = useState<Record<string, string>>({})
  const [usoImagem, setUsoImagem] = useState<'sim' | 'nao' | ''>('')

  // Exames (Lei PB 9.863/2012): UMA declaração de entrega — os dados técnicos
  // (datas, CRM, status) são lançados pelo administrador na aprovação.
  const [examsDelivered, setExamsDelivered] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const age = useMemo(() => calcAge(birthDate), [birthDate])
  const isMinor = age !== null && age < 18

  // Checkbox "aluno é o próprio responsável": preenche o responsável com os dados do
  // aluno e oculta a seção. Ao desmarcar, mantém o que o usuário digitou no aluno.
  const handleSelfChange = (checked: boolean) => {
    setIsSelf(checked)
    if (checked) {
      setGuardian({
        name: studentName.trim(),
        cpf: studentCpf,
        phone: studentPhone,
        email: studentEmail,
      })
      setRgFile(null)
      setErrors((e) => {
        const next = { ...e }
        delete next.guardian_name
        delete next.guardian_cpf
        delete next.guardian_phone
        delete next.guardian_email
        delete next.guardian_rg
        return next
      })
    }
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}

    if (!studentName.trim()) next.student_name = 'Informe o nome do aluno.'
    if (!birthDate) next.student_birth = 'Informe a data de nascimento.'
    if (studentCpf && onlyDigits(studentCpf).length !== 11)
      next.student_cpf = 'CPF do aluno incompleto (11 dígitos).'
    if (studentPhone && onlyDigits(studentPhone).length < 10)
      next.student_phone = 'Telefone incompleto.'
    if (studentEmail && !/^\S+@\S+\.\S+$/.test(studentEmail))
      next.student_email = 'E-mail inválido.'

    if (isMinor) {
      if (!guardian.name.trim()) next.guardian_name = 'Responsável é obrigatório para menor de 18.'
      if (!guardian.cpf.trim()) {
        next.guardian_cpf = 'CPF do responsável é obrigatório para menor de 18.'
      } else if (onlyDigits(guardian.cpf).length !== 11) {
        next.guardian_cpf = 'CPF do responsável incompleto (11 dígitos).'
      }
      if (!guardian.phone.trim()) {
        next.guardian_phone = 'Telefone do responsável é obrigatório para menor de 18.'
      } else if (onlyDigits(guardian.phone).length < 10) {
        next.guardian_phone = 'Telefone do responsável incompleto.'
      }
      if (!guardian.email.trim()) {
        next.guardian_email = 'E-mail do responsável é obrigatório para menor de 18.'
      } else if (!/^\S+@\S+\.\S+$/.test(guardian.email)) {
        next.guardian_email = 'E-mail do responsável inválido.'
      }
      if (!rgFile)
        next.guardian_rg = 'Anexe a foto/scan do RG do responsável (obrigatório p/ menor).'
    } else if (
      !isSelf &&
      guardian.name.trim() &&
      onlyDigits(guardian.cpf) &&
      onlyDigits(guardian.cpf).length !== 11
    ) {
      next.guardian_cpf = 'CPF do responsável incompleto (11 dígitos).'
    }

    if (address.cep && onlyDigits(address.cep).length !== 8)
      next.cep = 'CEP incompleto (8 dígitos).'
    if (address.cep && onlyDigits(address.cep).length === 8 && !address.city.trim())
      next.city = 'Informe a cidade.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const effGuardian = isSelf
        ? { name: studentName.trim(), cpf: studentCpf, phone: studentPhone, email: studentEmail }
        : guardian

      const payload: Record<string, string> = {
        student_name: studentName.trim(),
        student_birth_date: birthDate,
        student_age: String(age ?? ''),
        student_cpf: studentCpf,
        student_phone: studentPhone,
        student_email: studentEmail,
        guardian_name: effGuardian.name,
        guardian_cpf: effGuardian.cpf,
        guardian_phone: effGuardian.phone,
        guardian_email: effGuardian.email,
        cep: address.cep,
        street: address.street,
        street_number: address.street_number,
        complement: address.complement,
        neighborhood: address.neighborhood,
        city: address.city,
        uf: address.uf,
        exams_delivered: examsDelivered ? 'sim' : 'nao',
        status: 'pendente',
      }
      Object.keys(parq).forEach((k) => {
        payload[k] = parq[k]
      })
      Object.keys(anamnese).forEach((k) => {
        payload[k] = anamnese[k]
      })
      if (usoImagem) payload.uso_imagem_autorizado = usoImagem

      const record = await pb.collection('enrollment_requests').create(payload)
      if (rgFile) {
        const fd = new FormData()
        fd.append('guardian_rg_file', rgFile, rgFile.name)
        await pb.collection('enrollment_requests').update(record.id, fd)
      }

      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F1B3D] to-[#1a2b57] flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h1 className="text-xl font-bold text-[#0F1B3D]">Inscrição enviada!</h1>
          <p className="text-sm text-slate-600">
            Recebemos sua solicitação de matrícula. Nossa equipe fará a conferência dos dados,
            exames e documentos, e entrará em contato em breve.
          </p>
          <p className="text-xs text-slate-500">{FICHA_LEGAL.footer}</p>
        </Card>
      </div>
    )
  }

  const errCls = (field: string) =>
    errors[field] ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-[#D4AF37]'
  const Err = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-[10px] text-red-600 font-medium">{errors[field]}</p> : null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-b from-[#0F1B3D] to-[#1a2b57] text-white py-10 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <LogoFull
            size={72}
            textClassName="text-lg"
            subtitleClassName="text-xs"
            className="mx-auto"
          />
          <h1 className="text-3xl font-bold">Matrícula RC Acqua Life</h1>
          <p className="text-sm text-white/80">
            Academia de Natação e Hidroginástica — {FICHA_LEGAL.city}
          </p>
          <p className="text-xs text-white/70 max-w-lg mx-auto">{FICHA_LEGAL.footer}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {submitError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-xs text-red-700">
              <p className="font-semibold">Não foi possível enviar a inscrição.</p>
              <p>{submitError}</p>
            </div>
          </div>
        )}
        {Object.keys(errors).length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 font-medium">
              Verifique os campos destacados abaixo antes de enviar.
            </p>
          </div>
        )}

        {/* Dados do aluno */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#0F1B3D]">1. Dados do(a) aluno(a)</h2>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E2A3A]">Nome completo *</Label>
            <Input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Nome completo do aluno"
              className={`h-9 text-sm ${errCls('student_name')}`}
            />
            <Err field="student_name" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E2A3A]">Data de nascimento *</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={`h-9 text-sm ${errCls('student_birth')}`}
              />
              <Err field="student_birth" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E2A3A]">CPF</Label>
              <Input
                value={maskCpf(studentCpf)}
                onChange={(e) => setStudentCpf(e.target.value)}
                placeholder="000.000.000-00"
                className={`h-9 text-sm ${errCls('student_cpf')}`}
              />
              <Err field="student_cpf" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E2A3A]">Telefone / WhatsApp</Label>
              <Input
                value={maskPhone(studentPhone)}
                onChange={(e) => setStudentPhone(e.target.value)}
                placeholder="(83) 90000-0000"
                className={`h-9 text-sm ${errCls('student_phone')}`}
              />
              <Err field="student_phone" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E2A3A]">E-mail</Label>
              <Input
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className={`h-9 text-sm ${errCls('student_email')}`}
              />
              <Err field="student_email" />
            </div>
          </div>
          {isMinor && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Aluno(a) menor de 18 anos: o responsável deve ser identificado na seção 2, com RG
              anexado.
            </p>
          )}
        </Card>

        {/* Endereço com ViaCEP */}
        <EnrollAddressSection
          value={address}
          onChange={(p) => setAddress((a) => ({ ...a, ...p }))}
          errors={errors}
        />

        {/* Responsável */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#0F1B3D]">2. Dados do responsável</h2>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
            <Checkbox
              id="self-guardian"
              checked={isSelf}
              disabled={isMinor}
              onCheckedChange={(v) => handleSelfChange(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="self-guardian" className="text-xs font-semibold text-[#1E2A3A]">
                O aluno é o próprio responsável?
              </Label>
              <p className="text-[10px] text-slate-500">
                Marque se o aluno é maior de 18 anos e responde pela própria matrícula — os dados
                serão copiados da seção 1.
              </p>
            </div>
          </div>

          {!isSelf && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1E2A3A]">
                  Nome do responsável {isMinor && <span className="text-red-600">*</span>}
                </Label>
                <Input
                  value={guardian.name}
                  onChange={(e) => setGuardian((g) => ({ ...g, name: e.target.value }))}
                  placeholder="Nome completo do responsável"
                  className={`h-9 text-sm ${errCls('guardian_name')}`}
                />
                <Err field="guardian_name" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#1E2A3A]">
                    CPF {isMinor && <span className="text-red-600">*</span>}
                  </Label>
                  <Input
                    value={maskCpf(guardian.cpf)}
                    onChange={(e) => setGuardian((g) => ({ ...g, cpf: e.target.value }))}
                    placeholder="000.000.000-00"
                    className={`h-9 text-sm ${errCls('guardian_cpf')}`}
                  />
                  <Err field="guardian_cpf" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#1E2A3A]">
                    Telefone / WhatsApp {isMinor && <span className="text-red-600">*</span>}
                  </Label>
                  <Input
                    value={maskPhone(guardian.phone)}
                    onChange={(e) => setGuardian((g) => ({ ...g, phone: e.target.value }))}
                    placeholder="(83) 90000-0000"
                    className={`h-9 text-sm ${errCls('guardian_phone')}`}
                  />
                  <Err field="guardian_phone" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1E2A3A]">
                  E-mail {isMinor && <span className="text-red-600">*</span>}
                </Label>
                <Input
                  type="email"
                  value={guardian.email}
                  onChange={(e) => setGuardian((g) => ({ ...g, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className={`h-9 text-sm ${errCls('guardian_email')}`}
                />
                <Err field="guardian_email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1E2A3A]">
                  RG do responsável {isMinor && <span className="text-red-600">*</span>}
                </Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setRgFile(e.target.files?.[0] ?? null)}
                  className={`h-9 text-xs file:mr-2 file:px-2 file:py-1 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0F1B3D] file:text-white ${errCls(
                    'guardian_rg',
                  )}`}
                />
                <Err field="guardian_rg" />
                <p className="text-[10px] text-slate-500">
                  Foto ou scan do documento (imagem ou PDF).{' '}
                  {isMinor ? 'Obrigatório para menor de 18.' : 'Opcional.'}
                </p>
              </div>
            </div>
          )}

          {isSelf && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              Os dados do responsável serão os mesmos do aluno (seção 1).
            </p>
          )}
        </Card>

        {/* Saúde */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#0F1B3D]">3. Saúde</h2>
          <ParqSection
            values={parq}
            onChange={(key: ParqKey, v: string) => setParq((q) => ({ ...q, [key]: v }))}
          />
          <AnamneseSection
            values={anamnese}
            onChange={(key: AnamneseKey, v: string) => setAnamnese((p) => ({ ...p, [key]: v }))}
          />
          {/* Uso de imagem */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E2A3A]">
              Autorização de uso de imagem (LGPD)
            </Label>
            <select
              value={usoImagem}
              onChange={(e) => setUsoImagem(e.target.value as 'sim' | 'nao' | '')}
              className={`h-9 w-full text-sm rounded-md border bg-white px-2 outline-none ${
                errors.uso_imagem ? 'border-red-500' : 'border-slate-200'
              } focus-visible:ring-[#D4AF37]`}
            >
              <option value="">Selecione…</option>
              <option value="sim">Autorizo o uso de imagem</option>
              <option value="nao">Não autorizo o uso de imagem</option>
            </select>
          </div>
        </Card>

        {/* Exames */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#0F1B3D]">4. Exames médicos</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            São exigidos apenas os <strong>DOIS exames</strong> abaixo — o{' '}
            <strong>atestado cardiológico</strong> e o <strong>exame dermatológico</strong>, com
            validade de 6 meses ({FICHA_LEGAL.law}). Os dados técnicos (datas de emissão, CRM e
            status) serão lançados pela academia na conferência da matrícula.
          </p>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
            <Checkbox
              id="exams-delivered"
              checked={examsDelivered}
              onCheckedChange={(v) => setExamsDelivered(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="exams-delivered" className="text-xs font-semibold text-[#1E2A3A]">
                Declaro que entreguei os atestados cardiológico e dermatológico
              </Label>
              <p className="text-[10px] text-slate-500">{FICHA_LEGAL.cardioLawText}</p>
            </div>
          </div>
        </Card>

        {/* Termo legal */}
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-bold text-[#0F1B3D]">
            5. Termo de ciência — {FICHA_LEGAL.law}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">{FICHA_LEGAL.riskTerm}</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>Normas da academia:</strong> Conforme {FICHA_LEGAL.law}, é obrigatória a
            apresentação do atestado cardiológico e do exame médico dermatológico, com validade de 6
            (seis) meses.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">{FICHA_LEGAL.lgpd}</p>
        </Card>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-11 bg-[#0F1B3D] hover:bg-[#1a2b57] text-white font-bold"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {submitting ? 'Enviando…' : 'Enviar inscrição'}
        </Button>
      </form>

      <footer className="max-w-2xl mx-auto px-4 pb-10 text-center">
        <p className="text-[10px] text-slate-400">
          {FICHA_LEGAL.city} · Documento gerado pela RC Acqua Life · {FICHA_LEGAL.law}
        </p>
      </footer>
    </div>
  )
}
