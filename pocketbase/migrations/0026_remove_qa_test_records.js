// Migration 0026 — Corretiva: remove registros de TESTE da collection
// `enrollment_requests` deixados pela migration de QA 0025 (student_name
// "TESTE QA (excluir)"). A 0025 era uma sonda de teste e não faz parte do app;
// onde ela nunca rodou (ou o registro já foi removido), esta migration é um
// no-op idempotente e não altera nada.
migrate(
  (app) => {
    const rows = app.findRecordsByFilter(
      'enrollment_requests',
      "student_name = 'TESTE QA (excluir)'",
      '',
      100,
      0,
    )
    for (const r of rows) {
      app.delete(r)
    }
    if (rows.length > 0) {
      console.log('[0026] registros de teste removidos:', rows.length)
    }
  },
  (app) => {
    // Down: nada a restaurar (eram registros de teste).
  },
)
