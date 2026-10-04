migrate(
  (app) => {
    // 1. Seed user maurobranco@incidesolar.com.br
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'maurobranco@incidesolar.com.br')
    } catch (_) {
      const adminUser = new Record(users)
      adminUser.setEmail('maurobranco@incidesolar.com.br')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Mauro Branco')
      app.save(adminUser)
    }

    // 2. Seed Plans
    const plansCol = app.findCollectionByNameOrId('plans')
    const planData = [
      {
        name: 'Natação Infantil',
        monthly_price: 150,
        description: 'Aulas de natação para crianças de 3 a 12 anos',
        is_active: true,
      },
      {
        name: 'Natação Adulto',
        monthly_price: 180,
        description: 'Condicionamento físico e técnicas de natação para adultos',
        is_active: true,
      },
      {
        name: 'Hidroginástica',
        monthly_price: 160,
        description: 'Aulas dinâmicas e de baixo impacto na piscina aquecida',
        is_active: true,
      },
    ]

    const planRecords = []
    for (const item of planData) {
      let rec
      try {
        rec = app.findFirstRecordByData('plans', 'name', item.name)
      } catch (_) {
        rec = new Record(plansCol)
        rec.set('name', item.name)
        rec.set('monthly_price', item.monthly_price)
        rec.set('description', item.description)
        rec.set('is_active', item.is_active)
        app.save(rec)
      }
      planRecords.push(rec)
    }

    // 3. Seed Instructors
    const instructorsCol = app.findCollectionByNameOrId('instructors')
    const instructorData = [
      {
        name: 'Carlos Mendes',
        email: 'carlos.mendes@academiaaquatica.com.br',
        phone: '(11) 98765-4321',
        specialty: 'natacao',
        is_active: true,
      },
      {
        name: 'Fernanda Souza',
        email: 'fernanda.souza@academiaaquatica.com.br',
        phone: '(11) 98765-8765',
        specialty: 'hidroginastica',
        is_active: true,
      },
    ]

    const instructorRecords = []
    for (const item of instructorData) {
      let rec
      try {
        rec = app.findFirstRecordByData('instructors', 'email', item.email)
      } catch (_) {
        rec = new Record(instructorsCol)
        rec.set('name', item.name)
        rec.set('email', item.email)
        rec.set('phone', item.phone)
        rec.set('specialty', item.specialty)
        rec.set('is_active', item.is_active)
        app.save(rec)
      }
      instructorRecords.push(rec)
    }

    // 4. Seed Classes
    const classesCol = app.findCollectionByNameOrId('classes')
    const classData = [
      {
        name: 'Natação Infantil — Iniciante',
        type: 'natacao',
        instructor_id: instructorRecords[0].id,
        schedule_days: ['seg', 'qua', 'sex'],
        schedule_time: '09:00',
        duration_minutes: 50,
        capacity: 8,
        monthly_price: 150,
      },
      {
        name: 'Natação Adulto — Avançado',
        type: 'natacao',
        instructor_id: instructorRecords[0].id,
        schedule_days: ['ter', 'qui'],
        schedule_time: '19:00',
        duration_minutes: 60,
        capacity: 12,
        monthly_price: 180,
      },
      {
        name: 'Hidroginástica — Manhã Especial',
        type: 'hidroginastica',
        instructor_id: instructorRecords[1].id,
        schedule_days: ['seg', 'qua', 'sex'],
        schedule_time: '08:00',
        duration_minutes: 50,
        capacity: 15,
        monthly_price: 160,
      },
    ]

    const classRecords = []
    for (const item of classData) {
      let rec
      try {
        rec = app.findFirstRecordByData('classes', 'name', item.name)
      } catch (_) {
        rec = new Record(classesCol)
        rec.set('name', item.name)
        rec.set('type', item.type)
        rec.set('instructor_id', item.instructor_id)
        rec.set('schedule_days', item.schedule_days)
        rec.set('schedule_time', item.schedule_time)
        rec.set('duration_minutes', item.duration_minutes)
        rec.set('capacity', item.capacity)
        rec.set('monthly_price', item.monthly_price)
        app.save(rec)
      }
      classRecords.push(rec)
    }

    // 5. Seed Students
    const studentsCol = app.findCollectionByNameOrId('students')
    const studentData = [
      {
        name: 'Mariana Silva',
        email: 'mariana.silva@gmail.com',
        phone: '(11) 99123-4567',
        cpf: '123.456.789-01',
        birth_date: '1994-05-12 00:00:00.000Z',
        address: 'Rua das Flores, 142 - Apto 31',
        plan_id: planRecords[1].id, // Natação Adulto
        status: 'ativo',
      },
      {
        name: 'Lucas Gabriel',
        email: 'lucas.gabriel@outlook.com',
        phone: '(11) 98234-5678',
        cpf: '234.567.890-12',
        birth_date: '2015-08-20 00:00:00.000Z',
        address: 'Av. Paulista, 1000',
        plan_id: planRecords[0].id, // Natação Infantil
        status: 'ativo',
      },
      {
        name: 'Beatriz Oliveira',
        email: 'beatriz.oliveira@uol.com.br',
        phone: '(11) 97345-6789',
        cpf: '345.678.901-23',
        birth_date: '1968-11-04 00:00:00.000Z',
        address: 'Rua Vergueiro, 850',
        plan_id: planRecords[2].id, // Hidroginástica
        status: 'ativo',
      },
      {
        name: 'Rodrigo Almeida',
        email: 'rodrigo.almeida@hotmail.com',
        phone: '(11) 96456-7890',
        cpf: '456.789.012-34',
        birth_date: '1989-02-17 00:00:00.000Z',
        address: 'Rua Augusta, 520',
        plan_id: planRecords[1].id, // Natação Adulto
        status: 'ativo',
      },
    ]

    const studentRecords = []
    for (const item of studentData) {
      let rec
      try {
        rec = app.findFirstRecordByData('students', 'cpf', item.cpf)
      } catch (_) {
        rec = new Record(studentsCol)
        rec.set('name', item.name)
        rec.set('email', item.email)
        rec.set('phone', item.phone)
        rec.set('cpf', item.cpf)
        rec.set('birth_date', item.birth_date)
        rec.set('address', item.address)
        rec.set('plan_id', item.plan_id)
        rec.set('status', item.status)
        app.save(rec)
      }
      studentRecords.push(rec)
    }

    // 6. Seed Enrollments
    const enrollmentsCol = app.findCollectionByNameOrId('enrollments')
    const enrollmentData = [
      { student_id: studentRecords[0].id, class_id: classRecords[1].id }, // Mariana -> Natação Adulto
      { student_id: studentRecords[1].id, class_id: classRecords[0].id }, // Lucas -> Natação Infantil
      { student_id: studentRecords[2].id, class_id: classRecords[2].id }, // Beatriz -> Hidroginástica
      { student_id: studentRecords[3].id, class_id: classRecords[1].id }, // Rodrigo -> Natação Adulto
    ]

    for (const item of enrollmentData) {
      try {
        const records = app.findRecordsByFilter(
          'enrollments',
          `student_id = '${item.student_id}' && class_id = '${item.class_id}'`,
          '-created',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      const rec = new Record(enrollmentsCol)
      rec.set('student_id', item.student_id)
      rec.set('class_id', item.class_id)
      rec.set('enrollment_date', '2025-01-10 00:00:00.000Z')
      rec.set('is_active', true)
      app.save(rec)
    }

    // 7. Seed Charges and Payments (5 payments across statuses: 2 paid, 1 pending, 2 overdue)
    const chargesCol = app.findCollectionByNameOrId('charges')
    const paymentsCol = app.findCollectionByNameOrId('payments')

    const sampleCharges = [
      {
        student_id: studentRecords[0].id,
        description: 'Mensalidade — Janeiro/2025',
        amount: 180,
        due_date: '2025-01-10 00:00:00.000Z',
        status: 'paga',
        payment_method: 'pix',
        paid_date: '2025-01-08 14:30:00.000Z',
        infinipay_id: 'inf_pay_1001',
        payment_status: 'pago',
        plan_id: planRecords[1].id,
      },
      {
        student_id: studentRecords[1].id,
        description: 'Mensalidade — Janeiro/2025',
        amount: 150,
        due_date: '2025-01-10 00:00:00.000Z',
        status: 'paga',
        payment_method: 'cartao',
        paid_date: '2025-01-09 10:15:00.000Z',
        infinipay_id: 'inf_pay_1002',
        payment_status: 'pago',
        plan_id: planRecords[0].id,
      },
      {
        student_id: studentRecords[2].id,
        description: 'Mensalidade — Fevereiro/2025',
        amount: 160,
        due_date: '2025-02-15 00:00:00.000Z',
        status: 'em_aberto',
        payment_method: 'pix',
        paid_date: null,
        infinipay_id: 'inf_pay_1003',
        payment_status: 'pendente',
        plan_id: planRecords[2].id,
      },
      {
        student_id: studentRecords[3].id,
        description: 'Mensalidade — Janeiro/2025',
        amount: 180,
        due_date: '2025-01-05 00:00:00.000Z',
        status: 'vencida',
        payment_method: 'boleto',
        paid_date: null,
        infinipay_id: 'inf_pay_1004',
        payment_status: 'vencido',
        plan_id: planRecords[1].id,
      },
      {
        student_id: studentRecords[0].id,
        description: 'Taxa de Matrícula e Exame Médico',
        amount: 120,
        due_date: '2025-01-02 00:00:00.000Z',
        status: 'vencida',
        payment_method: 'pix',
        paid_date: null,
        infinipay_id: 'inf_pay_1005',
        payment_status: 'vencido',
        plan_id: planRecords[1].id,
      },
    ]

    for (const item of sampleCharges) {
      let chargeRec
      try {
        chargeRec = app.findFirstRecordByData('charges', 'infinipay_payment_id', item.infinipay_id)
      } catch (_) {
        chargeRec = new Record(chargesCol)
        chargeRec.set('student_id', item.student_id)
        chargeRec.set('description', item.description)
        chargeRec.set('amount', item.amount)
        chargeRec.set('due_date', item.due_date)
        chargeRec.set('status', item.status)
        chargeRec.set('payment_method', item.payment_method)
        chargeRec.set('infinipay_payment_id', item.infinipay_id)
        chargeRec.set('payment_link', `https://pay.infinitepay.io/link/${item.infinipay_id}`)
        app.save(chargeRec)

        // Create matching payment record
        const payRec = new Record(paymentsCol)
        payRec.set('student_id', item.student_id)
        payRec.set('charge_id', chargeRec.id)
        payRec.set('plan_id', item.plan_id)
        payRec.set('amount', item.amount)
        payRec.set('due_date', item.due_date)
        if (item.paid_date) {
          payRec.set('paid_date', item.paid_date)
        }
        payRec.set('status', item.payment_status)
        payRec.set('payment_method', item.payment_method)
        payRec.set('payment_link', `https://pay.infinitepay.io/link/${item.infinipay_id}`)
        payRec.set('infinipay_transaction_id', item.infinipay_id)
        app.save(payRec)
      }
    }

    // 8. Seed Transactions (Revenues and Expenses)
    const transactionsCol = app.findCollectionByNameOrId('transactions')
    const sampleTransactions = [
      {
        type: 'receita',
        description: 'Mensalidade Mariana Silva - Janeiro',
        category: 'mensalidade',
        amount: 180,
        date: '2025-01-08 14:30:00.000Z',
        payment_method: 'pix',
        status: 'confirmado',
        notes: 'Recebido via InfinitePay PIX',
      },
      {
        type: 'receita',
        description: 'Mensalidade Lucas Gabriel - Janeiro',
        category: 'mensalidade',
        amount: 150,
        date: '2025-01-09 10:15:00.000Z',
        payment_method: 'cartao',
        status: 'confirmado',
        notes: 'Recebido via InfinitePay Cartão de Crédito',
      },
      {
        type: 'despesa',
        description: 'Tratamento de cloro e controle de pH da piscina',
        category: 'manutencao',
        amount: 320,
        date: '2025-01-12 11:00:00.000Z',
        payment_method: 'transferencia',
        status: 'confirmado',
        notes: 'Produtos químicos Aquapool',
      },
      {
        type: 'despesa',
        description: 'Pranchas e flutuadores espaguete para natação',
        category: 'equipamento',
        amount: 240,
        date: '2025-01-15 16:00:00.000Z',
        payment_method: 'pix',
        status: 'confirmado',
        notes: 'Kit esportivo Speedo',
      },
      {
        type: 'despesa',
        description: 'Manutenção preventiva dos aquecedores de piscina',
        category: 'manutencao',
        amount: 450,
        date: '2025-01-20 09:30:00.000Z',
        payment_method: 'boleto',
        status: 'confirmado',
        notes: 'Técnico especialista',
      },
    ]

    for (const item of sampleTransactions) {
      try {
        const records = app.findRecordsByFilter(
          'transactions',
          `description = '${item.description}' && amount = ${item.amount}`,
          '-created',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      const rec = new Record(transactionsCol)
      rec.set('type', item.type)
      rec.set('description', item.description)
      rec.set('category', item.category)
      rec.set('amount', item.amount)
      rec.set('date', item.date)
      rec.set('payment_method', item.payment_method)
      rec.set('status', item.status)
      rec.set('notes', item.notes)
      app.save(rec)
    }

    // 9. Seed Settings
    const settingsCol = app.findCollectionByNameOrId('settings')
    const defaultSettings = [
      { key: 'academy_name', value: 'Academia Aquática Azul Celeste' },
      { key: 'academy_cnpj', value: '12.345.678/0001-90' },
      { key: 'academy_phone', value: '(11) 3214-5678' },
      { key: 'academy_email', value: 'contato@academiaaquatica.com.br' },
      { key: 'academy_address', value: 'Av. das Águas, 350 - Jardim Paulista, São Paulo - SP' },
      { key: 'infinitepay_api_key', value: 'inf_live_sec_demo_98721634' },
      { key: 'infinitepay_auto_send_link', value: 'true' },
      { key: 'notify_email_payment', value: 'true' },
      { key: 'notify_whatsapp_overdue', value: 'true' },
    ]

    for (const item of defaultSettings) {
      let rec
      try {
        rec = app.findFirstRecordByData('settings', 'key', item.key)
      } catch (_) {
        rec = new Record(settingsCol)
        rec.set('key', item.key)
        rec.set('value', item.value)
        app.save(rec)
      }
    }
  },
  (app) => {
    // rollback
  },
)
