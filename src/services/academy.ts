import pb from '@/lib/pocketbase/client'
import type {
  PlanRecord,
  InstructorRecord,
  StudentRecord,
  ClassRecord,
  EnrollmentRecord,
  ChargeRecord,
  PaymentRecord,
  TransactionRecord,
  SettingRecord,
} from '@/types/database'

export const academyService = {
  // Plans
  async getPlans(): Promise<PlanRecord[]> {
    return pb.collection('plans').getFullList<PlanRecord>({ sort: 'name' })
  },
  async createPlan(data: Partial<PlanRecord>): Promise<PlanRecord> {
    return pb.collection('plans').create<PlanRecord>(data)
  },
  async updatePlan(id: string, data: Partial<PlanRecord>): Promise<PlanRecord> {
    return pb.collection('plans').update<PlanRecord>(id, data)
  },
  async deletePlan(id: string): Promise<boolean> {
    return pb.collection('plans').delete(id)
  },

  // Instructors
  async getInstructors(): Promise<InstructorRecord[]> {
    return pb.collection('instructors').getFullList<InstructorRecord>({ sort: 'name' })
  },
  async createInstructor(data: Partial<InstructorRecord>): Promise<InstructorRecord> {
    return pb.collection('instructors').create<InstructorRecord>(data)
  },
  async updateInstructor(id: string, data: Partial<InstructorRecord>): Promise<InstructorRecord> {
    return pb.collection('instructors').update<InstructorRecord>(id, data)
  },
  async deleteInstructor(id: string): Promise<boolean> {
    return pb.collection('instructors').delete(id)
  },

  // Students
  async getStudents(options?: { expand?: string; fields?: string }): Promise<StudentRecord[]> {
    return pb.collection('students').getFullList<StudentRecord>({
      sort: 'name',
      expand: options?.expand !== undefined ? options.expand : 'plan_id',
      fields: options?.fields,
    })
  },
  async getStudent(id: string): Promise<StudentRecord> {
    return pb.collection('students').getOne<StudentRecord>(id, {
      expand: 'plan_id',
    })
  },
  async createStudent(data: Partial<StudentRecord>): Promise<StudentRecord> {
    return pb.collection('students').create<StudentRecord>(data)
  },
  async updateStudent(id: string, data: Partial<StudentRecord> | FormData): Promise<StudentRecord> {
    return pb.collection('students').update<StudentRecord>(id, data)
  },
  async uploadStudentPhoto(
    id: string,
    file: File | Blob,
    filename?: string,
  ): Promise<StudentRecord> {
    const formData = new FormData()
    if (file instanceof File) {
      formData.append('photo_file', file)
    } else {
      formData.append('photo_file', file, filename || 'photo.jpg')
    }
    return pb.collection('students').update<StudentRecord>(id, formData)
  },
  async deleteStudent(id: string): Promise<boolean> {
    // Exclui matrículas vinculadas primeiro se houver
    try {
      const enrollments = await pb.collection('enrollments').getFullList<EnrollmentRecord>({
        filter: `student_id = "${id}"`,
      })
      for (const enr of enrollments) {
        await pb
          .collection('enrollments')
          .delete(enr.id)
          .catch(() => {})
      }
    } catch {
      /* intentionally ignored */
    }

    return pb.collection('students').delete(id)
  },

  async deleteStudentWithHistory(
    studentId: string,
    confirmationName: string,
  ): Promise<{
    success: boolean
    message: string
    details?: {
      student_id: string
      student_name: string
      charges_deleted: number
      payments_deleted: number
      enrollments_deleted: number
      transactions_deleted: number
    }
  }> {
    const response = await fetch(`${pb.baseUrl}/backend/v1/students/delete-with-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        student_id: studentId,
        confirmation_name: confirmationName,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || `Erro HTTP ${response.status} ao excluir aluno com histórico`)
    }
    return data
  },

  async previewSampleDataCleanup(): Promise<{
    success: boolean
    summary: {
      students_count: number
      charges_count: number
      payments_count: number
      enrollments_count: number
      transactions_count: number
      ignored_count: number
    }
    students: Array<{
      id: string
      name: string
      cpf: string
      email: string
      status: string
      reason: string
    }>
    charges: Array<{
      id: string
      description: string
      amount: number
      due_date: string
      status: string
      payment_link: string
      student_id: string
    }>
    payments: Array<{
      id: string
      charge_id: string
      amount: number
      status: string
      due_date: string
      student_id: string
    }>
    enrollments: Array<{
      id: string
      student_id: string
      class_id: string
    }>
    transactions: Array<{
      id: string
      description: string
      amount: number
      type: string
      notes: string
    }>
    ignored_for_safety: Array<{
      id: string
      name: string
      bubble_id: string
      reason: string
    }>
  }> {
    const response = await fetch(`${pb.baseUrl}/backend/v1/cleanup/sample-data`, {
      method: 'GET',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || `Erro HTTP ${response.status} ao buscar dados de exemplo`)
    }
    return data
  },

  async executeSampleDataCleanup(confirmation: string): Promise<{
    success: boolean
    message: string
    report: {
      students_deleted: number
      charges_deleted: number
      payments_deleted: number
      enrollments_deleted: number
      transactions_deleted: number
      student_names: string[]
    }
  }> {
    const response = await fetch(`${pb.baseUrl}/backend/v1/cleanup/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || `Erro HTTP ${response.status} ao limpar dados de exemplo`)
    }
    return data
  },

  // Classes
  async getClasses(): Promise<ClassRecord[]> {
    return pb.collection('classes').getFullList<ClassRecord>({
      sort: 'name',
      expand: 'instructor_id',
    })
  },
  async getClass(id: string): Promise<ClassRecord> {
    return pb.collection('classes').getOne<ClassRecord>(id, {
      expand: 'instructor_id',
    })
  },
  async createClass(data: Partial<ClassRecord>): Promise<ClassRecord> {
    return pb.collection('classes').create<ClassRecord>(data)
  },
  async updateClass(id: string, data: Partial<ClassRecord>): Promise<ClassRecord> {
    return pb.collection('classes').update<ClassRecord>(id, data)
  },
  async deleteClass(id: string): Promise<boolean> {
    return pb.collection('classes').delete(id)
  },

  // Enrollments
  async getEnrollments(): Promise<EnrollmentRecord[]> {
    return pb.collection('enrollments').getFullList<EnrollmentRecord>({
      expand: 'student_id,class_id,class_id.instructor_id,student_id.plan_id',
    })
  },
  async createEnrollment(
    studentId: string,
    classId: string,
    enrollmentDate?: string,
  ): Promise<EnrollmentRecord> {
    return pb.collection('enrollments').create<EnrollmentRecord>({
      student_id: studentId,
      class_id: classId,
      enrollment_date: enrollmentDate || new Date().toISOString(),
      is_active: true,
    })
  },
  async deleteEnrollment(id: string): Promise<boolean> {
    return pb.collection('enrollments').delete(id)
  },

  // Charges
  async getCharges(): Promise<ChargeRecord[]> {
    return pb.collection('charges').getFullList<ChargeRecord>({
      sort: '-created',
      expand: 'student_id',
    })
  },
  async testInfinitepayConnection(credentials?: {
    apiKey?: string
    handle?: string
  }): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${pb.baseUrl}/backend/v1/infinitepay/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials || {}),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || `Erro HTTP ${response.status} ao testar conexão`)
    }
    return data
  },

  async runRecurringBillingNow(force = false): Promise<{
    success: boolean
    summary?: string
    message?: string
    targetDueDate?: string
    processedCount?: number
    createdCount?: number
    alreadyIssuedCount?: number
    skippedIsentoCount?: number
    errors?: Array<{ studentId: string; studentName: string; error: string }>
  }> {
    const response = await fetch(`${pb.baseUrl}/backend/v1/recurring-billing/run-now`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || `Erro HTTP ${response.status} na rotina de cobrança`)
    }
    return data
  },

  async createCharge(data: {
    student_id: string
    description: string
    amount: number
    discount_amount?: number
    due_date: string
    status?: 'em_aberto' | 'paga' | 'vencida' | 'cancelada'
    payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
    generateInfinitepay?: boolean
  }): Promise<ChargeRecord> {
    // Quando solicitado checkout InfinitePay, chama o hook seguro no backend PocketBase
    if (data.generateInfinitepay) {
      const response = await fetch(`${pb.baseUrl}/backend/v1/infinitepay/create-charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const resJson = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          resJson.message || `Falha ao emitir cobrança via backend (HTTP ${response.status})`,
        )
      }

      if (resJson.charge && resJson.charge.id) {
        // Retorna o registro completo atualizado com dados de envio de whatsapp
        const record = await pb.collection('charges').getOne<ChargeRecord>(resJson.charge.id, {
          expand: 'student_id',
        })
        const enhanced = record as ChargeRecord
        if (resJson.whatsapp_sent !== undefined) enhanced.whatsapp_sent = resJson.whatsapp_sent
        if (resJson.whatsapp_status !== undefined)
          enhanced.whatsapp_status = resJson.whatsapp_status
        if (resJson.whatsapp_error !== undefined) enhanced.whatsapp_error = resJson.whatsapp_error
        if (resJson.whatsapp_sent_at !== undefined)
          enhanced.whatsapp_sent_at = resJson.whatsapp_sent_at
        if (resJson.whatsapp_phone !== undefined) enhanced.whatsapp_phone = resJson.whatsapp_phone
        return enhanced
      }
    }

    // Fluxo manual tradicional (sem API externa ou gerado diretamente)
    const infinipayId = 'inf_' + Math.random().toString(36).substring(2, 10)
    const paymentLink = `https://pay.infinitepay.io/link/${infinipayId}`

    const record = await pb.collection('charges').create<ChargeRecord>({
      student_id: data.student_id,
      description: data.description,
      amount: data.amount,
      discount_amount: data.discount_amount || 0,
      due_date: data.due_date,
      status: data.status || 'em_aberto',
      payment_method: data.payment_method || 'pix',
      infinipay_payment_id: infinipayId,
      payment_link: paymentLink,
    })

    // Also create matching payment entry
    await pb.collection('payments').create<PaymentRecord>({
      student_id: data.student_id,
      charge_id: record.id,
      amount: data.amount,
      discount_amount: data.discount_amount || 0,
      due_date: data.due_date,
      status: data.status === 'paga' ? 'pago' : 'pendente',
      payment_method: data.payment_method || 'pix',
      payment_link: paymentLink,
      infinipay_transaction_id: infinipayId,
    })

    return record
  },
  async updateChargeStatus(
    id: string,
    status: 'em_aberto' | 'paga' | 'vencida' | 'cancelada',
    paidDate?: string,
  ): Promise<ChargeRecord> {
    const existingCharge = await pb.collection('charges').getOne<ChargeRecord>(id, {
      expand: 'student_id',
    })

    // Se estiver marcando como paga, calcula se foi pago até o vencimento ou após
    let effectiveAmount = existingCharge.amount
    let appliedDiscount = existingCharge.discount_amount || 0

    const paymentDateIso = paidDate || new Date().toISOString()

    if (status === 'paga') {
      const paidDay = new Date(paymentDateIso).setHours(0, 0, 0, 0)
      const dueDay = new Date(existingCharge.due_date).setHours(23, 59, 59, 999)
      const isOnTime = paidDay <= dueDay

      // Se pago em dia e houver desconto família registrado ou aplicável
      if (isOnTime && appliedDiscount > 0) {
        // o valor pago já reflete ou mantém o desconto
      } else if (!isOnTime && appliedDiscount > 0) {
        // Se pago após a data de vencimento, o desconto de família de R$ 10 não se aplica (valor cheio)
        effectiveAmount = existingCharge.amount + appliedDiscount
        appliedDiscount = 0
      }
    }

    const updated = await pb.collection('charges').update<ChargeRecord>(id, {
      status,
      amount: effectiveAmount,
      discount_amount: appliedDiscount,
    })

    // If set to paga or cancelada, also find and update payment
    if (status === 'paga') {
      try {
        const payments = await pb.collection('payments').getList<PaymentRecord>(1, 10, {
          filter: `charge_id = "${id}"`,
        })
        for (const pmt of payments.items) {
          await pb.collection('payments').update(pmt.id, {
            status: 'pago',
            amount: effectiveAmount,
            discount_amount: appliedDiscount,
            paid_date: paymentDateIso,
          })
        }
        if (payments.items.length > 0) {
          // Also create income transaction
          await pb.collection('transactions').create<TransactionRecord>({
            type: 'receita',
            description: updated.description,
            category: 'mensalidade',
            amount: effectiveAmount,
            date: paymentDateIso,
            payment_method: updated.payment_method || 'pix',
            status: 'confirmado',
            notes: `Pagamento de cobrança #${id}${appliedDiscount > 0 ? ' (Desconto Família R$ 10,00 aplicado)' : ''}`,
          })
        }
      } catch (err) {
        console.error('Failed to update corresponding payment/transaction', err)
      }
    } else if (status === 'cancelada') {
      try {
        const payments = await pb.collection('payments').getList<PaymentRecord>(1, 50, {
          filter: `charge_id = "${id}"`,
        })
        for (const pmt of payments.items) {
          if (pmt.status !== 'cancelado') {
            await pb.collection('payments').update(pmt.id, {
              status: 'cancelado',
            })
          }
        }
      } catch (err) {
        console.error('Failed to cancel corresponding payment', err)
      }
    }
    return updated
  },
  async getWhatsAppSenderInfo(): Promise<{
    success: boolean
    connected: boolean
    display_phone_number?: string | null
    phone_number_id?: string | null
    verified_name?: string | null
    quality_rating?: string | null
    total_numbers?: number
    error?: string
    message?: string
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (pb.authStore.token) {
      headers.Authorization = `Bearer ${pb.authStore.token}`
    }

    try {
      const response = await fetch(`${pb.baseUrl}/backend/v1/whatsapp/sender-info`, {
        method: 'GET',
        headers,
      })
      const data = await response.json().catch(() => ({}))
      return data
    } catch (err: unknown) {
      return {
        success: false,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },

  async sendChargeWhatsApp(chargeId: string): Promise<{
    success: boolean
    message: string
    charge_id?: string
    whatsapp_status?: string
    whatsapp_sent_at?: string
    whatsapp_phone?: string
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (pb.authStore.token) {
      headers.Authorization = `Bearer ${pb.authStore.token}`
    }

    const response = await fetch(`${pb.baseUrl}/backend/v1/charges/${chargeId}/send-whatsapp`, {
      method: 'POST',
      headers,
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || `Erro HTTP ${response.status} ao enviar WhatsApp`)
    }
    return data
  },

  async cancelCharge(chargeId: string): Promise<{
    success: boolean
    message: string
    charge_id?: string
    status?: string
    payment_status?: string
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (pb.authStore.token) {
      headers.Authorization = `Bearer ${pb.authStore.token}`
    }

    const response = await fetch(`${pb.baseUrl}/backend/v1/charges/${chargeId}/cancel`, {
      method: 'POST',
      headers,
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || `Erro HTTP ${response.status} ao cancelar cobrança`)
    }
    return data
  },

  async refundCharge(chargeId: string): Promise<void> {
    await pb.collection('charges').update(chargeId, { status: 'cancelada' })
    const payments = await pb.collection('payments').getList<PaymentRecord>(1, 1, {
      filter: `charge_id = "${chargeId}"`,
    })
    if (payments.items.length > 0) {
      await pb.collection('payments').update(payments.items[0].id, {
        status: 'reembolsado',
      })
    }
  },

  // Payments
  async getPayments(): Promise<PaymentRecord[]> {
    return pb.collection('payments').getFullList<PaymentRecord>({
      sort: '-created',
      expand: 'student_id,plan_id,charge_id',
    })
  },
  async createPayment(data: Partial<PaymentRecord>): Promise<PaymentRecord> {
    return pb.collection('payments').create<PaymentRecord>(data)
  },
  async updatePayment(id: string, data: Partial<PaymentRecord>): Promise<PaymentRecord> {
    return pb.collection('payments').update<PaymentRecord>(id, data)
  },

  // Transactions
  async getTransactions(): Promise<TransactionRecord[]> {
    return pb.collection('transactions').getFullList<TransactionRecord>({
      sort: '-date',
    })
  },
  async createTransaction(data: Partial<TransactionRecord>): Promise<TransactionRecord> {
    return pb.collection('transactions').create<TransactionRecord>(data)
  },
  async deleteTransaction(id: string): Promise<boolean> {
    return pb.collection('transactions').delete(id)
  },

  // Settings
  async getSettings(): Promise<Record<string, string>> {
    const list = await pb.collection('settings').getFullList<SettingRecord>()
    const map: Record<string, string> = {}
    list.forEach((item) => {
      map[item.key] = item.value || ''
    })
    return map
  },
  async updateSetting(key: string, value: string): Promise<void> {
    try {
      const existing = await pb
        .collection('settings')
        .getFirstListItem<SettingRecord>(`key = "${key}"`)
      await pb.collection('settings').update(existing.id, { value })
    } catch (_) {
      await pb.collection('settings').create({ key, value })
    }
  },
}
