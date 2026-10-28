migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')

    if (!students.fields.getByName('validade_do_ultimo_pagamento')) {
      students.fields.add(new DateField({ name: 'validade_do_ultimo_pagamento' }))
    }

    app.save(students)
  },
  (app) => {
    try {
      const students = app.findCollectionByNameOrId('students')
      const field = students.fields.getByName('validade_do_ultimo_pagamento')
      if (field) {
        students.fields.removeByName('validade_do_ultimo_pagamento')
      }
      app.save(students)
    } catch (_) {}
  },
)
