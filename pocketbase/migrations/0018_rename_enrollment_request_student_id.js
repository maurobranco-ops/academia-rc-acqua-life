// Migration 0018: alinhar enrollment_requests.student_id
// A coluna real no banco chama-se `reviewed_student_id` (text), mas os tipos
// (EnrollmentRequestRecord.student_id) e o service usam `student_id`.
// Renomeia a coluna para `student_id` de forma idempotente.
migrate(
  (app) => {
    let requests
    try {
      requests = app.findCollectionByNameOrId('enrollment_requests')
    } catch (_) {
      return // coleção não existe — nada a fazer
    }

    const field = requests.fields.getByName('reviewed_student_id')
    if (field) {
      field.setName('student_id')
      app.save(requests)
    }
  },
  (app) => {
    try {
      const requests = app.findCollectionByNameOrId('enrollment_requests')
      // Reverso: se a coleção não tem `reviewed_student_id` mas tem `student_id`,
      // assume que este é o campo renomeado e volta o nome original.
      if (
        !requests.fields.getByName('reviewed_student_id') &&
        requests.fields.getByName('student_id')
      ) {
        const field = requests.fields.getByName('student_id')
        field.setName('reviewed_student_id')
        app.save(requests)
      }
    } catch (_) {}
  },
)
