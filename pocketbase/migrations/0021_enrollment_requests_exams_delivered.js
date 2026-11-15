/// <reference path="../pb_data/types.d.ts" />
// Migration 0021 — Formulário público simplificado: os exames deixam de ser
// preenchidos pelo responsável no /matricula (apenas os DOIS exames existem:
// cardiológico e dermatológico) e entram como UMA declaração de entrega.
//  - enrollment_requests: campo exams_delivered ('sim' | 'nao') com a declaração
//    "entreguei os atestados cardiológico e dermatológico".
//  - Os campos cardio_*/dermato_* já existem em students e enrollment_requests
//    (migrations 0017/0020) e continuam servindo para o lançamento do administrador
//    na aprovação da matrícula em /matriculas.
//  Idempotente: o campo só é adicionado se ainda não existir.
migrate(
  (app) => {
    const req = app.findCollectionByNameOrId('enrollment_requests')
    if (!req.fields.getByName('exams_delivered')) {
      req.fields.add(
        new SelectField({ name: 'exams_delivered', values: ['sim', 'nao'], maxSelect: 1 }),
      )
      app.save(req)
    }
  },
  (app) => {
    // Down: remove o campo (silencioso quando não existe).
    try {
      const req = app.findCollectionByNameOrId('enrollment_requests')
      if (req.fields.getByName('exams_delivered')) {
        req.fields.removeByName('exams_delivered')
        app.save(req)
      }
    } catch (_) {}
  },
)
