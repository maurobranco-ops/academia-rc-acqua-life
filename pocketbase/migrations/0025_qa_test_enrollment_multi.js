/// RC Acqua Life — QA: prova de que `enrollment_requests` aceita MÚLTIPLAS
/// atividades (SELECT múltiplo) e MÚLTIPLAS turmas pretendidas (RELATION
/// múltipla) após a migration 0024.
///
/// Cria 1 registro de teste com student_name "TESTE QA (excluir)" — a usuária
/// apaga manualmente depois pela tela /matriculas ou pelo painel.
/// Idempotente: se o registro já existe, não faz nada. Nunca lança erro
/// (falha de teste é logada, não bloqueia o apply).

migrate(
  (app) => {
    const TAG = '[QA matricula 0025]'
    const NAME = 'TESTE QA (excluir)'

    // Idempotência: já existe? então nada a fazer.
    const already = app.findRecordsByFilter(
      'enrollment_requests',
      "student_name = '" + NAME + "'",
      '',
      1,
      0,
    )
    if (already && already.length > 0) {
      console.log(TAG, 'registro de teste já existe — nada a fazer')
      return
    }

    // 2 turmas reais para preferred_classes
    const classes = app.findRecordsByFilter('classes', '', '-created', 2, 0)
    if (!classes || classes.length < 2) {
      console.error(TAG, 'menos de 2 turmas na collection classes — teste não roda')
      return
    }
    const classIdA = classes[0].id
    const classIdB = classes[1].id
    console.log(TAG, 'turmas de teste:', classIdA, classIdB)

    const tryRestPost = () => {
      const base = $os.getenv('PB_INSTANCE_URL') || ''
      if (!base) throw new Error('PB_INSTANCE_URL não configurado')
      const fd = new FormData()
      fd.append('student_name', NAME)
      fd.append('student_birth_date', '2015-05-10')
      fd.append('student_phone', '(83) 99999-0000')
      fd.append('guardian_name', 'Responsável Teste QA')
      fd.append('guardian_phone', '(83) 98888-0000')
      fd.append('status', 'pendente')
      fd.append('term_agreed', 'sim')
      fd.append('activities', 'natacao')
      fd.append('activities', 'hidroginastica')
      fd.append('preferred_classes', classIdA)
      fd.append('preferred_classes', classIdB)
      fd.append('photo_file', $filesystem.fileFromBytes('foto teste qa', 'teste-qa.jpg'))
      const res = $http.send({
        url: base + '/api/collections/enrollment_requests/records',
        method: 'POST',
        body: fd,
        timeout: 30,
      })
      return { via: 'REST público', status: res.statusCode, body: res.raw }
    }

    const tryDirectSave = () => {
      const collection = app.findCollectionByNameOrId('enrollment_requests')
      const record = new Record(collection)
      record.set('student_name', NAME)
      record.set('student_birth_date', '2015-05-10')
      record.set('student_phone', '(83) 99999-0000')
      record.set('guardian_name', 'Responsável Teste QA')
      record.set('guardian_phone', '(83) 98888-0000')
      record.set('status', 'pendente')
      record.set('term_agreed', 'sim')
      record.set('activities', ['natacao', 'hidroginastica'])
      record.set('preferred_classes', [classIdA, classIdB])
      record.set('photo_file', $filesystem.fileFromBytes('foto teste qa', 'teste-qa.jpg'))
      app.save(record)
      return { via: '$app.save (mesma validação de campos)', status: 200, body: record.id }
    }

    let result = null
    try {
      result = tryRestPost()
    } catch (err) {
      console.error(TAG, 'POST REST falhou:', err)
      try {
        result = tryDirectSave()
      } catch (err2) {
        console.error(TAG, '$app.save também falhou:', err2)
        return
      }
    }

    console.log(TAG, 'resultado:', JSON.stringify(result))
  },
  (app) => {
    // rollback: remove o registro de teste
    const rows = app.findRecordsByFilter(
      'enrollment_requests',
      "student_name = 'TESTE QA (excluir)'",
      '',
      10,
      0,
    )
    for (const r of rows) {
      app.delete(r)
    }
  },
)
