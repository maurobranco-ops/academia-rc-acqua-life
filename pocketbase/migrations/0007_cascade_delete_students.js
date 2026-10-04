migrate(
  (app) => {
    const charges = app.findCollectionByNameOrId('charges')
    const studentFieldCharges = charges.fields.getByName('student_id')
    if (studentFieldCharges) {
      studentFieldCharges.cascadeDelete = true
      app.save(charges)
    }

    const payments = app.findCollectionByNameOrId('payments')
    const studentFieldPayments = payments.fields.getByName('student_id')
    if (studentFieldPayments) {
      studentFieldPayments.cascadeDelete = true
      app.save(payments)
    }
  },
  (app) => {
    const charges = app.findCollectionByNameOrId('charges')
    const studentFieldCharges = charges.fields.getByName('student_id')
    if (studentFieldCharges) {
      studentFieldCharges.cascadeDelete = false
      app.save(charges)
    }

    const payments = app.findCollectionByNameOrId('payments')
    const studentFieldPayments = payments.fields.getByName('student_id')
    if (studentFieldPayments) {
      studentFieldPayments.cascadeDelete = false
      app.save(payments)
    }
  },
)
