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

/** Tradução de mensagens cruas do PocketBase para português. */
const RAW_MESSAGE_TRANSLATIONS: Array<{ test: RegExp; pt: string }> = [
  {
    test: /requested resource wasn't found|not found/i,
    pt: 'O registro não foi encontrado — ele já pode ter sido excluído.',
  },
  {
    test: /cannot be blank|must not be blank|non-empty value|required/i,
    pt: 'Verifique os campos obrigatórios — algum campo necessário ficou vazio.',
  },
  {
    test: /invalid value|must be a valid|validation/i,
    pt: 'Algum campo tem um valor inválido — verifique os dados digitados.',
  },
  {
    test: /failed to authenticate|authentication (is )?required|you are not (allowed|authenticated)/i,
    pt: 'Sua sessão expirou — faça login novamente.',
  },
]

export function translatePocketBaseMessage(message: string): string {
  for (const { test, pt } of RAW_MESSAGE_TRANSLATIONS) {
    if (test.test(message)) return pt
  }
  return message
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) return msgs.map(translatePocketBaseMessage).join(' ')
  return translatePocketBaseMessage(error.message || 'Ocorreu um erro inesperado.')
}

/**
 * Um 404 numa EXCLUSÃO não é erro: significa que o registro já não existe
 * (ex. duplo clique, aba duplicada ou exclusão simultânea) — o resultado
 * desejado ("registro some") já aconteceu. Trate como sucesso.
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof ClientResponseError &&
    error.status === 404 &&
    /requested resource wasn't found|not found/i.test(error.message || '')
  )
}
