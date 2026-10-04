routerAdd('POST', '/backend/v1/infinitepay/webhook', (e) => {
  const info = e.requestInfo()
  const body = info.body || {}

  // Expected payload properties from Infinitepay webhook:
  // e.g. { event: "transaction.paid" | "charge.paid", data: { payment_id: "...", status: "paid" | "failed" | "refunded", amount: 180, payment_method: "pix" } }
  const paymentId =
    body.payment_id || (body.data && body.data.payment_id) || body.id || (body.data && body.data.id)
  const statusRaw = (
    body.status ||
    (body.data && body.data.status) ||
    body.event ||
    ''
  ).toLowerCase()
  const amount = Number(body.amount || (body.data && body.data.amount) || 0)

  if (!paymentId) {
    return e.json(400, { success: false, error: 'Missing payment_id in webhook payload' })
  }

  let mappedChargeStatus = 'em_aberto'
  let mappedPaymentStatus = 'pendente'

  if (
    statusRaw.includes('paid') ||
    statusRaw.includes('pago') ||
    statusRaw.includes('confirmed') ||
    statusRaw.includes('approved')
  ) {
    mappedChargeStatus = 'paga'
    mappedPaymentStatus = 'pago'
  } else if (statusRaw.includes('refund') || statusRaw.includes('estorn')) {
    mappedChargeStatus = 'cancelada'
    mappedPaymentStatus = 'reembolsado'
  } else if (statusRaw.includes('cancel') || statusRaw.includes('fail')) {
    mappedChargeStatus = 'cancelada'
    mappedPaymentStatus = 'cancelado'
  }

  let updatedCharge = null
  let updatedPayment = null

  // 1. Find and update charge
  try {
    const charges = $app.findRecordsByFilter(
      'charges',
      `infinipay_payment_id = '${paymentId}'`,
      '-created',
      1,
      0,
    )
    if (charges && charges.length > 0) {
      updatedCharge = charges[0]
      updatedCharge.set('status', mappedChargeStatus)
      $app.save(updatedCharge)
    }
  } catch (err) {
    console.log('Error updating charge in infinitepay webhook:', err)
  }

  // 2. Find and update payment
  try {
    const payments = $app.findRecordsByFilter(
      'payments',
      `infinipay_transaction_id = '${paymentId}' || payment_link ~ '${paymentId}'`,
      '-created',
      1,
      0,
    )
    if (payments && payments.length > 0) {
      updatedPayment = payments[0]
      updatedPayment.set('status', mappedPaymentStatus)
      if (mappedPaymentStatus === 'pago') {
        updatedPayment.set('paid_date', new Date().toISOString())
      }
      $app.save(updatedPayment)
    }
  } catch (err) {
    console.log('Error updating payment in infinitepay webhook:', err)
  }

  // 3. If paid, create a transaction record if one doesn't exist yet
  if (mappedPaymentStatus === 'pago') {
    try {
      const transDesc = updatedCharge
        ? updatedCharge.getString('description')
        : `Recebimento Infinitepay #${paymentId}`
      const transAmount =
        (updatedPayment && updatedPayment.getInt('amount')) ||
        (updatedCharge && updatedCharge.getInt('amount')) ||
        amount

      const existingTrans = $app.findRecordsByFilter(
        'transactions',
        `description ~ '${paymentId}' || notes ~ '${paymentId}'`,
        '-created',
        1,
        0,
      )

      if (existingTrans.length === 0 && transAmount > 0) {
        const transCol = $app.findCollectionByNameOrId('transactions')
        const newTrans = new Record(transCol)
        newTrans.set('type', 'receita')
        newTrans.set('description', transDesc)
        newTrans.set('category', 'mensalidade')
        newTrans.set('amount', transAmount)
        newTrans.set('date', new Date().toISOString())
        newTrans.set(
          'payment_method',
          (updatedPayment && updatedPayment.getString('payment_method')) || 'pix',
        )
        newTrans.set('status', 'confirmado')
        newTrans.set('notes', `Confirmado via Infinitepay webhook (${paymentId})`)
        $app.save(newTrans)
      }
    } catch (err) {
      console.log('Error creating transaction in infinitepay webhook:', err)
    }
  }

  return e.json(200, {
    success: true,
    payment_id: paymentId,
    charge_status: mappedChargeStatus,
    payment_status: mappedPaymentStatus,
  })
})
