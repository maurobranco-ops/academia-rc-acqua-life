// pocketbase/migrations/0013_update_recurring_billing_days_to_7.js
// Atualiza a antecedência de cobrança automática para 7 dias antes do vencimento
// e assegura que a cobrança recorrente permaneça DESLIGADA.

migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('settings')

    // 1. Atualizar recurring_billing_days_before para 7
    try {
      const record = app.findFirstRecordByData('settings', 'key', 'recurring_billing_days_before')
      record.set('value', '7')
      app.save(record)
    } catch (_) {
      // Se não existir, criar com 7
      const newRecord = new Record(settingsCol)
      newRecord.set('key', 'recurring_billing_days_before')
      newRecord.set('value', '7')
      app.save(newRecord)
    }

    // 2. Garantir que recurring_billing_active permaneça false (DESLIGADA)
    try {
      const recordActive = app.findFirstRecordByData('settings', 'key', 'recurring_billing_active')
      // Não altera se já existir, mas se for inexistente cria false
    } catch (_) {
      const newActiveRecord = new Record(settingsCol)
      newActiveRecord.set('key', 'recurring_billing_active')
      newActiveRecord.set('value', 'false')
      app.save(newActiveRecord)
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('settings', 'key', 'recurring_billing_days_before')
      record.set('value', '5')
      app.save(record)
    } catch (_) {}
  },
)
