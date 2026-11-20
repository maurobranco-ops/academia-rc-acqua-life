import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * 404 ("The requested resource wasn't found.") não é erro para os fluxos
 * tolerantes do academyService (delete, getOne pós-exclusão): significa que o
 * registro JÁ foi excluído. Qualquer outro status (ou erro não-HTTP) é erro real.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/** Mapa de traduções de mensagens conhecidas do backend (GENERIC). */
const GENERIC: Record<string, string> = {
  "The requested resource wasn't found.": 'Registro não encontrado.',
  'Something went wrong while handling your request.':
    'Algo deu errado ao processar sua solicitação.',
  'An existing collection name was provided.': 'Já existe uma coleção com esse nome.',
}

/** Regras por regex (RULES), avaliadas na ordem — a primeira que casa vence. */
const RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^Failed to convert.*record\.$/, replacement: 'Registro inválido.' },
  {
    pattern: /validation not satisfied/i,
    replacement: 'Validação não satisfeita — verifique os campos do formulário.',
  },
]

/**
 * Traduz mensagens cruas do backend (PocketBase/rotas /backend/v1) para
 * português — a interface nunca mostra mensagem em inglês para o usuário.
 * Mensagem desconhecida volta como veio (sem perder informação).
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  if (GENERIC[message]) return GENERIC[message]
  for (const rule of RULES) {
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
