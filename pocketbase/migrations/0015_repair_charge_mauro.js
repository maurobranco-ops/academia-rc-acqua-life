/// <reference path="../../pb_data/types.d.ts" />
// RC Acqua Life — Migration 0015: reparo idempotente da cobrança q79iwqs1cfmuenb
// (Mauro, R$ 1,00, Pix) que o webhook original não conseguiu casar (identificadores
// da InfinitePay eram UUID deles e o webhook gravava rc_*).
// Aplica a baixa como se o webhook tivesse casado: charge paga/pix + payment pago +
// transação financeira de receita. Idempotente: se a cobrança já estiver paga com a
// receipt_url registrada, não refaz nada.
migrate(
  (app) => {
    const CHARGE_ID = 'q79iwqs1cfmuenb'
    const RECEIPT_URL = 'https://recibo.infinitepay.io/b5d410e6-ba7b-4da1-9c0c-4129cc11cdd8'
    const INFINIPAY_ORDER_NSU = '6288a633-2417-47d3-8fdf-539e92eb6945'
    const INFINIPAY_SLUG = 'xsg3TPNNU3'
    const PAID_AT = '2026-11-11T00:33:00.000Z'
    const AMOUNT = 1.0
    const PAID_CENTS = 100

    let charge = null
    try {
      charge = app.findRecordById('charges', CHARGE_ID)
    } catch (err) {
      console.log(
        `[Migration 0015] Cobrança ${CHARGE_ID} não encontrada — nada a reparar nesta base (ok em bases novas).`,
      )
      return
    }

    // Idempotência: já reparada?
    if (charge.getString('status') === 'paga' && charge.getString('infinipay_receipt_url')) {
      console.log(`[Migration 0015] Cobrança ${CHARGE_ID} já reparada anteriormente. Nada a fazer.`)
      return
    }

    app.runInTransaction((txApp) => {
      // 1. Cobrança: paga, pix, paid_amount 100 centavos, receipt_url, identificadores deles
      charge.set('status', 'paga')
      charge.set('payment_method', 'pix')
      charge.set('amount', AMOUNT)
      charge.set('infinipay_paid_amount', PAID_CENTS)
      charge.set('infinipay_receipt_url', RECEIPT_URL)
      charge.set('infinipay_order_nsu', INFINIPAY_ORDER_NSU)
      charge.set('infinipay_slug', INFINIPAY_SLUG)
      txApp.save(charge)

      // 2. Payment vinculado (cria se não existir)
      let payment = null
      try {
        const pmts = txApp.findRecordsByFilter(
          'payments',
          `charge_id = '${CHARGE_ID}'`,
          '-created',
          1,
          0,
        )
        if (pmts && pmts.length > 0) payment = pmts[0]
      } catch (_) {}

      if (!payment) {
        const paymentsCol = txApp.findCollectionByNameOrId('payments')
        payment = new Record(paymentsCol)
        payment.set('student_id', charge.getString('student_id'))
        payment.set('charge_id', CHARGE_ID)
        payment.set('due_date', charge.getString('due_date'))
        payment.set('status', 'pendente')
        payment.set('payment_method', 'pix')
        payment.set('amount', AMOUNT)
      }

      payment.set('status', 'pago')
      payment.set('payment_method', 'pix')
      payment.set('amount', AMOUNT)
      payment.set('paid_date', PAID_AT)
      payment.set('receipt_url', RECEIPT_URL)
      payment.set('infinipay_order_nsu', INFINIPAY_ORDER_NSU)
      payment.set('infinipay_slug', INFINIPAY_SLUG)
      payment.set('infinipay_transaction_id', INFINIPAY_ORDER_NSU)
      txApp.save(payment)

      // 3. Transação financeira de receita (se não existir ainda)
      try {
        const existingTrans = txApp.findRecordsByFilter(
          'transactions',
          `notes ~ '${CHARGE_ID}'`,
          '-created',
          1,
          0,
        )
        if (existingTrans.length === 0) {
          const transCol = txApp.findCollectionByNameOrId('transactions')
          const newTrans = new Record(transCol)
          newTrans.set('type', 'receita')
          newTrans.set('description', charge.getString('description') || 'Mensalidade')
          newTrans.set('category', 'mensalidade')
          newTrans.set('amount', AMOUNT)
          newTrans.set('date', PAID_AT)
          newTrans.set('payment_method', 'pix')
          newTrans.set('status', 'confirmado')
          newTrans.set(
            'notes',
            `Baixa de reparo InfinitePay (order_nsu: ${INFINIPAY_ORDER_NSU}, slug: ${INFINIPAY_SLUG}) - Cobrança #${CHARGE_ID}`,
          )
          txApp.save(newTrans)
        }
      } catch (transErr) {
        console.log('[Migration 0015] Aviso ao criar transação de receita:', transErr)
      }
    })

    console.log(
      `[Migration 0015] Cobrança ${CHARGE_ID} (Mauro) marcada como PAGA (pix, 100 centavos), receipt_url=${RECEIPT_URL}, payment vinculado e transação criados.`,
    )
  },
  (app) => {
    // Down: sem ação — não desfazemos baixa de pagamento real.
  },
)
