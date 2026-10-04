migrate(
  (app) => {
    // 1. plans
    const plans = new Collection({
      name: 'plans',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'monthly_price', type: 'number', required: true },
        { name: 'description', type: 'text' },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(plans)

    // 2. instructors
    const instructors = new Collection({
      name: 'instructors',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'text' },
        { name: 'phone', type: 'text' },
        {
          name: 'specialty',
          type: 'select',
          values: ['natacao', 'hidroginastica', 'ambos'],
          maxSelect: 1,
        },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(instructors)

    // 3. students (relations to plans)
    const plansCol = app.findCollectionByNameOrId('plans')
    const students = new Collection({
      name: 'students',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'cpf', type: 'text' },
        { name: 'birth_date', type: 'date' },
        { name: 'address', type: 'text' },
        {
          name: 'plan_id',
          type: 'relation',
          required: true,
          collectionId: plansCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_students_cpf ON students (cpf) WHERE cpf != ''"],
    })
    app.save(students)

    // 4. classes (relation to instructors)
    const instructorsCol = app.findCollectionByNameOrId('instructors')
    const classes = new Collection({
      name: 'classes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['natacao', 'hidroginastica'],
          maxSelect: 1,
        },
        {
          name: 'instructor_id',
          type: 'relation',
          collectionId: instructorsCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'schedule_days',
          type: 'select',
          values: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
          maxSelect: 7,
        },
        { name: 'schedule_time', type: 'text', required: true },
        { name: 'duration_minutes', type: 'number' },
        { name: 'capacity', type: 'number', required: true },
        { name: 'monthly_price', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(classes)

    // 5. enrollments (relations to students and classes)
    const studentsCol = app.findCollectionByNameOrId('students')
    const classesCol = app.findCollectionByNameOrId('classes')
    const enrollments = new Collection({
      name: 'enrollments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'student_id',
          type: 'relation',
          required: true,
          collectionId: studentsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'class_id',
          type: 'relation',
          required: true,
          collectionId: classesCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'enrollment_date', type: 'date' },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_enrollments_student_id ON enrollments (student_id)',
        'CREATE INDEX idx_enrollments_class_id ON enrollments (class_id)',
      ],
    })
    app.save(enrollments)

    // 6. charges (relation to students)
    const charges = new Collection({
      name: 'charges',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'student_id',
          type: 'relation',
          required: true,
          collectionId: studentsCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'description', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true },
        { name: 'due_date', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['em_aberto', 'paga', 'vencida', 'cancelada'],
          maxSelect: 1,
        },
        {
          name: 'payment_method',
          type: 'select',
          values: ['pix', 'cartao', 'boleto', 'dinheiro', 'transferencia'],
          maxSelect: 1,
        },
        { name: 'infinipay_payment_id', type: 'text' },
        { name: 'payment_link', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_charges_student_id ON charges (student_id)',
        'CREATE INDEX idx_charges_status ON charges (status)',
      ],
    })
    app.save(charges)

    // 7. payments (relations to students, charges, plans)
    const chargesCol = app.findCollectionByNameOrId('charges')
    const payments = new Collection({
      name: 'payments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'student_id',
          type: 'relation',
          required: true,
          collectionId: studentsCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'charge_id',
          type: 'relation',
          collectionId: chargesCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'plan_id',
          type: 'relation',
          collectionId: plansCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'amount', type: 'number', required: true },
        { name: 'due_date', type: 'date', required: true },
        { name: 'paid_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'pago', 'vencido', 'cancelado', 'reembolsado'],
          maxSelect: 1,
        },
        {
          name: 'payment_method',
          type: 'select',
          values: ['pix', 'cartao', 'boleto', 'dinheiro', 'transferencia'],
          maxSelect: 1,
        },
        { name: 'payment_link', type: 'text' },
        { name: 'infinipay_transaction_id', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_payments_student_id ON payments (student_id)',
        'CREATE INDEX idx_payments_charge_id ON payments (charge_id)',
        'CREATE INDEX idx_payments_status ON payments (status)',
      ],
    })
    app.save(payments)

    // 8. transactions
    const transactions = new Collection({
      name: 'transactions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['receita', 'despesa'],
          maxSelect: 1,
        },
        { name: 'description', type: 'text', required: true },
        {
          name: 'category',
          type: 'select',
          required: true,
          values: ['mensalidade', 'matricula', 'equipamento', 'salario', 'manutencao', 'outros'],
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true },
        { name: 'date', type: 'date', required: true },
        {
          name: 'payment_method',
          type: 'select',
          values: ['pix', 'cartao', 'boleto', 'dinheiro', 'transferencia'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['confirmado', 'pendente'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_transactions_date ON transactions (date)',
        'CREATE INDEX idx_transactions_type ON transactions (type)',
      ],
    })
    app.save(transactions)

    // 9. settings
    const settings = new Collection({
      name: 'settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'value', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_settings_key ON settings (key)'],
    })
    app.save(settings)
  },
  (app) => {
    const toDelete = [
      'settings',
      'transactions',
      'payments',
      'charges',
      'enrollments',
      'classes',
      'students',
      'instructors',
      'plans',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
