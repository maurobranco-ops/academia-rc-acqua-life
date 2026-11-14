// Máscaras e validações de formulário (CPF, telefone, e-mail) — RC Acqua Life

/** Remove tudo que não é dígito */
export const onlyDigits = (value: string): string => (value || '').replace(/\D/g, '')

/**
 * Máscara de CPF: 000.000.000-00
 * Aceita valor parcial (vai formatando conforme o usuário digita).
 */
export const maskCpf = (value: string): string => {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Máscara de CEP: 00000-000 (formato dos Correios).
 */
export const maskCep = (value: string): string => {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/**
 * Máscara de telefone brasileiro:
 *  - celular 10-11 dígitos com 9º dígito: (84) 98830-9717
 *  - fixo 10 dígitos: (84) 3232-0000
 */
export const maskPhone = (value: string): string => {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (rest.length === 0) return `(${ddd}) `
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  // celular com 9º dígito: 5 + 4
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

/**
 * Máscara de CNPJ: 00.000.000/0000-00 (aceita valor parcial).
 */
export const maskCnpj = (value: string): string => {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Máscara de telefone aceitando também o prefixo internacional +55
 * (13 dígitos: +55 (84) 99992-9666). Sem o prefixo, usa maskPhone.
 */
export const maskPhoneIntl = (value: string): string => {
  const d = onlyDigits(value)
  if (d.length >= 12 && d.startsWith('55')) {
    const rest = d.slice(2, 13)
    if (rest.length === 0) return '+55 '
    if (rest.length <= 2) return `+55 (${rest}`
    if (rest.length <= 6) return `+55 (${rest.slice(0, 2)}) ${rest.slice(2)}`
    if (rest.length <= 10) return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`
    return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`
  }
  return maskPhone(d)
}

/**
 * Formata um telefone para EXIBIÇÃO na ficha do aluno (sem "+55"):
 * remove o prefixo internacional 55 quando o restante forma um número
 * nacional completo (DDD + 8 ou 9 dígitos) e aplica maskPhone.
 * Ex.: "5584988309717" -> "(84) 98830-9717".
 */
export const formatPhoneDisplay = (value: string): string => {
  const d = onlyDigits(value)
  if (d.length >= 12 && d.startsWith('55')) {
    const rest = d.slice(2)
    // 11 dígitos nacionais = celular; 10 = fixo. Casos entre 12 e 13 no total.
    if (rest.length === 10 || rest.length === 11) return maskPhone(rest)
  }
  return maskPhone(d)
}

/**
 * Valida CPF matematicamente pelos dígitos verificadores.
 * Rejeita sequências repetidas (111.111.111-11), dígitos trocados e tamanhos errados.
 */
export const isValidCpf = (value: string): boolean => {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return false
  // sequências repetidas (111.111.111-11, 222..., etc.) são inválidas
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const calcDigit = (base: string, weightStart: number): number => {
    let sum = 0
    let weight = weightStart
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * weight
      weight--
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  const digit1 = calcDigit(cpf.slice(0, 9), 10)
  const digit2 = calcDigit(cpf.slice(0, 10), 11)
  return digit1 === parseInt(cpf[9], 10) && digit2 === parseInt(cpf[10], 10)
}

/** Valida formato de e-mail simples: nome@dominio.tld */
export const isValidEmail = (value: string): boolean => {
  const v = (value || '').trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

/**
 * Valida telefone: preenchido precisa ter DDD + número (10 ou 11 dígitos).
 * Vazio é válido (campos importados do Bubble podem ficar sem telefone).
 */
export const isValidPhone = (value: string): boolean => {
  const d = onlyDigits(value)
  return d.length === 0 || d.length === 10 || d.length === 11
}
