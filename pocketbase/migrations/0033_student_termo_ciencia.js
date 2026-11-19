/// <reference path="../pb_data/types.d.ts" />
// Migration 0033 — Termo de ciência na página pública de atualização do aluno
// (/atualizar/TOKEN):
//  - students.termo_ciencia_aceito_em (date): data do aceite do termo de ciência
//    da professora Carmem Rachel (mesmos textos da matrícula — FICHA_LEGAL),
//    gravado quando o aluno envia o formulário de atualização com a caixa
//    obrigatória marcada. Vazio = ainda não aceitou.
// Idempotente: o campo só é criado se ainda não existir.

migrate(
  (app) => {
    const students = tryFindCollection(app, 'students')
    if (students && !students.fields.getByName('termo_ciencia_aceito_em')) {
      students.fields.add(new DateField({ name: 'termo_ciencia_aceito_em' }))
      app.save(students)
    }
  },
  (app) => {
    // Down: remove o campo criado (silencioso quando não existe).
    try {
      const students = app.findCollectionByNameOrId('students')
      if (students.fields.getByName('termo_ciencia_aceito_em')) {
        students.fields.removeByName('termo_ciencia_aceito_em')
        app.save(students)
      }
    } catch (_) {}
  },
)

function tryFindCollection(app, name) {
  try {
    return app.findCollectionByNameOrId(name)
  } catch (_) {
    return null
  }
}
