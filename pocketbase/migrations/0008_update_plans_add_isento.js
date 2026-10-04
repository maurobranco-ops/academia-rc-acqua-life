migrate(
  (app) => {
    const plansCol = app.findCollectionByNameOrId('plans')

    // 1. Alterar o campo monthly_price para que não seja required (pois no PocketBase number required rejeita 0)
    const priceField = plansCol.fields.getByName('monthly_price')
    if (priceField) {
      priceField.required = false
      app.save(plansCol)
    }

    // 2. Obter ou criar o plano "Integral" (R$ 110,00)
    let integralPlan
    try {
      integralPlan = app.findFirstRecordByData('plans', 'name', 'Integral')
    } catch (_) {
      integralPlan = new Record(plansCol)
      integralPlan.set('name', 'Integral')
      integralPlan.set('monthly_price', 110.0)
      integralPlan.set('description', 'Plano Integral — frequência regular de aulas na semana')
      integralPlan.set('is_active', true)
      app.save(integralPlan)
    }

    // 3. Obter ou criar o plano "Isento" (R$ 0,00)
    let isentoPlan
    try {
      isentoPlan = app.findFirstRecordByData('plans', 'name', 'Isento')
      isentoPlan.set('monthly_price', 0)
      isentoPlan.set('description', 'Plano Isento — sem cobrança de mensalidade (R$ 0,00)')
      isentoPlan.set('is_active', true)
      app.save(isentoPlan)
    } catch (_) {
      isentoPlan = new Record(plansCol)
      isentoPlan.set('name', 'Isento')
      isentoPlan.set('monthly_price', 0)
      isentoPlan.set('description', 'Plano Isento — sem cobrança de mensalidade (R$ 0,00)')
      isentoPlan.set('is_active', true)
      app.save(isentoPlan)
    }

    // 4. Garantir Família e Sábados com valores e status ativos corretos
    const standardPlans = [
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
    for (const sp of standardPlans) {
      try {
        const rec = app.findFirstRecordByData('plans', 'name', sp.name)
        rec.set('monthly_price', sp.monthly_price)
        rec.set('description', sp.description)
        rec.set('is_active', sp.is_active)
        app.save(rec)
      } catch (_) {
        const rec = new Record(plansCol)
        rec.set('name', sp.name)
        rec.set('monthly_price', sp.monthly_price)
        rec.set('description', sp.description)
        rec.set('is_active', sp.is_active)
        app.save(rec)
      }
    }

    // 5. Mapear qualquer aluno que ainda aponte para "Natação infantil", "Natação adulto" ou "Hidroginástica" para o plano "Integral"
    const oldPlanNames = ['Natação Infantil', 'Natação Adulto', 'Hidroginástica']
    const oldPlanIds = []

    for (const oldName of oldPlanNames) {
      try {
        const oldRec = app.findFirstRecordByData('plans', 'name', oldName)
        oldPlanIds.push(oldRec.id)
      } catch (_) {}
    }

    if (oldPlanIds.length > 0 && integralPlan) {
      for (const oldId of oldPlanIds) {
        // Atualiza students via SQL direta com segurança
        app
          .db()
          .newQuery('UPDATE students SET plan_id = {:newPlanId} WHERE plan_id = {:oldPlanId}')
          .bind({ newPlanId: integralPlan.id, oldPlanId: oldId })
          .execute()

        // Atualiza payments se houver referência ao plano
        app
          .db()
          .newQuery('UPDATE payments SET plan_id = {:newPlanId} WHERE plan_id = {:oldPlanId}')
          .bind({ newPlanId: integralPlan.id, oldPlanId: oldId })
          .execute()
      }
    }

    // 6. Excluir ou desativar os planos antigos da coleção plans
    for (const oldId of oldPlanIds) {
      try {
        const rec = app.findFirstRecordByData('plans', 'id', oldId)
        try {
          app.delete(rec)
        } catch (_) {
          rec.set('is_active', false)
          app.save(rec)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // Rollback opcional
  },
)
