/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('enrollment_requests')
    const field = collection.fields.getByName('guardian_rg_file')
    const mimeTypes = field.mimeTypes || []
    const next = []
    for (let i = 0; i < mimeTypes.length; i++) next.push(mimeTypes[i])
    if (next.indexOf('application/pdf') === -1) next.push('application/pdf')
    field.mimeTypes = next
    field.maxSize = 10485760
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('enrollment_requests')
    const field = collection.fields.getByName('guardian_rg_file')
    field.mimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    field.maxSize = 10485760
    app.save(collection)
  },
)
