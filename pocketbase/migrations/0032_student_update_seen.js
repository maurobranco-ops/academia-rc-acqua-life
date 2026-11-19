/// <reference path="../pb_data/types.d.ts" />
// Migration 0032 — Sinalização de atualizações do aluno na listagem/navegação:
//  - students.atualizacao_vista_pelo_admin (bool): marca que o admin JÁ VIU a
//    última atualização enviada pelo próprio aluno (link seguro /atualizar).
//    Enquanto for false (com atualizado_pelo_aluno_em preenchido), o botão
//    "Atualizações" em /alunos e o item "Alunos" da navegação exibem badge.
// Idempotente: o campo só é criado se ainda não existir.

migrate(
  (app) => {
    const students = tryFindCollection(app, 'students')
    if (students && !students.fields.getByName('atualizacao_vista_pelo_admin')) {
      students.fields.add(new BoolField({ name: 'atualizacao_vista_pelo_admin' }))
      app.save(students)
    }
  },
  (app) => {
    // Down: remove o campo criado (silencioso quando não existe).
    try {
      const students = app.findCollectionByNameOrId('students')
      if (students.fields.getByName('atualizacao_vista_pelo_admin')) {
        students.fields.removeByName('atualizacao_vista_pelo_admin')
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
