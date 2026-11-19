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

// GUARD: estes exports já sumiram 4+ vezes em builds anteriores (academy.ts
// importa ambos na linha 2 e a build quebra) — NUNCA removê-los deste arquivo.
/** 404/not found do PocketBase (status 404). */
export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof ClientResponseError && (error.status === 404 || error.response?.status === 404)
  )
}

/** Traduz mensagens cruas do backend para português (fallback: devolve a original). */
export function translateBackendMessage(message: string): string {
  const raw = (message || '').trim()
  const lower = raw.toLowerCase()
  const table: Record<string, string> = {
    'record not found': 'Registro não encontrado.',
    'student not found': 'Aluno não encontrado.',
    'confirmation failed': 'Confirmação inválida.',
    'authentication required': 'Autenticação necessária.',
    forbidden: 'Acesso negado.',
    'something went wrong': 'Algo deu errado. Tente novamente.',
    'internal server error': 'Erro interno do servidor.',
  }
  if (table[lower]) return table[lower]
  // Mensagens HTTP cruas comuns em inglês.
  if (/^http (4|5)\d{2}/.test(lower) || lower.startsWith('erro http')) return raw
  if (/cannot be blank/.test(lower)) return 'Campo obrigatório não preenchido.'
  if (/not found|missing/.test(lower)) return 'Registro não encontrado.'
  if (/unauthorized|token|auth/.test(lower)) return 'Sessão expirada. Faça login novamente.'
  return raw || 'Ocorreu um erro inesperado.'
}
