// Migration 0019 — a collection enrollment_requests (criada na 0017) ficou sem os
// campos automáticos `created` e `updated` (autodate), o que fazia qualquer
// listagem com sort/filter por data (ex.: sort=-used pela tela /matriculas)
// retornar HTTP 400. Esta migration adiciona os dois campos exatamente como
// existem nas demais collections base (students, plans), de forma idempotente:
// em banco vazio ou quando já aplicada, ela é no-op.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('enrollment_requests')

    if (!col.fields.getByName('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    }

    app.save(col)
  },
  (app) => {
    // down: remove os campos autodate de volta (best-effort)
    const col = app.findCollectionByNameOrId('enrollment_requests')
    const created = col.fields.getByName('created')
    if (created) col.fields.remove(created)
    const updated = col.fields.getByName('updated')
    if (updated) col.fields.remove(updated)
    app.save(col)
  },
)
