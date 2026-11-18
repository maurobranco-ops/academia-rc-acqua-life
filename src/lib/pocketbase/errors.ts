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
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}

/** 404 do PocketBase não é erro na prática: significa que o registro já foi excluído. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz mensagens cruas do PocketBase (inglês) para pt-BR amigável.
 * Mensagens desconhecidas passam inalteradas.
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  const raw = message.toLowerCase()
  if (raw.includes('failed to create record')) {
    return 'Não foi possível salvar o registro. Verifique os campos e tente novamente.'
  }
  if (raw.includes('failed to update record')) {
    return 'Não foi possível atualizar o registro. Tente novamente.'
  }
  if (raw.includes('failed to delete record')) {
    return 'Não foi possível excluir o registro. Tente novamente.'
  }
  if (raw.includes("the requested resource wasn't found") || raw.includes('not found')) {
    return 'Registro não encontrado (talvez já tenha sido excluído).'
  }
  if (raw.includes('failed to authenticate') || raw.includes('invalid login credentials')) {
    return 'Falha de autenticação. Faça login novamente.'
  }
  if (raw.includes('validation')) {
    return 'Dados inválidos. Verifique os campos e tente novamente.'
  }
  return message
}
