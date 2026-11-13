migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')

    const fieldsToAdd = [
      { name: 'cep', type: 'text', max: 12 },
      { name: 'street', type: 'text', max: 255 },
      { name: 'street_number', type: 'text', max: 20 },
      { name: 'complement', type: 'text', max: 120 },
      { name: 'neighborhood', type: 'text', max: 120 },
      { name: 'city', type: 'text', max: 120 },
      { name: 'uf', type: 'text', max: 2 },
    ]

    fieldsToAdd.forEach((f) => {
      if (!students.fields.getByName(f.name)) {
        students.fields.add(new TextField({ name: f.name, max: f.max }))
      }
    })

    app.save(students)
  },
  (app) => {
    try {
      const students = app.findCollectionByNameOrId('students')
      ;['cep', 'street', 'street_number', 'complement', 'neighborhood', 'city', 'uf'].forEach(
        (name) => {
          if (students.fields.getByName(name)) {
            students.fields.removeByName(name)
          }
        },
      )
      app.save(students)
    } catch (_) {}
  },
)
