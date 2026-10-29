// pocketbase/migrations/0012_add_whatsapp_fields_to_charges.js
migrate(
  (app) => {
    const charges = app.findCollectionByNameOrId('charges')

    // 1. Flag booleana se foi enviado
    if (!charges.fields.getByName('whatsapp_sent')) {
      charges.fields.add(new BoolField({ name: 'whatsapp_sent' }))
    }

    // 2. Data/hora de envio
    if (!charges.fields.getByName('whatsapp_sent_at')) {
      charges.fields.add(new DateField({ name: 'whatsapp_sent_at' }))
    }

    // 3. Status descritivo: 'enviado', 'falha', 'sem_telefone', 'pendente'
    if (!charges.fields.getByName('whatsapp_status')) {
      charges.fields.add(new TextField({ name: 'whatsapp_status' }))
    }

    // 4. Motivo / mensagem de erro ou detalhe quando falhar
    if (!charges.fields.getByName('whatsapp_error')) {
      charges.fields.add(new TextField({ name: 'whatsapp_error' }))
    }

    // 5. Telefone destinatário utilizado no disparo
    if (!charges.fields.getByName('whatsapp_phone')) {
      charges.fields.add(new TextField({ name: 'whatsapp_phone' }))
    }

    app.save(charges)
  },
  (app) => {
    try {
      const charges = app.findCollectionByNameOrId('charges')
      if (charges.fields.getByName('whatsapp_sent')) charges.fields.removeByName('whatsapp_sent')
      if (charges.fields.getByName('whatsapp_sent_at'))
        charges.fields.removeByName('whatsapp_sent_at')
      if (charges.fields.getByName('whatsapp_status'))
        charges.fields.removeByName('whatsapp_status')
      if (charges.fields.getByName('whatsapp_error')) charges.fields.removeByName('whatsapp_error')
      if (charges.fields.getByName('whatsapp_phone')) charges.fields.removeByName('whatsapp_phone')
      app.save(charges)
    } catch (_) {}
  },
)
