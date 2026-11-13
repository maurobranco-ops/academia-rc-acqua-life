/**
 * Consulta de endereço na API pública ViaCEP (https://viacep.com.br).
 * Preenche logradouro, bairro, cidade e UF — NUNCA número e complemento
 * (esses são sempre digitados manualmente pelo usuário).
 */

export interface ViaCepAddress {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
}

/**
 * Busca o endereço de um CEP na ViaCEP.
 * Lança Error com mensagem em português quando o CEP é inválido,
 * não encontrado ou a consulta falha — erros NUNCA bloqueiam o salvamento
 * dos demais dados do formulário (tratados na UI como aviso).
 */
export async function fetchAddressByCep(cep: string): Promise<ViaCepAddress> {
  const digits = (cep || '').replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP incompleto: informe os 8 dígitos (ex.: 59000-000).')
  }

  let response: Response
  try {
    response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  } catch {
    throw new Error(
      'Não foi possível consultar o CEP agora (falha de conexão). Verifique sua internet ou preencha o endereço manualmente.',
    )
  }

  if (!response.ok) {
    throw new Error(
      'CEP não encontrado. Verifique o número digitado ou preencha o endereço manualmente.',
    )
  }

  const data = (await response.json().catch(() => null)) as
    | (ViaCepAddress & { erro?: boolean | string })
    | null

  if (!data || data.erro === true || data.erro === 'true' || !data.localidade) {
    throw new Error('CEP não encontrado na base dos Correios. Verifique o número digitado.')
  }

  return {
    cep: data.cep || digits,
    logradouro: data.logradouro || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    localidade: data.localidade,
    uf: data.uf || '',
  }
}
