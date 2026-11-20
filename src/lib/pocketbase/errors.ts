/**
 * GUARDA (regra durável do projeto): academy.ts importa isNotFoundError e
 * translateBackendMessage na linha 2 — NUNCA remover esses exports deste
 * arquivo. Builds já quebraram várias vezes por esse sumiço.
 */
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

/** true SOMENTE para 404 — o registro já não existe (exclusão tolerante). */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

/** Traduções literais de mensagens cruas do PocketBase. */
const GENERIC: Record<string, string> = {
  "The requested resource wasn't found.": 'Registro não encontrado.',
  'Failed to authenticate.': 'Falha na autenticação. Faça login novamente.',
  'You are not allowed to perform this request.': 'Você não tem permissão para esta ação.',
  'An unexpected error occurred.': 'Ocorreu um erro inesperado.',
  'Failed to create record.': 'Não foi possível criar o registro.',
  'Failed to update record.': 'Não foi possível atualizar o registro.',
  'Failed to delete record.': 'Não foi possível excluir o registro.',
  'User already exists.': 'Já existe um usuário com este e-mail.',
  'Validation not passed.': 'Verifique os dados informados.',
  'Something went wrong while processing your request.':
    'Algo deu errado ao processar sua solicitação.',
  'The request is invalid. It may have been tampered with or has expired.':
    'Solicitação inválida — pode ter sido alterada ou expirou.',
}

/** Traduções por padrão (regex) para mensagens dinâmicas. */
const RULES: Array<[RegExp, string]> = [
  [/^validation_not_null$/i, 'Campo obrigatório não pode ficar em branco.'],
  [/^cannot be blank\.?$/i, 'Não pode ficar em branco.'],
  [/^cannot be empty\.?$/i, 'Não pode ficar vazio.'],
  [/^must be a valid email address\.?$/i, 'Informe um e-mail válido.'],
  [/^value must be unique\.?$/i, 'Este valor já está cadastrado.'],
  [/^must be a valid date\.?$/i, 'Informe uma data válida.'],
  [/^value must be greater than (\d+)\.?$/i, 'Deve ser maior que $1.'],
  [/^value must be less than (\d+)\.?$/i, 'Deve ser menor que $1.'],
  [/^the value must be a (\w+) number\.?$/i, 'O valor deve ser um número $1.'],
  [/^size must be less than (\d+)$/i, 'O tamanho deve ser menor que $1.'],
  [/^invalid file format\.?$/i, 'Formato de arquivo inválido.'],
  [/^file must be at least .+$/i, 'Arquivo fora dos limites aceitos.'],
  [/^record must have at least one relation\.?$/i, 'Selecione pelo menos uma opção.'],
  [/^not enough or too many segments$/i, 'Token inválido.'],
  [/^The token is invalid or has expired\.?$/i, 'Token inválido ou expirado.'],
]

/**
 * Traduz uma mensagem crua do backend (PocketBase) para português. Retorna a
 * própria string quando não há tradução conhecida.
 */
export function translateBackendMessage(message: string | undefined | null): string {
  if (!message) return ''
  const raw = message.trim()
  if (GENERIC[raw]) return GENERIC[raw]
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(raw)) return raw.replace(pattern, replacement)
  }
  return message
}
