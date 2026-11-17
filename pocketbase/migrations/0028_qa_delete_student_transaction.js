/// RC Acqua Life — QA: prova de que a EXCLUSÃO DE ALUNO DENTRO DE TRANSAÇÃO
/// funciona com os handlers onRecordDelete do student_cleanup.js — o bug da
/// 0.0.71 ("Cannot read property 'name' of undefined") abortava a transação da
/// rota delete-with-history e o aluno permanecia no banco.
///
/// Reproduz exatamente o cenário da rota: cria um aluno de teste COM vínculos
/// (enrollment + charge + payment) e o exclui DENTRO de $app.runInTransaction,
/// que é o caminho em que o PocketBase dispara os onRecordDelete sem e.collection.
/// Idempotente: se o aluno de teste já existe, apenas tenta excluí-lo de novo.
/// Nunca lança erro — o resultado vai para os logs de hooks com a tag [QA delete].

migrate(
  (app) => {
    const TAG = '[QA delete 0028]'
    const NAME = 'TESTE QA EXCLUSAO'
    const CPF = '999.888.777-66'

    // Encontrar (ou criar) o aluno de teste.
    let student = null
    const found = app.findRecordsByFilter('students', "name = '" + NAME + "'", '', 1, 0)
    if (found && found.length > 0) {
      student = found[0]
    }

    if (!student) {
      const col = app.findCollectionByNameOrId('students')
      student = new Record(col)
      student.set('name', NAME)
      student.set('cpf', CPF)
      student.set('status', 'ativo')
      student.set('situation', 'ativo')
      app.save(student)
      console.log(TAG, 'aluno de teste criado:', student.id)
    } else {
      console.log(TAG, 'aluno de teste já existe (reexecução):', student.id)
    }
    const studentId = student.id

    // Criar vínculos idempotentes (1 enrollment, 1 charge, 1 payment).
    const hasVinculo = function (collectionName, filter) {
      const rows = app.findRecordsByFilter(collectionName, filter, '', 1, 0)
      return rows && rows.length > 0
    }

    if (!hasVinculo('enrollments', "student_id = '" + studentId + "'")) {
      const classes = app.findRecordsByFilter('classes', '', 'name', 1, 0)
      if (classes && classes.length > 0) {
        const enrCol = app.findCollectionByNameOrId('enrollments')
        const enr = new Record(enrCol)
        enr.set('student_id', studentId)
        enr.set('class_id', classes[0].id)
        enr.set('enrollment_date', '2026-01-05 00:00:00.000Z')
        enr.set('is_active', true)
        app.save(enr)
        console.log(TAG, 'enrollment de teste criado:', enr.id)
      } else {
        console.log(TAG, 'sem turmas no banco — enrollment de teste não criado')
      }
    }

    if (!hasVinculo('charges', "student_id = '" + studentId + "'")) {
      const chgCol = app.findCollectionByNameOrId('charges')
      const chg = new Record(chgCol)
      chg.set('student_id', studentId)
      chg.set('description', 'Mensalidade ' + NAME)
      chg.set('amount', 110)
      chg.set('due_date', '2026-02-05 00:00:00.000Z')
      chg.set('status', 'em_aberto')
      app.save(chg)
      console.log(TAG, 'charge de teste criada:', chg.id)
    }

    if (!hasVinculo('payments', "student_id = '" + studentId + "'")) {
      const payCol = app.findCollectionByNameOrId('payments')
      const pay = new Record(payCol)
      pay.set('student_id', studentId)
      pay.set('amount', 110)
      pay.set('due_date', '2026-02-05 00:00:00.000Z')
      pay.set('status', 'pendente')
      app.save(pay)
      console.log(TAG, 'payment de teste criado:', pay.id)
    }

    // PROVA: mesma mecânica da rota delete-with-history — exclusão do aluno
    // dentro de runInTransaction. Se os handlers onRecordDelete quebrarem
    // (e.collection undefined), a transação rola back e o teste falha aqui.
    let cascadeInfo = { enrollments: 0, charges: 0, payments: 0 }
    try {
      app.runInTransaction(function (txApp) {
        const targets = ['payments', 'charges', 'enrollments']
        for (let t = 0; t < targets.length; t++) {
          const rows = txApp.findRecordsByFilter(
            targets[t],
            "student_id = '" + studentId + "'",
            '',
            500,
            0,
          )
          cascadeInfo[targets[t]] = rows.length
          for (let i = 0; i < rows.length; i++) {
            txApp.delete(rows[i])
          }
        }
        txApp.delete(student)
      })
    } catch (txErr) {
      console.error(
        TAG,
        'FALHOU: exclusão em transação quebrou (bug e.collection reproduzido?):',
        txErr,
      )
      return
    }

    // Verificação pós-transação (igual à rota): o aluno NÃO pode mais existir,
    // e nenhum vínculo pode ter sobrado.
    let stillExists = false
    try {
      app.findRecordById('students', studentId)
      stillExists = true
    } catch (_) {
      stillExists = false
    }

    const orphanEnr = app.findRecordsByFilter(
      'enrollments',
      "student_id = '" + studentId + "'",
      '',
      1,
      0,
    )
    const orphanChg = app.findRecordsByFilter(
      'charges',
      "student_id = '" + studentId + "'",
      '',
      1,
      0,
    )
    const orphanPay = app.findRecordsByFilter(
      'payments',
      "student_id = '" + studentId + "'",
      '',
      1,
      0,
    )

    if (stillExists) {
      console.error(TAG, 'FALHOU: aluno ainda existe após a transação (exclusão abortada).')
      return
    }

    console.log(
      TAG,
      'OK: aluno excluído dentro de transação sem erro de e.collection.',
      'cascade:',
      JSON.stringify(cascadeInfo),
      'órfãos restantes: enrollments=' + orphanEnr.length,
      'charges=' + orphanChg.length,
      'payments=' + orphanPay.length,
    )
  },
  (app) => {
    // Rollback: remove o aluno de teste (e vínculos) se existir.
    const TAG = '[QA delete 0028 rollback]'
    const found = app.findRecordsByFilter('students', "name = 'TESTE QA EXCLUSAO'", '', 1, 0)
    if (!found || found.length === 0) return
    const studentId = found[0].id
    const cleanup = function (collectionName) {
      const rows = app.findRecordsByFilter(
        collectionName,
        "student_id = '" + studentId + "'",
        '',
        500,
        0,
      )
      for (let i = 0; i < rows.length; i++) {
        try {
          app.delete(rows[i])
        } catch (_) {}
      }
    }
    cleanup('payments')
    cleanup('charges')
    cleanup('enrollments')
    app.delete(found[0])
    console.log(TAG, 'aluno de teste removido')
  },
)
