migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    if (!students.fields.getByName('photo_file')) {
      students.fields.add(
        new FileField({
          name: 'photo_file',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        }),
      )
      app.save(students)
    }
  },
  (app) => {
    try {
      const students = app.findCollectionByNameOrId('students')
      if (students.fields.getByName('photo_file')) {
        students.fields.removeByName('photo_file')
        app.save(students)
      }
    } catch (_) {}
  },
)
