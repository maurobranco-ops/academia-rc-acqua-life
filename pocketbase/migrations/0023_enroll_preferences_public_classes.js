// Migration 0023 — Melhorias do formulário público de matrícula (/matricula):
// 1) enrollment_requests: atividades pretendidas (select multi: natacao/hidroginastica),
//    turmas pretendidas (relation multi → classes) e dia de vencimento da mensalidade
//    (number: 5, 10, 15, 20 ou 25).
// 2) students: campo observacoes_matricula (texto livre de referência do administrador).
// 3) Regra de leitura PÚBLICA (apenas list/view) na collection classes — o formulário
//    de matrícula é sem login e precisa listar as turmas reais (nome + horário).
//    Escrita em classes continua autenticada.
// Idempotente por construção: guarda com getByName antes de add.

migrate(
  (app) => {
    // ---------- enrollment_requests ----------
    const req = app.findCollectionByNameOrId('enrollment_requests')

    if (!req.fields.getByName('activities')) {
      req.fields.add(
        new SelectField({
          name: 'activities',
          maxSelect: 2,
          values: ['natacao', 'hidroginastica'],
        }),
      )
    }

    if (!req.fields.getByName('preferred_classes')) {
      req.fields.add(
        new RelationField({
          name: 'preferred_classes',
          collectionId: app.findCollectionByNameOrId('classes').id,
          maxSelect: 10,
        }),
      )
    }

    if (!req.fields.getByName('due_day')) {
      req.fields.add(new NumberField({ name: 'due_day', onlyInt: true, min: 1, max: 31 }))
    }

    app.save(req)

    // ---------- students ----------
    const students = app.findCollectionByNameOrId('students')

    if (!students.fields.getByName('observacoes_matricula')) {
      students.fields.add(new TextField({ name: 'observacoes_matricula', max: 2000 }))
    }

    app.save(students)

    // ---------- classes: leitura pública (list + view), escrita continua auth ----------
    const classes = app.findCollectionByNameOrId('classes')
    classes.listRule = ''
    classes.viewRule = ''
    app.save(classes)
  },
  (app) => {
    // down — restringe de novo a leitura de classes e remove os campos novos.
    try {
      const classes = app.findCollectionByNameOrId('classes')
      classes.listRule = "@request.auth.id != ''"
      classes.viewRule = "@request.auth.id != ''"
      app.save(classes)
    } catch (_) {}

    try {
      const req = app.findCollectionByNameOrId('enrollment_requests')
      const f1 = req.fields.getByName('activities')
      if (f1) req.fields.removeByName('activities')
      const f2 = req.fields.getByName('preferred_classes')
      if (f2) req.fields.removeByName('preferred_classes')
      const f3 = req.fields.getByName('due_day')
      if (f3) req.fields.removeByName('due_day')
      app.save(req)
    } catch (_) {}

    try {
      const students = app.findCollectionByNameOrId('students')
      const f = students.fields.getByName('observacoes_matricula')
      if (f) students.fields.removeByName('observacoes_matricula')
      app.save(students)
    } catch (_) {}
  },
)
