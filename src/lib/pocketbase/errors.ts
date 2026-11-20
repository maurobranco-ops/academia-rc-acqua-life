import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * true somente para 404 do PocketBase ("The requested resource wasn't found.") —
 * usado pelo delete tolerante de academy.ts: 404 significa que o registro JÁ foi
 * excluído (disparo duplo, aba duplicada), então o resultado desejado aconteceu.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

const GENERIC_TRANSLATIONS: Record<string, string> = {
  'Failed to authenticate.': 'Falha na autenticação. Faça login novamente.',
  'The request requires valid admin authorization token.': 'Sessão expirada. Faça login novamente.',
  "The requested resource wasn't found.": 'Registro não encontrado.',
}

const RULE_TRANSLATIONS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /validation not satisfied/i,
    replacement: 'Verifique os campos destacados do formulário.',
  },
]

/**
 * Traduz mensagens cruas do PocketBase para português (usado principalmente nas
 * rotas de servidor de exclusão de aluno com histórico, em academy.ts).
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  const generic = GENERIC_TRANSLATIONS[message]
  if (generic) return generic
  for (const rule of RULE_TRANSLATIONS) {
    if (rule.pattern.test(message)) return rule.replacement
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
