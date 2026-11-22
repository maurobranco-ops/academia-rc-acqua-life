import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * TRUE apenas para 404 ("The requested resource wasn't found."): usado pelo
 * delete tolerante do academyService — 404 significa que o registro já foi
 * excluído e o resultado desejado já aconteceu. Outros erros seguem como erro.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404
}

const GENERIC_TRANSLATIONS: Record<string, string> = {
  'The requested resource was not found.': 'Recurso não encontrado.',
  "The requested resource wasn't found.": 'Recurso não encontrado.',
  'An error occurred while processing the request.': 'Ocorreu um erro ao processar a solicitação.',
  'Something went wrong while handling the request.': 'Algo deu errado ao processar a solicitação.',
}

// Padrões que a mensagem crua do PocketBase carrega e que precisam ser
// traduzidos/normalizados para o usuário (regex pela original).
const RULES: Array<{ pattern: RegExp; replace: string }> = [
  { pattern: /validation not satisfied/i, replace: 'Validação não satisfeita.' },
  { pattern: /failed to create record/i, replace: 'Falha ao criar o registro.' },
  { pattern: /failed to update record/i, replace: 'Falha ao atualizar o registro.' },
  { pattern: /failed to delete record/i, replace: 'Falha ao excluir o registro.' },
  {
    pattern: /value must be a valid email address/i,
    replace: 'Informe um endereço de e-mail válido.',
  },
  { pattern: /cannot be blank/i, replace: 'Não pode ficar em branco.' },
  {
    pattern: /value must be greater than or equal to (\d+)/i,
    replace: 'O valor deve ser maior ou igual a $1.',
  },
  {
    pattern: /value must be less than or equal to (\d+)/i,
    replace: 'O valor deve ser menor ou igual a $1.',
  },
  {
    pattern: /the request exceeds the maximum allowed size/i,
    replace: 'O arquivo excede o tamanho máximo permitido.',
  },
  {
    pattern: /misformatted form data/i,
    replace: 'Dados do formulário mal formatados.',
  },
]

/**
 * Traduz mensagens cruas do PocketBase/servidor para o usuário final,
 * preservando detalhes específicos (ex. nome de campo) quando existirem.
 * Mensagens desconhecidas voltam como vieram — nunca inventa tradução.
 */
export function translateBackendMessage(message: string): string {
  if (!message) return message

  // Mensagem puramente genérica: traduz direto pelo mapa.
  const trimmed = message.trim()
  if (GENERIC_TRANSLATIONS[trimmed]) {
    return GENERIC_TRANSLATIONS[trimmed]
  }

  // Demais casos: aplica as regras, preservando o que não casar.
  let translated = message
  for (const rule of RULES) {
    translated = translated.replace(rule.pattern, rule.replace)
  }
  return translated
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
