// pocketbase/hooks/student_cleanup.js
// RC Acqua Life — Rotas para exclusão atômica de alunos e limpeza de dados de exemplo
// PocketBase JSVM requirement: All functions and variables must be declared INLINE inside each callback.

// -------------------------------------------------------------
// 1. Excluir aluno com histórico completo de forma atômica
// POST /backend/v1/students/delete-with-history
// Body: { student_id: string, confirmation_name: string }
// -------------------------------------------------------------
// -------------------------------------------------------------
// 0. Cascade: ao excluir um ALUNO, apagar também a ficha de matrícula
// (enrollment_requests) que o originou, se existir — sem deixar ficha
// órfã "Aprovada · aluno vinculado" apontando para aluno inexistente.
// Tolerante: se a ficha já não existir, segue sem erro.
// -------------------------------------------------------------
onRecordDelete((e) => {
  if (e.collection.name !== 'students') {
    return e.next()
  }
  const studentId = e.record.id
  let fichas = []
  try {
    fichas = $app.findRecordsByFilter(
      'enrollment_requests',
      "student_id = '" + studentId + "'",
      '-created',
      50,
      0,
    )
  } catch (errF) {
    console.log('[student-cleanup] Erro ao buscar fichas do aluno:', errF)
    return e.next()
  }
  for (let i = 0; i < fichas.length; i++) {
    try {
      $app.delete(fichas[i])
      console.log('[student-cleanup] Ficha de matrícula removida em cascade:', fichas[i].id)
    } catch (errDel) {
      // 404 = ficha já excluída — tolerante, segue sem erro
      console.log('[student-cleanup] Falha ao remover ficha (ignorado):', errDel)
    }
  }
  // Obrigatório: sem e.next() a exclusão do aluno é abortada silenciosamente
  return e.next()
}, 'students')

// -------------------------------------------------------------
// 0.1 Cascade: ao excluir um ALUNO, apagar seus vínculos obrigatórios
// (matrículas em turmas, pagamentos e cobranças). student_id é texto, sem
// relação no PocketBase; sem isso a exclusão é recusada com "required relation
// reference". Ordem: pagamentos -> cobranças -> matrículas.
// Tolerante a 404 (registro já removido). Sempre chama e.next().
// -------------------------------------------------------------
onRecordDelete((e) => {
  if (e.collection.name !== 'students') {
    return e.next()
  }
  const studentId = e.record.id
  const collections = ['payments', 'charges', 'enrollments']
  for (let c = 0; c < collections.length; c++) {
    let rows = []
    try {
      rows = $app.findRecordsByFilter(
        collections[c],
        "student_id = '" + studentId + "'",
        '-created',
        2000,
        0,
      )
    } catch (errFind) {
      // Nenhum registro encontrado (ou coleção ausente) — segue
      rows = []
    }
    for (let i = 0; i < rows.length; i++) {
      try {
        $app.delete(rows[i])
      } catch (errDel) {
        // 404 = já excluído — tolerante
        console.log('[student-cleanup] Falha ao remover vínculo do aluno (ignorado):', errDel)
      }
    }
  }
  // Obrigatório: sem e.next() a exclusão do aluno é abortada silenciosamente
  return e.next()
}, 'students')

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
// 1.1 Execução de mesclagem (upsert) do CSV do Bubble
// POST /backend/v1/import/execute-csv
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/import/execute-csv', (e) => {
  const info = e.requestInfo()
  const body = info.body || {}

  let rows = body.rows || null
  const csvText = body.csv_text || ''

  const parseBubbleDateInternal = (dateStr) => {
    if (!dateStr || !String(dateStr).trim()) return null
    const s = String(dateStr).trim()
    const regex = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm))?/i
    const match = s.match(regex)
    const monthMap = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    }
    if (match) {
      const monStr = match[1].toLowerCase()
      const day = parseInt(match[2], 10)
      const year = parseInt(match[3], 10)
      let hour = match[4] ? parseInt(match[4], 10) : 0
      const minute = match[5] ? parseInt(match[5], 10) : 0
      const ampm = match[6] ? match[6].toLowerCase() : ''
      if (ampm === 'pm' && hour < 12) hour += 12
      if (ampm === 'am' && hour === 12) hour = 0
      const monIdx = monthMap[monStr]
      if (monIdx !== undefined) {
        const d = new Date(Date.UTC(year, monIdx, day, hour, minute, 0))
        if (!isNaN(d.getTime())) {
          return d.toISOString().replace('T', ' ')
        }
      }
    }
    const standard = new Date(s)
    if (!isNaN(standard.getTime())) {
      return standard.toISOString().replace('T', ' ')
    }
    return null
  }

  const normalizeNameInternal = (str) => {
    if (!str) return ''
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const normalizeNameExactInternal = (str) => {
    if (!str) return ''
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const parseNumberInternal = (val) => {
    if (val === undefined || val === null) return 0
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    const s = String(val).trim().replace(/\s/g, '').replace(',', '.')
    const n = parseFloat(s)
    return isNaN(n) ? 0 : n
  }

  const formatAddressInternal = (p) => {
    const log = (p.logradouro || '').trim()
    const num = (p.numero || '').trim()
    const comp = (p.complemento || '').trim()
    const bairro = (p.bairro || '').trim()
    const cidade = (p.cidade || '').trim()
    const uf = (p.uf || '').trim()
    const cep = (p.cep || '').trim()
    const parts = []
    let street = log
    if (street && num && num !== '0' && num !== 'S/N' && num !== 'S.N⁰') {
      street += ', Nº ' + num
    } else if (num && !street) {
      street = 'Nº ' + num
    }
    if (comp) {
      street = street ? street + ' - ' + comp : comp
    }
    if (street) parts.push(street)
    if (bairro) parts.push(bairro)
    if (cidade && uf) parts.push(cidade + '/' + uf.toUpperCase())
    else if (cidade) parts.push(cidade)
    else if (uf) parts.push(uf.toUpperCase())
    if (cep && cep !== '00000-000') parts.push('CEP ' + cep)
    return parts.join(', ')
  }

  if (!rows && csvText) {
    let content = csvText
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
    const rawRows = []
    let currentRow = []
    let currentField = ''
    let insideQuotes = false
    let i = 0
    while (i < content.length) {
      const char = content[i]
      if (insideQuotes) {
        if (char === '"') {
          if (i + 1 < content.length && content[i + 1] === '"') {
            currentField += '"'
            i += 2
            continue
          } else {
            insideQuotes = false
            i++
            continue
          }
        } else {
          currentField += char
          i++
          continue
        }
      } else {
        if (char === '"') {
          insideQuotes = true
          i++
          continue
        } else if (char === ',') {
          currentRow.push(currentField)
          currentField = ''
          i++
          continue
        } else if (char === '\r') {
          if (i + 1 < content.length && content[i + 1] === '\n') i++
          currentRow.push(currentField)
          rawRows.push(currentRow)
          currentRow = []
          currentField = ''
          i++
          continue
        } else if (char === '\n') {
          currentRow.push(currentField)
          rawRows.push(currentRow)
          currentRow = []
          currentField = ''
          i++
          continue
        } else {
          currentField += char
          i++
          continue
        }
      }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField)
      rawRows.push(currentRow)
    }

    if (rawRows.length > 1) {
      const headers = rawRows[0].map((h) => (h || '').trim())
      rows = []
      for (let r = 1; r < rawRows.length; r++) {
        const line = rawRows[r]
        if (line.length === 1 && !line[0].trim()) continue
        if (line.every((v) => !v.trim())) continue
        const obj = {}
        for (let c = 0; c < headers.length; c++) {
          obj[headers[c]] = line[c] !== undefined ? line[c] : ''
        }
        rows.push(obj)
      }
    }
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return e.json(400, {
      success: false,
      message: 'Nenhum registro para importar. Envie "rows" (array) ou "csv_text" (string).',
    })
  }

  const result = {
    totalProcessed: 0,
    studentsCreated: 0,
    studentsUpdated: 0,
    studentsInactiveTR: 0,
    classesCreated: 0,
    enrollmentsCreated: 0,
    enrollmentsUpdated: 0,
    warnings: [],
  }

  // 1. Carregar turmas
  const classMap = {}
  try {
    const classes = $app.findRecordsByFilter('classes', '', 'name', 500, 0)
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i]
      classMap[c.getString('name').trim().toLowerCase()] = c
    }
  } catch (errClasses) {}

  // 2. Carregar alunos existentes
  const studentByBubbleId = {}
  const studentByNormName = {}
  const studentByNormExact = {}
  const studentByCpfAndName = {}

  const indexStudent = (s) => {
    const bid = (s.getString('bubble_id') || '').trim()
    if (bid) studentByBubbleId[bid] = s

    const sName = s.getString('name') || ''
    const norm = normalizeNameInternal(sName)
    if (norm) studentByNormName[norm] = s

    const normExact = normalizeNameExactInternal(sName)
    if (normExact) studentByNormExact[normExact] = s

    const gCpf = (s.getString('guardian_cpf') || '').replace(/\D/g, '')
    if (gCpf && norm) studentByCpfAndName[norm + ':' + gCpf] = s
  }

  try {
    const existingStudents = $app.findRecordsByFilter('students', '', 'name', 2000, 0)
    for (let i = 0; i < existingStudents.length; i++) {
      indexStudent(existingStudents[i])
    }
  } catch (errSt) {}

  // 3. Carregar matrículas
  const enrollmentMap = {}
  try {
    const existingEnrollments = $app.findRecordsByFilter('enrollments', '', '-created', 5000, 0)
    for (let i = 0; i < existingEnrollments.length; i++) {
      const enr = existingEnrollments[i]
      enrollmentMap[enr.getString('student_id') + ':' + enr.getString('class_id')] = true
    }
  } catch (errEnr) {}

  // 4. Carregar planos
  let defaultPlanId = ''
  try {
    const plans = $app.findRecordsByFilter('plans', 'is_active = true', 'monthly_price', 10, 0)
    if (plans.length > 0) defaultPlanId = plans[0].id
  } catch (_) {}

  const studentsCol = $app.findCollectionByNameOrId('students')
  const classesCol = $app.findCollectionByNameOrId('classes')
  const enrollmentsCol = $app.findCollectionByNameOrId('enrollments')

  // Pre-criar turmas
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const rawAtividade = (row['Atividade'] || row['atividade'] || '').trim()
    if (rawAtividade) {
      const acts = rawAtividade
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
      for (let a = 0; a < acts.length; a++) {
        const actName = acts[a]
        const key = actName.toLowerCase()
        if (!classMap[key]) {
          try {
            const classRec = new Record(classesCol)
            classRec.set('name', actName)
            let cType = 'natacao'
            if (key.indexOf('hidro') !== -1) cType = 'hidroginastica'
            else if (key.indexOf('funcional') !== -1) cType = 'funcional'
            classRec.set('type', cType)
            classRec.set('schedule_days', ['seg', 'qua', 'sex'])
            classRec.set('schedule_time', '08:00')
            classRec.set('capacity', 20)
            classRec.set('monthly_price', 100)
            $app.save(classRec)
            classMap[key] = classRec
            result.classesCreated++
          } catch (errC) {}
        }
      }
    }
  }

  // 6. Processar linhas
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const rowNum = r + 2

    const rawName = (row['Aluno'] || row['aluno'] || row['Nome'] || '').trim()
    const bubbleId = (row['unique id'] || row['uniqueId'] || row['Bubble ID'] || '').trim()

    if (!rawName) {
      result.warnings.push({ row: rowNum, message: 'Linha ignorada: nome do aluno não informado.' })
      result.totalProcessed++
      continue
    }

    try {
      const normName = normalizeNameInternal(rawName)
      const normExact = normalizeNameExactInternal(rawName)

      let rawPhoto = (row['Foto'] || row['foto'] || '').trim()
      if (rawPhoto.startsWith('//')) rawPhoto = 'https:' + rawPhoto

      const birthDate = parseBubbleDateInternal(row['Nascimento'] || row['nascimento'])
      const guardianName = (row['Nome Responsável'] || row['nomeResponsavel'] || '').trim()
      const guardianCpf = (row['CPF do responsável'] || row['cpfResponsavel'] || '').trim()
      const guardianPhone = (
        row['Celular do responsável'] ||
        row['celularResponsavel'] ||
        ''
      ).trim()
      const guardianEmail = (row['E-mail Responsável'] || row['emailResponsavel'] || '').trim()
      const rawWhatsapp = (row['WhatsApp'] || row['whatsapp'] || '').trim()

      const address = formatAddressInternal({
        logradouro: row['Logradouro'],
        numero: row['Número'],
        complemento: row['Complemento'],
        bairro: row['Bairro'],
        cidade: row['Cidade'],
        uf: row['UF'],
        cep: row['CEP'],
      })

      const monthlyFee = parseNumberInternal(row['Mensalidade'] || row['mensalidade'])
      const discountedFee = parseNumberInternal(
        row['Mensalidade com desconto'] || row['mensalidadeComDesconto'],
      )
      const dueDay = Math.round(parseNumberInternal(row['Vencimento'] || row['vencimento'])) || 5

      const rawSituation = (row['Atestado/TR'] || row['atestadoTr'] || '').trim()
      const lowerSit = rawSituation.toLowerCase()
      const isTR = lowerSit === 'tr' || lowerSit === 'trancado'

      let systemStatus = 'ativo'
      let situationTag = 'ativo'
      if (isTR) {
        systemStatus = 'inativo'
        situationTag = 'trancado'
        result.studentsInactiveTR++
      } else if (lowerSit === 'atestado') {
        systemStatus = 'inativo'
        situationTag = 'atestado'
      } else if (lowerSit === 'vencido') {
        systemStatus = 'ativo'
        situationTag = 'inadimplente'
      } else if (lowerSit === 'inativo') {
        systemStatus = 'inativo'
        situationTag = 'inativo'
      }

      const atestadoValidade = parseBubbleDateInternal(
        row['Atestado/TR Validade'] || row['atestadoTrValidade'],
      )
      const trancamentoValidade = parseBubbleDateInternal(
        row['Validade Trancamento Alunos'] || row['validadeTrancamento'],
      )
      const rawValidadePagto = (
        row['Data Ultimo Pagamento'] ||
        row['dataUltimoPagamento'] ||
        ''
      ).trim()
      const validadeDoUltimoPagamento = parseBubbleDateInternal(rawValidadePagto)

      const rawFeeSusp = (row['Mensalidade trancada'] || row['mensalidadeTrancada'] || '')
        .trim()
        .toLowerCase()
      const feeSuspended = isTR || rawFeeSusp === 'sim' || rawFeeSusp === 'true'

      const guardianCpfDigits = guardianCpf.replace(/\D/g, '')
      const cpfKey = guardianCpfDigits && normName ? normName + ':' + guardianCpfDigits : ''

      let existingStudent = null
      if (bubbleId && studentByBubbleId[bubbleId]) {
        existingStudent = studentByBubbleId[bubbleId]
      } else if (cpfKey && studentByCpfAndName[cpfKey]) {
        existingStudent = studentByCpfAndName[cpfKey]
      } else if (normName && studentByNormName[normName]) {
        existingStudent = studentByNormName[normName]
      } else if (normExact && studentByNormExact[normExact]) {
        existingStudent = studentByNormExact[normExact]
      }

      let savedStudent = null

      if (existingStudent) {
        existingStudent.set('name', rawName)
        existingStudent.set('status', systemStatus)
        existingStudent.set('situation', situationTag)
        if (rawSituation) existingStudent.set('raw_situation', rawSituation)
        existingStudent.set('fee_suspended', feeSuspended)

        if (bubbleId && !existingStudent.getString('bubble_id')) {
          existingStudent.set('bubble_id', bubbleId)
        }
        if (rawPhoto && !existingStudent.getString('photo_file')) {
          existingStudent.set('photo', rawPhoto)
        }
        if (birthDate) existingStudent.set('birth_date', birthDate)
        if (guardianName) existingStudent.set('guardian_name', guardianName)
        if (guardianCpf) existingStudent.set('guardian_cpf', guardianCpf)
        if (guardianPhone) existingStudent.set('guardian_phone', guardianPhone)
        if (guardianEmail) existingStudent.set('guardian_email', guardianEmail)
        if (rawWhatsapp) existingStudent.set('whatsapp', rawWhatsapp)
        if (guardianPhone || rawWhatsapp) {
          existingStudent.set('phone', rawWhatsapp || guardianPhone)
        }
        if (guardianEmail) existingStudent.set('email', guardianEmail)
        if (address) existingStudent.set('address', address)
        if (monthlyFee > 0) existingStudent.set('monthly_fee', monthlyFee)
        if (discountedFee > 0 || monthlyFee > 0) {
          existingStudent.set('discounted_fee', discountedFee || monthlyFee)
        }
        if (dueDay > 0) existingStudent.set('due_day', dueDay)
        if (atestadoValidade) existingStudent.set('atestado_validade', atestadoValidade)
        if (trancamentoValidade) existingStudent.set('trancamento_validade', trancamentoValidade)
        if (validadeDoUltimoPagamento) {
          existingStudent.set('validade_do_ultimo_pagamento', validadeDoUltimoPagamento)
        }

        $app.save(existingStudent)
        savedStudent = existingStudent
        result.studentsUpdated++
      } else {
        savedStudent = new Record(studentsCol)
        savedStudent.set('name', rawName)
        if (bubbleId) savedStudent.set('bubble_id', bubbleId)
        if (rawPhoto) savedStudent.set('photo', rawPhoto)
        if (birthDate) savedStudent.set('birth_date', birthDate)
        if (guardianName) savedStudent.set('guardian_name', guardianName)
        if (guardianCpf) savedStudent.set('guardian_cpf', guardianCpf)
        if (guardianPhone) savedStudent.set('guardian_phone', guardianPhone)
        if (guardianEmail) savedStudent.set('guardian_email', guardianEmail)
        if (rawWhatsapp) savedStudent.set('whatsapp', rawWhatsapp)
        if (rawWhatsapp || guardianPhone) {
          savedStudent.set('phone', rawWhatsapp || guardianPhone)
        }
        if (guardianEmail) savedStudent.set('email', guardianEmail)
        if (address) savedStudent.set('address', address)
        savedStudent.set('monthly_fee', monthlyFee)
        savedStudent.set('discounted_fee', discountedFee || monthlyFee)
        savedStudent.set('due_day', dueDay)
        savedStudent.set('situation', situationTag)
        if (rawSituation) savedStudent.set('raw_situation', rawSituation)
        savedStudent.set('status', systemStatus)
        if (atestadoValidade) savedStudent.set('atestado_validade', atestadoValidade)
        if (trancamentoValidade) savedStudent.set('trancamento_validade', trancamentoValidade)
        if (validadeDoUltimoPagamento) {
          savedStudent.set('validade_do_ultimo_pagamento', validadeDoUltimoPagamento)
        }
        savedStudent.set('fee_suspended', feeSuspended)
        if (defaultPlanId) savedStudent.set('plan_id', defaultPlanId)

        $app.save(savedStudent)
        result.studentsCreated++
      }

      indexStudent(savedStudent)

      // Matrículas
      const rawAtividade = (row['Atividade'] || row['atividade'] || '').trim()
      if (rawAtividade) {
        const activityNames = rawAtividade
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0)
        for (let a = 0; a < activityNames.length; a++) {
          const actName = activityNames[a]
          const actKey = actName.toLowerCase()
          const classRec = classMap[actKey]
          if (classRec) {
            const enrollKey = savedStudent.id + ':' + classRec.id
            if (!enrollmentMap[enrollKey]) {
              const enrollmentDate =
                parseBubbleDateInternal(row['Data matrícula']) ||
                parseBubbleDateInternal(row['Data Início']) ||
                new Date().toISOString().replace('T', ' ')
              try {
                const enrRecord = new Record(enrollmentsCol)
                enrRecord.set('student_id', savedStudent.id)
                enrRecord.set('class_id', classRec.id)
                enrRecord.set('enrollment_date', enrollmentDate)
                enrRecord.set('is_active', systemStatus === 'ativo')
                $app.save(enrRecord)
                enrollmentMap[enrollKey] = true
                result.enrollmentsCreated++
              } catch (enrErr) {}
            } else {
              result.enrollmentsUpdated++
            }
          }
        }
      }

      result.totalProcessed++
    } catch (errRow) {
      result.warnings.push({
        row: rowNum,
        studentName: rawName,
        message: 'Erro ao processar: ' + (errRow.message || String(errRow)),
      })
      result.totalProcessed++
    }
  }

  return e.json(200, {
    success: true,
    result: result,
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
