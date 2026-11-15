/// <reference path="../pb_data/types.d.ts" />
// Migration 0022 — PAR-Q com resposta escrita (perguntas 5, 6 e 7), entrega dos
// exames em DUAS declarações separadas e aceite do termo de ciência:
//  - students + enrollment_requests: campos de texto parq_5_detail, parq_6_detail
//    e parq_7_detail (explicação escrita quando a resposta do PAR-Q é "SIM").
//  - enrollment_requests: exams_cardio_delivered e exams_dermato_delivered
//    ('sim' | 'nao') — a declaração única exams_delivered (migration 0021) é
//    MANTIDA para compatibilidade e recebe backfill a partir das novas caixas.
//  - enrollment_requests: term_agreed ('sim' | 'nao') — caixa "Li e concordo"
//    com o termo de ciência da Lei Estadual nº 9.863/2012-PB.
//  Idempotente: cada campo só é adicionado se ainda não existir; o backfill só
//  roda quando há linha sem os novos campos preenchidos.
migrate(
  (app) => {
    const detailNames = ['parq_5_detail', 'parq_6_detail', 'parq_7_detail']

    // students: campos de texto do detalhe do PAR-Q
    const students = app.findCollectionByNameOrId('students')
    let studentsChanged = false
    detailNames.forEach((name) => {
      if (!students.fields.getByName(name)) {
        students.fields.add(new TextField({ name, max: 500 }))
        studentsChanged = true
      }
    })
    if (studentsChanged) app.save(students)

    const req = app.findCollectionByNameOrId('enrollment_requests')
    let reqChanged = false

    // enrollment_requests: detalhes do PAR-Q
    detailNames.forEach((name) => {
      if (!req.fields.getByName(name)) {
        req.fields.add(new TextField({ name, max: 500 }))
        reqChanged = true
      }
    })

    // enrollment_requests: duas declarações de entrega separadas por exame
    if (!req.fields.getByName('exams_cardio_delivered')) {
      req.fields.add(
        new SelectField({ name: 'exams_cardio_delivered', values: ['sim', 'nao'], maxSelect: 1 }),
      )
      reqChanged = true
    }
    if (!req.fields.getByName('exams_dermato_delivered')) {
      req.fields.add(
        new SelectField({ name: 'exams_dermato_delivered', values: ['sim', 'nao'], maxSelect: 1 }),
      )
      reqChanged = true
    }

    // enrollment_requests: aceite do termo de ciência
    if (!req.fields.getByName('term_agreed')) {
      req.fields.add(new SelectField({ name: 'term_agreed', values: ['sim', 'nao'], maxSelect: 1 }))
      reqChanged = true
    }
    if (reqChanged) app.save(req)

    // Backfill idempotente: registros antigos (apenas exams_delivered) passam a
    // ter as duas declarações derivadas da declaração única.
    const records = app.findRecordsByFilter(
      'enrollment_requests',
      "exams_delivered != '' && exams_cardio_delivered = '' && exams_dermato_delivered = ''",
      '',
      0,
      0,
    )
    records.forEach((r) => {
      const delivered = r.getString('exams_delivered')
      r.set('exams_cardio_delivered', delivered)
      r.set('exams_dermato_delivered', delivered)
      app.save(r)
    })
  },
  (app) => {
    // Down: remove os campos criados (silencioso quando não existem).
    try {
      const students = app.findCollectionByNameOrId('students')
      let changed = false
      ;['parq_5_detail', 'parq_6_detail', 'parq_7_detail'].forEach((name) => {
        if (students.fields.getByName(name)) {
          students.fields.removeByName(name)
          changed = true
        }
      })
      if (changed) app.save(students)
    } catch (_) {}
    try {
      const req = app.findCollectionByNameOrId('enrollment_requests')
      let changed = false
      ;[
        'parq_5_detail',
        'parq_6_detail',
        'parq_7_detail',
        'exams_cardio_delivered',
        'exams_dermato_delivered',
        'term_agreed',
      ].forEach((name) => {
        if (req.fields.getByName(name)) {
          req.fields.removeByName(name)
          changed = true
        }
      })
      if (changed) app.save(req)
    } catch (_) {}
  },
)
