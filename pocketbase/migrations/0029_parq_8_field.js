/// <reference path="../pb_data/types.d.ts" />
// Migration 0029 — PAR-Q atualizado da RC Acqua Life:
//  - students + enrollment_requests: campo parq_8 (sim/nao — "Teria algum outro
//    problema de saúde de ordem física ou psicológica que impeça a sua
//    participação na atividade proposta?") e parq_8_detail (texto aberto
//    preenchido quando a resposta é "SIM").
//  Idempotente: cada campo só é adicionado se ainda não existir.
migrate(
  (app) => {
    const detailNames = ['parq_8', 'parq_8_detail']

    // students: resposta da pergunta 8 + detalhe escrito
    const students = app.findCollectionByNameOrId('students')
    let studentsChanged = false
    if (!students.fields.getByName('parq_8')) {
      students.fields.add(new TextField({ name: 'parq_8', max: 10 }))
      studentsChanged = true
    }
    if (!students.fields.getByName('parq_8_detail')) {
      students.fields.add(new TextField({ name: 'parq_8_detail', max: 500 }))
      studentsChanged = true
    }
    if (studentsChanged) app.save(students)

    // enrollment_requests: mesmos campos (o formulário público grava ali)
    const req = app.findCollectionByNameOrId('enrollment_requests')
    let reqChanged = false
    detailNames.forEach((name) => {
      if (!req.fields.getByName(name)) {
        req.fields.add(new TextField({ name, max: name === 'parq_8' ? 10 : 500 }))
        reqChanged = true
      }
    })
    if (reqChanged) app.save(req)
  },
  (app) => {
    // Down: remove os campos criados (silencioso quando não existem).
    try {
      const students = app.findCollectionByNameOrId('students')
      let changed = false
      ;['parq_8', 'parq_8_detail'].forEach((name) => {
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
      ;['parq_8', 'parq_8_detail'].forEach((name) => {
        if (req.fields.getByName(name)) {
          req.fields.removeByName(name)
          changed = true
        }
      })
      if (changed) app.save(req)
    } catch (_) {}
  },
)
