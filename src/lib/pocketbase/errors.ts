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
  return msgs.length > 0 ? msgs.join(' ') : translateBackendMessage(error.message)
}

/** 404 = registro já não existe (exclusão dupla, aba duplicada): tratado como sucesso. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

// -------------------------------------------------------------
// Tradução de mensagens cruas do PocketBase para pt-BR
// -------------------------------------------------------------

const GENERIC: Record<string, string> = {
  "The requested resource wasn't found.": 'Registro não encontrado.',
  'Failed to authenticate.': 'Falha na autenticação.',
  'Failed to create record.': 'Falha ao criar o registro.',
  'Failed to update record.': 'Falha ao atualizar o registro.',
  'Failed to delete record. Make sure that the record is not referenced by other records.':
    'Não foi possível excluir: este registro está vinculado a outros registros.',
  'An error occurred while uploading the file. Please try again.':
    'Erro ao enviar o arquivo. Tente novamente.',
  'You are not allowed to perform this request.': 'Você não tem permissão para esta ação.',
  'Something went wrong while processing your request.':
    'Algo deu errado ao processar a solicitação.',
}

const RULES: Array<{ test: RegExp; replace: string }> = [
  { test: /^validation not null error:? /i, replace: '' },
  { test: /cannot be blank\.?$/i, replace: 'não pode ficar em branco.' },
  { test: /must be a valid email\./i, replace: 'deve ser um e-mail válido.' },
  { test: /value must be unique\./i, replace: 'já está em uso (valor deve ser único).' },
  {
    test: /missing required value\./i,
    replace: 'campo obrigatório não preenchido.',
  },
]

/** Converte uma mensagem crua do PocketBase (inglês) para português, se houver equivalente. */
export function translateBackendMessage(message: string): string {
  if (!message) return message
  if (GENERIC[message]) return GENERIC[message]
  let out = message
  for (const rule of RULES) {
    out = out.replace(rule.test, rule.replace)
  }
  return out
}
