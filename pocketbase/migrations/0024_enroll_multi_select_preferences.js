/// <reference path="../pb_data/types.d.ts" />
// Migration 0024 — Correção do formulário público de matrícula (/matricula):
// o campo `activities` foi criado como SELECT de valor ÚNICO e
// `preferred_classes` como RELATION de valor ÚNICO (maxSelect padrão 1), mas o
// formulário permite marcar várias atividades e várias turmas — envios com mais
// de uma eram recusados com 400 "Failed to create record".
// Aqui ambos passam a aceitar múltiplos valores:
//  - activities: SELECT múltiplo (maxSelect: 2) com os MESMOS valores
//    natacao/hidroginastica;
//  - preferred_classes: RELATION múltipla (maxSelect: 10) para a MESMA collection
//    classes e MESMAS regras de cascade (nenhuma, como na criação original).
// Idempotente: só altera quando o campo ainda está em valor único.
migrate(
  (app) => {
    const req = app.findCollectionByNameOrId('enrollment_requests')
    let changed = false

    const activities = req.fields.getByName('activities')
    if (activities) {
      const maxSelect = activities.maxSelect
      if (typeof maxSelect !== 'number' || maxSelect < 2) {
        // PocketBase não permite mudar maxSelect de select de 1 para N com
        // segurança: remove e recria o campo com o mesmo nome e valores.
        req.fields.removeByName('activities')
        req.fields.add(
          new SelectField({
            name: 'activities',
            maxSelect: 2,
            values: ['natacao', 'hidroginastica'],
          }),
        )
        changed = true
      }
    } else {
      req.fields.add(
        new SelectField({
          name: 'activities',
          maxSelect: 2,
          values: ['natacao', 'hidroginastica'],
        }),
      )
      changed = true
    }

    const preferred = req.fields.getByName('preferred_classes')
    if (preferred) {
      const maxSelect = preferred.maxSelect
      if (typeof maxSelect !== 'number' || maxSelect < 2) {
        req.fields.removeByName('preferred_classes')
        req.fields.add(
          new RelationField({
            name: 'preferred_classes',
            collectionId: app.findCollectionByNameOrId('classes').id,
            maxSelect: 10,
          }),
        )
        changed = true
      }
    } else {
      req.fields.add(
        new RelationField({
          name: 'preferred_classes',
          collectionId: app.findCollectionByNameOrId('classes').id,
          maxSelect: 10,
        }),
      )
      changed = true
    }

    if (changed) app.save(req)
  },
  (app) => {
    // Down: volta ambos para valor único.
    try {
      const req = app.findCollectionByNameOrId('enrollment_requests')
      const a = req.fields.getByName('activities')
      if (a) {
        req.fields.removeByName('activities')
        req.fields.add(
          new SelectField({
            name: 'activities',
            maxSelect: 1,
            values: ['natacao', 'hidroginastica'],
          }),
        )
      }
      const p = req.fields.getByName('preferred_classes')
      if (p) {
        req.fields.removeByName('preferred_classes')
        req.fields.add(
          new RelationField({
            name: 'preferred_classes',
            collectionId: app.findCollectionByNameOrId('classes').id,
            maxSelect: 1,
          }),
        )
      }
      app.save(req)
    } catch (_) {}
  },
)
