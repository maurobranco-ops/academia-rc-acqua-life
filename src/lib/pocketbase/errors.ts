import { ClientResponseError } from 'pocketbase'

// GUARD: os exports isNotFoundError e translateBackendMessage deste arquivo são
// importados por src/services/academy.ts (linha 2) e por várias páginas. Builds
// já quebraram 4+ vezes por esse arquivo perder esses exports — NUNCA removê-los.

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

/**
 * Erros de aluno/registro não encontrado (404) são tratados como SUCESSO em
 * fluxos tolerantes (ex.: exclusão dupla, disparo em abas duplicadas).
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz as mensagens cruas do PocketBase para pt-BR. Mensagens desconhecidas
 * passam inalteradas (nunca inventamos significado).
 */
export function translateBackendMessage(message: string): string {
  const m = (message || '').trim()
  const table: Array<[RegExp, string]> = [
    [/cannot be blank|required/i, 'Campo obrigatório não preenchido.'],
    [/the requested resource wasn'?t found/i, 'Registro não encontrado.'],
    [/not found/i, 'Registro não encontrado.'],
    [/value must be unique/i, 'Este valor já está cadastrado para outro registro.'],
    [/validation (not )?null|not a valid/i, 'Valor inválido para um dos campos.'],
    [/failed to authenticate|authorization token/i, 'Sessão expirada — entre novamente.'],
    [/insufficient permissions|you are not allowed/i, 'Você não tem permissão para esta ação.'],
    [/record\s*(create|update|delete)/i, 'Não foi possível salvar o registro.'],
  ]
  for (const [re, translated] of table) {
    if (re.test(m)) return translated
  }
  return m
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) return translateBackendMessage(msgs.join(' '))
  // Mensagem crua do topo da resposta (ex.: "The request is invalid...").
  if (error.response && typeof error.response === 'object') {
    const top = (error.response as { message?: unknown }).message
    if (typeof top === 'string' && top) return translateBackendMessage(top)
  }
  return translateBackendMessage(error.message || 'An unexpected error occurred.')
}
