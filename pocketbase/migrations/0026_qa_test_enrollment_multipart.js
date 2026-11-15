/// RC Acqua Life — QA: prova de que `enrollment_requests` aceita MÚLTIPLAS
/// atividades (SELECT múltiplo) e MÚLTIPLAS turmas pretendidas (RELATION
/// múltipla) após a migration 0024.
///
/// Cria o registro de teste via `$app.save()` — que passa pela MESMA validação
/// de campos da collection (maxSelect, required, valores de select) que recusava
/// o POST do formulário antes da migration. Sem chamada HTTP própria: dentro do
/// processo do PocketBase a auto-chamada REST é bloqueada (timeout de loopback),
/// então esta é a prova válida do esquema. O registro fica com student_name
/// "TESTE QA (excluir)" — a usuária apaga manualmente. Idempotente.

migrate(
  (app) => {
    const TAG = '[QA matricula 0026]'
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
      throw new Error(TAG + ' menos de 2 turmas na collection classes — teste não roda')
    }
    const classIdA = classes[0].id
    const classIdB = classes[1].id
    console.log(TAG, 'turmas de teste:', classIdA, classIdB)

    // Cria o registro com MÚLTIPLAS atividades e MÚLTIPLAS turmas.
    // app.save() roda a validação da collection (era aqui que o POST quebrava).
    // $filesystem não está definido dentro de migrations (bug do JSVM, issue
    // pocketbase#7125): para a prova, o campo photo_file obrigatório recebe o
    // nome de um arquivo já existente no storage de enrollment_requests.
    // A prova do multi-select não depende da foto — só dos campos lista.
    const existingPhoto = app.findRecordsByFilter(
      'enrollment_requests',
      'photo_file != ""',
      '-created',
      1,
      0,
    )
    const photoName =
      existingPhoto && existingPhoto.length > 0 ? existingPhoto[0].getString('photo_file') : ''

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
    record.set('photo_file', photoName)
    app.save(record)
    console.log(TAG, 'PROVA OK: create com múltiplas atividades e turmas gravou — id', record.id)
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
