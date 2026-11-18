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

/**
 * 404 ("The requested resource wasn't found.") não é erro para fluxos de
 * exclusão tolerante: significa que o registro JÁ foi excluído
 * (ex. disparo duplo, aba duplicada, cascade do servidor).
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

const BACKEND_MESSAGE_TRANSLATIONS: Array<[RegExp, string]> = [
  [
    /required relation reference/i,
    'Este registro tem vínculos (matrículas/cobranças/pagamentos) e não pode ser excluído diretamente.',
  ],
  [/make sure that the record exists/i, 'Registro não encontrado — ele já pode ter sido excluído.'],
  [/the requested resource wasn'?t found/i, 'Registro não encontrado.'],
  [/failed to delete record/i, 'Falha ao excluir o registro.'],
  [/validation not null failure/i, 'Preencha todos os campos obrigatórios.'],
  [/value must be greater or equal/i, 'Valor abaixo do mínimo permitido.'],
  [/value must be less or equal/i, 'Valor acima do máximo permitido.'],
  [/must be a valid email/i, 'E-mail inválido.'],
  [/cannot be blank/i, 'Campo obrigatório em branco.'],
]

/**
 * Traduz mensagens cruas do backend (PocketBase) para português. Quando não há
 * tradução conhecida, devolve a mensagem original sem quebrar o fluxo.
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  for (const [pattern, translated] of BACKEND_MESSAGE_TRANSLATIONS) {
    if (pattern.test(message)) return translated
  }
  return message
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
