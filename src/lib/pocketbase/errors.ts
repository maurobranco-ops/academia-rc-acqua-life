import { ClientResponseError } from 'pocketbase'

// GUARD (não remover): academy.ts importa isNotFoundError e translateBackendMessage
// na linha 2. Este arquivo já perdeu esses exports várias vezes e derrubou o build.
// Ao editar, preserve TODOS os exports abaixo.

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

/** 404 = "não encontrado" (registro já excluído / inexistente) — não é erro fatal. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz mensagens cruas do PocketBase para pt-BR amigável.
 * Mensagens desconhecidas passam inalteradas.
 */
export function translateBackendMessage(message: string): string {
  const msg = String(message || '')
  if (/failed to create record/i.test(msg)) return 'Não foi possível criar o registro.'
  if (/failed to update record/i.test(msg)) return 'Não foi possível salvar o registro.'
  if (/failed to delete record/i.test(msg)) return 'Não foi possível excluir o registro.'
  if (/requested resource wasn't found|resource wasn't found|not found/i.test(msg))
    return 'Registro não encontrado.'
  if (/requires valid record authorization token|authorization token/i.test(msg))
    return 'Sessão expirada — faça login novamente.'
  if (/only the superuser can perform this action/i.test(msg))
    return 'Ação permitida apenas ao administrador.'
  if (/not allowed to perform this request|insufficient permissions/i.test(msg))
    return 'Você não tem permissão para executar esta ação.'
  if (/cannot be blank|must not be blank|non-empty value/i.test(msg))
    return 'Há campos obrigatórios que não foram preenchidos.'
  if (/value must be|must be a valid|invalid value/i.test(msg))
    return 'Há campos com valores inválidos — confira o preenchimento.'
  if (/something went wrong/i.test(msg)) return 'Algo deu errado. Tente novamente.'
  if (/timeout/i.test(msg)) return 'Tempo esgotado — verifique sua conexão e tente novamente.'
  return msg
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error)).map((m) => translateBackendMessage(m))
  if (msgs.length > 0) return msgs.join(' ')
  return translateBackendMessage(error.message || 'An unexpected error occurred.')
}
