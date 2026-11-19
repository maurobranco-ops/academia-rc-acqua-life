// GUARD: NÃO remover os exports isNotFoundError e translateBackendMessage —
// academy.ts importa ambos na linha 2 e builds já quebraram várias vezes por
// esse sumiço (ver memória do projeto). Quem editar este arquivo deve manter
// TODOS os exports abaixo.
import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/** 404 do PocketBase: o registro que se tentou alterar já não existe. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

const BACKEND_MESSAGES_PT: Record<string, string> = {
  "The requested resource wasn't found.": 'O recurso solicitado não foi encontrado.',
  'An error occurred while processing the request.':
    'Ocorreu um erro ao processar a solicitação. Tente novamente.',
  'Something went wrong while processing the request.':
    'Algo deu errado ao processar a solicitação. Tente novamente.',
  'Failed to authenticate.': 'Falha na autenticação. Faça login novamente.',
  'The request requires valid record authorization token to be set.':
    'A solicitação exige um token de autenticação válido.',
  'Only admins can perform this action.': 'Apenas administradores podem executar esta ação.',
}

/**
 * Traduz mensagens cruas do backend (PocketBase/rotas próprias) para português —
 * a interface nunca deve exibir mensagem em inglês para o usuário. Mensagens
 * desconhecidas voltam inalteradas.
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  const mapped = BACKEND_MESSAGES_PT[message]
  if (mapped) return mapped
  // "The X field is required." / validações de campo do PocketBase.
  const required = message.match(/^The "?([\w .-]+)"? field (is required\.|must be a valid.*)\.?$/)
  if (required) {
    return `O campo ${required[1].toLowerCase()} é obrigatório.`
  }
  if (/failed to create record/i.test(message)) return 'Falha ao criar o registro.'
  if (/failed to update record/i.test(message)) return 'Falha ao atualizar o registro.'
  if (/failed to delete record/i.test(message)) return 'Falha ao excluir o registro.'
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
