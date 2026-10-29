migrate(
  (app) => {
    // Atualizar no banco todos os pagamentos vinculados a cobranças canceladas para o status 'cancelado'.
    // A regra é idempotente: pagamentos cuja cobrança está cancelada passam para status 'cancelado'.
    app
      .db()
      .newQuery(`
      UPDATE payments
      SET status = 'cancelado'
      WHERE status != 'cancelado'
        AND (
          charge_id IN (SELECT id FROM charges WHERE status = 'cancelada')
          OR (
            order_nsu IS NOT NULL AND order_nsu != ''
            AND order_nsu IN (SELECT order_nsu FROM charges WHERE status = 'cancelada' AND order_nsu IS NOT NULL AND order_nsu != '')
          )
          OR (
            infinipay_transaction_id IS NOT NULL AND infinipay_transaction_id != ''
            AND infinipay_transaction_id IN (SELECT infinipay_payment_id FROM charges WHERE status = 'cancelada' AND infinipay_payment_id IS NOT NULL AND infinipay_payment_id != '')
          )
        )
    `)
      .execute()
  },
  (app) => {
    // Reversão segura (no-op para não reativar pendências já canceladas)
  },
)
