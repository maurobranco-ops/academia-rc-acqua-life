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

/* GUARD CRÍTICO: isNotFoundError e translateBackendMessage são importados por
 * src/services/academy.ts na linha 2 — builds quebraram 4+ vezes quando este
 * arquivo foi reescrito sem eles. NÃO remover ao editar este arquivo. */

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false
  if (error.status !== 404) return false
  const msg = (error.response?.message || error.message || '').toLowerCase()
  return (
    msg.includes('wasn') ||
    msg.includes('not found') ||
    msg.includes('não encontrado') ||
    msg.includes('nao encontrado') ||
    msg.includes('não existe')
  )
}

/** Traduz mensagens cruas do PocketBase/Go para português, quando conhecidas. */
const TRANSLATIONS: Array<[RegExp, string]> = [
  [/validation not null constraint/i, 'Há campos obrigatórios não preenchidos.'],
  [/value must be non-empty string/i, 'Há campos obrigatórios não preenchidos.'],
  [
    /the request requires valid record authorization token/i,
    'Sessão expirada — faça login novamente.',
  ],
  [/failed to authenticate/i, 'Falha de autenticação — verifique suas credenciais.'],
  [/you are not allowed to perform this request/i, 'Você não tem permissão para esta ação.'],
  [/the requested resource wasn't found/i, 'Registro não encontrado.'],
  [/validation for (?<field>[\w_]+) requires (?<value>.+)/i, 'Valor inválido para um dos campos.'],
  [/email or password are invalid/i, 'E-mail ou senha inválidos.'],
  [/failed to create record/i, 'Falha ao salvar o registro.'],
  [/failed to update record/i, 'Falha ao atualizar o registro.'],
]

export function translateBackendMessage(message: string): string {
  for (const [pattern, translation] of TRANSLATIONS) {
    if (pattern.test(message)) return translation
  }
  return message
}
