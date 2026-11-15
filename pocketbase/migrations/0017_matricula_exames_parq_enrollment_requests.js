/// <reference path="../pb_data/types.d.ts" />
// Migration 0017 — Matrícula aquática (Lei Estadual PB 9.863/2012):
//  - students: campos dos exames obrigatórios (aptidão + dermatológico, validade 6 meses),
//    PAR-Q (7 perguntas), anamnese aquática e autorização de uso de imagem (LGPD),
//    além do arquivo do RG do responsável (menores).
//  - nova collection enrollment_requests: inscrições enviadas pelo formulário público
//    /matricula (create sem autenticação; leitura/edição só para usuários da academia).
//
// Tudo é idempotente: tryFindCollectionOrName retorna null quando não existe (em vez de
// lançar "sql: no rows in result set"), e cada campo só é adicionado se ainda não existir.
migrate(
  (app) => {
    // ===== 1. Novos campos de matrícula em students =====
    const students = tryFindCollectionOrName(app, 'students')
    if (students) {
      const has = (name) => !!students.fields.getByName(name)

      const ensureText = (name, max) => {
        if (!has(name)) students.fields.add(new TextField({ name, max }))
      }
      const ensureDate = (name) => {
        if (!has(name)) students.fields.add(new DateField({ name }))
      }
      const ensureSelect = (name, values) => {
        if (!has(name)) students.fields.add(new SelectField({ name, values, maxSelect: 1 }))
      }
      const ensureJson = (name) => {
        if (!has(name)) students.fields.add(new JSONField({ name, maxSize: 2000000 }))
      }
      const ensureBool = (name) => {
        if (!has(name)) students.fields.add(new BoolField({ name }))
      }

      // FRENTE 1 — Exames obrigatórios (Lei 9.863/2012-PB, validade de 6 meses)
      ensureDate('aptidao_date')
      ensureText('aptidao_crm', 40)
      ensureSelect('aptidao_status', ['entregue', 'pendente'])
      ensureDate('dermato_date')
      ensureSelect('dermato_status', ['entregue', 'pendente'])

      // FRENTE 2 — PAR-Q (7 perguntas) + anamnese aquática
      for (let i = 1; i <= 7; i++) ensureText('parq_' + i, 10)
      ensureText('anamnese_medo_agua', 10)
      ensureText('anamnese_convulsoes', 10)
      ensureText('anamnese_alergia_cloro', 10)
      ensureText('anamnese_medicamentos', 500)
      ensureText('anamnese_objetivo', 500)

      // FRENTE 4 — Autorização de uso de imagem (LGPD): sim | nao | (vazio = não respondido)
      ensureSelect('uso_imagem_autorizado', ['sim', 'nao'])

      // FRENTE 3 — RG do responsável (comprovação de nome/CPF para menores)
      if (!has('guardian_rg_file')) {
        students.fields.add(
          new FileField({
            name: 'guardian_rg_file',
            maxSelect: 1,
            maxSize: 10485760, // 10MB
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          }),
        )
      }

      app.save(students)
    }

    // ===== 2. Collection enrollment_requests (inscrições públicas) =====
    if (!tryFindCollectionOrName(app, 'enrollment_requests')) {
      const req = new Collection({
        name: 'enrollment_requests',
        type: 'base',
        // Público: apenas criar (formulário on-line sem login, link por WhatsApp).
        // Leitura/edição exclusivas de usuários autenticados da academia (conferência).
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: '',
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'student_name', type: 'text', required: true, max: 160 },
          { name: 'student_birth_date', type: 'date' },
          { name: 'student_cpf', type: 'text', max: 20 },
          { name: 'student_phone', type: 'text', max: 30 },
          { name: 'student_age', type: 'number' },
          { name: 'guardian_name', type: 'text', max: 160 },
          { name: 'guardian_cpf', type: 'text', max: 20 },
          { name: 'guardian_phone', type: 'text', max: 30 },
          {
            name: 'photo_file',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          {
            name: 'guardian_rg_file',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          { name: 'parq_1', type: 'text', max: 10 },
          { name: 'parq_2', type: 'text', max: 10 },
          { name: 'parq_3', type: 'text', max: 10 },
          { name: 'parq_4', type: 'text', max: 10 },
          { name: 'parq_5', type: 'text', max: 10 },
          { name: 'parq_6', type: 'text', max: 10 },
          { name: 'parq_7', type: 'text', max: 10 },
          { name: 'anamnese_medo_agua', type: 'text', max: 10 },
          { name: 'anamnese_convulsoes', type: 'text', max: 10 },
          { name: 'anamnese_alergia_cloro', type: 'text', max: 10 },
          { name: 'anamnese_medicamentos', type: 'text', max: 500 },
          { name: 'anamnese_objetivo', type: 'text', max: 500 },
          { name: 'uso_imagem_autorizado', type: 'text', max: 10 },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'aprovada', 'recusada'],
            maxSelect: 1,
            required: true,
          },
          { name: 'review_notes', type: 'text', max: 1000 },
          { name: 'reviewed_student_id', type: 'text', max: 40 },
        ],
      })
      app.save(req)
    }
  },
  (app) => {
    // Down: remove o que a up criou (silencioso quando nada existe).
    try {
      const students = app.findCollectionByNameOrId('students')
      const names = [
        'aptidao_date',
        'aptidao_crm',
        'aptidao_status',
        'dermato_date',
        'dermato_status',
        'parq_1',
        'parq_2',
        'parq_3',
        'parq_4',
        'parq_5',
        'parq_6',
        'parq_7',
        'anamnese_medo_agua',
        'anamnese_convulsoes',
        'anamnese_alergia_cloro',
        'anamnese_medicamentos',
        'anamnese_objetivo',
        'uso_imagem_autorizado',
        'guardian_rg_file',
      ]
      let dirty = false
      names.forEach((name) => {
        if (students.fields.getByName(name)) {
          students.fields.removeByName(name)
          dirty = true
        }
      })
      if (dirty) app.save(students)
    } catch (_) {}

    try {
      const req = app.findCollectionByNameOrId('enrollment_requests')
      app.delete(req)
    } catch (_) {}
  },
)

/** findCollectionByNameOrId lança erro quando não existe; aqui queremos null. */
function tryFindCollectionOrName(app, name) {
  try {
    return app.findCollectionByNameOrId(name)
  } catch (_) {
    return null
  }
}
