import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : translateBackendMessage(error.message)
}

/**
 * 404 tolerante: o registro já não existe (exclusão dupla, aba duplicada,
 * disparo concorrente). Não é falha do usuário — significa que o resultado
 * desejado já aconteceu.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz mensagens cruas do PocketBase/servidor para português. Mensagens que
 * já chegam em português (rotas próprias) passam intocadas.
 */
const MESSAGE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/the requested resource wasn'?t found/i, 'Registro não encontrado.'],
  [
    /make sure that the record (?:is|exists)/i,
    'O registro não pôde ser excluído ou atualizado — verifique se ainda existe.',
  ],
  [/failed to delete record/i, 'Falha ao excluir o registro no banco de dados.'],
  [
    /required relation reference/i,
    'Existem registros vinculados a este aluno que impedem a exclusão.',
  ],
  [/cannot be blank/i, 'Campo obrigatório em branco.'],
  [/validation_not_unique/i, 'Este valor já está em uso por outro registro.'],
]

export function translateBackendMessage(message: string | undefined | null): string {
  const raw = String(message || '').trim()
  if (!raw) return 'Ocorreu um erro inesperado. Tente novamente.'
  for (const [pattern, translated] of MESSAGE_TRANSLATIONS) {
    if (pattern.test(raw)) return translated
  }
  return raw
}
