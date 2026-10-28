import pb from '@/lib/pocketbase/client'
import type { StudentRecord, ClassRecord } from '@/types/database'
import {
  parseBubbleDate,
  parseCurrencyOrNumber,
  normalizeBubblePhoto,
  formatAddress,
  inferClassType,
  mapSituation,
} from './csvParser'
import { normalizeName, normalizeNameExact } from './studentPhoto'

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

/**
 * Mapeamento inteligente de cabeçalhos que detecta tanto o export antigo do Bubble
 * quanto o novo formato de export (com ou sem 'unique id', variações de maiúsculas/minúsculas/acentos).
 */
export function resolveColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...DEFAULT_COLUMN_MAPPING }
  const headerClean = new Map<string, string>()

  headers.forEach((h) => {
    // Normalizado sem acento, minúsculo, sem pontuação
    const key = h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    headerClean.set(key, h)
  })

  // Dicionário de variantes de cabeçalho comuns entre as versões do export Bubble
  const fieldAliases: Record<keyof ColumnMapping, string[]> = {
    aluno: ['aluno', 'nome', 'nomedoaluno', 'estudante'],
    foto: ['foto', 'fotodoaluno', 'imagem', 'photo'],
    atividade: ['atividade', 'atividades', 'turma', 'turmas', 'modalidade'],
    nascimento: ['nascimento', 'datanascimento', 'datadenascimento', 'birthdate'],
    diaNascimento: ['dianascimento', 'diadenascimento'],
    mesNascimento: ['mesnascimento', 'mesdenascimento'],
    nomeResponsavel: ['nomeresponsavel', 'responsavel', 'nomedoresponsavel', 'filiacao'],
    cpfResponsavel: ['cpfdoresponsavel', 'cpfresponsavel', 'cpf'],
    celularResponsavel: ['celulardoresponsavel', 'celularresponsavel', 'celular', 'telefone'],
    emailResponsavel: ['emailresponsavel', 'emaildoresponsavel', 'email'],
    whatsapp: ['whatsapp', 'zap', 'wpp'],
    logradouro: ['logradouro', 'rua', 'endereco', 'logradourobairro'],
    numero: ['numero', 'num', 'n'],
    complemento: ['complemento', 'comp', 'apto'],
    bairro: ['bairro'],
    cidade: ['cidade', 'municipio'],
    uf: ['uf', 'estado'],
    cep: ['cep'],
    mensalidade: ['mensalidade', 'valor', 'valormensalidade'],
    mensalidadeComDesconto: ['mensalidadecomdesconto', 'valordesconto', 'mensalidadedesconto'],
    mensalidadeTrancada: ['mensalidadetrancada', 'cobrancatrancada', 'trancado'],
    vencimento: ['vencimento', 'diavencimento', 'diadovencimento'],
    dataMatricula: ['datamatricula', 'datadeingresso', 'matricula'],
    dataInicio: ['datainicio', 'inicio'],
    dataFinal: ['datafinal', 'fim', 'termino'],
    dataUltimoPagamento: [
      'dataultimopagamento',
      'dataultimopagamentoaluno',
      'ultimopagamento',
      'datadavalidadedoultimopagamento',
      'validadedoultimopagamento',
    ],
    valorPago: ['valorpago', 'ultimovalorpago'],
    atestadoTr: ['atestadotr', 'atestado', 'tr', 'situacao', 'status'],
    atestadoTrValidade: ['atestadotrvalidade', 'validadeatestado', 'atestadovalidade'],
    validadeTrancamento: [
      'validadetrancamentoalunos',
      'validadetrancamento',
      'trancamentovalidade',
    ],
    uniqueId: ['uniqueid', 'idunico', 'bubbleid', 'id'],
  }

  for (const [key, aliases] of Object.entries(fieldAliases) as [keyof ColumnMapping, string[]][]) {
    for (const alias of aliases) {
      if (headerClean.has(alias)) {
        mapping[key] = headerClean.get(alias)!
        break
      }
    }
  }

  return mapping
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
  studentsInactiveTR: number
  classesCreated: number
  classesFound: number
  enrollmentsCreated: number
  enrollmentsUpdated: number
  paymentsCreated: number
  warnings: ImportWarning[]
  errors: string[]
}

export interface ImportPreviewPlan {
  totalRows: number
  toCreateCount: number
  toUpdateCount: number
  inactiveTRCount: number
  sampleMatches: {
    rawName: string
    action: 'criar' | 'atualizar'
    matchReason?: string
    isTR: boolean
  }[]
}

/**
 * Gera um resumo prévio (upsert preview) do que será criado e atualizado antes de confirmar.
 */
export async function previewBubbleUpsert(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): Promise<ImportPreviewPlan> {
  const existingStudents = await pb.collection('students').getFullList<StudentRecord>()

  const studentByBubbleId = new Map<string, StudentRecord>()
  const studentByNormalizedName = new Map<string, StudentRecord>()
  const studentByCpfAndName = new Map<string, StudentRecord>()

  existingStudents.forEach((s) => {
    if (s.bubble_id && s.bubble_id.trim()) {
      studentByBubbleId.set(s.bubble_id.trim(), s)
    }
    const norm = normalizeName(s.name)
    if (norm) {
      studentByNormalizedName.set(norm, s)
    }
    const normExact = normalizeNameExact(s.name)
    if (normExact) {
      studentByNormalizedName.set(normExact, s)
    }
    const guardianCpfDigits = (s.guardian_cpf || '').replace(/\D/g, '')
    if (guardianCpfDigits && norm) {
      studentByCpfAndName.set(`${norm}:${guardianCpfDigits}`, s)
    }
  })

  let toCreateCount = 0
  let toUpdateCount = 0
  let inactiveTRCount = 0
  const sampleMatches: ImportPreviewPlan['sampleMatches'] = []

  rows.forEach((row, idx) => {
    const rawName = (row[mapping.aluno] || '').trim()
    if (!rawName) return

    const bubbleId = (row[mapping.uniqueId] || '').trim()
    const normName = normalizeName(rawName)
    const normExact = normalizeNameExact(rawName)
    const rawGuardianCpf = (row[mapping.cpfResponsavel] || '').replace(/\D/g, '')
    const cpfKey = rawGuardianCpf && normName ? `${normName}:${rawGuardianCpf}` : ''

    const rawSituation = (row[mapping.atestadoTr] || '').trim()
    const isTR = rawSituation.toLowerCase() === 'tr' || rawSituation.toLowerCase() === 'trancado'
    if (isTR) {
      inactiveTRCount++
    }

    let existing: StudentRecord | undefined
    let matchReason = ''

    if (bubbleId && studentByBubbleId.has(bubbleId)) {
      existing = studentByBubbleId.get(bubbleId)
      matchReason = 'Bubble ID'
    } else if (cpfKey && studentByCpfAndName.has(cpfKey)) {
      existing = studentByCpfAndName.get(cpfKey)
      matchReason = 'Nome normalizado + CPF do responsável'
    } else if (normName && studentByNormalizedName.has(normName)) {
      existing = studentByNormalizedName.get(normName)
      matchReason = 'Nome normalizado'
    } else if (normExact && studentByNormalizedName.has(normExact)) {
      existing = studentByNormalizedName.get(normExact)
      matchReason = 'Nome exato'
    }

    if (existing) {
      toUpdateCount++
      if (sampleMatches.length < 10) {
        sampleMatches.push({
          rawName,
          action: 'atualizar',
          matchReason: `${matchReason} (ID: ${existing.id})`,
          isTR,
        })
      }
    } else {
      toCreateCount++
      if (sampleMatches.length < 10) {
        sampleMatches.push({
          rawName,
          action: 'criar',
          isTR,
        })
      }
    }
  })

  return {
    totalRows: rows.length,
    toCreateCount,
    toUpdateCount,
    inactiveTRCount,
    sampleMatches,
  }
}

/**
 * Executa a importação em modo de MESCLAGEM (upsert):
 * - Aluno existente -> ATUALIZA campos cadastrais (contato, endereço, responsável, mensalidade, vencimento, situação, etc.)
 *   sem duplicar e SEM tocar no histórico financeiro existente (cobranças, pagamentos).
 * - Aluno novo -> CRIA o registro.
 * - Registros com Atestado/TR = "TR" (trancado) -> Ficam INATIVOS (status = inativo, situation = trancado).
 * - Campo "validade_do_ultimo_pagamento" preenchido a partir da coluna "Data Ultimo Pagamento".
 * - Alunos que estão no banco mas não vieram no CSV ficam intocados.
 * - Idempotente: rodar o mesmo arquivo de novo atualiza sem duplicar.
 */
export async function importBubbleStudents(
  rows: Record<string, string>[],
  mapping: ColumnMapping = DEFAULT_COLUMN_MAPPING,
  onProgress?: (current: number, total: number, currentName?: string) => void,
): Promise<ImportResult> {
  const result: ImportResult = {
    totalProcessed: 0,
    studentsCreated: 0,
    studentsUpdated: 0,
    studentsInactiveTR: 0,
    classesCreated: 0,
    classesFound: 0,
    enrollmentsCreated: 0,
    enrollmentsUpdated: 0,
    paymentsCreated: 0,
    warnings: [],
    errors: [],
  }

  // 1. Carrega turmas existentes
  const existingClasses = await pb.collection('classes').getFullList<ClassRecord>()
  const classMap = new Map<string, ClassRecord>()
  existingClasses.forEach((c) => {
    classMap.set(c.name.trim().toLowerCase(), c)
  })

  // 2. Carrega todos os alunos existentes para índice de casamento em memória
  const existingStudents = await pb.collection('students').getFullList<StudentRecord>()
  const studentByBubbleId = new Map<string, StudentRecord>()
  const studentByNormalizedName = new Map<string, StudentRecord>()
  const studentByCpfAndName = new Map<string, StudentRecord>()

  const registerStudentInMaps = (s: StudentRecord) => {
    if (s.bubble_id && s.bubble_id.trim()) {
      studentByBubbleId.set(s.bubble_id.trim(), s)
    }
    const norm = normalizeName(s.name)
    if (norm) {
      studentByNormalizedName.set(norm, s)
    }
    const normExact = normalizeNameExact(s.name)
    if (normExact) {
      studentByNormalizedName.set(normExact, s)
    }
    const guardianCpfDigits = (s.guardian_cpf || '').replace(/\D/g, '')
    if (guardianCpfDigits && norm) {
      studentByCpfAndName.set(`${norm}:${guardianCpfDigits}`, s)
    }
  }

  existingStudents.forEach(registerStudentInMaps)

  // 3. Pre-load matrículas existentes
  const existingEnrollments = await pb.collection('enrollments').getFullList()
  const enrollmentSet = new Set<string>()
  existingEnrollments.forEach((e) => {
    enrollmentSet.add(`${e.student_id}:${e.class_id}`)
  })

  // 4. Pre-load planos para associar plano padrão caso necessário
  const plans = await pb.collection('plans').getFullList()
  const defaultPlanId = plans.length > 0 ? plans[0].id : undefined

  // 5. Pre-scan turmas faltantes no CSV e cria antecipadamente
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

  // 6. Processamento concorrente controlado (concurrency = 6 para balancear taxa de requisições)
  const CONCURRENCY = 6

  interface RowWorkItem {
    row: Record<string, string>
    idx: number
  }

  const workQueue: RowWorkItem[] = rows.map((row, idx) => ({ row, idx }))

  const processRowItem = async (item: RowWorkItem) => {
    const { row, idx } = item
    const rowNum = idx + 2 // 1-based, cabeçalho é 1

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
      // Normalização de nomes e campos
      const normName = normalizeName(rawName)
      const normExact = normalizeNameExact(rawName)
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

      const isTR = rawSituation.toLowerCase() === 'tr' || rawSituation.toLowerCase() === 'trancado'
      if (isTR) {
        result.studentsInactiveTR++
      }

      const atestadoValidade = parseBubbleDate(row[mapping.atestadoTrValidade])
      const trancamentoValidade = parseBubbleDate(row[mapping.validadeTrancamento])

      // Data de Validade do Último Pagamento (do novo export)
      const rawValidadePagto = (row[mapping.dataUltimoPagamento] || '').trim()
      const validadeDoUltimoPagamento = parseBubbleDate(rawValidadePagto)

      const rawFeeSuspended = (row[mapping.mensalidadeTrancada] || '').trim().toLowerCase()
      const feeSuspended = isTR || rawFeeSuspended === 'sim' || rawFeeSuspended === 'true'

      // Casamento com aluno existente (upsert)
      const guardianCpfDigits = guardianCpf.replace(/\D/g, '')
      const cpfKey = guardianCpfDigits && normName ? `${normName}:${guardianCpfDigits}` : ''

      let existingStudent: StudentRecord | null = null
      if (bubbleId && studentByBubbleId.has(bubbleId)) {
        existingStudent = studentByBubbleId.get(bubbleId)!
      } else if (cpfKey && studentByCpfAndName.has(cpfKey)) {
        existingStudent = studentByCpfAndName.get(cpfKey)!
      } else if (normName && studentByNormalizedName.has(normName)) {
        existingStudent = studentByNormalizedName.get(normName)!
      } else if (normExact && studentByNormalizedName.has(normExact)) {
        existingStudent = studentByNormalizedName.get(normExact)!
      }

      let studentRecord: StudentRecord

      if (existingStudent) {
        // ATUALIZAR ALUNO EXISTENTE SEM TOCAR NO HISTÓRICO FINANCEIRO
        const updatePayload: Partial<StudentRecord> = {
          name: rawName, // atualiza para a grafia mais recente
          status: systemStatus,
          situation: situationTag,
          raw_situation: rawSituation || undefined,
          fee_suspended: feeSuspended,
        }

        if (bubbleId && !existingStudent.bubble_id) {
          updatePayload.bubble_id = bubbleId
        }
        if (photo && !existingStudent.photo_file) {
          updatePayload.photo = photo
        }
        if (birthDate) updatePayload.birth_date = birthDate
        if (guardianName) updatePayload.guardian_name = guardianName
        if (guardianCpf) updatePayload.guardian_cpf = guardianCpf
        if (guardianPhone) updatePayload.guardian_phone = guardianPhone
        if (guardianEmail) updatePayload.guardian_email = guardianEmail
        if (rawWhatsapp) updatePayload.whatsapp = rawWhatsapp
        if (guardianPhone || rawWhatsapp) {
          updatePayload.phone = rawWhatsapp || guardianPhone
        }
        if (guardianEmail) updatePayload.email = guardianEmail
        if (address) updatePayload.address = address
        if (monthlyFee > 0) updatePayload.monthly_fee = monthlyFee
        if (discountedFee > 0 || monthlyFee > 0) {
          updatePayload.discounted_fee = discountedFee || monthlyFee
        }
        if (dueDay > 0) updatePayload.due_day = dueDay
        if (atestadoValidade) updatePayload.atestado_validade = atestadoValidade
        if (trancamentoValidade) updatePayload.trancamento_validade = trancamentoValidade
        if (validadeDoUltimoPagamento) {
          updatePayload.validade_do_ultimo_pagamento = validadeDoUltimoPagamento
        }

        studentRecord = await pb
          .collection('students')
          .update<StudentRecord>(existingStudent.id, updatePayload)
        result.studentsUpdated++
      } else {
        // CRIAR NOVO ALUNO
        const createPayload: Partial<StudentRecord> = {
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
          validade_do_ultimo_pagamento: validadeDoUltimoPagamento || undefined,
          fee_suspended: feeSuspended,
        }

        if (defaultPlanId) {
          createPayload.plan_id = defaultPlanId
        }

        studentRecord = await pb.collection('students').create<StudentRecord>(createPayload)
        result.studentsCreated++
      }

      // Atualiza índices em memória para próximas linhas do mesmo lote
      registerStudentInMaps(studentRecord)

      // Matrículas nas turmas informadas no CSV
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
                  message: `Aviso ao matricular na turma "${actName}": ${err?.message || 'erro'}`,
                })
              }
            } else {
              result.enrollmentsUpdated++
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
