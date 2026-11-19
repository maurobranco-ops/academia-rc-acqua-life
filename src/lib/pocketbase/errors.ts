// GUARDA (v0.0.86): este arquivo já perdeu exports e quebrou builds 4+ vezes —
// academy.ts importa isNotFoundError e translateBackendMessage na linha 2.
// PRESERVE estes exports ao editar.

import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * True quando o erro é um 404 do PocketBase — "não encontrado" costuma ser
 * resultado desejado (ex.: delete tolerante a disparo duplo).
 */
export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false
  return error.status === 404
}

const BACKEND_MESSAGE_TRANSLATIONS: Array<{ test: RegExp; message: string }> = [
  { test: /Failed to authenticate/i, message: 'Sessão expirada. Faça login novamente.' },
  {
    test: /The request requires valid authentication token/i,
    message: 'Sessão expirada. Faça login novamente.',
  },
  {
    test: /Missing or invalid authorization token/i,
    message: 'Sessão expirada. Faça login novamente.',
  },
  {
    test: /You are not allowed to perform this request/i,
    message: 'Você não tem permissão para esta ação.',
  },
  { test: /The requested resource wasn't found/i, message: 'Registro não encontrado.' },
  { test: /Validation not less than/i, message: 'Valor menor que o mínimo permitido.' },
  { test: /Validation not greater than/i, message: 'Valor maior que o máximo permitido.' },
  { test: /Validation min string constraint/i, message: 'Valor muito curto.' },
  { test: /Validation max string constraint/i, message: 'Valor muito longo.' },
  { test: /Validation required/i, message: 'Campo obrigatório não preenchido.' },
  { test: /Cannot be blank/i, message: 'Campo obrigatório não preenchido.' },
  { test: /must be a valid email/i, message: 'E-mail inválido.' },
  { test: /must be a valid URL/i, message: 'URL inválida.' },
  { test: /value must be unique/i, message: 'Este valor já está cadastrado.' },
  { test: /Failed to create record/i, message: 'Não foi possível salvar o registro.' },
  { test: /Failed to update record/i, message: 'Não foi possível atualizar o registro.' },
]

/**
 * Traduz mensagens cruas do backend PocketBase para português, preservando o
 * texto original quando não há tradução conhecida.
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  for (const { test, message: translated } of BACKEND_MESSAGE_TRANSLATIONS) {
    if (test.test(message)) return translated
  }
  return message
}

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
