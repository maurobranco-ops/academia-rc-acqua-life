/// <reference path="../pb_data/types.d.ts" />
// Migration 0031 — Autocadastro do aluno por link seguro (/atualizar/TOKEN):
//  - nova collection student_update_tokens: token secreto forte gerado no SERVIDOR,
//    relation OBRIGATÓRIA para students, validade de 5 DIAS (expires_at), revogável
//    (revoked) e com contador de usos (used_count — o token continua válido até
//    expirar, para o aluno revisar quantas vezes quiser).
//  - students: atualizado_pelo_aluno_em (date) — registro "Atualizado pelo aluno em …"
//    exibido no detalhe do aluno.
// Idempotente: cada campo/collection só é criado se ainda não existir.
//
// PROVA server-side (padrão da migration 0028): cria aluno de teste, gera token,
// valida expiração/revogação e grava os resultados nos logs com a tag [QA token 0031].

migrate(
  (app) => {
    const TAG = '[QA token 0031]'

    // ===== 1. students.atualizado_pelo_aluno_em =====
    const students = tryFindCollection(app, 'students')
    if (students && !students.fields.getByName('atualizado_pelo_aluno_em')) {
      students.fields.add(new DateField({ name: 'atualizado_pelo_aluno_em' }))
      app.save(students)
    }

    // ===== 2. Collection student_update_tokens =====
    if (!tryFindCollection(app, 'student_update_tokens')) {
      const tokens = new Collection({
        name: 'student_update_tokens',
        type: 'base',
        // NENHUMA regra de API pública: o token só é criado/lido/validado pelas
        // rotas do SERVIDOR (student_update_link.js), nunca pelo cliente.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'student_id',
            type: 'relation',
            required: true,
            collectionId: students.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'token', type: 'text', required: true, max: 64 },
          { name: 'expires_at', type: 'date', required: true },
          { name: 'revoked', type: 'bool' },
          { name: 'used_count', type: 'number' },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_token_unique ON student_update_tokens (token)',
          'CREATE INDEX idx_token_student ON student_update_tokens (student_id)',
        ],
      })
      app.save(tokens)
    }

    // ===== 3. PROVA: gerar token, validar expiração e revogação =====
    let student = null
    const found = app.findRecordsByFilter('students', "name = 'TESTE QA EXCLUSAO'", '', 1, 0)
    if (found && found.length > 0) {
      student = found[0]
    } else {
      const col = app.findCollectionByNameOrId('students')
      student = new Record(col)
      student.set('name', 'TESTE QA TOKEN')
      student.set('cpf', '111.222.333-44')
      student.set('status', 'ativo')
      student.set('situation', 'ativo')
      app.save(student)
      console.log(TAG, 'aluno de teste criado:', student.id)
    }

    const nowDateTime = new Date()
    const inFiveDays = new Date(nowDateTime.getTime() + 5 * 24 * 3600 * 1000)
    const iso = (d) => d.toISOString().replace('T', ' ').substring(0, 19) + '.000Z'

    const tokenCol = app.findCollectionByNameOrId('student_update_tokens')
    const rec = new Record(tokenCol)
    const testToken = 'qa-test-token-' + Math.random().toString(36).slice(2, 18)
    rec.set('student_id', student.id)
    rec.set('token', testToken)
    rec.set('expires_at', iso(inFiveDays))
    rec.set('revoked', false)
    rec.set('used_count', 0)
    app.save(rec)

    // Validações: válido agora; inválido se expirado; inválido se revogado.
    let failures = 0
    const active = findValidToken(app, testToken)
    if (!active) {
      console.error(TAG, 'FALHOU: token recém-criado deveria ser válido.')
      failures++
    }

    const expired = new Record(tokenCol)
    expired.set('student_id', student.id)
    expired.set('token', testToken + '-exp')
    expired.set('expires_at', iso(new Date(nowDateTime.getTime() - 1000)))
    expired.set('revoked', false)
    expired.set('used_count', 0)
    app.save(expired)
    if (findValidToken(app, testToken + '-exp')) {
      console.error(TAG, 'FALHOU: token expirado passou como válido.')
      failures++
    }

    const revoking = findValidToken(app, testToken)
    if (revoking) {
      revoking.set('revoked', true)
      app.save(revoking)
      if (findValidToken(app, testToken)) {
        console.error(TAG, 'FALHOU: token revogado passou como válido.')
        failures++
      }
    }

    if (failures === 0) {
      console.log(TAG, 'OK: criação, validade de 5 dias e revogação de token funcionam.')
    }

    // Limpeza dos registros de teste (a collection fica, os dados de prova vão).
    try {
      const garbage = app.findRecordsByFilter(
        'student_update_tokens',
        "token ~ 'qa-test-token-'",
        '',
        10,
        0,
      )
      for (let i = 0; i < garbage.length; i++) app.delete(garbage[i])
    } catch (_) {}
  },
  (app) => {
    // Down: remove a collection e o campo criados (silencioso quando nada existe).
    try {
      const tokens = app.findCollectionByNameOrId('student_update_tokens')
      app.delete(tokens)
    } catch (_) {}
    try {
      const students = app.findCollectionByNameOrId('students')
      if (students.fields.getByName('atualizado_pelo_aluno_em')) {
        students.fields.removeByName('atualizado_pelo_aluno_em')
        app.save(students)
      }
    } catch (_) {}
  },
)

function tryFindCollection(app, name) {
  try {
    return app.findCollectionByNameOrId(name)
  } catch (_) {
    return null
  }
}

/** Só é válido se: existe, não revogado e expires_at no futuro. */
function findValidToken(app, token) {
  const rows = app.findRecordsByFilter(
    'student_update_tokens',
    "token = '" + token + "' && revoked != true && expires_at > @now",
    '',
    1,
    0,
  )
  return rows && rows.length > 0 ? rows[0] : null
}
