migrate(
  (app) => {
    // 1. Add order_nsu and invoice_slug to charges
    const charges = app.findCollectionByNameOrId('charges')
    if (!charges.fields.getByName('order_nsu')) {
      charges.fields.add(new TextField({ name: 'order_nsu' }))
    }
    if (!charges.fields.getByName('invoice_slug')) {
      charges.fields.add(new TextField({ name: 'invoice_slug' }))
    }
    charges.addIndex('idx_charges_order_nsu', false, 'order_nsu', '')
    charges.addIndex('idx_charges_infinipay_payment_id', false, 'infinipay_payment_id', '')
    app.save(charges)

    // 2. Add order_nsu and invoice_slug to payments
    const payments = app.findCollectionByNameOrId('payments')
    if (!payments.fields.getByName('order_nsu')) {
      payments.fields.add(new TextField({ name: 'order_nsu' }))
    }
    if (!payments.fields.getByName('invoice_slug')) {
      payments.fields.add(new TextField({ name: 'invoice_slug' }))
    }
    payments.addIndex('idx_payments_order_nsu', false, 'order_nsu', '')
    payments.addIndex('idx_payments_infinipay_trans', false, 'infinipay_transaction_id', '')
    app.save(payments)

    // 3. Create webhook_events collection for idempotency and audit trail
    let webhookEventsExists = true
    try {
      app.findCollectionByNameOrId('webhook_events')
    } catch (_) {
      webhookEventsExists = false
    }

    if (!webhookEventsExists) {
      const webhookEvents = new Collection({
        name: 'webhook_events',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'event_key', type: 'text', required: true },
          { name: 'event_type', type: 'text', required: true },
          { name: 'order_nsu', type: 'text' },
          { name: 'transaction_nsu', type: 'text' },
          { name: 'invoice_slug', type: 'text' },
          { name: 'charge_id', type: 'text' },
          { name: 'status', type: 'text' },
          { name: 'payload', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_webhook_events_key ON webhook_events (event_key)',
          'CREATE INDEX idx_webhook_events_order_nsu ON webhook_events (order_nsu)',
        ],
      })
      app.save(webhookEvents)
    }

    // 4. Seed default settings for recurring billing automation (OFF by default)
    const settingsCol = app.findCollectionByNameOrId('settings')
    const ensureSetting = (key, defaultValue) => {
      try {
        app.findFirstRecordByData('settings', 'key', key)
      } catch (_) {
        const r = new Record(settingsCol)
        r.set('key', key)
        r.set('value', defaultValue)
        app.save(r)
      }
    }

    // Geração automática desligada por padrão conforme instrução estrita do usuário
    ensureSetting('recurring_billing_active', 'false')
    ensureSetting('recurring_billing_days_before', '7')
    ensureSetting('recurring_billing_last_run', '')
    ensureSetting('recurring_billing_last_status', 'Nunca executado')
  },
  (app) => {
    try {
      const webhookEvents = app.findCollectionByNameOrId('webhook_events')
      app.delete(webhookEvents)
    } catch (_) {}

    try {
      const charges = app.findCollectionByNameOrId('charges')
      charges.removeIndex('idx_charges_order_nsu')
      charges.removeIndex('idx_charges_infinipay_payment_id')
      if (charges.fields.getByName('order_nsu')) charges.fields.removeByName('order_nsu')
      if (charges.fields.getByName('invoice_slug')) charges.fields.removeByName('invoice_slug')
      app.save(charges)
    } catch (_) {}

    try {
      const payments = app.findCollectionByNameOrId('payments')
      payments.removeIndex('idx_payments_order_nsu')
      payments.removeIndex('idx_payments_infinipay_trans')
      if (payments.fields.getByName('order_nsu')) payments.fields.removeByName('order_nsu')
      if (payments.fields.getByName('invoice_slug')) payments.fields.removeByName('invoice_slug')
      app.save(payments)
    } catch (_) {}
  },
)
