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

/** TRUE apenas para 404 real — o recurso já não existe (exclusão dupla, aba duplicada). */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

// ---------------------------------------------------------------------------
// Tradução de mensagens do backend para português (academy.ts consome direto).
// ---------------------------------------------------------------------------

const GENERIC: Record<string, string> = {
  "The requested resource wasn't found.": 'Registro não encontrado.',
  'Fail to authenticate.': 'Falha na autenticação.',
  'An error occurred while processing your request. Please try again later.':
    'Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.',
}

const RULES: { pattern: RegExp; message: string }[] = [
  {
    pattern: /You can only delete/i,
    message: 'Não foi possível excluir: existem registros vinculados a este item.',
  },
  {
    pattern: /values must be unique|UNIQUE constraint/i,
    message: 'Já existe um registro com esse valor (duplicado).',
  },
]

/**
 * Converte a mensagem crua do PocketBase/servidor em português legível para o
 * usuário; devolve a original quando não há tradução conhecida.
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  if (GENERIC[message]) return GENERIC[message]
  for (const rule of RULES) {
    if (rule.pattern.test(message)) return rule.message
  }
  return message
}
