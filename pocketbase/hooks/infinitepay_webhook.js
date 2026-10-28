// pocketbase/hooks/infinitepay_webhook.js
// RC Acqua Life — Integração InfinitePay e Cobrança Recorrente
// PocketBase JSVM requirement: All functions and variables must be declared INLINE inside each callback.

// -------------------------------------------------------------
// 1. Test Connection Route
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/infinitepay/test-connection', (e) => {
  const readSetting = (k, fallback = '') => {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        const val = records[0].getString('value')
        return val !== undefined && val !== null ? val.trim() : fallback
      }
    } catch (_) {}
    return fallback
  }

  const info = e.requestInfo()
  const body = info.body || {}

  const apiKey = (
    body.apiKey !== undefined ? body.apiKey : readSetting('infinitepay_api_key')
  ).trim()
  const handle = (body.handle !== undefined ? body.handle : readSetting('infinitepay_handle'))
    .trim()
    .replace(/^@/, '')
    .replace(/^\$/, '')

  if (!apiKey && !handle) {
    return e.json(400, {
      success: false,
      message: 'Nenhuma credencial informada. Preencha a Chave de API ou a InfiniteTag/Handle.',
    })
  }

  // Base URL: sempre a nova URL oficial
  let baseUrl = (
    readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
  ).replace(/\/+$/, '')
  if (baseUrl.includes('api.infinitepay.io/invoices/public/checkout')) {
    baseUrl = 'https://api.checkout.infinitepay.io'
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'RCAcquaLife-Academy/1.0',
    }
    if (apiKey) {
      headers['X-Api-Key'] = apiKey
    }

    const testPayload = {
      order_nsu: 'probe_test_' + Date.now(),
      items: [
        {
          quantity: 1,
          price: 100, // R$ 1,00 em centavos
          description: 'Teste de Conexao',
        },
      ],
    }
    if (handle) {
      testPayload.handle = handle
    }

    const res = $http.send({
      url: `${baseUrl}/links`,
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testPayload),
      timeout: 10,
    })

    if (res.statusCode === 401 || res.statusCode === 403) {
      return e.json(400, {
        success: false,
        status: res.statusCode,
        message:
          'Chave de API Infinitepay rejeitada ou não autorizada. Verifique a chave inserida.',
      })
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return e.json(200, {
        success: true,
        message:
          'Conexão com InfinitePay validada com sucesso! Link de teste gerado perfeitamente.',
        statusCode: res.statusCode,
      })
    }

    let respJson = null
    try {
      respJson = JSON.parse(res.raw)
    } catch (_) {}

    if (res.statusCode === 400 || res.statusCode === 422) {
      const errMsg = (respJson && (respJson.message || respJson.error)) || res.raw || ''
      if (
        errMsg.toLowerCase().includes('unauthorized') ||
        errMsg.toLowerCase().includes('api key') ||
        errMsg.toLowerCase().includes('forbidden')
      ) {
        return e.json(400, {
          success: false,
          message: 'Falha de autenticação na InfinitePay: ' + errMsg,
        })
      }

      return e.json(200, {
        success: true,
        message:
          'Conexão estabelecida com a InfinitePay! (Validação concluída: ' +
          (errMsg || 'API online') +
          ')',
      })
    }

    return e.json(400, {
      success: false,
      message: `Erro na resposta da Infinitepay (HTTP ${res.statusCode}). Verifique suas credenciais.`,
    })
  } catch (err) {
    return e.json(500, {
      success: false,
      message:
        'Não foi possível contatar os servidores da Infinitepay: ' + (err.message || String(err)),
    })
  }
})

// -------------------------------------------------------------
// 2. Create Charge Route (Chamada manual pelo frontend)
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/infinitepay/create-charge', (e) => {
  const readSetting = (k, fallback = '') => {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        const val = records[0].getString('value')
        return val !== undefined && val !== null ? val.trim() : fallback
      }
    } catch (_) {}
    return fallback
  }

  const info = e.requestInfo()
  const body = info.body || {}

  const studentId = body.student_id
  const description = body.description || 'Mensalidade'
  const amount = Number(body.amount || 0)
  const discountAmount = Number(body.discount_amount || 0)
  const dueDate = body.due_date
  const paymentMethod = body.payment_method || 'pix'
  const generateInfinitepay = body.generateInfinitepay !== false
  const customOrderNsu = body.order_nsu || null

  if (!studentId || !description || amount <= 0 || !dueDate) {
    return e.json(400, {
      success: false,
      message: 'Dados incompletos: student_id, description, amount e due_date são obrigatórios.',
    })
  }

  let student = null
  try {
    student = $app.findRecordById('students', studentId)
  } catch (err) {
    return e.json(404, {
      success: false,
      message: 'Aluno não encontrado no sistema.',
    })
  }

  const apiKey = readSetting('infinitepay_api_key')
  const handle = readSetting('infinitepay_handle').replace(/^@/, '').replace(/^\$/, '')
  let apiUrl = (
    readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
  ).replace(/\/+$/, '')
  if (apiUrl.includes('api.infinitepay.io/invoices/public/checkout')) {
    apiUrl = 'https://api.checkout.infinitepay.io'
  }

  let infinitepayPaymentId = ''
  let paymentLink = ''
  let invoiceSlug = ''
  let apiWarning = ''

  const orderNsu =
    customOrderNsu ||
    `rc_${studentId.substring(0, 5)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  if (generateInfinitepay) {
    if (!apiKey && !handle) {
      return e.json(400, {
        success: false,
        code: 'MISSING_CREDENTIALS',
        message:
          'Credenciais InfinitePay não configuradas. Acesse Configurações → Integração Infinitepay.',
      })
    }

    const priceCents = Math.round(amount * 100)

    const customerPayload = {
      name: student.getString('name') || 'Aluno',
    }
    const studentEmail = student.getString('email') || student.getString('guardian_email')
    if (studentEmail) customerPayload.email = studentEmail
    const studentPhone =
      student.getString('phone') ||
      student.getString('whatsapp') ||
      student.getString('guardian_phone')
    if (studentPhone) {
      const cleanPhone = studentPhone.replace(/\D/g, '')
      customerPayload.phone_number = cleanPhone.startsWith('55')
        ? '+' + cleanPhone
        : '+55' + cleanPhone
    }

    const pbUrl = $os.getenv('PB_INSTANCE_URL') || readSetting('site_url') || ''
    const webhookUrl = pbUrl ? `${pbUrl.replace(/\/+$/, '')}/backend/v1/infinitepay/webhook` : ''

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'RCAcquaLife-Academy/1.0',
    }
    if (apiKey) {
      headers['X-Api-Key'] = apiKey
    }

    const infinitepayPayload = {
      order_nsu: orderNsu,
      items: [
        {
          quantity: 1,
          price: priceCents,
          description: description,
        },
      ],
      customer: customerPayload,
    }

    if (handle) {
      infinitepayPayload.handle = handle
    }
    if (webhookUrl) {
      infinitepayPayload.webhook_url = webhookUrl
    }

    try {
      const res = $http.send({
        url: `${apiUrl}/links`,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(infinitepayPayload),
        timeout: 15,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        let respData = null
        try {
          respData = JSON.parse(res.raw)
        } catch (_) {}

        if (respData) {
          paymentLink = respData.url || respData.link || respData.checkout_url || ''
          invoiceSlug = respData.invoice_slug || respData.slug || ''
          infinitepayPaymentId = invoiceSlug || respData.order_nsu || orderNsu
        }
      } else {
        console.log('[InfinitePay API] Erro status:', res.statusCode, 'body:', res.raw)
        let errJson = null
        try {
          errJson = JSON.parse(res.raw)
        } catch (_) {}
        const errorDetail = (errJson && (errJson.message || errJson.error)) || res.raw
        apiWarning = `Aviso da InfinitePay (${res.statusCode}): ${errorDetail}`
      }
    } catch (httpErr) {
      console.log('[InfinitePay API] Falha HTTP:', httpErr)
      apiWarning = 'Falha ao contatar API InfinitePay: ' + (httpErr.message || String(httpErr))
    }
  }

  if (!infinitepayPaymentId) {
    infinitepayPaymentId = orderNsu
  }
  if (!paymentLink) {
    paymentLink = `https://pay.infinitepay.io/link/${infinitepayPaymentId}`
  }

  // Persistir em `charges`
  let chargeRecord = null
  try {
    const chargesCol = $app.findCollectionByNameOrId('charges')
    chargeRecord = new Record(chargesCol)
    chargeRecord.set('student_id', studentId)
    chargeRecord.set('description', description)
    chargeRecord.set('amount', amount)
    chargeRecord.set('discount_amount', discountAmount)
    chargeRecord.set('due_date', dueDate)
    chargeRecord.set('status', 'em_aberto')
    chargeRecord.set('payment_method', paymentMethod)
    chargeRecord.set('infinipay_payment_id', infinitepayPaymentId)
    chargeRecord.set('payment_link', paymentLink)
    chargeRecord.set('order_nsu', orderNsu)
    if (invoiceSlug) {
      chargeRecord.set('invoice_slug', invoiceSlug)
    }
    $app.save(chargeRecord)

    // Persistir em `payments`
    const paymentsCol = $app.findCollectionByNameOrId('payments')
    const paymentRecord = new Record(paymentsCol)
    paymentRecord.set('student_id', studentId)
    paymentRecord.set('charge_id', chargeRecord.id)
    paymentRecord.set('amount', amount)
    paymentRecord.set('discount_amount', discountAmount)
    paymentRecord.set('due_date', dueDate)
    paymentRecord.set('status', 'pendente')
    paymentRecord.set('payment_method', paymentMethod)
    paymentRecord.set('payment_link', paymentLink)
    paymentRecord.set('infinipay_transaction_id', infinitepayPaymentId)
    paymentRecord.set('order_nsu', orderNsu)
    if (invoiceSlug) {
      paymentRecord.set('invoice_slug', invoiceSlug)
    }
    $app.save(paymentRecord)
  } catch (dbErr) {
    console.log('[Create Charge] Erro ao salvar no banco:', dbErr)
    return e.json(500, {
      success: false,
      message: 'Erro ao salvar cobrança no banco de dados: ' + (dbErr.message || String(dbErr)),
    })
  }

  return e.json(200, {
    success: true,
    charge: {
      id: chargeRecord.id,
      student_id: studentId,
      description: description,
      amount: amount,
      discount_amount: discountAmount,
      due_date: dueDate,
      status: 'em_aberto',
      payment_method: paymentMethod,
      infinipay_payment_id: infinitepayPaymentId,
      payment_link: paymentLink,
      order_nsu: orderNsu,
      invoice_slug: invoiceSlug,
    },
    warning: apiWarning || null,
  })
})

// -------------------------------------------------------------
// 3. Webhook Route (Oficial InfinitePay com idempotência e /payment_check)
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/infinitepay/webhook', (e) => {
  const readSetting = (k, fallback = '') => {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        const val = records[0].getString('value')
        return val !== undefined && val !== null ? val.trim() : fallback
      }
    } catch (_) {}
    return fallback
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const headers = info.headers || {}

  // 3.1 Validação de segurança/assinatura
  let configuredSecret = readSetting('infinitepay_webhook_secret')
  if (!configuredSecret) {
    configuredSecret = $os.getenv('INFINITEPAY_WEBHOOK_SECRET') || ''
  }

  if (configuredSecret) {
    const receivedSignature =
      headers['x-infinitepay-signature'] ||
      headers['x-signature'] ||
      headers['x-webhook-token'] ||
      headers['authorization'] ||
      ''

    const queryToken = (info.query && info.query.token) || ''
    let isAuthorized = false

    if (queryToken && queryToken === configuredSecret) {
      isAuthorized = true
    } else if (receivedSignature) {
      if (
        receivedSignature === configuredSecret ||
        receivedSignature === `Bearer ${configuredSecret}`
      ) {
        isAuthorized = true
      } else {
        try {
          const rawBody = typeof body === 'string' ? body : JSON.stringify(body)
          const expectedHmac = $security.hs256(rawBody, configuredSecret)
          if (receivedSignature.toLowerCase() === expectedHmac.toLowerCase()) {
            isAuthorized = true
          }
        } catch (_) {}
      }
    }

    if (!isAuthorized) {
      console.log('[Webhook] Assinatura ou token inválido rejeitado')
      return e.json(401, { success: false, error: 'Unauthorized webhook request' })
    }
  }

  // 3.2 Extração dos dados do payload da InfinitePay
  const innerData = body.data || {}
  const invoiceSlug = String(
    body.invoice_slug || innerData.invoice_slug || body.slug || innerData.slug || '',
  ).trim()
  const orderNsu = String(body.order_nsu || innerData.order_nsu || '').trim()
  const transactionNsu = String(
    body.transaction_nsu || innerData.transaction_nsu || body.nsu || innerData.nsu || '',
  ).trim()
  const paymentId = String(
    body.payment_id ||
      innerData.payment_id ||
      body.id ||
      innerData.id ||
      orderNsu ||
      invoiceSlug ||
      '',
  ).trim()

  const rawEventType = String(
    body.event_type ||
      body.event ||
      innerData.event_type ||
      innerData.event ||
      body.status ||
      innerData.status ||
      '',
  )
    .trim()
    .toLowerCase()

  if (!orderNsu && !paymentId && !invoiceSlug && !transactionNsu) {
    console.log('[Webhook] Payload sem identificadores válidos:', JSON.stringify(body))
    return e.json(400, {
      success: false,
      error: 'Missing order_nsu / payment identifier in webhook payload',
    })
  }

  // Mapeamento dos eventos oficiais da InfinitePay:
  // created, paid, settled, canceled, refunded, payment_failed
  let normalizedEvent = 'unknown'
  let targetChargeStatus = null
  let targetPaymentStatus = null
  let requiresConfirmation = false

  if (
    rawEventType === 'paid' ||
    rawEventType.includes('paid') ||
    rawEventType.includes('pago') ||
    rawEventType.includes('approved')
  ) {
    normalizedEvent = 'paid'
    targetChargeStatus = 'paga'
    targetPaymentStatus = 'pago'
    requiresConfirmation = true
  } else if (rawEventType === 'settled' || rawEventType.includes('settled')) {
    normalizedEvent = 'settled'
    targetChargeStatus = 'paga'
    targetPaymentStatus = 'pago'
    requiresConfirmation = true
  } else if (
    rawEventType === 'refunded' ||
    rawEventType.includes('refund') ||
    rawEventType.includes('estorn')
  ) {
    normalizedEvent = 'refunded'
    targetChargeStatus = 'cancelada'
    targetPaymentStatus = 'reembolsado'
  } else if (
    rawEventType === 'canceled' ||
    rawEventType === 'cancelled' ||
    rawEventType.includes('cancel')
  ) {
    normalizedEvent = 'canceled'
    targetChargeStatus = 'cancelada'
    targetPaymentStatus = 'cancelado'
  } else if (
    rawEventType === 'payment_failed' ||
    rawEventType === 'failed' ||
    rawEventType.includes('fail') ||
    rawEventType.includes('falh')
  ) {
    normalizedEvent = 'payment_failed'
    targetChargeStatus = 'em_aberto'
    targetPaymentStatus = 'pendente'
  } else if (rawEventType === 'created' || rawEventType.includes('creat')) {
    normalizedEvent = 'created'
    targetChargeStatus = 'em_aberto'
    targetPaymentStatus = 'pendente'
  } else {
    normalizedEvent = rawEventType || 'unknown'
  }

  // 3.3 Idempotência por evento: combinar event_type com identificador
  const idempotencyKey = `${normalizedEvent}_${orderNsu || transactionNsu || invoiceSlug || paymentId}`
  try {
    const existingEvents = $app.findRecordsByFilter(
      'webhook_events',
      `event_key = '${idempotencyKey}'`,
      '-created',
      1,
      0,
    )
    if (existingEvents && existingEvents.length > 0) {
      console.log(
        `[Webhook] Evento já processado anteriormente (${idempotencyKey}). Ignorando re-tentativa.`,
      )
      return e.json(200, {
        success: true,
        idempotent: true,
        message: 'Event already processed',
        event_key: idempotencyKey,
      })
    }
  } catch (err) {
    console.log('[Webhook] Verificação de idempotência:', err)
  }

  // 3.4 Casamento de cobrança — PRIORIDADE MÁXIMA PARA order_nsu
  let matchedCharge = null
  let matchedPayment = null

  if (orderNsu) {
    try {
      const byOrder = $app.findRecordsByFilter(
        'charges',
        `order_nsu = '${orderNsu}' || infinipay_payment_id = '${orderNsu}'`,
        '-created',
        1,
        0,
      )
      if (byOrder && byOrder.length > 0) {
        matchedCharge = byOrder[0]
      }
    } catch (_) {}
  }

  if (!matchedCharge && invoiceSlug) {
    try {
      const bySlug = $app.findRecordsByFilter(
        'charges',
        `invoice_slug = '${invoiceSlug}' || infinipay_payment_id = '${invoiceSlug}' || payment_link ~ '${invoiceSlug}'`,
        '-created',
        1,
        0,
      )
      if (bySlug && bySlug.length > 0) {
        matchedCharge = bySlug[0]
      }
    } catch (_) {}
  }

  if (!matchedCharge && paymentId) {
    try {
      const byPayId = $app.findRecordsByFilter(
        'charges',
        `infinipay_payment_id = '${paymentId}' || payment_link ~ '${paymentId}'`,
        '-created',
        1,
        0,
      )
      if (byPayId && byPayId.length > 0) {
        matchedCharge = byPayId[0]
      }
    } catch (_) {}
  }

  if (matchedCharge) {
    try {
      const pmts = $app.findRecordsByFilter(
        'payments',
        `charge_id = '${matchedCharge.id}'`,
        '-created',
        1,
        0,
      )
      if (pmts && pmts.length > 0) {
        matchedPayment = pmts[0]
      }
    } catch (_) {}
  }

  if (!matchedPayment) {
    try {
      const filters = []
      if (orderNsu) filters.push(`order_nsu = '${orderNsu}'`)
      if (invoiceSlug) filters.push(`invoice_slug = '${invoiceSlug}'`)
      if (paymentId) filters.push(`infinipay_transaction_id = '${paymentId}'`)
      if (filters.length > 0) {
        const pmts = $app.findRecordsByFilter('payments', filters.join(' || '), '-created', 1, 0)
        if (pmts && pmts.length > 0) {
          matchedPayment = pmts[0]
        }
      }
    } catch (_) {}
  }

  if (!matchedCharge) {
    console.log(
      `[Webhook] Cobrança não encontrada para order_nsu=${orderNsu}, slug=${invoiceSlug}, paymentId=${paymentId}`,
    )
    return e.json(400, {
      success: false,
      error: `Charge not found for order_nsu: ${orderNsu || paymentId}`,
    })
  }

  // 3.5 Se o evento for paid/settled: Confirmação OBRIGATÓRIA via POST /payment_check antes de dar baixa!
  let verifiedCaptureMethod = 'pix'
  let confirmedPaid = false
  const nowIso = new Date().toISOString()
  let finalPaidAmount = 0
  let appliedDiscount = 0

  if (requiresConfirmation) {
    const apiKey = readSetting('infinitepay_api_key')
    const handle = readSetting('infinitepay_handle').replace(/^@/, '').replace(/^\$/, '')
    let apiUrl = (
      readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
    ).replace(/\/+$/, '')
    if (apiUrl.includes('api.infinitepay.io/invoices/public/checkout')) {
      apiUrl = 'https://api.checkout.infinitepay.io'
    }

    const checkHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'RCAcquaLife-Academy/1.0',
    }
    if (apiKey) {
      checkHeaders['X-Api-Key'] = apiKey
    }

    const checkPayload = {
      handle: handle,
      order_nsu:
        orderNsu ||
        matchedCharge.getString('order_nsu') ||
        matchedCharge.getString('infinipay_payment_id'),
    }
    if (transactionNsu) checkPayload.transaction_nsu = transactionNsu
    if (invoiceSlug || matchedCharge.getString('invoice_slug')) {
      checkPayload.slug = invoiceSlug || matchedCharge.getString('invoice_slug')
    }

    let checkSuccess = false
    let checkRespJson = null

    try {
      const checkRes = $http.send({
        url: `${apiUrl}/payment_check`,
        method: 'POST',
        headers: checkHeaders,
        body: JSON.stringify(checkPayload),
        timeout: 10,
      })

      if (checkRes.statusCode >= 200 && checkRes.statusCode < 300) {
        try {
          checkRespJson = JSON.parse(checkRes.raw)
        } catch (_) {}

        if (checkRespJson) {
          const isPaid = checkRespJson.paid === true || checkRespJson.status === 'paid'
          const confirmedAmountCents = Number(
            checkRespJson.paid_amount || checkRespJson.amount || 0,
          )
          const expectedAmount = matchedCharge.getFloat('amount') || 0
          const expectedDiscount = matchedCharge.getFloat('discount_amount') || 0
          const expectedAmountCents = Math.round(expectedAmount * 100)
          const expectedDiscountedCents = Math.round(
            Math.max(0, expectedAmount - expectedDiscount) * 100,
          )

          const amountMatches =
            confirmedAmountCents <= 0 ||
            confirmedAmountCents === expectedAmountCents ||
            confirmedAmountCents === expectedDiscountedCents ||
            Math.abs(confirmedAmountCents - expectedAmountCents) <= 50 ||
            Math.abs(confirmedAmountCents - expectedDiscountedCents) <= 50

          if (isPaid && amountMatches) {
            checkSuccess = true
            confirmedPaid = true
            if (checkRespJson.capture_method) {
              verifiedCaptureMethod = String(checkRespJson.capture_method).toLowerCase()
            }
          } else {
            console.log(
              `[Webhook /payment_check] Divergência na confirmação: paid=${isPaid}, amountCents=${confirmedAmountCents}, expected=${expectedAmountCents}/${expectedDiscountedCents}`,
            )
          }
        }
      } else {
        console.log(
          `[Webhook /payment_check] API respondeu HTTP ${checkRes.statusCode}:`,
          checkRes.raw,
        )
      }
    } catch (checkErr) {
      console.log('[Webhook /payment_check] Falha ao chamar endpoint de confirmação:', checkErr)
    }

    if (!checkSuccess) {
      console.log(
        `[Webhook] Confirmação via /payment_check NÃO aprovada para cobrança ${matchedCharge.id}. Cobrança permanece pendente de verificação.`,
      )
      return e.json(400, {
        success: false,
        error:
          'Confirmation via /payment_check failed or unavailable. Charge kept pending verification.',
      })
    }
  }

  // 3.6 Aplicar atualização do status da cobrança e pagamento
  if (targetChargeStatus === 'paga' && confirmedPaid) {
    const chargeNominal = matchedCharge.getFloat('amount') || 0
    const chargeDiscount = matchedCharge.getFloat('discount_amount') || 0
    const dueDateStr = matchedCharge.getString('due_date')

    // Regra: Desconto família de R$ 10,00 por aluno quando pago ATÉ o vencimento
    let isOnTime = true
    if (dueDateStr) {
      const dueDay = new Date(dueDateStr).setHours(23, 59, 59, 999)
      const payDay = new Date().setHours(0, 0, 0, 0)
      isOnTime = payDay <= dueDay
    }

    if (isOnTime && chargeDiscount > 0) {
      appliedDiscount = chargeDiscount
      finalPaidAmount = Math.max(0, chargeNominal - chargeDiscount)
    } else {
      appliedDiscount = 0
      finalPaidAmount = chargeNominal
    }

    // Salvar cobrança como paga
    try {
      matchedCharge.set('status', 'paga')
      matchedCharge.set('amount', finalPaidAmount)
      matchedCharge.set('discount_amount', appliedDiscount)
      if (orderNsu && !matchedCharge.getString('order_nsu')) {
        matchedCharge.set('order_nsu', orderNsu)
      }
      if (invoiceSlug && !matchedCharge.getString('invoice_slug')) {
        matchedCharge.set('invoice_slug', invoiceSlug)
      }
      $app.save(matchedCharge)
    } catch (err) {
      console.log('[Webhook] Erro ao salvar charge como paga:', err)
    }

    // Salvar pagamento como pago
    if (matchedPayment) {
      try {
        matchedPayment.set('status', 'pago')
        matchedPayment.set('amount', finalPaidAmount)
        matchedPayment.set('discount_amount', appliedDiscount)
        matchedPayment.set('paid_date', nowIso)
        if (orderNsu && !matchedPayment.getString('order_nsu')) {
          matchedPayment.set('order_nsu', orderNsu)
        }
        if (invoiceSlug && !matchedPayment.getString('invoice_slug')) {
          matchedPayment.set('invoice_slug', invoiceSlug)
        }
        $app.save(matchedPayment)
      } catch (err) {
        console.log('[Webhook] Erro ao salvar payment como pago:', err)
      }
    }

    // Criar movimentação financeira de receita
    try {
      const chargeId = matchedCharge.id
      const transDesc =
        matchedCharge.getString('description') ||
        `Mensalidade InfinitePay (${orderNsu || paymentId})`

      const existingTrans = $app.findRecordsByFilter(
        'transactions',
        `notes ~ '${chargeId}' || notes ~ '${orderNsu || paymentId}'`,
        '-created',
        1,
        0,
      )

      if (existingTrans.length === 0 && finalPaidAmount > 0) {
        const transCol = $app.findCollectionByNameOrId('transactions')
        const newTrans = new Record(transCol)
        newTrans.set('type', 'receita')
        newTrans.set('description', transDesc)
        newTrans.set('category', 'mensalidade')
        newTrans.set('amount', finalPaidAmount)
        newTrans.set('date', nowIso)

        let mappedMethod = 'pix'
        if (verifiedCaptureMethod.includes('card') || verifiedCaptureMethod.includes('cred')) {
          mappedMethod = 'cartao'
        } else if (verifiedCaptureMethod.includes('bol')) {
          mappedMethod = 'boleto'
        } else if (matchedCharge.getString('payment_method')) {
          mappedMethod = matchedCharge.getString('payment_method')
        }

        newTrans.set('payment_method', mappedMethod)
        newTrans.set('status', 'confirmado')
        newTrans.set(
          'notes',
          `Baixa automática confirmada via InfinitePay (order_nsu: ${orderNsu || paymentId}) - Cobrança #${chargeId}${appliedDiscount > 0 ? ' [Desconto família R$ 10,00 aplicado]' : ''}`,
        )
        $app.save(newTrans)
      }
    } catch (transErr) {
      console.log('[Webhook] Erro ao criar transação financeira:', transErr)
    }
  } else if (targetChargeStatus) {
    try {
      if (normalizedEvent === 'refunded') {
        matchedCharge.set('status', 'cancelada')
        $app.save(matchedCharge)
        if (matchedPayment) {
          matchedPayment.set('status', 'reembolsado')
          $app.save(matchedPayment)
        }
      } else if (normalizedEvent === 'canceled') {
        matchedCharge.set('status', 'cancelada')
        $app.save(matchedCharge)
        if (matchedPayment) {
          matchedPayment.set('status', 'cancelado')
          $app.save(matchedPayment)
        }
      } else if (normalizedEvent === 'payment_failed') {
        console.log(
          `[Webhook] Tentativa de pagamento falhou para cobrança #${matchedCharge.id}. Mantida em aberto.`,
        )
      }
    } catch (updErr) {
      console.log('[Webhook] Erro ao atualizar status não-pago:', updErr)
    }
  }

  // 3.7 Registrar na tabela de idempotência/auditoria `webhook_events`
  try {
    const webhookEventsCol = $app.findCollectionByNameOrId('webhook_events')
    const evtRecord = new Record(webhookEventsCol)
    evtRecord.set('event_key', idempotencyKey)
    evtRecord.set('event_type', normalizedEvent)
    evtRecord.set('order_nsu', orderNsu)
    evtRecord.set('transaction_nsu', transactionNsu)
    evtRecord.set('invoice_slug', invoiceSlug)
    evtRecord.set('charge_id', matchedCharge.id)
    evtRecord.set('status', targetChargeStatus || 'processado')
    evtRecord.set('payload', body)
    $app.save(evtRecord)
  } catch (auditErr) {
    console.log('[Webhook] Erro ao registrar webhook_events:', auditErr)
  }

  return e.json(200, {
    success: true,
    event_type: normalizedEvent,
    order_nsu: orderNsu,
    charge_id: matchedCharge.id,
    charge_status: matchedCharge.getString('status'),
    payment_status: matchedPayment ? matchedPayment.getString('status') : null,
    amount_paid: finalPaidAmount,
    discount_applied: appliedDiscount,
  })
})

// -------------------------------------------------------------
// 4. Endpoint para acionar manualmente ou testar a rotina recorrente
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/recurring-billing/run-now', (e) => {
  const readSetting = (k, fallback = '') => {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        const val = records[0].getString('value')
        return val !== undefined && val !== null ? val.trim() : fallback
      }
    } catch (_) {}
    return fallback
  }

  const setSetting = (k, v) => {
    try {
      const settingsCol = $app.findCollectionByNameOrId('settings')
      let rec = null
      try {
        rec = $app.findFirstRecordByData('settings', 'key', k)
      } catch (_) {}
      if (rec) {
        rec.set('value', String(v))
        $app.save(rec)
      } else {
        const newRec = new Record(settingsCol)
        newRec.set('key', k)
        newRec.set('value', String(v))
        $app.save(newRec)
      }
    } catch (err) {
      console.log(`[Settings] Erro ao salvar setting ${k}:`, err)
    }
  }

  const normalizeGuardian = (name) => {
    if (!name) return ''
    return String(name).trim().replace(/\s+/g, ' ')
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const force = body.force === true

  const isAutomationActive = readSetting('recurring_billing_active', 'false') === 'true'

  if (!isAutomationActive && !force) {
    return e.json(400, {
      success: false,
      message:
        'A geração automática de cobranças está DESLIGADA no sistema. Ative o interruptor nas Configurações ou envie force: true para testar.',
    })
  }

  const daysBefore = parseInt(readSetting('recurring_billing_days_before', '7'), 10) || 7
  const now = new Date()
  const nowIso = now.toISOString()
  const todayStr = nowIso.split('T')[0]
  console.log(
    `[Cobrança Automática Manual] Iniciando rotina (forçado=${force}, ativo=${isAutomationActive}, dias_antes=${daysBefore}, data_base=${todayStr})`,
  )

  // Carregar planos
  const planMap = {}
  try {
    const allPlans = $app.findRecordsByFilter('plans', 'is_active = true', 'name', 100, 0)
    for (const p of allPlans) {
      planMap[p.id] = {
        id: p.id,
        name: p.getString('name') || '',
        price: p.getFloat('monthly_price') || 0,
      }
    }
  } catch (pErr) {
    console.log('[Cobrança Automática] Erro ao carregar planos:', pErr)
  }

  // Carregar alunos ativos
  let activeStudents = []
  try {
    activeStudents = $app.findRecordsByFilter(
      'students',
      "status = 'ativo' && fee_suspended = false",
      'name',
      2000,
      0,
    )
  } catch (stErr) {
    console.log('[Cobrança Automática] Erro ao carregar alunos ativos:', stErr)
    return e.json(500, {
      success: false,
      message: 'Erro ao carregar alunos: ' + String(stErr),
    })
  }

  // Contagem por responsável
  const guardianCount = {}
  for (const st of activeStudents) {
    const gName = normalizeGuardian(st.getString('guardian_name')).toLowerCase()
    if (gName) {
      guardianCount[gName] = (guardianCount[gName] || 0) + 1
    }
  }

  let processedCount = 0
  let createdCount = 0
  let skippedIsentoCount = 0
  let alreadyIssuedCount = 0
  const errorDetails = []

  const targetDate = new Date(now)
  targetDate.setDate(targetDate.getDate() + daysBefore)
  const targetDueDay = targetDate.getDate()
  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth()

  const targetDueDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDueDay).padStart(2, '0')}`
  const cyclePeriodStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`

  const apiKey = readSetting('infinitepay_api_key')
  const handle = readSetting('infinitepay_handle').replace(/^@/, '').replace(/^\$/, '')
  let apiUrl = (
    readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
  ).replace(/\/+$/, '')
  if (apiUrl.includes('api.infinitepay.io/invoices/public/checkout')) {
    apiUrl = 'https://api.checkout.infinitepay.io'
  }

  const pbUrl = $os.getenv('PB_INSTANCE_URL') || readSetting('site_url') || ''
  const webhookUrl = pbUrl ? `${pbUrl.replace(/\/+$/, '')}/backend/v1/infinitepay/webhook` : ''

  for (const st of activeStudents) {
    const studentId = st.id
    const studentName = st.getString('name') || 'Aluno'
    const dueDay = st.getInt('due_day') || 0
    const planId = st.getString('plan_id') || ''
    const plan = planMap[planId] || null
    const situation = (st.getString('situation') || '').toLowerCase()

    const isIsento =
      situation === 'isento' ||
      (plan && (plan.price === 0 || plan.name.toLowerCase().includes('isento'))) ||
      (st.getFloat('monthly_fee') === 0 && plan && plan.price === 0)

    if (isIsento) {
      skippedIsentoCount++
      continue
    }

    if (dueDay <= 0) {
      continue
    }

    if (dueDay !== targetDueDay) {
      continue
    }

    processedCount++

    // Anti-duplicação
    try {
      const existingCharges = $app.findRecordsByFilter(
        'charges',
        `student_id = '${studentId}' && due_date ~ '${cyclePeriodStr}' && status != 'cancelada'`,
        '-created',
        1,
        0,
      )

      if (existingCharges && existingCharges.length > 0) {
        alreadyIssuedCount++
        console.log(
          `[Cobrança Automática] Aluno ${studentName} (#${studentId}) já possui cobrança para o ciclo ${cyclePeriodStr}. Pulando duplicação.`,
        )
        continue
      }
    } catch (dupErr) {
      console.log(`[Cobrança Automática] Erro ao checar duplicação para ${studentName}:`, dupErr)
    }

    // Regras de valor e família
    const guardianName = normalizeGuardian(st.getString('guardian_name')).toLowerCase()
    const isFamilyMember =
      (guardianName && guardianCount[guardianName] > 1) ||
      (plan && plan.name.toLowerCase().includes('fam')) ||
      st.getFloat('monthly_fee') === 100

    let baseAmount = st.getFloat('monthly_fee')
    if (!baseAmount || baseAmount <= 0) {
      if (plan && plan.price > 0) {
        baseAmount = plan.price
      } else if (isFamilyMember) {
        baseAmount = 100
      } else {
        baseAmount = 110
      }
    }

    const discountAmount = isFamilyMember ? 10 : 0
    const planLabel = plan ? plan.name : isFamilyMember ? 'Plano Família' : 'Plano Integral'
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    const description = `Mensalidade ${monthNames[targetMonth]}/${targetYear} — ${planLabel}`
    const deterministicOrderNsu = `rc_rec_${studentId.substring(0, 5)}_${targetYear}${String(targetMonth + 1).padStart(2, '0')}_${dueDay}`

    // Chamada à InfinitePay
    let paymentLink = ''
    let invoiceSlug = ''
    let infinitepayPaymentId = deterministicOrderNsu

    if (apiKey || handle) {
      const priceCents = Math.round(baseAmount * 100)
      const customerPayload = { name: studentName }
      const sEmail = st.getString('email') || st.getString('guardian_email')
      if (sEmail) customerPayload.email = sEmail
      const sPhone =
        st.getString('phone') || st.getString('whatsapp') || st.getString('guardian_phone')
      if (sPhone) {
        const cleanPhone = sPhone.replace(/\D/g, '')
        customerPayload.phone_number = cleanPhone.startsWith('55')
          ? '+' + cleanPhone
          : '+55' + cleanPhone
      }

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'RCAcquaLife-Academy/1.0',
      }
      if (apiKey) headers['X-Api-Key'] = apiKey

      const payload = {
        order_nsu: deterministicOrderNsu,
        items: [{ quantity: 1, price: priceCents, description: description }],
        customer: customerPayload,
      }
      if (handle) payload.handle = handle
      if (webhookUrl) payload.webhook_url = webhookUrl

      try {
        const res = $http.send({
          url: `${apiUrl}/links`,
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
          timeout: 15,
        })
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let respData = null
          try {
            respData = JSON.parse(res.raw)
          } catch (_) {}
          if (respData) {
            paymentLink = respData.url || respData.link || respData.checkout_url || ''
            invoiceSlug = respData.invoice_slug || respData.slug || ''
            infinitepayPaymentId = invoiceSlug || respData.order_nsu || deterministicOrderNsu
          }
        }
      } catch (genErr) {
        console.log(`[Cobrança Automática] Erro API para ${studentName}:`, genErr)
      }
    }

    if (!paymentLink) {
      paymentLink = `https://pay.infinitepay.io/link/${infinitepayPaymentId}`
    }

    // Salvar cobrança
    try {
      const chargesCol = $app.findCollectionByNameOrId('charges')
      const chargeRecord = new Record(chargesCol)
      chargeRecord.set('student_id', studentId)
      chargeRecord.set('description', description)
      chargeRecord.set('amount', baseAmount)
      chargeRecord.set('discount_amount', discountAmount)
      chargeRecord.set('due_date', `${targetDueDateStr} 00:00:00.000Z`)
      chargeRecord.set('status', 'em_aberto')
      chargeRecord.set('payment_method', 'pix')
      chargeRecord.set('infinipay_payment_id', infinitepayPaymentId)
      chargeRecord.set('payment_link', paymentLink)
      chargeRecord.set('order_nsu', deterministicOrderNsu)
      if (invoiceSlug) chargeRecord.set('invoice_slug', invoiceSlug)
      $app.save(chargeRecord)

      const paymentsCol = $app.findCollectionByNameOrId('payments')
      const paymentRecord = new Record(paymentsCol)
      paymentRecord.set('student_id', studentId)
      paymentRecord.set('charge_id', chargeRecord.id)
      paymentRecord.set('amount', baseAmount)
      paymentRecord.set('discount_amount', discountAmount)
      paymentRecord.set('due_date', `${targetDueDateStr} 00:00:00.000Z`)
      paymentRecord.set('status', 'pendente')
      paymentRecord.set('payment_method', 'pix')
      paymentRecord.set('payment_link', paymentLink)
      paymentRecord.set('infinipay_transaction_id', infinitepayPaymentId)
      paymentRecord.set('order_nsu', deterministicOrderNsu)
      if (invoiceSlug) paymentRecord.set('invoice_slug', invoiceSlug)
      $app.save(paymentRecord)

      createdCount++
      console.log(
        `[Cobrança Automática] Emitida para ${studentName}: R$ ${baseAmount}, vencimento ${targetDueDateStr}`,
      )
    } catch (saveErr) {
      console.log(`[Cobrança Automática] Erro ao salvar para ${studentName}:`, saveErr)
      errorDetails.push({ studentId, studentName, error: String(saveErr) })
    }
  }

  const summary = `Executado em ${nowIso}: ${processedCount} alunos aptos com vencimento em ${targetDueDateStr}, ${createdCount} cobranças emitidas, ${alreadyIssuedCount} já existentes, ${skippedIsentoCount} isentos, ${errorDetails.length} erros.`
  console.log(`[Cobrança Automática] Resumo: ${summary}`)

  setSetting('recurring_billing_last_run', nowIso)
  setSetting('recurring_billing_last_status', summary)

  return e.json(200, {
    success: true,
    summary,
    targetDueDate: targetDueDateStr,
    processedCount,
    createdCount,
    alreadyIssuedCount,
    skippedIsentoCount,
    errors: errorDetails,
  })
})

// -------------------------------------------------------------
// 5. Registro do Agendamento Diário (cronAdd)
// Roda todos os dias às 06:00 da manhã (horário do servidor)
// -------------------------------------------------------------
cronAdd('daily_recurring_billing', '0 6 * * *', () => {
  const readSetting = (k, fallback = '') => {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        const val = records[0].getString('value')
        return val !== undefined && val !== null ? val.trim() : fallback
      }
    } catch (_) {}
    return fallback
  }

  const setSetting = (k, v) => {
    try {
      const settingsCol = $app.findCollectionByNameOrId('settings')
      let rec = null
      try {
        rec = $app.findFirstRecordByData('settings', 'key', k)
      } catch (_) {}
      if (rec) {
        rec.set('value', String(v))
        $app.save(rec)
      } else {
        const newRec = new Record(settingsCol)
        newRec.set('key', k)
        newRec.set('value', String(v))
        $app.save(newRec)
      }
    } catch (err) {
      console.log(`[Settings] Erro ao salvar setting ${k}:`, err)
    }
  }

  const normalizeGuardian = (name) => {
    if (!name) return ''
    return String(name).trim().replace(/\s+/g, ' ')
  }

  const isAutomationActive = readSetting('recurring_billing_active', 'false') === 'true'

  // SE DESLIGADO, NÃO EMITIR COBRANÇA ALGUMA
  if (!isAutomationActive) {
    console.log(
      '[Cron] daily_recurring_billing ignorado: interruptor mestre está DESLIGADO nas Configurações.',
    )
    return
  }

  const daysBefore = parseInt(readSetting('recurring_billing_days_before', '7'), 10) || 7
  const now = new Date()
  const nowIso = now.toISOString()
  console.log(`[Cron] daily_recurring_billing executando: dias_antes=${daysBefore}, hora=${nowIso}`)

  const planMap = {}
  try {
    const allPlans = $app.findRecordsByFilter('plans', 'is_active = true', 'name', 100, 0)
    for (const p of allPlans) {
      planMap[p.id] = {
        id: p.id,
        name: p.getString('name') || '',
        price: p.getFloat('monthly_price') || 0,
      }
    }
  } catch (pErr) {
    console.log('[Cron] Erro ao carregar planos:', pErr)
  }

  let activeStudents = []
  try {
    activeStudents = $app.findRecordsByFilter(
      'students',
      "status = 'ativo' && fee_suspended = false",
      'name',
      2000,
      0,
    )
  } catch (stErr) {
    console.log('[Cron] Erro ao carregar alunos ativos:', stErr)
    return
  }

  const guardianCount = {}
  for (const st of activeStudents) {
    const gName = normalizeGuardian(st.getString('guardian_name')).toLowerCase()
    if (gName) {
      guardianCount[gName] = (guardianCount[gName] || 0) + 1
    }
  }

  let processedCount = 0
  let createdCount = 0
  let skippedIsentoCount = 0
  let alreadyIssuedCount = 0
  const errorDetails = []

  const targetDate = new Date(now)
  targetDate.setDate(targetDate.getDate() + daysBefore)
  const targetDueDay = targetDate.getDate()
  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth()

  const targetDueDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDueDay).padStart(2, '0')}`
  const cyclePeriodStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`

  const apiKey = readSetting('infinitepay_api_key')
  const handle = readSetting('infinitepay_handle').replace(/^@/, '').replace(/^\$/, '')
  let apiUrl = (
    readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
  ).replace(/\/+$/, '')
  if (apiUrl.includes('api.infinitepay.io/invoices/public/checkout')) {
    apiUrl = 'https://api.checkout.infinitepay.io'
  }

  const pbUrl = $os.getenv('PB_INSTANCE_URL') || readSetting('site_url') || ''
  const webhookUrl = pbUrl ? `${pbUrl.replace(/\/+$/, '')}/backend/v1/infinitepay/webhook` : ''

  for (const st of activeStudents) {
    const studentId = st.id
    const studentName = st.getString('name') || 'Aluno'
    const dueDay = st.getInt('due_day') || 0
    const planId = st.getString('plan_id') || ''
    const plan = planMap[planId] || null
    const situation = (st.getString('situation') || '').toLowerCase()

    const isIsento =
      situation === 'isento' ||
      (plan && (plan.price === 0 || plan.name.toLowerCase().includes('isento'))) ||
      (st.getFloat('monthly_fee') === 0 && plan && plan.price === 0)

    if (isIsento) {
      skippedIsentoCount++
      continue
    }

    if (dueDay <= 0) {
      continue
    }

    if (dueDay !== targetDueDay) {
      continue
    }

    processedCount++

    // Anti-duplicação
    try {
      const existingCharges = $app.findRecordsByFilter(
        'charges',
        `student_id = '${studentId}' && due_date ~ '${cyclePeriodStr}' && status != 'cancelada'`,
        '-created',
        1,
        0,
      )

      if (existingCharges && existingCharges.length > 0) {
        alreadyIssuedCount++
        continue
      }
    } catch (_) {}

    const guardianName = normalizeGuardian(st.getString('guardian_name')).toLowerCase()
    const isFamilyMember =
      (guardianName && guardianCount[guardianName] > 1) ||
      (plan && plan.name.toLowerCase().includes('fam')) ||
      st.getFloat('monthly_fee') === 100

    let baseAmount = st.getFloat('monthly_fee')
    if (!baseAmount || baseAmount <= 0) {
      if (plan && plan.price > 0) {
        baseAmount = plan.price
      } else if (isFamilyMember) {
        baseAmount = 100
      } else {
        baseAmount = 110
      }
    }

    const discountAmount = isFamilyMember ? 10 : 0
    const planLabel = plan ? plan.name : isFamilyMember ? 'Plano Família' : 'Plano Integral'
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    const description = `Mensalidade ${monthNames[targetMonth]}/${targetYear} — ${planLabel}`
    const deterministicOrderNsu = `rc_rec_${studentId.substring(0, 5)}_${targetYear}${String(targetMonth + 1).padStart(2, '0')}_${dueDay}`

    let paymentLink = ''
    let invoiceSlug = ''
    let infinitepayPaymentId = deterministicOrderNsu

    if (apiKey || handle) {
      const priceCents = Math.round(baseAmount * 100)
      const customerPayload = { name: studentName }
      const sEmail = st.getString('email') || st.getString('guardian_email')
      if (sEmail) customerPayload.email = sEmail
      const sPhone =
        st.getString('phone') || st.getString('whatsapp') || st.getString('guardian_phone')
      if (sPhone) {
        const cleanPhone = sPhone.replace(/\D/g, '')
        customerPayload.phone_number = cleanPhone.startsWith('55')
          ? '+' + cleanPhone
          : '+55' + cleanPhone
      }

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'RCAcquaLife-Academy/1.0',
      }
      if (apiKey) headers['X-Api-Key'] = apiKey

      const payload = {
        order_nsu: deterministicOrderNsu,
        items: [{ quantity: 1, price: priceCents, description: description }],
        customer: customerPayload,
      }
      if (handle) payload.handle = handle
      if (webhookUrl) payload.webhook_url = webhookUrl

      try {
        const res = $http.send({
          url: `${apiUrl}/links`,
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
          timeout: 15,
        })
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let respData = null
          try {
            respData = JSON.parse(res.raw)
          } catch (_) {}
          if (respData) {
            paymentLink = respData.url || respData.link || respData.checkout_url || ''
            invoiceSlug = respData.invoice_slug || respData.slug || ''
            infinitepayPaymentId = invoiceSlug || respData.order_nsu || deterministicOrderNsu
          }
        }
      } catch (genErr) {
        console.log(`[Cron] Erro API para ${studentName}:`, genErr)
      }
    }

    if (!paymentLink) {
      paymentLink = `https://pay.infinitepay.io/link/${infinitepayPaymentId}`
    }

    try {
      const chargesCol = $app.findCollectionByNameOrId('charges')
      const chargeRecord = new Record(chargesCol)
      chargeRecord.set('student_id', studentId)
      chargeRecord.set('description', description)
      chargeRecord.set('amount', baseAmount)
      chargeRecord.set('discount_amount', discountAmount)
      chargeRecord.set('due_date', `${targetDueDateStr} 00:00:00.000Z`)
      chargeRecord.set('status', 'em_aberto')
      chargeRecord.set('payment_method', 'pix')
      chargeRecord.set('infinipay_payment_id', infinitepayPaymentId)
      chargeRecord.set('payment_link', paymentLink)
      chargeRecord.set('order_nsu', deterministicOrderNsu)
      if (invoiceSlug) chargeRecord.set('invoice_slug', invoiceSlug)
      $app.save(chargeRecord)

      const paymentsCol = $app.findCollectionByNameOrId('payments')
      const paymentRecord = new Record(paymentsCol)
      paymentRecord.set('student_id', studentId)
      paymentRecord.set('charge_id', chargeRecord.id)
      paymentRecord.set('amount', baseAmount)
      paymentRecord.set('discount_amount', discountAmount)
      paymentRecord.set('due_date', `${targetDueDateStr} 00:00:00.000Z`)
      paymentRecord.set('status', 'pendente')
      paymentRecord.set('payment_method', 'pix')
      paymentRecord.set('payment_link', paymentLink)
      paymentRecord.set('infinipay_transaction_id', infinitepayPaymentId)
      paymentRecord.set('order_nsu', deterministicOrderNsu)
      if (invoiceSlug) paymentRecord.set('invoice_slug', invoiceSlug)
      $app.save(paymentRecord)

      createdCount++
      console.log(
        `[Cron] Emitida para ${studentName}: R$ ${baseAmount}, vencimento ${targetDueDateStr}`,
      )
    } catch (saveErr) {
      console.log(`[Cron] Erro ao salvar para ${studentName}:`, saveErr)
      errorDetails.push({ studentId, studentName, error: String(saveErr) })
    }
  }

  const summary = `Cron executado em ${nowIso}: ${processedCount} alunos aptos com vencimento em ${targetDueDateStr}, ${createdCount} cobranças emitidas, ${alreadyIssuedCount} já existentes, ${skippedIsentoCount} isentos, ${errorDetails.length} erros.`
  console.log(`[Cron] Resumo: ${summary}`)

  setSetting('recurring_billing_last_run', nowIso)
  setSetting('recurring_billing_last_status', summary)
})

// -------------------------------------------------------------
// 6. Cancel Charge Route
// POST /backend/v1/charges/{id}/cancel
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/charges/{id}/cancel', (e) => {
  const readSetting = (k, fallback = '') => {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        const val = records[0].getString('value')
        return val !== undefined && val !== null ? val.trim() : fallback
      }
    } catch (_) {}
    return fallback
  }

  const info = e.requestInfo()

  // Validação de autenticação (PocketBase: info.auth existe no requestInfo)
  if (!info.auth && !info.hasSuperuserAuth) {
    return e.json(401, {
      success: false,
      message: 'Não autorizado. Faça login para cancelar cobranças.',
    })
  }

  const chargeId = String(e.request.pathValue('id') || '').trim()
  if (!chargeId) {
    return e.json(400, {
      success: false,
      message: 'ID da cobrança é obrigatório.',
    })
  }

  let charge = null
  try {
    charge = $app.findRecordById('charges', chargeId)
  } catch (err) {
    return e.json(404, {
      success: false,
      message: 'Cobrança não encontrada no sistema.',
    })
  }

  const currentStatus = charge.getString('status') || 'em_aberto'

  // Proteção 1: Só aceita cancelar cobranças em status "em_aberto"
  if (currentStatus !== 'em_aberto') {
    if (currentStatus === 'paga') {
      return e.json(400, {
        success: false,
        message:
          'Não é possível cancelar uma cobrança já paga ou liquidada. Se necessário, utilize o estorno.',
      })
    }
    if (currentStatus === 'cancelada') {
      return e.json(400, {
        success: false,
        message: 'Esta cobrança já se encontra cancelada no sistema.',
      })
    }
    return e.json(400, {
      success: false,
      message: `Apenas cobranças em aberto podem ser canceladas (status atual: ${currentStatus}).`,
    })
  }

  const orderNsu = charge.getString('order_nsu') || ''
  const invoiceSlug = charge.getString('invoice_slug') || ''
  const infinipayPaymentId = charge.getString('infinipay_payment_id') || ''

  const apiKey = readSetting('infinitepay_api_key')
  const handle = readSetting('infinitepay_handle').replace(/^@/, '').replace(/^\$/, '')
  let apiUrl = (
    readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
  ).replace(/\/+$/, '')
  if (apiUrl.includes('api.infinitepay.io/invoices/public/checkout')) {
    apiUrl = 'https://api.checkout.infinitepay.io'
  }

  // Verifica se a cobrança possui integração ativa na InfinitePay
  const hasActiveIntegration = (orderNsu || invoiceSlug) && (apiKey || handle)

  if (hasActiveIntegration) {
    // Primeiro tenta chamar a API da InfinitePay para desativar/cancelar o link
    let apiSuccess = false
    let lastErrorMsg = ''
    let receivedStatusCode = 0

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'RCAcquaLife-Academy/1.0',
    }
    if (apiKey) {
      headers['X-Api-Key'] = apiKey
    }

    const cancelPayload = {
      handle: handle,
      order_nsu: orderNsu || infinipayPaymentId,
    }
    if (invoiceSlug) {
      cancelPayload.slug = invoiceSlug
      cancelPayload.invoice_slug = invoiceSlug
    }

    const targetIdentifier = invoiceSlug || orderNsu || infinipayPaymentId

    // Tentativa 1: POST {apiUrl}/links/{id}/cancel
    try {
      const res1 = $http.send({
        url: `${apiUrl}/links/${targetIdentifier}/cancel`,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(cancelPayload),
        timeout: 10,
      })
      receivedStatusCode = res1.statusCode
      if (res1.statusCode >= 200 && res1.statusCode < 300) {
        apiSuccess = true
      } else if (res1.statusCode !== 404 && res1.statusCode !== 405) {
        let errJson = null
        try {
          errJson = JSON.parse(res1.raw)
        } catch (_) {}
        lastErrorMsg = (errJson && (errJson.message || errJson.error)) || res1.raw
      }
    } catch (e1) {
      lastErrorMsg = e1.message || String(e1)
    }

    // Tentativa 2: Se não funcionou, tenta DELETE {apiUrl}/links/{id}
    if (
      !apiSuccess &&
      (receivedStatusCode === 404 || receivedStatusCode === 405 || !receivedStatusCode)
    ) {
      try {
        const res2 = $http.send({
          url: `${apiUrl}/links/${targetIdentifier}`,
          method: 'DELETE',
          headers: headers,
          body: JSON.stringify(cancelPayload),
          timeout: 10,
        })
        receivedStatusCode = res2.statusCode
        if (res2.statusCode >= 200 && res2.statusCode < 300) {
          apiSuccess = true
        } else if (res2.statusCode !== 404 && res2.statusCode !== 405) {
          let errJson = null
          try {
            errJson = JSON.parse(res2.raw)
          } catch (_) {}
          lastErrorMsg = (errJson && (errJson.message || errJson.error)) || res2.raw
        }
      } catch (e2) {
        lastErrorMsg = e2.message || String(e2)
      }
    }

    // Tentativa 3: Se a rota de links não existir na API (retornou 404 em ambas),
    // a API pública da InfinitePay trabalha com links sem expiração ativa e cancela apenas via dashboard/webhook.
    // Mas se retornou 401, 403, 422, 500, trata como falha real.
    const isEndpointUnsupported = receivedStatusCode === 404 || receivedStatusCode === 405
    if (!apiSuccess && !isEndpointUnsupported) {
      console.log(
        `[Cancel Charge] Falha ao cancelar link na InfinitePay (${receivedStatusCode}): ${lastErrorMsg}`,
      )
      return e.json(502, {
        success: false,
        message: `Falha ao cancelar cobrança na InfinitePay (${receivedStatusCode || 'erro de rede'}): ${lastErrorMsg || 'Serviço indisponível'}. A cobrança não foi cancelada localmente para manter a consistência.`,
      })
    }
  }

  // Atualização atômica local: charges.status = 'cancelada' e payment vinculado = 'cancelado'
  let linkedPayment = null
  try {
    $app.runInTransaction((txApp) => {
      charge.set('status', 'cancelada')
      txApp.save(charge)

      // Buscar payment vinculado por charge_id
      try {
        const pmts = txApp.findRecordsByFilter(
          'payments',
          `charge_id = '${charge.id}'`,
          '-created',
          1,
          0,
        )
        if (pmts && pmts.length > 0) {
          linkedPayment = pmts[0]
          linkedPayment.set('status', 'cancelado')
          txApp.save(linkedPayment)
        }
      } catch (pErr) {
        console.log('[Cancel Charge] Aviso ao buscar payment vinculado:', pErr)
      }
    })
  } catch (dbErr) {
    console.log('[Cancel Charge] Erro ao persistir cancelamento no banco:', dbErr)
    return e.json(500, {
      success: false,
      message: 'Erro ao atualizar cobrança no banco de dados: ' + (dbErr.message || String(dbErr)),
    })
  }

  return e.json(200, {
    success: true,
    message: 'Cobrança cancelada com sucesso.',
    charge_id: charge.id,
    order_nsu: orderNsu,
    status: 'cancelada',
    payment_status: linkedPayment ? 'cancelado' : null,
  })
})
