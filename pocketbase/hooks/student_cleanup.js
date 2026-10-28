// pocketbase/hooks/student_cleanup.js
// RC Acqua Life — Rotas para exclusão atômica de alunos e limpeza de dados de exemplo
// PocketBase JSVM requirement: All functions and variables must be declared INLINE inside each callback.

// -------------------------------------------------------------
// 1. Excluir aluno com histórico completo de forma atômica
// POST /backend/v1/students/delete-with-history
// Body: { student_id: string, confirmation_name: string }
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/students/delete-with-history', (e) => {
  const info = e.requestInfo()
  const body = info.body || {}

  const studentId = String(body.student_id || '').trim()
  const confirmationName = String(body.confirmation_name || '').trim()

  if (!studentId) {
    return e.json(400, {
      success: false,
      message: 'student_id é obrigatório.',
    })
  }

  let student = null
  try {
    student = $app.findRecordById('students', studentId)
  } catch (err) {
    return e.json(404, {
      success: false,
      message: 'Aluno não encontrado.',
    })
  }

  const realName = student.getString('name') || ''
  const normalize = (str) =>
    String(str || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')

  if (normalize(confirmationName) !== normalize(realName)) {
    return e.json(400, {
      success: false,
      message: `O nome digitado ("${confirmationName}") não confere com o nome do aluno ("${realName}").`,
    })
  }

  let deletedCharges = 0
  let deletedPayments = 0
  let deletedEnrollments = 0
  let deletedTransactions = 0

  try {
    $app.runInTransaction((txApp) => {
      // 1. Matrículas
      try {
        const enrollments = txApp.findRecordsByFilter(
          'enrollments',
          `student_id = '${studentId}'`,
          '-created',
          500,
          0,
        )
        for (let i = 0; i < enrollments.length; i++) {
          txApp.delete(enrollments[i])
          deletedEnrollments++
        }
      } catch (errEnr) {
        console.log('[delete-with-history] Erro ao remover matrículas:', errEnr)
      }

      // 2. Pagamentos
      try {
        const payments = txApp.findRecordsByFilter(
          'payments',
          `student_id = '${studentId}'`,
          '-created',
          1000,
          0,
        )
        for (let i = 0; i < payments.length; i++) {
          txApp.delete(payments[i])
          deletedPayments++
        }
      } catch (errPay) {
        console.log('[delete-with-history] Erro ao remover pagamentos:', errPay)
      }

      // 3. Cobranças
      try {
        const charges = txApp.findRecordsByFilter(
          'charges',
          `student_id = '${studentId}'`,
          '-created',
          1000,
          0,
        )
        for (let i = 0; i < charges.length; i++) {
          txApp.delete(charges[i])
          deletedCharges++
        }
      } catch (errChg) {
        console.log('[delete-with-history] Erro ao remover cobranças:', errChg)
      }

      // 4. Transações financeiras que mencionam este aluno pelo nome ou ID
      try {
        const transList = txApp.findRecordsByFilter(
          'transactions',
          `description ~ '${realName}' || notes ~ '${studentId}'`,
          '-created',
          500,
          0,
        )
        for (let i = 0; i < transList.length; i++) {
          txApp.delete(transList[i])
          deletedTransactions++
        }
      } catch (errTrans) {
        console.log('[delete-with-history] Erro ao remover transações vinculadas:', errTrans)
      }

      // 5. Excluir o próprio aluno
      txApp.delete(student)
    })
  } catch (txErr) {
    console.log('[delete-with-history] Falha na transação:', txErr)
    return e.json(500, {
      success: false,
      message:
        'Erro ao remover aluno e histórico no banco de dados: ' + (txErr.message || String(txErr)),
    })
  }

  return e.json(200, {
    success: true,
    message: `Aluno ${realName} e todo o seu histórico financeiro foram excluídos permanentemente.`,
    details: {
      student_id: studentId,
      student_name: realName,
      charges_deleted: deletedCharges,
      payments_deleted: deletedPayments,
      enrollments_deleted: deletedEnrollments,
      transactions_deleted: deletedTransactions,
    },
  })
})

// -------------------------------------------------------------
// 2. Pré-visualizar / Buscar dados de exemplo fictícios
// GET /backend/v1/cleanup/sample-data
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/cleanup/sample-data', (e) => {
  // Heurística de identificação de registros fictícios:
  // 1. Alunos:
  //    - bubble_id DEVE ser nulo ou vazio (nunca tocar em alunos do Bubble!)
  //    - CPF genérico como 123.456.789-01, 234.567.890-12, 345.678.901-23, 456.789.012-34
  //    - OU nomes conhecidos das sementes iniciais se tiverem CPF fictício: Rodrigo Almeida, Mariana Silva, Beatriz Oliveira, Lucas Gabriel
  // 2. Cobranças fictícias:
  //    - infinipay_payment_id ~ 'inf_pay_100' ou payment_link ~ 'inf_pay_100'
  //    - OU pertencentes aos alunos fictícios identificados
  // 3. Pagamentos fictícios:
  //    - infinipay_transaction_id ~ 'inf_pay_100' ou payment_link ~ 'inf_pay_100'
  //    - OU pertencentes aos alunos fictícios identificados
  // 4. Transações fictícias:
  //    - Transações que citam "Mensalidade Mariana Silva - Janeiro" ou "Mensalidade Lucas Gabriel - Janeiro"
  //    - OU despesas de manutenção da semente inicial criada na mesma época se explicitamente vinculadas

  const isGenericCpf = (cpf) => {
    if (!cpf) return false
    const clean = String(cpf).replace(/\D/g, '')
    // Padrões 12345678901, 23456789012, 34567890123, 45678901234, etc.
    const genericPatterns = [
      '12345678901',
      '23456789012',
      '34567890123',
      '45678901234',
      '56789012345',
      '00000000000',
      '11111111111',
    ]
    if (genericPatterns.indexOf(clean) !== -1) return true
    if (/^(\d)\1{10}$/.test(clean)) return true
    return false
  }

  const sampleStudentNames = [
    'mariana silva',
    'rodrigo almeida',
    'beatriz oliveira',
    'lucas gabriel',
  ]

  let allStudents = []
  try {
    allStudents = $app.findRecordsByFilter('students', '', 'name', 2000, 0)
  } catch (err) {
    return e.json(500, { success: false, message: 'Erro ao buscar alunos: ' + String(err) })
  }

  const sampleStudents = []
  const ignoredForSafety = []
  const sampleStudentIds = {}

  for (let i = 0; i < allStudents.length; i++) {
    const st = allStudents[i]
    const bubbleId = String(st.getString('bubble_id') || '').trim()
    const name = st.getString('name') || ''
    const cpf = st.getString('cpf') || ''
    const lowerName = name.trim().toLowerCase()

    // Regra inquebrável: se tem bubble_id, NUNCA é fictício!
    if (bubbleId) {
      if (sampleStudentNames.indexOf(lowerName) !== -1 || isGenericCpf(cpf)) {
        ignoredForSafety.push({
          id: st.id,
          name: name,
          bubble_id: bubbleId,
          reason: 'Possui bubble_id preenchido (aluno real importado do Bubble)',
        })
      }
      continue
    }

    const isNameMatch = sampleStudentNames.indexOf(lowerName) !== -1
    const isCpfMatch = isGenericCpf(cpf)

    if (isNameMatch || isCpfMatch) {
      sampleStudents.push({
        id: st.id,
        name: name,
        cpf: cpf,
        email: st.getString('email') || '',
        status: st.getString('status') || '',
        reason: isCpfMatch
          ? 'CPF genérico/fictício de demonstração'
          : 'Nome e dados da semente inicial',
      })
      sampleStudentIds[st.id] = true
    }
  }

  // Buscar cobranças
  const sampleCharges = []
  try {
    const allCharges = $app.findRecordsByFilter('charges', '', '-created', 2000, 0)
    for (let i = 0; i < allCharges.length; i++) {
      const chg = allCharges[i]
      const payId = chg.getString('infinipay_payment_id') || ''
      const link = chg.getString('payment_link') || ''
      const stId = chg.getString('student_id') || ''

      const isFakeLink = payId.indexOf('inf_pay_100') !== -1 || link.indexOf('inf_pay_100') !== -1
      const isFakeStudent = !!sampleStudentIds[stId]

      if (isFakeLink || isFakeStudent) {
        sampleCharges.push({
          id: chg.id,
          description: chg.getString('description') || '',
          amount: chg.getFloat('amount') || 0,
          due_date: chg.getString('due_date') || '',
          status: chg.getString('status') || '',
          payment_link: link,
          student_id: stId,
        })
      }
    }
  } catch (errChg) {
    console.log('[cleanup/sample-data] Erro ao buscar cobranças:', errChg)
  }

  // Buscar pagamentos
  const samplePayments = []
  try {
    const allPayments = $app.findRecordsByFilter('payments', '', '-created', 2000, 0)
    for (let i = 0; i < allPayments.length; i++) {
      const p = allPayments[i]
      const transId = p.getString('infinipay_transaction_id') || ''
      const link = p.getString('payment_link') || ''
      const stId = p.getString('student_id') || ''

      const isFakeLink = transId.indexOf('inf_pay_100') !== -1 || link.indexOf('inf_pay_100') !== -1
      const isFakeStudent = !!sampleStudentIds[stId]

      if (isFakeLink || isFakeStudent) {
        samplePayments.push({
          id: p.id,
          charge_id: p.getString('charge_id') || '',
          amount: p.getFloat('amount') || 0,
          status: p.getString('status') || '',
          due_date: p.getString('due_date') || '',
          student_id: stId,
        })
      }
    }
  } catch (errPay) {
    console.log('[cleanup/sample-data] Erro ao buscar pagamentos:', errPay)
  }

  // Buscar matrículas dos alunos fictícios
  const sampleEnrollments = []
  try {
    const allEnrollments = $app.findRecordsByFilter('enrollments', '', '-created', 2000, 0)
    for (let i = 0; i < allEnrollments.length; i++) {
      const enr = allEnrollments[i]
      const stId = enr.getString('student_id') || ''
      if (sampleStudentIds[stId]) {
        sampleEnrollments.push({
          id: enr.id,
          student_id: stId,
          class_id: enr.getString('class_id') || '',
        })
      }
    }
  } catch (errEnr) {
    console.log('[cleanup/sample-data] Erro ao buscar matrículas:', errEnr)
  }

  // Buscar transações de receitas fictícias da semente inicial
  const sampleTransactions = []
  try {
    const allTransactions = $app.findRecordsByFilter('transactions', '', '-created', 1000, 0)
    for (let i = 0; i < allTransactions.length; i++) {
      const t = allTransactions[i]
      const desc = t.getString('description') || ''
      const notes = t.getString('notes') || ''
      const isSeedIncome =
        desc.indexOf('Mariana Silva - Janeiro') !== -1 ||
        desc.indexOf('Lucas Gabriel - Janeiro') !== -1 ||
        desc.indexOf('Rodrigo Almeida') !== -1 ||
        desc.indexOf('Beatriz Oliveira') !== -1

      if (isSeedIncome) {
        sampleTransactions.push({
          id: t.id,
          description: desc,
          amount: t.getFloat('amount') || 0,
          type: t.getString('type') || '',
          notes: notes,
        })
      }
    }
  } catch (errTrans) {
    console.log('[cleanup/sample-data] Erro ao buscar transações:', errTrans)
  }

  return e.json(200, {
    success: true,
    summary: {
      students_count: sampleStudents.length,
      charges_count: sampleCharges.length,
      payments_count: samplePayments.length,
      enrollments_count: sampleEnrollments.length,
      transactions_count: sampleTransactions.length,
      ignored_count: ignoredForSafety.length,
    },
    students: sampleStudents,
    charges: sampleCharges,
    payments: samplePayments,
    enrollments: sampleEnrollments,
    transactions: sampleTransactions,
    ignored_for_safety: ignoredForSafety,
  })
})

// -------------------------------------------------------------
// 3. Executar limpeza de dados fictícios
// POST /backend/v1/cleanup/execute
// Body: { confirmation: string } ("LIMPAR")
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/cleanup/execute', (e) => {
  const info = e.requestInfo()
  const body = info.body || {}

  const confirmation = String(body.confirmation || '')
    .trim()
    .toUpperCase()
  if (confirmation !== 'LIMPAR') {
    return e.json(400, {
      success: false,
      message:
        'Confirmação inválida. Digite exatamente "LIMPAR" para confirmar a exclusão dos dados de exemplo.',
    })
  }

  const isGenericCpf = (cpf) => {
    if (!cpf) return false
    const clean = String(cpf).replace(/\D/g, '')
    const genericPatterns = [
      '12345678901',
      '23456789012',
      '34567890123',
      '45678901234',
      '56789012345',
      '00000000000',
      '11111111111',
    ]
    if (genericPatterns.indexOf(clean) !== -1) return true
    if (/^(\d)\1{10}$/.test(clean)) return true
    return false
  }

  const sampleStudentNames = [
    'mariana silva',
    'rodrigo almeida',
    'beatriz oliveira',
    'lucas gabriel',
  ]

  let deletedStudentsCount = 0
  let deletedChargesCount = 0
  let deletedPaymentsCount = 0
  let deletedEnrollmentsCount = 0
  let deletedTransactionsCount = 0
  const deletedStudentNames = []

  try {
    $app.runInTransaction((txApp) => {
      // 1. Identificar alunos fictícios
      const allStudents = txApp.findRecordsByFilter('students', '', 'name', 2000, 0)
      const targetStudentIds = {}
      const targetStudentRecords = []

      for (let i = 0; i < allStudents.length; i++) {
        const st = allStudents[i]
        const bubbleId = String(st.getString('bubble_id') || '').trim()
        const name = st.getString('name') || ''
        const cpf = st.getString('cpf') || ''
        const lowerName = name.trim().toLowerCase()

        // Proteção inquebrável para dados reais do Bubble
        if (bubbleId) continue

        const isNameMatch = sampleStudentNames.indexOf(lowerName) !== -1
        const isCpfMatch = isGenericCpf(cpf)

        if (isNameMatch || isCpfMatch) {
          targetStudentIds[st.id] = true
          targetStudentRecords.push(st)
          deletedStudentNames.push(name)
        }
      }

      // 2. Remover matrículas vinculadas
      const allEnrollments = txApp.findRecordsByFilter('enrollments', '', '-created', 2000, 0)
      for (let i = 0; i < allEnrollments.length; i++) {
        const enr = allEnrollments[i]
        const stId = enr.getString('student_id') || ''
        if (targetStudentIds[stId]) {
          txApp.delete(enr)
          deletedEnrollmentsCount++
        }
      }

      // 3. Remover pagamentos fictícios ou vinculados aos alunos fictícios
      const allPayments = txApp.findRecordsByFilter('payments', '', '-created', 2000, 0)
      for (let i = 0; i < allPayments.length; i++) {
        const p = allPayments[i]
        const transId = p.getString('infinipay_transaction_id') || ''
        const link = p.getString('payment_link') || ''
        const stId = p.getString('student_id') || ''

        const isFake =
          targetStudentIds[stId] ||
          transId.indexOf('inf_pay_100') !== -1 ||
          link.indexOf('inf_pay_100') !== -1

        if (isFake) {
          txApp.delete(p)
          deletedPaymentsCount++
        }
      }

      // 4. Remover cobranças fictícias ou vinculadas aos alunos fictícios
      const allCharges = txApp.findRecordsByFilter('charges', '', '-created', 2000, 0)
      for (let i = 0; i < allCharges.length; i++) {
        const chg = allCharges[i]
        const payId = chg.getString('infinipay_payment_id') || ''
        const link = chg.getString('payment_link') || ''
        const stId = chg.getString('student_id') || ''

        const isFake =
          targetStudentIds[stId] ||
          payId.indexOf('inf_pay_100') !== -1 ||
          link.indexOf('inf_pay_100') !== -1

        if (isFake) {
          txApp.delete(chg)
          deletedChargesCount++
        }
      }

      // 5. Remover transações de receita da semente inicial
      const allTransactions = txApp.findRecordsByFilter('transactions', '', '-created', 1000, 0)
      for (let i = 0; i < allTransactions.length; i++) {
        const t = allTransactions[i]
        const desc = t.getString('description') || ''
        const isSeed =
          desc.indexOf('Mariana Silva - Janeiro') !== -1 ||
          desc.indexOf('Lucas Gabriel - Janeiro') !== -1 ||
          desc.indexOf('Rodrigo Almeida') !== -1 ||
          desc.indexOf('Beatriz Oliveira') !== -1

        if (isSeed) {
          txApp.delete(t)
          deletedTransactionsCount++
        }
      }

      // 6. Excluir os alunos fictícios
      for (let i = 0; i < targetStudentRecords.length; i++) {
        txApp.delete(targetStudentRecords[i])
        deletedStudentsCount++
      }
    })
  } catch (err) {
    console.log('[cleanup/execute] Erro durante a limpeza:', err)
    return e.json(500, {
      success: false,
      message: 'Falha ao executar limpeza de dados de exemplo: ' + (err.message || String(err)),
    })
  }

  return e.json(200, {
    success: true,
    message: `Limpeza concluída com sucesso! ${deletedStudentsCount} aluno(s) de exemplo e seus históricos foram removidos.`,
    report: {
      students_deleted: deletedStudentsCount,
      charges_deleted: deletedChargesCount,
      payments_deleted: deletedPaymentsCount,
      enrollments_deleted: deletedEnrollmentsCount,
      transactions_deleted: deletedTransactionsCount,
      student_names: deletedStudentNames,
    },
  })
})
