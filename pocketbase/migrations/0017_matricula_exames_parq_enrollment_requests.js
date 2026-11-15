migrate(
  (app) => {
    // ===== 1. Novos campos de matrícula em students =====
    const students = app.findCollectionByNameOrId('students')

    const ensureText = (name, max) => {
      if (!students.fields.getByName(name)) {
        students.fields.add(new TextField({ name, max }))
      }
    }
    const ensureDate = (name) => {
      if (!students.fields.getByName(name)) {
        students.fields.add(new DateField({ name }))
      }
    }
    const ensureSelect = (name, values) => {
      if (!students.fields.getByName(name)) {
        students.fields.add(new SelectField({ name, values, maxSelect: 1 }))
      }
    }
    const ensureJson = (name) => {
      if (!students.fields.getByName(name)) {
        students.fields.add(new JSONField({ name, maxSize: 2000000 }))
      }
    }
    const ensureBool = (name) => {
      if (!students.fields.getByName(name)) {
        students.fields.add(new BoolField({ name }))
      }
    }

    // FRENTE 1 — Exames obrigatórios (Lei Estadual 9.863/2012-PB, validade 6 meses)
    ensureDate('apt_exam_date')
    ensureText('apt_exam_crm', 40)
    ensureSelect('apt_exam_status', ['entregue', 'pendente'])
    ensureDate('derm_exam_date')
    ensureSelect('derm_exam_status', ['entregue', 'pendente'])

    // FRENTE 2 — PAR-Q (7 perguntas) e anamnese aquática
    ensureJson('par_q')
    ensureJson('anamnese')

    // FRENTE 4 — Autorização de uso de imagem (LGPD)
    ensureBool('image_use_authorized')

    // FRENTE 3 — RG do responsável (comprovação para menores)
    if (!students.fields.getByName('guardian_rg_file')) {
      students.fields.add(
        new FileField({
          name: 'guardian_rg_file',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
    }

    app.save(students)

    // ===== 2. Collection enrollment_requests (inscrições públicas) =====
    if (!app.findCollectionByNameOrId('enrollment_requests')) {
      const req = new Collection({
        name: 'enrollment_requests',
        type: 'base',
        // Público: só cria (formulário on-line sem login).
        // Leitura/edição exclusiva de usuários autenticados da academia (conferência).
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: '',
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'name', type: 'text', required: true, max: 160 },
          { name: 'birth_date', type: 'date' },
          { name: 'cpf', type: 'text', max: 20 },
          { name: 'phone', type: 'text', max: 30 },
          { name: 'guardian_name', type: 'text', max: 160 },
          { name: 'guardian_cpf', type: 'text', max: 20 },
          { name: 'guardian_phone', type: 'text', max: 30 },
          { name: 'minor', type: 'bool' },
          {
            name: 'photo',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          {
            name: 'guardian_rg',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          { name: 'par_q', type: 'json', maxSize: 2000000 },
          { name: 'anamnese', type: 'json', maxSize: 2000000 },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'aprovado', 'recusado'],
            maxSelect: 1,
            required: true,
          },
          { name: 'review_notes', type: 'text', max: 1000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(req)
    }
  },
  (app) => {
    try {
      const students = app.findCollectionByNameOrId('students')
      ;[
        'apt_exam_date',
        'apt_exam_crm',
        'apt_exam_status',
        'derm_exam_date',
        'derm_exam_status',
        'par_q',
        'anamnese',
        'image_use_authorized',
        'guardian_rg_file',
      ].forEach((name) => {
        if (students.fields.getByName(name)) {
          students.fields.removeByName(name)
        }
      })
      app.save(students)
    } catch (_) {}

    try {
      const req = app.findCollectionByNameOrId('enrollment_requests')
      app.delete(req)
    } catch (_) {}
  },
)
