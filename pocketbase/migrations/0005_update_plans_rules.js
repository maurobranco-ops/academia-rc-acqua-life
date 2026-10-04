migrate(
  (app) => {
    const plansCol = app.findCollectionByNameOrId('plans')

    // 1. Ensure optional discount_amount field exists on charges and payments if helpful
    const chargesCol = app.findCollectionByNameOrId('charges')
    if (!chargesCol.fields.getByName('discount_amount')) {
      chargesCol.fields.add(new NumberField({ name: 'discount_amount' }))
      app.save(chargesCol)
    }

    const paymentsCol = app.findCollectionByNameOrId('payments')
    if (!paymentsCol.fields.getByName('discount_amount')) {
      paymentsCol.fields.add(new NumberField({ name: 'discount_amount' }))
      app.save(paymentsCol)
    }

    // 2. Exact plans required:
    // - Integral: R$ 110,00
    // - Família: R$ 100,00
    // - Sábados: R$ 75,00
    const desiredPlans = [
      {
        name: 'Integral',
        monthly_price: 110.0,
        description: 'Plano Integral — frequência regular de aulas na semana',
        is_active: true,
      },
      {
        name: 'Família',
        monthly_price: 100.0,
        description:
          'Plano Família — R$ 100,00/aluno com R$ 10,00 de desconto por aluno até o vencimento',
        is_active: true,
      },
      {
        name: 'Sábados',
        monthly_price: 75.0,
        description: 'Plano Sábados — aulas exclusivas aos sábados',
        is_active: true,
      },
    ]

    const desiredPlanRecords = {}
    for (const plan of desiredPlans) {
      let record
      try {
        record = app.findFirstRecordByData('plans', 'name', plan.name)
        record.set('monthly_price', plan.monthly_price)
        record.set('description', plan.description)
        record.set('is_active', plan.is_active)
        app.save(record)
      } catch (_) {
        record = new Record(plansCol)
        record.set('name', plan.name)
        record.set('monthly_price', plan.monthly_price)
        record.set('description', plan.description)
        record.set('is_active', plan.is_active)
        app.save(record)
      }
      desiredPlanRecords[plan.name] = record
    }

    // 3. Deactivate or remap old placeholder plans (Natação Infantil, Natação Adulto, Hidroginástica)
    const oldPlanNames = ['Natação Infantil', 'Natação Adulto', 'Hidroginástica']
    for (const oldName of oldPlanNames) {
      try {
        const oldRec = app.findFirstRecordByData('plans', 'name', oldName)
        oldRec.set('is_active', false)
        app.save(oldRec)
      } catch (_) {}
    }
  },
  (app) => {
    // optional rollback
  },
)
