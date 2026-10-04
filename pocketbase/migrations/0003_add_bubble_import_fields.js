migrate(
  (app) => {
    // 1. Update classes: add 'funcional' to type select field
    const classes = app.findCollectionByNameOrId('classes')
    const typeField = classes.fields.getByName('type')
    if (typeField) {
      typeField.values = ['natacao', 'hidroginastica', 'funcional']
      typeField.maxSelect = 1
    }
    app.save(classes)

    // 2. Update students: make plan_id optional if needed, add bubble migration fields
    const students = app.findCollectionByNameOrId('students')
    const planIdField = students.fields.getByName('plan_id')
    if (planIdField) {
      planIdField.required = false
    }

    // Add new fields to students if they don't exist yet
    if (!students.fields.getByName('bubble_id')) {
      students.fields.add(new TextField({ name: 'bubble_id' }))
    }
    if (!students.fields.getByName('photo')) {
      students.fields.add(new TextField({ name: 'photo' }))
    }
    if (!students.fields.getByName('guardian_name')) {
      students.fields.add(new TextField({ name: 'guardian_name' }))
    }
    if (!students.fields.getByName('guardian_cpf')) {
      students.fields.add(new TextField({ name: 'guardian_cpf' }))
    }
    if (!students.fields.getByName('guardian_email')) {
      students.fields.add(new TextField({ name: 'guardian_email' }))
    }
    if (!students.fields.getByName('guardian_phone')) {
      students.fields.add(new TextField({ name: 'guardian_phone' }))
    }
    if (!students.fields.getByName('whatsapp')) {
      students.fields.add(new TextField({ name: 'whatsapp' }))
    }
    if (!students.fields.getByName('monthly_fee')) {
      students.fields.add(new NumberField({ name: 'monthly_fee' }))
    }
    if (!students.fields.getByName('discounted_fee')) {
      students.fields.add(new NumberField({ name: 'discounted_fee' }))
    }
    if (!students.fields.getByName('due_day')) {
      students.fields.add(new NumberField({ name: 'due_day', onlyInt: true }))
    }
    if (!students.fields.getByName('situation')) {
      students.fields.add(new TextField({ name: 'situation' }))
    }
    if (!students.fields.getByName('atestado_validade')) {
      students.fields.add(new DateField({ name: 'atestado_validade' }))
    }
    if (!students.fields.getByName('trancamento_validade')) {
      students.fields.add(new DateField({ name: 'trancamento_validade' }))
    }
    if (!students.fields.getByName('fee_suspended')) {
      students.fields.add(new BoolField({ name: 'fee_suspended' }))
    }
    if (!students.fields.getByName('raw_situation')) {
      students.fields.add(new TextField({ name: 'raw_situation' }))
    }

    // Add unique index on bubble_id
    students.addIndex('idx_students_bubble_id', true, 'bubble_id', "bubble_id != ''")

    app.save(students)
  },
  (app) => {
    try {
      const students = app.findCollectionByNameOrId('students')
      students.removeIndex('idx_students_bubble_id')
      const fieldsToRemove = [
        'bubble_id',
        'photo',
        'guardian_name',
        'guardian_cpf',
        'guardian_email',
        'guardian_phone',
        'whatsapp',
        'monthly_fee',
        'discounted_fee',
        'due_day',
        'situation',
        'atestado_validade',
        'trancamento_validade',
        'fee_suspended',
        'raw_situation',
      ]
      for (const f of fieldsToRemove) {
        const field = students.fields.getByName(f)
        if (field) {
          students.fields.removeByName(f)
        }
      }
      app.save(students)

      const classes = app.findCollectionByNameOrId('classes')
      const typeField = classes.fields.getByName('type')
      if (typeField) {
        typeField.values = ['natacao', 'hidroginastica']
      }
      app.save(classes)
    } catch (_) {}
  },
)
