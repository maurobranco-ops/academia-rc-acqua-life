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

/**
 * Erro 404 do PocketBase (ClientResponseError com status 404): em exclusões
 * tolerantes significa que o registro JÁ foi excluído — não é um erro de fato.
 * IMPORTANTE: estes dois exports (isNotFoundError e translateBackendMessage) são
 * importados por src/services/academy.ts — NUNCA removê-los ao editar este arquivo
 * (regressão recorrente de build: MISSING_EXPORT).
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Tradução pt-BR de mensagens cruas do backend/PocketBase para exibição ao usuário.
 * Mensagens desconhecidas passam inalteradas (o chamador já fornece fallback).
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  const raw = message.trim()
  const translations: Array<[RegExp, string]> = [
    [/the requested resource wasn'?t found/i, 'Registro não encontrado.'],
    [/validation not null/i, 'Preencha todos os campos obrigatórios.'],
    [/failed to create record/i, 'Não foi possível salvar o registro.'],
    [/failed to update record/i, 'Não foi possível atualizar o registro.'],
    [/failed to delete record/i, 'Não foi possível excluir o registro.'],
    [/cannot be blank/i, 'Campo obrigatório.'],
    [/value must be unique/i, 'Este valor já está em uso.'],
    [/unauthorized/i, 'Sessão expirada. Faça login novamente.'],
    [/you are not allowed to perform this request/i, 'Você não tem permissão para esta ação.'],
    [/record not found/i, 'Registro não encontrado.'],
    [/invalid credentials/i, 'E-mail ou senha inválidos.'],
  ]
  for (const [pattern, translated] of translations) {
    if (pattern.test(raw)) return translated
  }
  return message
}
