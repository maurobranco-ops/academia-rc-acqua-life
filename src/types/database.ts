import type { RecordModel } from 'pocketbase'

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
  due_date: string
  status: 'em_aberto' | 'paga' | 'vencida' | 'cancelada'
  payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
  infinipay_payment_id?: string
  payment_link?: string
  expand?: {
    student_id?: StudentRecord
  }
}

export interface PaymentRecord extends RecordModel {
  student_id: string
  charge_id?: string
  plan_id?: string
  amount: number
  due_date: string
  paid_date?: string
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'reembolsado'
  payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
  payment_link?: string
  infinipay_transaction_id?: string
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
