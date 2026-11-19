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

/** Erro 404 do PocketBase: o registro já não existe (ex. disparo duplo, aba duplicada). */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz as mensagens cruas do PocketBase/Skip Cloud para português, preservando
 * erros de validação de campo (que já chegam traduzidos pelo extractFieldErrors).
 */
export function translateBackendMessage(message?: string | null): string {
  const raw = (message || '').trim()
  if (!raw) return 'Ocorreu um erro inesperado. Tente novamente.'
  const GENERIC: Record<string, string> = {
    'Failed to create record.':
      'Não foi possível salvar o registro. Verifique os dados e tente novamente.',
    'Failed to update record.':
      'Não foi possível atualizar o registro. Verifique os dados e tente novamente.',
    'Failed to delete record.': 'Não foi possível excluir o registro.',
    "The requested resource wasn't found.": 'Registro não encontrado. Ele pode ter sido excluído.',
    'An error occurred while processing the request.':
      'Ocorreu um erro ao processar a solicitação.',
    'Unauthenticated.': 'Sessão expirada. Faça login novamente.',
    'Invalid or expired token.': 'Token inválido ou expirado.',
    'The request requires valid record authorization token to be set as the Authorization header.':
      'Sessão expirada. Faça login novamente.',
    'User not found.': 'Usuário não encontrado.',
    'Bad request.': 'Requisição inválida.',
    'Missing or invalid request payload.': 'Requisição inválida.',
  }
  const generic = GENERIC[raw]
  if (generic) return generic
  const RULES: Array<[RegExp, string]> = [
    [/^validation_(not_null|validation_required)$/i, 'Campo obrigatório não preenchido.'],
    [/^value must be/i, 'Valor inválido para este campo.'],
    [/^invalid value at /i, 'Valor inválido em um dos campos enviados.'],
    [/cannot be blank/i, 'Campo obrigatório não pode ficar em branco.'],
    [/must be a valid/i, 'Valor em formato inválido.'],
    [/requires a valid/i, 'É necessário um valor válido.'],
    [/has already been used/i, 'Este valor já está em uso.'],
    [/not enough permissions/i, 'Você não tem permissão para executar esta ação.'],
    [
      /failed to create record/i,
      'Não foi possível salvar o registro. Verifique os dados e tente novamente.',
    ],
    [
      /failed to update record/i,
      'Não foi possível atualizar o registro. Verifique os dados e tente novamente.',
    ],
    [/failed to delete record/i, 'Não foi possível excluir o registro.'],
    [
      /the requested resource wasn'?t found/i,
      'Registro não encontrado. Ele pode ter sido excluído.',
    ],
    [/unauthenticated/i, 'Sessão expirada. Faça login novamente.'],
    [/collection "?([\w-]+)"? (?:was not )?not found/i, 'Coleção não encontrada no backend.'],
    [/record not found/i, 'Registro não encontrado.'],
    [/token/i, 'Sessão ou token inválido/expirado. Faça login novamente.'],
  ]
  for (const [re, msg] of RULES) {
    if (re.test(raw)) return msg
  }
  return raw
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
