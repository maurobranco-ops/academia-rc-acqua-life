/// <reference path="../pb_data/types.d.ts" />
// Rotas do SERVIDOR para o "Link de atualização" do aluno (/atualizar/TOKEN):
//  - POST /backend/v1/students/{id}/update-link  → gera novo token (validade 5 DIAS),
//    invalidando automaticamente os anteriores do aluno (novo token cancela o antigo).
//  - DELETE /backend/v1/students/{id}/update-link → revoga todos os tokens ativos.
//  - GET /backend/v1/update-link/{token}         → valida o token (público, sem auth) e
//    devolve o aluno com SOMENTE os campos editáveis/exibíveis permitidos.
//  - POST /backend/v1/update-link/{token}        → salva os campos permitidos, marca
//    ficha_pendente=true, grava atualizado_pelo_aluno_em e incrementa used_count.
// O token NUNCA é gerado no cliente e a collection student_update_tokens não tem
// nenhuma regra de API — todo acesso passa por aqui (goja: sem optional chaining).

routerAdd('POST', '/backend/v1/students/{id}/update-link', (e) => {
  const studentId = e.request.pathValue('id')
  const info = e.requestInfo()

  // Só usuário autenticado da academia gera/revoga links.
  if (!info.auth || info.auth.id === '') {
    return e.json(401, { success: false, message: 'Autenticação necessária.' })
  }

  let student = null
  try {
    student = e.app.findRecordById('students', studentId)
  } catch (_) {
    return e.json(404, { success: false, message: 'Aluno não encontrado.' })
  }

  const token = generateToken(48)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 5 * 24 * 3600 * 1000)

  // Novo token invalida o anterior: revoga todos os ativos antes de criar o novo.
  try {
    const actives = e.app.findRecordsByFilter(
      'student_update_tokens',
      "student_id = '" + studentId + "' && revoked != true",
      '',
      100,
      0,
    )
    for (let i = 0; i < actives.length; i++) {
      actives[i].set('revoked', true)
      e.app.save(actives[i])
    }
  } catch (err) {
    return e.json(500, { success: false, message: 'Erro ao invalidar links anteriores.' })
  }

  const col = e.app.findCollectionByNameOrId('student_update_tokens')
  const rec = new Record(col)
  rec.set('student_id', studentId)
  rec.set('token', token)
  rec.set('expires_at', isoDateTime(expiresAt))
  rec.set('revoked', false)
  rec.set('used_count', 0)
  try {
    e.app.save(rec)
  } catch (err) {
    return e.json(500, { success: false, message: 'Erro ao gravar o token.' })
  }

  return e.json(200, {
    success: true,
    token: token,
    expires_at: isoDateTime(expiresAt),
  })
})

routerAdd('DELETE', '/backend/v1/students/{id}/update-link', (e) => {
  const studentId = e.request.pathValue('id')
  const info = e.requestInfo()
  if (!info.auth || info.auth.id === '') {
    return e.json(401, { success: false, message: 'Autenticação necessária.' })
  }

  let revokedCount = 0
  try {
    const actives = e.app.findRecordsByFilter(
      'student_update_tokens',
      "student_id = '" + studentId + "' && revoked != true",
      '',
      100,
      0,
    )
    for (let i = 0; i < actives.length; i++) {
      actives[i].set('revoked', true)
      e.app.save(actives[i])
      revokedCount++
    }
  } catch (_) {}

  return e.json(200, { success: true, revoked: revokedCount })
})

routerAdd('GET', '/backend/v1/update-link/{token}', (e) => {
  const token = e.request.pathValue('token')

  const found = findValidToken(e.app, token)
  if (!found) {
    return e.json(404, {
      success: false,
      message: 'Link inválido, expirado ou revogado.',
    })
  }

  let student = null
  try {
    student = e.app.findRecordById('students', found.getString('student_id'))
  } catch (_) {
    return e.json(404, { success: false, message: 'Aluno não encontrado.' })
  }

  return e.json(200, {
    success: true,
    expires_at: found.getString('expires_at'),
    used_count: found.getInt('used_count'),
    student: safeStudentPayload(student),
  })
})

routerAdd('POST', '/backend/v1/update-link/{token}', (e) => {
  const token = e.request.pathValue('token')
  const info = e.requestInfo()
  const body = info.body || {}

  const found = findValidToken(e.app, token)
  if (!found) {
    return e.json(404, { success: false, message: 'Link inválido, expirado ou revogado.' })
  }

  let student = null
  try {
    student = e.app.findRecordById('students', found.getString('student_id'))
  } catch (_) {
    return e.json(404, { success: false, message: 'Aluno não encontrado.' })
  }

  // Campos que o aluno PODE alterar pelo link (whitelist — nada de nome, CPF,
  // nascimento, turmas ou dados financeiros).
  const textFields = [
    'parq_1',
    'parq_2',
    'parq_3',
    'parq_4',
    'parq_5',
    'parq_6',
    'parq_7',
    'parq_5_detail',
    'parq_6_detail',
    'parq_7_detail',
    'anamnese_medo_agua',
    'anamnese_convulsoes',
    'anamnese_alergia_cloro',
    'anamnese_medicamentos',
    'anamnese_objetivo',
    'uso_imagem_autorizado',
    'aptidao_date',
    'aptidao_crm',
    'aptidao_status',
    'dermato_date',
    'dermato_status',
    'cep',
    'street',
    'street_number',
    'complement',
    'neighborhood',
    'city',
    'uf',
    'address',
  ]
  const maxLengths = {
    parq_1: 10,
    parq_2: 10,
    parq_3: 10,
    parq_4: 10,
    parq_5: 10,
    parq_6: 10,
    parq_7: 10,
    parq_5_detail: 1000,
    parq_6_detail: 1000,
    parq_7_detail: 1000,
    anamnese_medo_agua: 10,
    anamnese_convulsoes: 10,
    anamnese_alergia_cloro: 10,
    anamnese_medicamentos: 500,
    anamnese_objetivo: 500,
    uso_imagem_autorizado: 10,
    aptidao_date: 10,
    aptidao_crm: 40,
    aptidao_status: 10,
    dermato_date: 10,
    dermato_status: 10,
    cep: 9,
    street: 255,
    street_number: 20,
    complement: 255,
    neighborhood: 120,
    city: 120,
    uf: 2,
    address: 500,
  }

  let touched = 0
  for (let i = 0; i < textFields.length; i++) {
    const key = textFields[i]
    if (!(key in body)) continue
    let value = body[key]
    if (value === null || value === undefined) value = ''
    value = String(value).substring(0, maxLengths[key] || 255)
    // Campos date/select: só aceita valores válidos (ou vazio para limpar).
    if (endsWith(key, '_date') && value !== '') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) continue
    }
    if (endsWith(key, '_status') && value !== '') {
      if (value !== 'entregue' && value !== 'pendente') continue
    }
    if (key === 'uso_imagem_autorizado' && value !== '') {
      if (value !== 'sim' && value !== 'nao') continue
    }
    if (key === 'uf' && value !== '') {
      value = value.toUpperCase().substring(0, 2)
    }
    student.set(key, value)
    touched++
  }

  if (touched === 0) {
    return e.json(400, { success: false, message: 'Nenhum campo válido para atualizar.' })
  }

  // Marca a ficha como desatualizada (tarja amarela já existente no app) e
  // registra quando o aluno atualizou — mostrado no detalhe do aluno.
  student.set('ficha_pendente', true)
  student.set('atualizado_pelo_aluno_em', isoDateTime(new Date()))

  try {
    e.app.save(student)
  } catch (err) {
    return e.json(400, { success: false, message: 'Erro ao salvar os dados do aluno.' })
  }

  // Token continua válido até expirar — o aluno pode revisar e reenviar.
  const used = found.getInt('used_count') + 1
  found.set('used_count', used)
  try {
    e.app.save(found)
  } catch (_) {}

  return e.json(200, {
    success: true,
    message: 'Dados atualizados com sucesso!',
    atualizado_pelo_aluno_em: student.getString('atualizado_pelo_aluno_em'),
  })
})

// ===== helpers (goja: sem optional chaining) =====

/** Token aleatório forte (48 chars URL-safe) — gerado pelo $security do PocketBase. */
function generateToken(len) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return $security.randomStringWithAlphabet(len, alphabet)
}

/** Só é válido se: existe, não revogado e expires_at no futuro. */
function findValidToken(app, token) {
  try {
    const rows = app.findRecordsByFilter(
      'student_update_tokens',
      "token = '" + token + "' && revoked != true && expires_at > @now",
      '',
      1,
      0,
    )
    if (rows && rows.length > 0) return rows[0]
  } catch (_) {}
  return null
}

/** Payload do aluno com APENAS os campos que o link pode ler (nada financeiro). */
function safeStudentPayload(student) {
  return {
    id: student.getString('id'),
    name: student.getString('name'),
    cpf: student.getString('cpf'),
    birth_date: student.getString('birth_date'),
    // PAR-Q
    parq_1: student.getString('parq_1'),
    parq_2: student.getString('parq_2'),
    parq_3: student.getString('parq_3'),
    parq_4: student.getString('parq_4'),
    parq_5: student.getString('parq_5'),
    parq_6: student.getString('parq_6'),
    parq_7: student.getString('parq_7'),
    parq_5_detail: student.getString('parq_5_detail'),
    parq_6_detail: student.getString('parq_6_detail'),
    parq_7_detail: student.getString('parq_7_detail'),
    // Anamnese aquática
    anamnese_medo_agua: student.getString('anamnese_medo_agua'),
    anamnese_convulsoes: student.getString('anamnese_convulsoes'),
    anamnese_alergia_cloro: student.getString('anamnese_alergia_cloro'),
    anamnese_medicamentos: student.getString('anamnese_medicamentos'),
    anamnese_objetivo: student.getString('anamnese_objetivo'),
    // LGPD — uso de imagem
    uso_imagem_autorizado: student.getString('uso_imagem_autorizado'),
    // Exames obrigatórios
    aptidao_date: student.getString('aptidao_date'),
    aptidao_crm: student.getString('aptidao_crm'),
    aptidao_status: student.getString('aptidao_status'),
    dermato_date: student.getString('dermato_date'),
    dermato_status: student.getString('dermato_status'),
    // Endereço
    cep: student.getString('cep'),
    street: student.getString('street'),
    street_number: student.getString('street_number'),
    complement: student.getString('complement'),
    neighborhood: student.getString('neighborhood'),
    city: student.getString('city'),
    uf: student.getString('uf'),
    address: student.getString('address'),
  }
}

function isoDateTime(d) {
  return d.toISOString().replace('T', ' ').substring(0, 19) + '.000Z'
}

function endsWith(str, suffix) {
  return str.length >= suffix.length && str.substring(str.length - suffix.length) === suffix
}
