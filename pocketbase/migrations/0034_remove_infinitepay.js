// 0034_remove_infinitepay.js
// RC Acqua Life — remoção da integração InfinitePay (decisão do usuário: ABANDONO).
// - Exclui a collection `webhook_events` (só existia para idempotência/auditoria
//   do webhook da InfinitePay — nenhum outro hook a usa).
// - Remove campos e índices infinipay_* de `charges` e `payments`.
// - `payment_link` em `charges`/`payments` é mantido como coluna órfã (dados
//   históricos preservados; nada mais grava nele).
//
// IMPORTANTE: nenhum dado histórico de cobranças é apagado — apenas os campos
// de identificação do gateway saem do schema. Down: recria o que foi removido.
//
// Roda em goja: sem optional chaining.

migrate(
  (app) => {
    // 1. Collection webhook_events — criar de novo aqui seria no-op (existe no
    // banco), então apenas removemos se estiver presente.
    try {
      const webhookEvents = app.findCollectionByNameOrId('webhook_events')
      app.delete(webhookEvents)
      console.log('[0034] collection webhook_events removida.')
    } catch (err) {
      console.log('[0034] webhook_events já ausente — nada a fazer.')
    }

    // 2. charges: remover campos infinipay_*
    const charges = app.findCollectionByNameOrId('charges')
    try {
      charges.removeIndex('idx_charges_infinipay_payment_id')
    } catch (err) {}
    try {
      charges.removeIndex('idx_charges_infinipay_order_nsu')
    } catch (err) {}
    try {
      charges.removeIndex('idx_charges_infinipay_slug')
    } catch (err) {}
    for (const f of [
      'infinipay_payment_id',
      'infinipay_order_nsu',
      'infinipay_slug',
      'infinipay_receipt_url',
      'infinipay_paid_amount',
    ]) {
      if (charges.fields.getByName(f)) {
        charges.fields.removeByName(f)
      }
    }
    app.save(charges)
    console.log('[0034] charges: campos infinipay_* removidos.')

    // 3. payments: remover campos infinipay_*
    const payments = app.findCollectionByNameOrId('payments')
    try {
      payments.removeIndex('idx_payments_infinipay_trans')
    } catch (err) {}
    try {
      payments.removeIndex('idx_payments_infinipay_order_nsu')
    } catch (err) {}
    for (const f of ['infinipay_transaction_id', 'infinipay_order_nsu', 'infinipay_slug']) {
      if (payments.fields.getByName(f)) {
        payments.fields.removeByName(f)
      }
    }
    app.save(payments)
    console.log('[0034] payments: campos infinipay_* removidos.')
  },
  (app) => {
    // Down: recriar a collection webhook_events
    const webhookEvents = new Collection({
      name: 'webhook_events',
      type: 'base',
      fields: [
        new TextField({ name: 'event_key' }),
        new TextField({ name: 'event_type' }),
        new TextField({ name: 'order_nsu' }),
        new TextField({ name: 'charge_id' }),
      ],
    })
    app.save(webhookEvents)
    try {
      $app.runQuery('CREATE UNIQUE INDEX idx_webhook_events_key ON webhook_events (event_key)')
      $app.runQuery('CREATE INDEX idx_webhook_events_order_nsu ON webhook_events (order_nsu)')
    } catch (err) {}

    // charges
    const charges = app.findCollectionByNameOrId('charges')
    if (!charges.fields.getByName('infinipay_payment_id')) {
      charges.fields.add(new TextField({ name: 'infinipay_payment_id' }))
      charges.addIndex('idx_charges_infinipay_payment_id', false, 'infinipay_payment_id', '')
    }
    if (!charges.fields.getByName('infinipay_order_nsu')) {
      charges.fields.add(new TextField({ name: 'infinipay_order_nsu' }))
      charges.addIndex('idx_charges_infinipay_order_nsu', false, 'infinipay_order_nsu', '')
    }
    if (!charges.fields.getByName('infinipay_slug')) {
      charges.fields.add(new TextField({ name: 'infinipay_slug' }))
      charges.addIndex('idx_charges_infinipay_slug', false, 'infinipay_slug', '')
    }
    if (!charges.fields.getByName('infinipay_receipt_url')) {
      charges.fields.add(new TextField({ name: 'infinipay_receipt_url' }))
    }
    if (!charges.fields.getByName('infinipay_paid_amount')) {
      charges.fields.add(new NumberField({ name: 'infinipay_paid_amount' }))
    }
    app.save(charges)

    // payments
    const payments = app.findCollectionByNameOrId('payments')
    if (!payments.fields.getByName('infinipay_transaction_id')) {
      payments.fields.add(new TextField({ name: 'infinipay_transaction_id' }))
      payments.addIndex('idx_payments_infinipay_trans', false, 'infinipay_transaction_id', '')
    }
    if (!payments.fields.getByName('infinipay_order_nsu')) {
      payments.fields.add(new TextField({ name: 'infinipay_order_nsu' }))
      payments.addIndex('idx_payments_infinipay_order_nsu', false, 'infinipay_order_nsu', '')
    }
    if (!payments.fields.getByName('infinipay_slug')) {
      payments.fields.add(new TextField({ name: 'infinipay_slug' }))
    }
    app.save(payments)
    console.log('[0034 down] schema da InfinitePay restaurado (sem dados).')
  },
)
