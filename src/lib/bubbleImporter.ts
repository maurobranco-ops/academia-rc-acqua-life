import pb from '@/lib/pocketbase/client'
import type { StudentRecord, ClassRecord, PaymentRecord } from '@/types/database'
import {
  parseBubbleDate,
  parseCurrencyOrNumber,
  normalizeBubblePhoto,
  formatAddress,
  inferClassType,
  mapSituation,
} from './csvParser'

export interface ColumnMapping {
  aluno: string
  foto: string
  atividade: string
  nascimento: string
  diaNascimento: string
  mesNascimento: string
  nomeResponsavel: string
  cpfResponsavel: string
  celularResponsavel: string
  emailResponsavel: string
  whatsapp: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  mensalidade: string
  mensalidadeComDesconto: string
  mensalidadeTrancada: string
  vencimento: string
  dataMatricula: string
  dataInicio: string
  dataFinal: string
  dataUltimoPagamento: string
  valorPago: string
  atestadoTr: string
  atestadoTrValidade: string
  validadeTrancamento: string
  uniqueId: string
}

export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  aluno: 'Aluno',
  foto: 'Foto',
  atividade: 'Atividade',
  nascimento: 'Nascimento',
  diaNascimento: 'Dia Nascimento',
  mesNascimento: 'Mês Nascimento',
  nomeResponsavel: 'Nome Responsável',
  cpfResponsavel: 'CPF do responsável',
  celularResponsavel: 'Celular do responsável',
  emailResponsavel: 'E-mail Responsável',
  whatsapp: 'WhatsApp',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
  cep: 'CEP',
  mensalidade: 'Mensalidade',
  mensalidadeComDesconto: 'Mensalidade com desconto',
  mensalidadeTrancada: 'Mensalidade trancada',
  vencimento: 'Vencimento',
  dataMatricula: 'Data matrícula',
  dataInicio: 'Data Início',
  dataFinal: 'Data Final',
  dataUltimoPagamento: 'Data Ultimo Pagamento',
  valorPago: 'Valor Pago',
  atestadoTr: 'Atestado/TR',
  atestadoTrValidade: 'Atestado/TR Validade',
  validadeTrancamento: 'Validade Trancamento Alunos',
  uniqueId: 'unique id',
}

export interface ImportWarning {
  row: number
  studentName?: string
  message: string
}

export interface ImportResult {
  totalProcessed: number
  studentsCreated: number
  studentsUpdated: number
  classesCreated: number
  classesFound: number
  enrollmentsCreated: number
  enrollmentsUpdated: number
  paymentsCreated: number
  warnings: ImportWarning[]
  errors: string[]
}

export async function importBubbleStudents(
  rows: Record<string, string>[],
  mapping: ColumnMapping = DEFAULT_COLUMN_MAPPING,
  onProgress?: (current: number, total: number, currentName?: string) => void,
): Promise<ImportResult> {
  const result: ImportResult = {
    totalProcessed: 0,
    studentsCreated: 0,
    studentsUpdated: 0,
    classesCreated: 0,
    classesFound: 0,
    enrollmentsCreated: 0,
    enrollmentsUpdated: 0,
    paymentsCreated: 0,
    warnings: [],
    errors: [],
  }

  // 1. Pre-load existing classes and map by trimmed name (case-insensitive)
  const existingClasses = await pb.collection('classes').getFullList<ClassRecord>()
  const classMap = new Map<string, ClassRecord>()
  existingClasses.forEach((c) => {
    classMap.set(c.name.trim().toLowerCase(), c)
  })

  // 2. Pre-load existing students with bubble_id to minimize queries
  const existingStudents = await pb.collection('students').getFullList<StudentRecord>()
  const studentByBubbleId = new Map<string, StudentRecord>()
  const studentByName = new Map<string, StudentRecord>()
  existingStudents.forEach((s) => {
    if (s.bubble_id && s.bubble_id.trim()) {
      studentByBubbleId.set(s.bubble_id.trim(), s)
    }
    studentByName.set(s.name.trim().toLowerCase(), s)
  })

  // 3. Pre-load existing enrollments
  const existingEnrollments = await pb.collection('enrollments').getFullList()
  const enrollmentSet = new Set<string>()
  existingEnrollments.forEach((e) => {
    enrollmentSet.add(`${e.student_id}:${e.class_id}`)
  })

  // 4. Pre-load default plan if needed
  const plans = await pb.collection('plans').getFullList()
  const defaultPlanId = plans.length > 0 ? plans[0].id : undefined

  // 5. Pre-load existing payments once into memory (key: student_id:paid_date_prefix)
  // Isso elimina a consulta individual de pagamentos por aluno (`collection('payments').getList`)
  // que gerava 1 chamada HTTP sequencial de ~0,7s por aluno!
  const existingPayments = await pb.collection('payments').getFullList<PaymentRecord>()
  const paymentSet = new Set<string>()
  existingPayments.forEach((p) => {
    if (p.student_id && p.paid_date) {
      paymentSet.add(`${p.student_id}:${p.paid_date.slice(0, 10)}`)
    }
  })

  // 6. Pre-scan rows to detect and create all missing classes upfront in parallel
  // Evita concorrência e chamadas repetidas para a mesma turma durante os lotes
  const uniqueClassNames = new Set<string>()
  for (const row of rows) {
    const rawAtividade = (row[mapping.atividade] || '').trim()
    if (rawAtividade) {
      rawAtividade
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0)
        .forEach((actName) => uniqueClassNames.add(actName))
    }
  }

  for (const actName of uniqueClassNames) {
    const actKey = actName.toLowerCase()
    if (!classMap.has(actKey)) {
      const classType = inferClassType(actName)
      try {
        const classRec = await pb.collection('classes').create<ClassRecord>({
          name: actName,
          type: classType,
          schedule_days: ['seg', 'qua', 'sex'],
          schedule_time: '08:00',
          capacity: 20,
          monthly_price: 100,
        })
        classMap.set(actKey, classRec)
        result.classesCreated++
      } catch (err: any) {
        console.warn(`Aviso ao criar turma prévia "${actName}":`, err?.message)
      }
    }
  }

  const total = rows.length
  let processedCounter = 0

  // 7. Processamento concorrente em lotes controlados (concurrency = 8)
  // Com o pool de 8 workers simultâneos e sem a consulta sequencial de pagamentos,
  // o tempo total cai de ~2 minutos para poucos segundos em lotes de centenas de alunos.
  const CONCURRENCY = 8

  // Prepara itens de trabalho
  interface RowWorkItem {
    row: Record<string, string>
    idx: number
  }

  const workQueue: RowWorkItem[] = rows.map((row, idx) => ({ row, idx }))

  const processRowItem = async (item: RowWorkItem) => {
    const { row, idx } = item
    const rowNum = idx + 2 // 1-based, header is 1

    const rawName = (row[mapping.aluno] || '').trim()
    const bubbleId = (row[mapping.uniqueId] || '').trim()

    if (!rawName) {
      result.warnings.push({
        row: rowNum,
        message: 'Linha ignorada: nome do aluno não informado.',
      })
      result.totalProcessed++
      processedCounter++
      if (onProgress) onProgress(processedCounter, total)
      return
    }

    try {
      // Parse fields
      const photo = normalizeBubblePhoto(row[mapping.foto])
      const birthDate = parseBubbleDate(
        row[mapping.nascimento],
        row[mapping.diaNascimento],
        row[mapping.mesNascimento],
      )
      const guardianName = (row[mapping.nomeResponsavel] || '').trim()
      const guardianCpf = (row[mapping.cpfResponsavel] || '').trim()
      const guardianPhone = (row[mapping.celularResponsavel] || '').trim()
      const guardianEmail = (row[mapping.emailResponsavel] || '').trim()
      const rawWhatsapp = (row[mapping.whatsapp] || '').trim()

      const address = formatAddress({
        logradouro: row[mapping.logradouro],
        numero: row[mapping.numero],
        complemento: row[mapping.complemento],
        bairro: row[mapping.bairro],
        cidade: row[mapping.cidade],
        uf: row[mapping.uf],
        cep: row[mapping.cep],
      })

      const monthlyFee = parseCurrencyOrNumber(row[mapping.mensalidade])
      const discountedFee = parseCurrencyOrNumber(row[mapping.mensalidadeComDesconto])
      const dueDay = Math.round(parseCurrencyOrNumber(row[mapping.vencimento])) || 5

      const rawSituation = (row[mapping.atestadoTr] || '').trim()
      const { systemStatus, situationTag } = mapSituation(rawSituation)

      const atestadoValidade = parseBubbleDate(row[mapping.atestadoTrValidade])
      const trancamentoValidade = parseBubbleDate(row[mapping.validadeTrancamento])

      const rawFeeSuspended = (row[mapping.mensalidadeTrancada] || '').trim().toLowerCase()
      const feeSuspended = rawFeeSuspended === 'sim' || rawFeeSuspended === 'true'

      const studentPayload: Partial<StudentRecord> = {
        name: rawName,
        bubble_id: bubbleId || undefined,
        photo: photo || undefined,
        birth_date: birthDate || undefined,
        guardian_name: guardianName || undefined,
        guardian_cpf: guardianCpf || undefined,
        guardian_phone: guardianPhone || undefined,
        guardian_email: guardianEmail || undefined,
        whatsapp: rawWhatsapp || undefined,
        phone: rawWhatsapp || guardianPhone || undefined,
        email: guardianEmail || undefined,
        address: address || undefined,
        monthly_fee: monthlyFee,
        discounted_fee: discountedFee || monthlyFee,
        due_day: dueDay,
        situation: situationTag,
        raw_situation: rawSituation || undefined,
        status: systemStatus,
        atestado_validade: atestadoValidade || undefined,
        trancamento_validade: trancamentoValidade || undefined,
        fee_suspended: feeSuspended,
      }

      if (defaultPlanId) {
        studentPayload.plan_id = defaultPlanId
      }

      // Check if student exists by bubble_id (idempotency primary key) or by name
      let studentRecord: StudentRecord | null = null
      if (bubbleId && studentByBubbleId.has(bubbleId)) {
        studentRecord = studentByBubbleId.get(bubbleId)!
      } else if (studentByName.has(rawName.toLowerCase())) {
        studentRecord = studentByName.get(rawName.toLowerCase())!
      }

      if (studentRecord) {
        // Update existing student
        studentRecord = await pb
          .collection('students')
          .update<StudentRecord>(studentRecord.id, studentPayload)
        result.studentsUpdated++
      } else {
        // Create new student
        studentRecord = await pb.collection('students').create<StudentRecord>(studentPayload)
        result.studentsCreated++
      }

      // Keep cache updated
      if (bubbleId) {
        studentByBubbleId.set(bubbleId, studentRecord)
      }
      studentByName.set(rawName.toLowerCase(), studentRecord)

      // Handle Activities -> Enrollments
      const rawAtividade = (row[mapping.atividade] || '').trim()
      if (rawAtividade) {
        const activityNames = rawAtividade
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0)

        for (const actName of activityNames) {
          const actKey = actName.toLowerCase()
          const classRec = classMap.get(actKey)

          if (classRec) {
            result.classesFound++
            const enrollmentKey = `${studentRecord.id}:${classRec.id}`
            if (!enrollmentSet.has(enrollmentKey)) {
              const enrollmentDate =
                parseBubbleDate(row[mapping.dataMatricula]) ||
                parseBubbleDate(row[mapping.dataInicio]) ||
                new Date().toISOString()

              try {
                await pb.collection('enrollments').create({
                  student_id: studentRecord.id,
                  class_id: classRec.id,
                  enrollment_date: enrollmentDate,
                  is_active: systemStatus === 'ativo',
                })
                enrollmentSet.add(enrollmentKey)
                result.enrollmentsCreated++
              } catch (err: any) {
                result.warnings.push({
                  row: rowNum,
                  studentName: rawName,
                  message: `Erro ao matricular na turma "${actName}": ${err?.message || 'erro'}`,
                })
              }
            } else {
              result.enrollmentsUpdated++
            }
          }
        }
      }

      // Handle historical payment if both "Data Ultimo Pagamento" and "Valor Pago" are present
      const rawPaidDate = (row[mapping.dataUltimoPagamento] || '').trim()
      const rawPaidAmount = (row[mapping.valorPago] || '').trim()

      if (rawPaidDate && rawPaidAmount) {
        const parsedPaidDate = parseBubbleDate(rawPaidDate)
        const parsedPaidAmount = parseCurrencyOrNumber(rawPaidAmount)

        if (parsedPaidDate && parsedPaidAmount > 0) {
          const checkDate = parsedPaidDate.slice(0, 10)
          const paymentKey = `${studentRecord.id}:${checkDate}`

          // Verificação rápida no Set em memória — sem round-trip sequencial de 0,7s!
          if (!paymentSet.has(paymentKey)) {
            try {
              await pb.collection('payments').create({
                student_id: studentRecord.id,
                plan_id: defaultPlanId || undefined,
                amount: parsedPaidAmount,
                due_date: parsedPaidDate,
                paid_date: parsedPaidDate,
                status: 'pago',
                payment_method: 'pix',
              })
              paymentSet.add(paymentKey)
              result.paymentsCreated++
            } catch (err) {
              console.warn('Não foi possível registrar pagamento histórico para', rawName, err)
            }
          }
        }
      }

      result.totalProcessed++
    } catch (rowErr: any) {
      result.warnings.push({
        row: rowNum,
        studentName: rawName,
        message: `Falha ao processar linha: ${rowErr?.message || 'Erro inesperado'}`,
      })
      result.totalProcessed++
    } finally {
      processedCounter++
      if (onProgress) {
        onProgress(processedCounter, total, rawName)
      }
    }
  }

  // Executa os itens da fila com Promise.all limitado a CONCURRENCY workers simultâneos
  const workers = Array.from({ length: Math.min(CONCURRENCY, workQueue.length) }, async () => {
    while (workQueue.length > 0) {
      const item = workQueue.shift()
      if (item) {
        await processRowItem(item)
      }
    }
  })

  await Promise.all(workers)

  return result
}
