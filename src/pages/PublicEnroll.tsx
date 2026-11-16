// Formulário público de matrícula (/matricula) da RC Acqua Life.
// Envia a inscrição para a collection enrollment_requests, conferida em /matriculas.
// Melhorias: checkbox "aluno é o próprio responsável", responsável obrigatório para
// menor de 18, endereço com busca ViaCEP + edição manual e a declaração de entrega
// dos DOIS exames (cardiológico + dermatológico — Lei Estadual nº 9.863/2012-PB).
// Os dados técnicos dos exames (datas, CRM, status) são lançados pelo administrador
// na aprovação da matrícula em /matriculas — o formulário público não os coleta.
// Preferências: atividades pretendidas (Natação/Hidroginástica), turma(s) pretendida(s)
// (listadas da collection classes — leitura pública, sem login) e dia de vencimento
// da mensalidade (5/10/15/20/25, obrigatório).

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Send, UserCheck } from 'lucide-react'
import { ClientResponseError } from 'pocketbase'
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
import { compressImage } from '@/lib/imageCompression'
import { maskCpf, maskPhone, cpfFieldError, CPF_INVALID_MESSAGE } from '@/lib/formatters'
import {
  FICHA_LEGAL,
  EMPTY_PARQ_DETAILS,
  ACTIVITY_OPTIONS,
  DUE_DAY_OPTIONS,
  type ParqDetailsMap,
  type ParqDetailKey,
} from '@/lib/matricula'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import type { ClassRecord } from '@/types/database'

interface GuardianData {
  name: string
  cpf: string
  phone: string
  email: string
}

/** Rótulo curto de uma turma: nome + dias + horário. */
function classLabel(c: ClassRecord): string {
  const dayMap: Record<string, string> = {
    seg: 'Seg',
    ter: 'Ter',
    qua: 'Qua',
    qui: 'Qui',
    sex: 'Sex',
    sab: 'Sáb',
    dom: 'Dom',
  }
  const days = (c.schedule_days || []).map((x) => dayMap[String(x)] || String(x)).join(' · ')
  return [c.name, days, c.schedule_time].filter(Boolean).join(' — ')
}

const EMPTY_GUARDIAN: GuardianData = { name: '', cpf: '', phone: '', email: '' }

/** Tamanho máximo aceito por arquivo no PocketBase (photo_file e guardian_rg_file). */
const MAX_FILE_MB = 10
/** Teto do servidor (PocketBase): arquivo individual acima disso é recusado com 400. */
const SERVER_MAX_FILE_MB = 10
/** Formatos aceitos no documento do responsável: foto (JPG/PNG/WEBP) ou PDF. */
const ACCEPTED_DOC_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const DOC_FORMAT_HINT = 'Formato não aceito — envie foto (JPG/PNG) ou PDF.'

/** Rótulos amigáveis dos campos da collection, para as mensagens de erro. */
const FIELD_LABELS: Record<string, string> = {
  student_name: 'nome do aluno',
  student_birth_date: 'data de nascimento',
  student_photo: 'foto do aluno',
  photo_file: 'foto do aluno',
  guardian_rg_file: 'documento do responsável',
  guardian_rg: 'documento do responsável',
  activities: 'atividades pretendidas',
  preferred_classes: 'turmas pretendidas',
  due_day: 'dia de vencimento',
  guardian_name: 'nome do responsável',
  guardian_cpf: 'CPF do responsável',
  guardian_phone: 'telefone do responsável',
  guardian_email: 'e-mail do responsável',
}

/** Traduz a mensagem crua do PocketBase para um detalhe em português. */
function translateFieldMessage(field: string, message: string): string {
  const label =
    FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  if (/mime type/i.test(message)) {
    return `O arquivo "${label}" está em um formato não aceito — envie foto (JPG/PNG) ou PDF.`
  }
  if (/less than|size|5mb|10mb|tamanho/i.test(message)) {
    return `O arquivo "${label}" é maior que o limite de ${MAX_FILE_MB} MB — anexe uma foto/scan menor (o celular costuma reduzir automaticamente ao fotografar de novo).`
  }
  if (/cannot be blank|must not be blank|non-empty value|required/i.test(message)) {
    return `O campo "${label}" é obrigatório.`
  }
  if (/invalid value|must be a valid/i.test(message)) {
    return `O campo "${label}" tem um valor inválido.`
  }
  return message
}

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

// CPF: erro INLINE no campo, na hora da digitação (assim que os 11 dígitos
// completam, se os dígitos verificadores não baterem). Bloqueia o envio.
const isCpfInvalid = (v: string): boolean => cpfFieldError(v) !== ''

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
  // Foto do aluno (photo_file é OBRIGATÓRIO na collection enrollment_requests).
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  // Endereço (CEP com busca ViaCEP + edição manual)
  const [address, setAddress] = useState<EnrollAddressValue>({ ...EMPTY_ADDRESS })

  // Preferências: atividades, turmas pretendidas e dia de vencimento da mensalidade.
  const [activities, setActivities] = useState<string[]>([])
  const [preferredClasses, setPreferredClasses] = useState<string[]>([])
  const [dueDay, setDueDay] = useState('')
  const [classes, setClasses] = useState<ClassRecord[]>([])

  // Turmas reais cadastradas — leitura pública (sem login) na collection classes.
  useEffect(() => {
    let active = true
    pb.collection('classes')
      .getFullList<ClassRecord>({ sort: 'name' })
      .then((list) => {
        if (active) setClasses(list)
      })
      .catch(() => {
        // Sem turmas acessíveis: o campo fica vazio (não bloqueia a matrícula).
      })
    return () => {
      active = false
    }
  }, [])

  // Saúde (PAR-Q + anamnese). Perguntas 5-7 do PAR-Q aceitam detalhe escrito quando SIM.
  const [parq, setParq] = useState<Record<string, string>>({})
  const [parqDetails, setParqDetails] = useState<ParqDetailsMap>({ ...EMPTY_PARQ_DETAILS })
  const [anamnese, setAnamnese] = useState<Record<string, string>>({})
  const [usoImagem, setUsoImagem] = useState<'sim' | 'nao' | ''>('')

  // Exames (Lei PB 9.863/2012): UMA declaração de entrega SEPARADA por exame —
  // os dados técnicos (datas, CRM, status) são lançados pelo administrador na aprovação.
  const [cardioDelivered, setCardioDelivered] = useState(false)
  const [dermatoDelivered, setDermatoDelivered] = useState(false)
  // Termo de ciência (Lei Estadual nº 9.863/2012-PB): leitura e concordância obrigatórias.
  const [termAgreed, setTermAgreed] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const age = useMemo(() => calcAge(birthDate), [birthDate])
  const isMinor = age !== null && age < 18

  // Checkbox "aluno é o próprio responsável": preenche o responsável com os dados do
  // aluno e oculta apenas os DADOS de contato — o upload do documento de identificação
  // do responsável continua disponível (com a caixa marcada, é o documento do próprio
  // aluno respondendo por si). Ao desmarcar, mantém o que o usuário digitou no aluno.
  // FOTO DO ALUNO: validação IMEDIATA na escolha do arquivo — só imagem (photo_file
  // do banco aceita apenas JPEG/PNG/WEBP), até 10 MB. Formato errado ou grande
  // demais é recusado na hora, com aviso em português e seleção limpa.
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (!f) {
      setPhotoFile(null)
      setPhotoPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return ''
      })
      return
    }
    if (!f.type.startsWith('image/')) {
      e.target.value = ''
      setPhotoFile(null)
      setPhotoPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return ''
      })
      setErrors((er) => ({
        ...er,
        student_photo: 'Formato não aceito — envie uma foto (JPG/PNG).',
      }))
      return
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      e.target.value = ''
      setPhotoFile(null)
      setPhotoPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return ''
      })
      setErrors((er) => ({
        ...er,
        student_photo: `A foto do aluno é muito grande (máximo ${MAX_FILE_MB} MB) — tire a foto novamente ou reduza a resolução.`,
      }))
      return
    }
    setPhotoFile(f)
    setPhotoPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(f)
    })
    setErrors((er) => {
      if (!er.student_photo) return er
      const clean = { ...er }
      delete clean.student_photo
      return clean
    })
  }

  // DOCUMENTO DO RESPONSÁVEL: validação IMEDIATA na escolha do arquivo — foto
  // (JPG/PNG/WEBP) ou PDF, até 10 MB (limite do PocketBase). Formato errado ou
  // grande demais é recusado na hora, com aviso em português e seleção limpa.
  const handleRgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (!f) {
      setRgFile(null)
      return
    }
    const isPdf = f.type === 'application/pdf'
    const isImage = f.type.startsWith('image/')
    if (!isPdf && !isImage) {
      e.target.value = ''
      setRgFile(null)
      setErrors((er) => ({ ...er, guardian_rg: DOC_FORMAT_HINT }))
      return
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      e.target.value = ''
      setRgFile(null)
      setErrors((er) => ({
        ...er,
        guardian_rg: `Arquivo muito grande (máximo ${MAX_FILE_MB} MB) — tire a foto novamente ou envie um PDF menor.`,
      }))
      return
    }
    setRgFile(f)
    setErrors((er) => {
      if (!er.guardian_rg) return er
      const clean = { ...er }
      delete clean.guardian_rg
      return clean
    })
  }

  const handleSelfChange = (checked: boolean) => {
    setIsSelf(checked)
    if (checked) {
      setGuardian({
        name: studentName.trim(),
        cpf: studentCpf,
        phone: studentPhone,
        email: studentEmail,
      })
      setErrors((e) => {
        const next = { ...e }
        delete next.guardian_name
        delete next.guardian_cpf
        delete next.guardian_phone
        delete next.guardian_email
        return next
      })
    }
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}

    if (!studentName.trim()) next.student_name = 'Informe o nome do aluno.'
    if (!birthDate) next.student_birth = 'Informe a data de nascimento.'
    // Foto do aluno: obrigatória (photo_file é required no banco) — validação amigável
    // ANTES do envio, para nunca estourar o "Cannot be blank" cru do backend.
    if (!photoFile) next.student_photo = 'Anexe a foto do aluno — ela é obrigatória para enviar.'
    if (photoFile && !photoFile.type.startsWith('image/'))
      next.student_photo = 'A foto do aluno deve ser uma imagem (JPG, PNG etc.).'
    if (photoFile && photoFile.size > MAX_FILE_MB * 1024 * 1024)
      next.student_photo = `A foto do aluno é muito grande (máximo ${MAX_FILE_MB} MB).`
    if (studentCpf && onlyDigits(studentCpf).length !== 11)
      next.student_cpf = 'CPF do aluno incompleto (11 dígitos).'
    else if (studentCpf && isCpfInvalid(studentCpf)) next.student_cpf = CPF_INVALID_MESSAGE
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
      } else if (isCpfInvalid(guardian.cpf)) {
        next.guardian_cpf = CPF_INVALID_MESSAGE
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
      if (rgFile) {
        // Documento do responsável: foto (JPG/PNG/WEBP) ou PDF, até 10 MB.
        // (A escolha do arquivo já valida — aqui é a segunda barreira, antes do POST.)
        if (!ACCEPTED_DOC_MIMES.includes(rgFile.type)) {
          next.guardian_rg = DOC_FORMAT_HINT
        } else if (rgFile.size > MAX_FILE_MB * 1024 * 1024) {
          next.guardian_rg = `O documento do responsável é muito grande (máximo ${MAX_FILE_MB} MB). Tire a foto novamente ou envie um PDF menor.`
        }
      }
      if (!rgFile)
        next.guardian_rg = 'Anexe a foto/scan do RG do responsável (obrigatório p/ menor).'
    } else if (!isSelf && guardian.name.trim() && guardian.cpf.trim()) {
      if (onlyDigits(guardian.cpf).length !== 11) {
        next.guardian_cpf = 'CPF do responsável incompleto (11 dígitos).'
      } else if (isCpfInvalid(guardian.cpf)) {
        next.guardian_cpf = CPF_INVALID_MESSAGE
      }
    }

    if (activities.length === 0)
      next.activities = 'Marque ao menos uma atividade pretendida (Natação e/ou Hidroginástica).'
    if (!dueDay) next.due_day = 'Escolha o dia de vencimento da mensalidade (5, 10, 15, 20 ou 25).'
    if (address.cep && onlyDigits(address.cep).length !== 8)
      next.cep = 'CEP incompleto (8 dígitos).'
    if (address.cep && onlyDigits(address.cep).length === 8 && !address.city.trim())
      next.city = 'Informe a cidade.'

      // PAR-Q 5-7: se respondeu "SIM", pede a descrição (aviso suave — não bloqueia sozinho).
    ;(['parq_5', 'parq_6', 'parq_7'] as const).forEach((qk, idx) => {
      const dk = `parq_${idx + 5}_detail` as ParqDetailKey
      if (parq[qk] === 'sim' && !parqDetails[dk]?.trim()) {
        next[dk] = 'Respondeu "SIM": descreva a situação no campo de texto abaixo da pergunta.'
      }
    })

    // Termo de ciência: leitura e concordância OBRIGATÓRIAS.
    if (!termAgreed)
      next.term_agreed =
        'Marque a caixa "Li e concordo com o que está descrito no termo de ciência acima" para enviar.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    // CPF com dígitos verificadores inválidos BLOQUEIA o envio (valida antes de
    // ligar o submitting, para o botão não ficar travado com o formulário sujo).
    if (isCpfInvalid(studentCpf) || isCpfInvalid(guardian.cpf)) {
      setErrors((er) => ({
        ...er,
        ...(isCpfInvalid(studentCpf) ? { student_cpf: CPF_INVALID_MESSAGE } : {}),
        ...(isCpfInvalid(guardian.cpf) ? { guardian_cpf: CPF_INVALID_MESSAGE } : {}),
      }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      if (!validate()) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const effGuardian = isSelf
        ? { name: studentName.trim(), cpf: studentCpf, phone: studentPhone, email: studentEmail }
        : guardian

      const payload: Record<string, string> = {
        student_name: studentName.trim(),
        student_birth_date: birthDate,
        student_age: String(age ?? ''),
        student_cpf: studentCpf,
        student_phone: studentPhone,
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
        exams_cardio_delivered: cardioDelivered ? 'sim' : 'nao',
        exams_dermato_delivered: dermatoDelivered ? 'sim' : 'nao',
        term_agreed: termAgreed ? 'sim' : 'nao',
        due_day: dueDay,
        status: 'pendente',
      }
      Object.keys(parq).forEach((k) => {
        payload[k] = parq[k]
      })
      Object.keys(parqDetails).forEach((k) => {
        if (parqDetails[k as ParqDetailKey].trim()) payload[k] = parqDetails[k as ParqDetailKey]
      })
      Object.keys(anamnese).forEach((k) => {
        payload[k] = anamnese[k]
      })
      if (usoImagem) payload.uso_imagem_autorizado = usoImagem

      // FOTO do aluno (photo_file) + RG do responsável (guardian_rg_file) no MESMO
      // POST de criação — com a foto no create, o backend valida tudo de uma vez
      // (photo_file é required) e a inscrição já nasce completa, com documentos.
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v)))
      // Arrays multi-select: cada valor em uma entrada própria do FormData.
      activities.forEach((a) => fd.append('activities', a))
      preferredClasses.forEach((c) => fd.append('preferred_classes', c))
      // FOTO DO ALUNO: comprime antes de anexar (mesma rotina da tela de alunos).
      // RG DO RESPONSÁVEL: também comprime quando é imagem — uma foto de documento
      // feita no celular chega a 3-8 MB; o PDF NÃO é comprimido (a validação na
      // escolha do arquivo já garantiu o limite de 10 MB).
      if (!photoFile) {
        setErrors((er) => ({ ...er, student_photo: 'Anexe a foto do aluno para enviar.' }))
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      let photo = photoFile
      try {
        const compressed = await compressImage(photoFile, photoFile.name)
        if (compressed.file instanceof File) photo = compressed.file
        else photo = new File([compressed.file], 'foto-aluno.jpg', { type: 'image/jpeg' })
      } catch {
        // Falhou a compressão: segue com o arquivo original.
      }
      fd.append('photo_file', photo, photo.name)
      if (rgFile) {
        let rg = rgFile
        if (rgFile.type.startsWith('image/')) {
          try {
            const compressedRg = await compressImage(rgFile, rgFile.name, {
              maxWidth: 2000,
              maxHeight: 2000,
              quality: 0.85,
            })
            if (compressedRg.file instanceof File) rg = compressedRg.file
            else
              rg = new File([compressedRg.file], 'documento-responsavel.jpg', {
                type: 'image/jpeg',
              })
          } catch {
            // Falhou a compressão: segue com o original (a validação de tamanho abaixo avisa).
          }
        }
        // Segunda barreira de tamanho (a primeira já validou na escolha do arquivo).
        if (rg.size > SERVER_MAX_FILE_MB * 1024 * 1024) {
          setErrors((er) => ({
            ...er,
            guardian_rg: `O documento do responsável é muito grande (máximo ${SERVER_MAX_FILE_MB} MB) — tire a foto novamente ou envie um PDF/scan menor.`,
          }))
          setSubmitting(false)
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return
        }
        fd.append('guardian_rg_file', rg, rg.name)
      }

      await pb.collection('enrollment_requests').create(fd)

      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      // NUNCA tela muda: qualquer falha (400 de validação, queda de rede, erro
      // inesperado no próprio formulário) cai aqui e exibe o banner vermelho
      // com uma mensagem clara em português — com o DETALHE do campo recusado.
      // O PocketBase traz em err.response.data a lista de campos com problema
      // (ex.: guardian_rg_file: "must be less than 5MB") — traduzimos cada um.
      console.error('[matricula] Falha ao enviar inscrição:', err)
      if (err instanceof ClientResponseError && err.response?.data) {
        console.error('[matricula] Detalhe de validação do PocketBase:', err.response.data)
      }
      let msg: string
      if (err instanceof ClientResponseError && err.status === 0) {
        msg = 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
      } else if (err instanceof ClientResponseError && err.status === 400) {
        const fieldErrors = extractFieldErrors(err)
        const details = Object.entries(fieldErrors)
          .map(([field, message]) => translateFieldMessage(field, message))
          .filter(Boolean)
        // Sem detalhe traduzido: mensagem genérica, mas indicando que houve
        // recusa de validação — nunca "erro desconhecido" sem pista.
        msg = details.length
          ? `Não foi possível enviar sua matrícula: ${details.join(' ')}`
          : 'Não foi possível enviar sua matrícula. Verifique os campos obrigatórios e o tamanho dos arquivos (máximo 10 MB por arquivo) e tente novamente.'
      } else {
        const raw = getErrorMessage(err)
        msg =
          raw && !/failed to create|unexpected error|cannot be blank/i.test(raw)
            ? raw
            : 'Não foi possível enviar sua matrícula. Verifique os dados e tente novamente.'
      }
      setSubmitError(msg)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
            size={110}
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
                onChange={(e) => {
                  setStudentCpf(e.target.value)
                  setErrors((er) => {
                    const live = cpfFieldError(e.target.value)
                    const next = { ...er }
                    if (live) next.student_cpf = live
                    else delete next.student_cpf
                    return next
                  })
                }}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className={`h-9 text-sm ${errCls('student_cpf')}`}
              />
              {cpfFieldError(studentCpf) && !errors.student_cpf && (
                <p className="text-[11px] text-red-600 font-medium">{cpfFieldError(studentCpf)}</p>
              )}
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
          {/* Foto do aluno: campo OBRIGATÓRIO (photo_file, required no banco).
              Sem ela o envio é bloqueado com mensagem amigável — nunca o erro cru. */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E2A3A]">
              Foto do aluno <span className="text-red-600">*</span>
            </Label>
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Prévia da foto do aluno"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                    Sem foto
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className={`h-9 text-xs file:mr-2 file:px-2 file:py-1 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0F1B3D] file:text-white ${errCls(
                    'student_photo',
                  )}`}
                />
                <Err field="student_photo" />
                <p className="text-[10px] text-slate-500">
                  Foto do rosto do aluno (imagem). Obrigatória — usada na ficha e na lista de
                  alunos.
                </p>
              </div>
            </div>
          </div>
          {isMinor && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Aluno(a) menor de 18 anos: o responsável deve ser identificado na seção 2, com RG
              anexado.
            </p>
          )}
        </Card>

        {/* Preferências: atividades, turmas pretendidas e dia de vencimento */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#0F1B3D]">2. Preferências da matrícula</h2>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E2A3A]">
              Atividade(s) pretendida(s) <span className="text-red-600">*</span>
            </Label>
            <div className="flex flex-wrap gap-4">
              {ACTIVITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1E2A3A]"
                >
                  <Checkbox
                    checked={activities.includes(opt.value)}
                    onCheckedChange={(v) =>
                      setActivities((prev) =>
                        v === true
                          ? prev.includes(opt.value)
                            ? prev
                            : [...prev, opt.value]
                          : prev.filter((x) => x !== opt.value),
                      )
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">
              Marque uma ou as duas — Natação e Hidroginástica.
            </p>
            <Err field="activities" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E2A3A]">Turma(s) pretendida(s)</Label>
            {classes.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Nenhuma turma disponível no momento — a academia definirá a turma na conferência.
              </p>
            ) : (
              <>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {classes.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={preferredClasses.includes(c.id)}
                        onCheckedChange={(v) =>
                          setPreferredClasses((prev) =>
                            v === true
                              ? prev.includes(c.id)
                                ? prev
                                : [...prev, c.id]
                              : prev.filter((x) => x !== c.id),
                          )
                        }
                      />
                      <span className="text-[#1E2A3A] font-medium">{classLabel(c)}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">
                  Turma(s) de preferência (pode marcar mais de uma) — a vaga é confirmada pela
                  academia na conferência da matrícula.
                </p>
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E2A3A]">
              Dia de vencimento da mensalidade <span className="text-red-600">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {DUE_DAY_OPTIONS.map((d) => (
                <label
                  key={d}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    dueDay === String(d)
                      ? 'border-[#0F1B3D] bg-[#0F1B3D] text-white'
                      : 'border-slate-200 bg-white text-[#1E2A3A] hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="due-day"
                    className="sr-only"
                    checked={dueDay === String(d)}
                    onChange={() => {
                      setDueDay(String(d))
                      setErrors((e) => {
                        if (!e.due_day) return e
                        const clean = { ...e }
                        delete clean.due_day
                        return clean
                      })
                    }}
                  />
                  Dia {d}
                </label>
              ))}
            </div>
            <Err field="due_day" />
          </div>
        </Card>

        {/* Endereço com ViaCEP */}
        <EnrollAddressSection
          value={address}
          onChange={(p) => setAddress((a) => ({ ...a, ...p }))}
          errors={errors}
        />

        {/* Responsável */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#0F1B3D]">3. Dados do responsável</h2>
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
                    onChange={(e) => {
                      const v = e.target.value
                      setGuardian((g) => ({ ...g, cpf: v }))
                      setErrors((er) => {
                        const live = cpfFieldError(v)
                        const next = { ...er }
                        if (live) next.guardian_cpf = live
                        else delete next.guardian_cpf
                        return next
                      })
                    }}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
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
                  Documento de identificação do responsável{' '}
                  {isMinor && <span className="text-red-600">*</span>}
                </Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleRgFileChange}
                  className={`h-9 text-xs file:mr-2 file:px-2 file:py-1 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0F1B3D] file:text-white ${errCls(
                    'guardian_rg',
                  )}`}
                />
                <Err field="guardian_rg" />
                <p className="text-[10px] text-slate-500">
                  Foto ou scan do documento (imagem JPG/PNG ou PDF, até 10 MB).{' '}
                  {isMinor ? 'Obrigatório para menor de 18.' : 'Opcional.'}
                </p>
              </div>
            </div>
          )}

          {isSelf && (
            <div className="space-y-3">
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                Os dados do responsável serão os mesmos do aluno (seção 1).
              </p>
              {/* Com a caixa marcada, o documento de identificação do responsável é o
                  documento do PRÓPRIO aluno respondendo por si — continua disponível. */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1E2A3A]">
                  Documento de identificação do responsável
                </Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleRgFileChange}
                  className={`h-9 text-xs file:mr-2 file:px-2 file:py-1 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0F1B3D] file:text-white ${errCls(
                    'guardian_rg',
                  )}`}
                />
                <Err field="guardian_rg" />
                <p className="text-[10px] text-slate-500">
                  Aluno(a) maior de 18 respondendo pela própria matrícula: anexe o documento dele(a)
                  (imagem JPG/PNG ou PDF, até 10 MB) — usado na conferência da inscrição. Opcional.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Saúde */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#0F1B3D]">4. Saúde</h2>
          <ParqSection
            values={parq}
            details={parqDetails}
            detailErrors={errors as Partial<Record<ParqDetailKey, string>>}
            onDetailChange={(key: ParqDetailKey, v: string) =>
              setParqDetails((d) => {
                const next = { ...d, [key]: v }
                setErrors((e) => {
                  if (!next[key].trim() && e[key]) return e
                  const clean = { ...e }
                  delete clean[key]
                  return clean
                })
                return next
              })
            }
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
          <h2 className="text-sm font-bold text-[#0F1B3D]">5. Exames médicos</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            São exigidos apenas os <strong>DOIS exames</strong> abaixo — o{' '}
            <strong>atestado cardiológico</strong> e o <strong>exame dermatológico</strong>, com
            validade de 6 meses ({FICHA_LEGAL.law}). Os dados técnicos (datas de emissão, CRM e
            status) serão lançados pela academia na conferência da matrícula.
          </p>
          {/* Uma caixa de seleção SEPARADA para cada exame (Lei Estadual nº 9.863/2012-PB) */}
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
            <Checkbox
              id="exams-cardio-delivered"
              checked={cardioDelivered}
              onCheckedChange={(v) => setCardioDelivered(v === true)}
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="exams-cardio-delivered"
                className="text-xs font-semibold text-[#1E2A3A]"
              >
                Declaro que entreguei o <strong>atestado cardiológico</strong>
              </Label>
              <p className="text-[10px] text-slate-500">{FICHA_LEGAL.cardioLawText}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
            <Checkbox
              id="exams-dermato-delivered"
              checked={dermatoDelivered}
              onCheckedChange={(v) => setDermatoDelivered(v === true)}
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="exams-dermato-delivered"
                className="text-xs font-semibold text-[#1E2A3A]"
              >
                Declaro que entreguei o <strong>exame dermatológico</strong>
              </Label>
              <p className="text-[10px] text-slate-500">
                Exame Médico Dermatológico — {FICHA_LEGAL.law}, validade de 6 meses.
              </p>
            </div>
          </div>
        </Card>

        {/* Termo legal */}
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-bold text-[#0F1B3D]">
            6. Termo de ciência — {FICHA_LEGAL.law}
          </h2>{' '}
          <p className="text-xs text-slate-600 leading-relaxed">{FICHA_LEGAL.riskTerm}</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>Normas da academia:</strong> Conforme {FICHA_LEGAL.law}, é obrigatória a
            apresentação do atestado cardiológico e do exame médico dermatológico, com validade de 6
            (seis) meses.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">{FICHA_LEGAL.lgpd}</p>
          {/* Concordância obrigatória com o termo de ciência (Lei Estadual nº 9.863/2012-PB) */}
          <div
            className={`flex items-start gap-2 rounded-lg p-2.5 border ${
              errors.term_agreed ? 'border-red-300 bg-red-50' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <Checkbox
              id="term-agreed"
              checked={termAgreed}
              onCheckedChange={(v) => {
                setTermAgreed(v === true)
                if (v === true)
                  setErrors((e) => {
                    const clean = { ...e }
                    delete clean.term_agreed
                    return clean
                  })
              }}
            />
            <div className="space-y-0.5">
              <Label htmlFor="term-agreed" className="text-xs font-semibold text-[#1E2A3A]">
                Li e concordo com o que está descrito no termo de ciência acima{' '}
                <span className="text-red-600">*</span>
              </Label>
              <p className="text-[10px] text-slate-500">
                Concordância obrigatória para enviar a inscrição — {FICHA_LEGAL.law}.
              </p>
              {errors.term_agreed && <Err field="term_agreed" />}
            </div>
          </div>
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
          {submitting
            ? 'Enviando…'
            : submitError
              ? 'Enviar inscrição novamente'
              : 'Enviar inscrição'}
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
