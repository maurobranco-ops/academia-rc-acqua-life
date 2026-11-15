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
 * Mensagem de erro amigável em pt-BR — nunca vaza o texto cru do backend
 * (ex.: "Cannot be blank") para a interface.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    if (error.status === 0 || error.status >= 500) {
      return 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
    }
    if (error.status >= 400) {
      // 400 aqui significa validação do backend — cobre os campos obrigatórios
      // (ex.: a foto do aluno) e qualquer outro dado que tenha chegado inválido.
      return 'Verifique os campos obrigatórios — a foto do aluno é necessária.'
    }
    return 'Não foi possível concluir a operação. Tente novamente.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
