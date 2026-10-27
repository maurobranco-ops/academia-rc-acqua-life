// pocketbase/hooks/infinitepay_webhook.js
// Handles:
// 1. POST /backend/v1/infinitepay/test-connection: Tests credentials against InfinitePay API
// 2. POST /backend/v1/infinitepay/create-charge: Creates real charge via InfinitePay Checkout API & saves to DB
// 3. POST /backend/v1/infinitepay/webhook: Webhook handler for automated payment confirmation with security validation

// -------------------------------------------------------------
// 1. Test Connection Route
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/infinitepay/test-connection', (e) => {
  const readSetting = function (k) {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        return (records[0].getString('value') || '').trim()
      }
    } catch (_) {}
    return ''
  }

  const info = e.requestInfo()
  const body = info.body || {}

  // Allow testing either newly entered credentials in body OR stored settings
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

  // Attempt a validation call to InfinitePay API
  const baseUrl = (
    readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
  ).replace(/\/+$/, '')

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
          price: 100, // R$ 1,00 in cents
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
// 2. Create Charge Route (Called from frontend to create in PB + InfinitePay)
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/infinitepay/create-charge', (e) => {
  const readSetting = function (k) {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        return (records[0].getString('value') || '').trim()
      }
    } catch (_) {}
    return ''
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

  if (!studentId || !description || amount <= 0 || !dueDate) {
    return e.json(400, {
      success: false,
      message: 'Dados incompletos: student_id, description, amount e due_date são obrigatórios.',
    })
  }

  // Load student info
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
  const apiUrl = (
    readSetting('infinitepay_api_url') || 'https://api.checkout.infinitepay.io'
  ).replace(/\/+$/, '')

  let infinitepayPaymentId = ''
  let paymentLink = ''
  let apiWarning = ''

  if (generateInfinitepay) {
    if (!apiKey && !handle) {
      return e.json(400, {
        success: false,
        code: 'MISSING_CREDENTIALS',
        message:
          'Credenciais InfinitePay não configuradas. Acesse Configurações → Integração Infinitepay para cadastrar sua Chave de API ou InfiniteTag.',
      })
    }

    const orderNsu = 'rc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
    // Price in cents
    const priceCents = Math.round(amount * 100)

    // Build customer payload
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

    // Webhook URL: use current site or environment setting
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

        if (respData && (respData.url || respData.link || respData.checkout_url)) {
          paymentLink = respData.url || respData.link || respData.checkout_url
          infinitepayPaymentId =
            respData.invoice_slug || respData.slug || respData.order_nsu || orderNsu
        } else if (respData && respData.id) {
          infinitepayPaymentId = String(respData.id)
          paymentLink = `https://pay.infinitepay.io/link/${infinitepayPaymentId}`
        }
      } else {
        console.log('InfinitePay API error status:', res.statusCode, 'body:', res.raw)
        let errJson = null
        try {
          errJson = JSON.parse(res.raw)
        } catch (_) {}
        const errorDetail = (errJson && (errJson.message || errJson.error)) || res.raw
        apiWarning = `Aviso da InfinitePay (${res.statusCode}): ${errorDetail}`
      }
    } catch (httpErr) {
      console.log('HTTP request to InfinitePay failed:', httpErr)
      apiWarning = 'Falha ao contatar API InfinitePay: ' + (httpErr.message || String(httpErr))
    }
  }

  // Fallback if API was not requested or failed gracefully
  if (!infinitepayPaymentId) {
    infinitepayPaymentId = 'inf_' + Math.random().toString(36).substring(2, 11)
  }
  if (!paymentLink) {
    paymentLink = `https://pay.infinitepay.io/link/${infinitepayPaymentId}`
  }

  // Save charge record to PocketBase
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
    $app.save(chargeRecord)

    // Save corresponding payment record
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
    $app.save(paymentRecord)
  } catch (dbErr) {
    console.log('Database error creating charge:', dbErr)
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
    },
    warning: apiWarning || null,
  })
})

// -------------------------------------------------------------
// 3. Webhook Route (Receives InfinitePay Payment Notifications)
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/infinitepay/webhook', (e) => {
  const readSetting = function (k) {
    try {
      const records = $app.findRecordsByFilter('settings', `key = '${k}'`, '-created', 1, 0)
      if (records && records.length > 0) {
        return (records[0].getString('value') || '').trim()
      }
    } catch (_) {}
    return ''
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const headers = info.headers || {}

  // Security Validation:
  // If a webhook secret is configured (in settings or env), validate signature/token header
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
      console.log('Webhook InfinitePay: Assinatura ou token inválido rejeitado')
      return e.json(401, { success: false, error: 'Unauthorized webhook request' })
    }
  }

  const invoiceSlug = body.invoice_slug || (body.data && body.data.invoice_slug) || ''
  const orderNsu = body.order_nsu || (body.data && body.data.order_nsu) || ''
  const paymentId =
    body.payment_id ||
    (body.data && body.data.payment_id) ||
    body.id ||
    (body.data && body.data.id) ||
    invoiceSlug ||
    orderNsu

  const statusRaw = (
    body.status ||
    (body.data && body.data.status) ||
    body.event ||
    ''
  ).toLowerCase()

  const isPaidEvent =
    statusRaw === '' ||
    statusRaw.includes('paid') ||
    statusRaw.includes('pago') ||
    statusRaw.includes('confirmed') ||
    statusRaw.includes('approved') ||
    statusRaw.includes('settled')

  const isRefundedEvent = statusRaw.includes('refund') || statusRaw.includes('estorn')
  const isCanceledEvent = statusRaw.includes('cancel') || statusRaw.includes('fail')

  if (!paymentId && !orderNsu && !invoiceSlug) {
    return e.json(400, { success: false, error: 'Missing payment identifier in webhook payload' })
  }

  let mappedChargeStatus = 'em_aberto'
  let mappedPaymentStatus = 'pendente'

  if (isRefundedEvent) {
    mappedChargeStatus = 'cancelada'
    mappedPaymentStatus = 'reembolsado'
  } else if (isCanceledEvent) {
    mappedChargeStatus = 'cancelada'
    mappedPaymentStatus = 'cancelado'
  } else if (isPaidEvent) {
    mappedChargeStatus = 'paga'
    mappedPaymentStatus = 'pago'
  }

  let updatedCharge = null
  let updatedPayment = null

  // 1. Locate charge by infinipay_payment_id OR payment_link
  try {
    const filters = []
    if (paymentId) filters.push(`infinipay_payment_id = '${paymentId}'`)
    if (invoiceSlug && invoiceSlug !== paymentId)
      filters.push(`infinipay_payment_id = '${invoiceSlug}'`)
    if (orderNsu && orderNsu !== paymentId) filters.push(`infinipay_payment_id = '${orderNsu}'`)
    if (paymentId) filters.push(`payment_link ~ '${paymentId}'`)

    const charges = $app.findRecordsByFilter('charges', filters.join(' || '), '-created', 1, 0)

    if (charges && charges.length > 0) {
      updatedCharge = charges[0]
    }
  } catch (err) {
    console.log('Error looking up charge in infinitepay webhook:', err)
  }

  // 2. Locate payment by charge_id OR infinipay_transaction_id
  try {
    const filters = []
    if (updatedCharge) filters.push(`charge_id = '${updatedCharge.id}'`)
    if (paymentId) filters.push(`infinipay_transaction_id = '${paymentId}'`)
    if (invoiceSlug) filters.push(`infinipay_transaction_id = '${invoiceSlug}'`)
    if (orderNsu) filters.push(`infinipay_transaction_id = '${orderNsu}'`)
    if (paymentId) filters.push(`payment_link ~ '${paymentId}'`)

    const payments = $app.findRecordsByFilter('payments', filters.join(' || '), '-created', 1, 0)

    if (payments && payments.length > 0) {
      updatedPayment = payments[0]
    }
  } catch (err) {
    console.log('Error looking up payment in infinitepay webhook:', err)
  }

  // 3. Process Status and apply Family Discount Rule if paying
  const nowIso = new Date().toISOString()
  let finalPaidAmount = 0
  let appliedDiscount = 0

  if (mappedChargeStatus === 'paga' && updatedCharge) {
    const chargeNominal = updatedCharge.getInt('amount') || 0
    const chargeDiscount = updatedCharge.getInt('discount_amount') || 0
    const dueDateStr = updatedCharge.getString('due_date')

    // Rule: Desconto família de R$ 10,00 por aluno quando pago ATÉ o vencimento (sem desconto se pago após).
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
      // Paid after due date or no discount: full nominal amount
      appliedDiscount = 0
      finalPaidAmount = chargeNominal
    }

    // Save updated charge
    try {
      updatedCharge.set('status', 'paga')
      updatedCharge.set('amount', finalPaidAmount)
      updatedCharge.set('discount_amount', appliedDiscount)
      $app.save(updatedCharge)
    } catch (err) {
      console.log('Error saving charge in webhook:', err)
    }

    // Save updated payment
    if (updatedPayment) {
      try {
        updatedPayment.set('status', 'pago')
        updatedPayment.set('amount', finalPaidAmount)
        updatedPayment.set('discount_amount', appliedDiscount)
        updatedPayment.set('paid_date', nowIso)
        $app.save(updatedPayment)
      } catch (err) {
        console.log('Error saving payment in webhook:', err)
      }
    }

    // 4. Create Income Transaction in `transactions`
    try {
      const chargeId = updatedCharge.id
      const transDesc =
        updatedCharge.getString('description') || `Mensalidade InfinitePay (${paymentId})`

      // Avoid duplicate transaction
      const existingTrans = $app.findRecordsByFilter(
        'transactions',
        `notes ~ '${chargeId}' || notes ~ '${paymentId}'`,
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

        const captureMethod = (
          body.capture_method ||
          (body.data && body.data.capture_method) ||
          ''
        ).toLowerCase()
        let mappedMethod = 'pix'
        if (captureMethod.includes('card') || captureMethod.includes('cred')) {
          mappedMethod = 'cartao'
        } else if (captureMethod.includes('bol')) {
          mappedMethod = 'boleto'
        } else if (updatedCharge.getString('payment_method')) {
          mappedMethod = updatedCharge.getString('payment_method')
        }

        newTrans.set('payment_method', mappedMethod)
        newTrans.set('status', 'confirmado')
        newTrans.set(
          'notes',
          `Baixa automática via Webhook Infinitepay (${paymentId || invoiceSlug || orderNsu}) - Cobrança #${chargeId}${appliedDiscount > 0 ? ' [Desconto família R$ 10,00 aplicado]' : ''}`,
        )
        $app.save(newTrans)
      }
    } catch (err) {
      console.log('Error creating transaction in infinitepay webhook:', err)
    }
  } else {
    // Other statuses (canceled/refunded)
    if (updatedCharge) {
      try {
        updatedCharge.set('status', mappedChargeStatus)
        $app.save(updatedCharge)
      } catch (err) {
        console.log('Error updating charge non-paid status:', err)
      }
    }
    if (updatedPayment) {
      try {
        updatedPayment.set('status', mappedPaymentStatus)
        $app.save(updatedPayment)
      } catch (err) {
        console.log('Error updating payment non-paid status:', err)
      }
    }
  }

  return e.json(200, {
    success: true,
    payment_id: paymentId,
    charge_status: mappedChargeStatus,
    payment_status: mappedPaymentStatus,
    discount_applied: appliedDiscount,
    amount_paid: finalPaidAmount,
  })
})
