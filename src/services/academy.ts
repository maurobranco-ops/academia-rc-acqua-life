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
  async getStudents(): Promise<StudentRecord[]> {
    return pb.collection('students').getFullList<StudentRecord>({
      sort: 'name',
      expand: 'plan_id',
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
    return pb.collection('students').delete(id)
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
  async createCharge(data: {
    student_id: string
    description: string
    amount: number
    due_date: string
    status?: 'em_aberto' | 'paga' | 'vencida' | 'cancelada'
    payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
    generateInfinitepay?: boolean
  }): Promise<ChargeRecord> {
    const infinipayId = 'inf_' + Math.random().toString(36).substring(2, 10)
    const paymentLink = `https://pay.infinitepay.io/link/${infinipayId}`

    const record = await pb.collection('charges').create<ChargeRecord>({
      student_id: data.student_id,
      description: data.description,
      amount: data.amount,
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
  ): Promise<ChargeRecord> {
    const updated = await pb.collection('charges').update<ChargeRecord>(id, { status })
    // If set to paga, also find and update payment
    if (status === 'paga') {
      try {
        const payments = await pb.collection('payments').getList<PaymentRecord>(1, 1, {
          filter: `charge_id = "${id}"`,
        })
        if (payments.items.length > 0) {
          await pb.collection('payments').update(payments.items[0].id, {
            status: 'pago',
            paid_date: new Date().toISOString(),
          })
          // Also create income transaction
          await pb.collection('transactions').create<TransactionRecord>({
            type: 'receita',
            description: updated.description,
            category: 'mensalidade',
            amount: updated.amount,
            date: new Date().toISOString(),
            payment_method: updated.payment_method || 'pix',
            status: 'confirmado',
            notes: `Pagamento de cobrança #${id}`,
          })
        }
      } catch (err) {
        console.error('Failed to update corresponding payment/transaction', err)
      }
    }
    return updated
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
