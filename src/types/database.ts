import type { RecordModel } from 'pocketbase'
import { readDateParts } from '@/lib/dates'

export interface UserRecord extends RecordModel {
  email: string
  name: string
  avatar?: string
  verified: boolean
}

export interface PlanRecord extends RecordModel {
  name: string
  monthly_price: number
  description?: string
  is_active: boolean
}

export interface InstructorRecord extends RecordModel {
  name: string
  email?: string
  phone?: string
  specialty: 'natacao' | 'hidroginastica' | 'ambos'
  is_active: boolean
}

export interface StudentRecord extends RecordModel {
  name: string
  email?: string
  phone?: string
  cpf?: string
  birth_date?: string
  address?: string
  plan_id?: string
  status: 'ativo' | 'inativo'
  bubble_id?: string
  photo?: string
  photo_file?: string
  guardian_name?: string
  guardian_cpf?: string
  guardian_email?: string
  guardian_phone?: string
  whatsapp?: string
  monthly_fee?: number
  discounted_fee?: number
  due_day?: number
  situation?: string
  atestado_validade?: string
  trancamento_validade?: string
  fee_suspended?: boolean
  raw_situation?: string
  validade_do_ultimo_pagamento?: string
  cep?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  uf?: string
  // Controle de matrícula — exames, PAR-Q, anamnese e uso de imagem (migration 0017)
  aptidao_date?: string
  aptidao_crm?: string
  aptidao_status?: 'entregue' | 'pendente'
  dermato_date?: string
  dermato_status?: 'entregue' | 'pendente'
  cardio_date?: string
  cardio_crm?: string
  cardio_status?: 'entregue' | 'pendente'
  parq_1?: string
  parq_2?: string
  parq_3?: string
  parq_4?: string
  parq_5?: string
  parq_6?: string
  parq_7?: string
  // Detalhes escritos das perguntas 5-7 do PAR-Q (migration 0022)
  parq_5_detail?: string
  parq_6_detail?: string
  parq_7_detail?: string
  anamnese_medo_agua?: string
  anamnese_convulsoes?: string
  anamnese_alergia_cloro?: string
  anamnese_medicamentos?: string
  anamnese_objetivo?: string
  uso_imagem_autorizado?: 'sim' | 'nao'
  // Referência das preferências escolhidas na matrícula on-line (migration 0023)
  observacoes_matricula?: string
  // Controle de reimpressão da ficha de matrícula (migration 0030):
  // ficha_assinada_em = data da última assinatura da ficha impressa;
  // ficha_pendente = cadastro editado e ficha precisa ser reimpressa.
  ficha_assinada_em?: string
  ficha_pendente?: boolean
  /** Data da última atualização enviada pelo próprio aluno (link seguro /atualizar). */
  atualizado_pelo_aluno_em?: string
  /** Data/hora do aceite do termo de ciência (migration 0033, link seguro /atualizar). */
  termo_ciencia_aceito_em?: string
  expand?: {
    plan_id?: PlanRecord
  }
}

export interface ClassRecord extends RecordModel {
  name: string
  type: 'natacao' | 'hidroginastica' | 'funcional'
  instructor_id?: string
  schedule_days: string[]
  schedule_time: string
  duration_minutes?: number
  capacity: number
  monthly_price?: number
  expand?: {
    instructor_id?: InstructorRecord
  }
}

export interface EnrollmentRecord extends RecordModel {
  student_id: string
  class_id: string
  enrollment_date?: string
  is_active: boolean
  expand?: {
    student_id?: StudentRecord
    class_id?: ClassRecord
  }
}

export interface ChargeRecord extends RecordModel {
  student_id: string
  description: string
  amount: number
  discount_amount?: number
  due_date: string
  status: 'em_aberto' | 'paga' | 'vencida' | 'cancelada'
  payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
  order_nsu?: string
  invoice_slug?: string
  whatsapp_sent?: boolean
  whatsapp_sent_at?: string
  whatsapp_status?: 'enviado' | 'falha' | 'sem_telefone' | 'pendente' | string
  whatsapp_error?: string
  whatsapp_phone?: string
  expand?: {
    student_id?: StudentRecord
  }
}

export interface PaymentRecord extends RecordModel {
  student_id: string
  charge_id?: string
  plan_id?: string
  amount: number
  discount_amount?: number
  due_date: string
  paid_date?: string
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'reembolsado'
  payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
  order_nsu?: string
  invoice_slug?: string
  receipt_url?: string
  expand?: {
    student_id?: StudentRecord
    plan_id?: PlanRecord
    charge_id?: ChargeRecord
  }
}

export interface TransactionRecord extends RecordModel {
  type: 'receita' | 'despesa'
  description: string
  category: 'mensalidade' | 'matricula' | 'equipamento' | 'salario' | 'manutencao' | 'outros'
  amount: number
  date: string
  payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
  status: 'confirmado' | 'pendente'
  notes?: string
}

export interface SettingRecord extends RecordModel {
  key: string
  value?: string
}

/** Inscrição enviada pelo formulário público /matricula (migration 0017). */
export interface EnrollmentRequestRecord extends RecordModel {
  student_name: string
  student_birth_date?: string
  student_cpf?: string
  student_phone?: string
  guardian_name?: string
  guardian_cpf?: string
  guardian_phone?: string
  guardian_email?: string
  cep?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  uf?: string
  cardio_date?: string
  cardio_crm?: string
  cardio_status?: 'entregue' | 'pendente'
  student_age?: number
  photo_file?: string
  guardian_rg_file?: string
  status: 'pendente' | 'aprovada' | 'recusada'
  review_notes?: string
  parq_1?: string
  parq_2?: string
  parq_3?: string
  parq_4?: string
  parq_5?: string
  parq_6?: string
  parq_7?: string
  // Detalhes escritos das perguntas 5-7 do PAR-Q (migration 0022)
  parq_5_detail?: string
  parq_6_detail?: string
  parq_7_detail?: string
  anamnese_medo_agua?: string
  anamnese_convulsoes?: string
  anamnese_alergia_cloro?: string
  anamnese_medicamentos?: string
  anamnese_objetivo?: string
  uso_imagem_autorizado?: 'sim' | 'nao'
  // Declaração de entrega dos exames (migration 0021 + split 0022)
  exams_delivered?: 'sim' | 'nao'
  exams_cardio_delivered?: 'sim' | 'nao'
  exams_dermato_delivered?: 'sim' | 'nao'
  // Concordância com o termo de ciência (Lei Estadual nº 9.863/2012-PB, migration 0022)
  term_agreed?: 'sim' | 'nao'
  // Preferências da matrícula (migration 0023)
  activities?: string[]
  preferred_classes?: string[]
  due_day?: string
  student_id?: string
  reviewed_at?: string
}

// ============================================================
// Matrícula: exames (Lei Estadual PB 9.863/2012 — validade 6 meses)
// ============================================================

/** Calcula a validade (6 meses) a partir da data de emissão (yyyy-mm-dd). */
export function addSixMonths(isoDate?: string | null): string | null {
  if (!isoDate) return null
  // Data pura: ler direto da string ISO — sem fuso (UTC−3 voltava um dia).
  const parts = readDateParts(isoDate)
  if (!parts) return null
  const d = new Date(parts.year, parts.month - 1, parts.day, 12)
  d.setMonth(d.getMonth() + 6)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type ExamAlertLevel = 'ok' | 'warn' | 'expired'

export interface ExamAlertInfo {
  level: ExamAlertLevel
  label: string
  days: number | null
  expiry: string | null
}

/** Estado do exame frente à validade de 6 meses: vencido (vermelho), ≤30 dias (âmbar) ou ok. */
export function getExamAlert(
  issuedDate?: string | null,
  status?: string | null,
): ExamAlertInfo | null {
  if (!issuedDate) return null
  const expiry = addSixMonths(issuedDate)
  if (!expiry) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(`${expiry}T12:00:00`)
  const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
  if (status === 'pendente') {
    return { level: 'warn', label: 'Pendente de entrega', days, expiry }
  }
  if (days < 0) return { level: 'expired', label: 'Vencido', days, expiry }
  if (days <= 15)
    return { level: 'warn', label: `Vence em ${days} dia${days === 1 ? '' : 's'}`, days, expiry }
  return { level: 'ok', label: 'Válido', days, expiry }
}

/** Idade em anos completos na data de hoje. */
export function calcAge(birthDate?: string | null): number | null {
  if (!birthDate) return null
  // Data pura: ler direto da string ISO — sem fuso.
  const parts = readDateParts(birthDate)
  if (!parts) return null
  const today = new Date()
  let age = today.getFullYear() - parts.year
  const m = today.getMonth() + 1 - parts.month
  if (m < 0 || (m === 0 && today.getDate() < parts.day)) age--
  return age
}
