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
 * 404 do PocketBase = o registro já não existe. Nas exclusões tolerantes isso
 * é SUCESSO (registro já removido por outro caminho ou duplo clique), nunca erro.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz para português as mensagens cruas que o PocketBase/devolve de rotas
 * e validações de campo. O que já está em português passa intacto.
 */
const TRANSLATIONS: Record<string, string> = {
  'Failed to delete record. Make sure that the record is not referenced by other collections.':
    'Falha ao remover o registro: ele ainda é referenciado por outros cadastros (turmas, cobranças ou pagamentos).',
  'Cannot be blank': 'Campo obrigatório não preenchido.',
  'The request is valid but the record could not be saved':
    'A requisição é válida, mas o registro não pôde ser salvo.',
  'Validation not passed': 'Validação não passou.',
  'Something went wrong while processing your request':
    'Algo deu errado ao processar sua requisição.',
  'Insufficient permissions': 'Permissões insuficientes.',
}

export function translateBackendMessage(message: string): string {
  const raw = String(message || '').trim()
  if (!raw) return 'Ocorreu um erro inesperado no servidor.'
  const direct = TRANSLATIONS[raw]
  if (direct) return direct

  // Mensagens de validação "field: message" — traduz o trecho conhecido.
  for (const [en, pt] of Object.entries(TRANSLATIONS)) {
    if (raw.indexOf(en) !== -1) return raw.replace(en, pt)
  }
  return raw
}
