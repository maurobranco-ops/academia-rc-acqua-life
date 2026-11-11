migrate(
  (app) => {
    // 1. charges: identificadores próprios da InfinitePay (UUID/slug que ELA devolve),
    // mantendo order_nsu/invoice_slug como referência interna (rc_*)
    const charges = app.findCollectionByNameOrId('charges')
    if (!charges.fields.getByName('infinipay_order_nsu')) {
      charges.fields.add(new TextField({ name: 'infinipay_order_nsu' }))
    }
    if (!charges.fields.getByName('infinipay_slug')) {
      charges.fields.add(new TextField({ name: 'infinipay_slug' }))
    }
    if (!charges.fields.getByName('infinipay_receipt_url')) {
      charges.fields.add(new TextField({ name: 'infinipay_receipt_url' }))
    }
    if (!charges.fields.getByName('infinipay_paid_amount')) {
      charges.fields.add(new NumberField({ name: 'infinipay_paid_amount' }))
    }
    charges.addIndex('idx_charges_infinipay_order_nsu', false, 'infinipay_order_nsu', '')
    charges.addIndex('idx_charges_infinipay_slug', false, 'infinipay_slug', '')
    app.save(charges)

    // 2. payments: mesmos campos espelhados
    const payments = app.findCollectionByNameOrId('payments')
    if (!payments.fields.getByName('infinipay_order_nsu')) {
      payments.fields.add(new TextField({ name: 'infinipay_order_nsu' }))
    }
    if (!payments.fields.getByName('infinipay_slug')) {
      payments.fields.add(new TextField({ name: 'infinipay_slug' }))
    }
    if (!payments.fields.getByName('receipt_url')) {
      payments.fields.add(new TextField({ name: 'receipt_url' }))
    }
    payments.addIndex('idx_payments_infinipay_order_nsu', false, 'infinipay_order_nsu', '')
    app.save(payments)

    console.log(
      '[Migration 0014] Campos infinipay_order_nsu/infinipay_slug/receipt_url adicionados a charges e payments.',
    )
  },
  (app) => {
    try {
      const charges = app.findCollectionByNameOrId('charges')
      charges.removeIndex('idx_charges_infinipay_order_nsu')
      charges.removeIndex('idx_charges_infinipay_slug')
      for (const f of [
        'infinipay_order_nsu',
        'infinipay_slug',
        'infinipay_receipt_url',
        'infinipay_paid_amount',
      ]) {
        if (charges.fields.getByName(f)) charges.fields.removeByName(f)
      }
      app.save(charges)
    } catch (_) {}

    try {
      const payments = app.findCollectionByNameOrId('payments')
      payments.removeIndex('idx_payments_infinipay_order_nsu')
      for (const f of ['infinipay_order_nsu', 'infinipay_slug', 'receipt_url']) {
        if (payments.fields.getByName(f)) payments.fields.removeByName(f)
      }
      app.save(payments)
    } catch (_) {}
  },
)
