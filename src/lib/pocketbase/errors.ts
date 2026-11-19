import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

// Guard: NÃO remover estes exports — src/services/academy.ts importa ambos e
// builds já quebraram várias vezes por esse sumiço (ver memória do projeto).
/** Verdadeiro quando o erro do PocketBase é 404 ("recurso não encontrado"). */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

const PT_BR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/The requested resource wasn'?t found/i, 'Registro não encontrado.'],
  [/Failed to create record/i, 'Não foi possível criar o registro.'],
  [/Failed to update record/i, 'Não foi possível atualizar o registro.'],
  [/Failed to delete record/i, 'Não foi possível excluir o registro.'],
  [/validation not null/i, 'Campo obrigatório não preenchido.'],
  [/cannot be blank/i, 'Campo obrigatório não preenchido.'],
  [/value must be a valid email/i, 'E-mail inválido.'],
  [/missing required context/i, 'Sessão expirada — faça login novamente.'],
  [
    /The request requires valid record authorization token/i,
    'Sessão expirada — faça login novamente.',
  ],
  [
    /Autentication|authentication required|authorization token/i,
    'Sessão expirada — faça login novamente.',
  ],
  [/unique constraint/i, 'Este registro já existe (valor duplicado).'],
]

/** Traduz mensagens cruas do backend (inglês) para português legível ao usuário. */
export function translateBackendMessage(message: string): string {
  if (!message) return 'Ocorreu um erro inesperado.'
  let out = message
  for (const [pattern, pt] of PT_BR_TRANSLATIONS) {
    if (pattern.test(out)) return pt
  }
  return out
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
