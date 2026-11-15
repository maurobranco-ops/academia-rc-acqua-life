/// <reference path="../pb_data/types.d.ts" />
// Migration 0020 — Melhorias da ficha de matrícula pública:
//  - enrollment_requests: campos de endereço (mesmos nomes dos alunos, migration 0016:
//    cep, street, street_number, complement, neighborhood, city, uf) e atestado
//    cardiológico (cardio_date, cardio_crm, cardio_status), exigido para natação e/ou
//    hidroginástica (Lei Estadual PB 9.863/2012).
//  - students: campos do atestado cardiológico no prontuário de saúde (mesma estrutura
//    de aptidao_*/dermato_*).
//  Idempotente: cada campo só é adicionado se ainda não existir.
migrate(
  (app) => {
    const addressFields = [
      { name: 'cep', max: 12 },
      { name: 'street', max: 255 },
      { name: 'street_number', max: 20 },
      { name: 'complement', max: 120 },
      { name: 'neighborhood', max: 120 },
      { name: 'city', max: 120 },
      { name: 'uf', max: 2 },
    ]

    // ===== 1. enrollment_requests: endereço + atestado cardiológico =====
    const req = app.findCollectionByNameOrId('enrollment_requests')
    const reqHas = (name) => !!req.fields.getByName(name)

    addressFields.forEach((f) => {
      if (!reqHas(f.name)) req.fields.add(new TextField({ name: f.name, max: f.max }))
    })
    if (!reqHas('guardian_email'))
      req.fields.add(new TextField({ name: 'guardian_email', max: 160 }))

    if (!reqHas('cardio_date')) req.fields.add(new DateField({ name: 'cardio_date' }))
    if (!reqHas('cardio_crm')) req.fields.add(new TextField({ name: 'cardio_crm', max: 40 }))
    if (!reqHas('cardio_status')) {
      req.fields.add(
        new SelectField({ name: 'cardio_status', values: ['entregue', 'pendente'], maxSelect: 1 }),
      )
    }

    app.save(req)

    // ===== 2. students: atestado cardiológico no prontuário de saúde =====
    const students = app.findCollectionByNameOrId('students')
    const stHas = (name) => !!students.fields.getByName(name)

    if (!stHas('cardio_date')) students.fields.add(new DateField({ name: 'cardio_date' }))
    if (!stHas('cardio_crm')) students.fields.add(new TextField({ name: 'cardio_crm', max: 40 }))
    if (!stHas('cardio_status')) {
      students.fields.add(
        new SelectField({ name: 'cardio_status', values: ['entregue', 'pendente'], maxSelect: 1 }),
      )
    }

    app.save(students)
  },
  (app) => {
    // Down: remove o que a up adicionou (silencioso quando não existe).
    try {
      const req = app.findCollectionByNameOrId('enrollment_requests')
      const reqNames = [
        'cep',
        'street',
        'street_number',
        'complement',
        'neighborhood',
        'city',
        'uf',
        'guardian_email',
        'cardio_date',
        'cardio_crm',
        'cardio_status',
      ]
      let dirty = false
      reqNames.forEach((name) => {
        if (req.fields.getByName(name)) {
          req.fields.removeByName(name)
          dirty = true
        }
      })
      if (dirty) app.save(req)
    } catch (_) {}

    try {
      const students = app.findCollectionByNameOrId('students')
      const stNames = ['cardio_date', 'cardio_crm', 'cardio_status']
      let dirty = false
      stNames.forEach((name) => {
        if (students.fields.getByName(name)) {
          students.fields.removeByName(name)
          dirty = true
        }
      })
      if (dirty) app.save(students)
    } catch (_) {}
  },
)
