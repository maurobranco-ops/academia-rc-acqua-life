/// <reference path="../pb_data/types.d.ts" />
// Migration 0030 — Controle de reimpressão de ficha de matrícula:
//  - students: ficha_assinada_em (date, opcional — data da última assinatura
//    da ficha impressa) e ficha_pendente (bool, default false — marcado quando
//    o cadastro é editado e a ficha precisa ser reimpressa para assinatura).
//  Idempotente: cada campo só é adicionado se ainda não existir.
migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    let changed = false
    if (!students.fields.getByName('ficha_assinada_em')) {
      students.fields.add(new DateField({ name: 'ficha_assinada_em' }))
      changed = true
    }
    if (!students.fields.getByName('ficha_pendente')) {
      students.fields.add(new BoolField({ name: 'ficha_pendente' }))
      changed = true
    }
    if (changed) app.save(students)
  },
  (app) => {
    try {
      const students = app.findCollectionByNameOrId('students')
      let changed = false
      ;['ficha_assinada_em', 'ficha_pendente'].forEach((name) => {
        if (students.fields.getByName(name)) {
          students.fields.removeByName(name)
          changed = true
        }
      })
      if (changed) app.save(students)
    } catch (_) {}
  },
)
