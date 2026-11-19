// GUARD: academy.ts importa isNotFoundError e translateBackendMessage na linha 2 —
// NUNCA remover esses exports deste arquivo (builds já quebraram 4+ vezes por isso).
import { ClientResponseError } from 'pocketbase'

/** true quando o erro é um ClientResponseError com status 404 (registro não encontrado). */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz mensagens cruas do PocketBase para pt-BR (create/update/delete, 404,
 * auth, validação). Mensagens desconhecidas passam inalteradas.
 */
export function translateBackendMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Erro inesperado.'
  }
  const status = error.status
  const fieldMsgs = Object.values(extractFieldErrors(error)).map(translateFieldMessage)
  if (fieldMsgs.length > 0) return fieldMsgs.join(' ')
  if (status === 400)
    return 'Dados inválidos — verifique os campos obrigatórios e os arquivos enviados.'
  if (status === 401 || status === 403)
    return 'Você não tem permissão para esta operação — verifique o login.'
  if (status === 404) return 'Registro não encontrado — ele pode ter sido excluído.'
  if (/failed to create/i.test(error.message)) return 'Não foi possível cadastrar o registro.'
  if (/failed to update/i.test(error.message)) return 'Não foi possível atualizar o registro.'
  if (/failed to delete/i.test(error.message)) return 'Não foi possível excluir o registro.'
  return error.message || 'Erro inesperado.'
}

/** Traduz a mensagem crua de UM campo recusado pelo PocketBase. */
function translateFieldMessage(message: string): string {
  const m = message.toLowerCase()
  if (/cannot be blank|must not be blank|non-empty value|required/.test(m))
    return 'Há campo obrigatório não preenchido.'
  if (/invalid value|must be a valid/.test(m)) return 'Há campo com valor inválido.'
  if (/must be unique|value already exists/.test(m)) return 'Já existe um registro com esse valor.'
  if (/mime type/.test(m)) return 'Arquivo em formato não aceito.'
  if (/less than|size/.test(m)) return 'Arquivo maior que o limite permitido.'
  return message
}

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
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
