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
 * 404 do PocketBase não é erro — significa que o registro JÁ foi excluído
 * (ex. disparo duplo, aba duplicada), então o resultado desejado já aconteceu.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/**
 * Traduz as mensagens cruas mais comuns do PocketBase para português, para
 * nunca vazar texto em inglês ao usuário. Mensagem desconhecida passa intocada.
 */
const BACKEND_MESSAGE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/the requested resource wasn't found/i, 'Registro não encontrado.'],
  [/failed to authenticate/i, 'Não foi possível autenticar. Faça login novamente.'],
  [/the request requires valid .* authorization token/i, 'Sessão expirada. Faça login novamente.'],
  [/you are not allowed to perform this request/i, 'Você não tem permissão para esta ação.'],
  [/validation not null failure/i, 'Preencha todos os campos obrigatórios.'],
  [/validation not unique failure/i, 'Já existe um registro com esse valor.'],
  [/validation missing value failure/i, 'Campo obrigatório não informado.'],
  [/validation length out of range failure/i, 'Valor fora do tamanho permitido.'],
  [/cannot be blank/i, 'Não pode ficar em branco.'],
]

export function translateBackendMessage(message: string): string {
  for (const [pattern, translated] of BACKEND_MESSAGE_TRANSLATIONS) {
    if (pattern.test(message)) return translated
  }
  return message
}
