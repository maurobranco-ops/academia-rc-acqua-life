/**
 * Parser de CSV robusto (RFC 4180), tratando:
 * - Aspas duplas ("...")
 * - Aspas escapadas ("" dentro de campos)
 * - Vírgulas dentro de campos protegidos por aspas
 * - Quebras de linha CRLF (\r\n) e LF (\n) dentro ou fora de aspas
 * - UTF-8 com acentuação e caracteres especiais
 * - BOM (\uFEFF)
 */

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCSV(text: string): ParsedCSV {
  if (!text) {
    return { headers: [], rows: [] }
  }

  // Remove potential UTF-8 BOM
  let content = text
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }

  const rawRows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let insideQuotes = false
  let i = 0

  while (i < content.length) {
    const char = content[i]

    if (insideQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          // Closing quote
          insideQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        insideQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
        i++
        continue
      } else if (char === '\r') {
        if (i + 1 < content.length && content[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        rawRows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else if (char === '\n') {
        currentRow.push(currentField)
        rawRows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  // Push remaining field if file didn't end with newline
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rawRows.push(currentRow)
  }

  if (rawRows.length === 0) {
    return { headers: [], rows: [] }
  }

  // Clean headers (trim)
  const headers = rawRows[0].map((h) => h.trim())

  const rows: Record<string, string>[] = []
  for (let r = 1; r < rawRows.length; r++) {
    const rowValues = rawRows[r]
    // Skip empty lines
    if (rowValues.length === 1 && !rowValues[0].trim()) continue
    if (rowValues.every((v) => !v.trim())) continue

    const rowObj: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c]
      rowObj[header] = rowValues[c] !== undefined ? rowValues[c] : ''
    }
    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * Converte data em inglês do Bubble (ex: "Jul 14, 2014 12:00 am", "Oct 10, 2026 11:59 pm", "Feb 3, 2025 3:58 pm")
 * ou ISO para string ISO compatível com PocketBase date (ex: "2014-07-14 00:00:00.000Z" ou YYYY-MM-DD).
 */
const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

export function parseBubbleDate(
  dateStr?: string,
  dayFallback?: string,
  monthFallback?: string,
): string | null {
  if (dateStr && dateStr.trim()) {
    const s = dateStr.trim()
    // Pattern: "Jul 14, 2014 12:00 am" or "Jul 14, 2014"
    const regex = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm))?/i
    const match = s.match(regex)
    if (match) {
      const monStr = match[1].toLowerCase()
      const day = parseInt(match[2], 10)
      const year = parseInt(match[3], 10)
      let hour = match[4] ? parseInt(match[4], 10) : 0
      const minute = match[5] ? parseInt(match[5], 10) : 0
      const ampm = match[6] ? match[6].toLowerCase() : ''

      if (ampm === 'pm' && hour < 12) hour += 12
      if (ampm === 'am' && hour === 12) hour = 0

      const monIdx = MONTH_MAP[monStr]
      if (monIdx !== undefined) {
        const d = new Date(Date.UTC(year, monIdx, day, hour, minute, 0))
        if (!isNaN(d.getTime())) {
          return d.toISOString().replace('T', ' ')
        }
      }
    }

    // Fallback standard parse
    const standard = new Date(s)
    if (!isNaN(standard.getTime())) {
      return standard.toISOString().replace('T', ' ')
    }
  }

  // Fallback when day & month are provided (e.g., Dia Nascimento / Mês Nascimento)
  if (dayFallback && monthFallback && dayFallback.trim() && monthFallback.trim()) {
    const d = parseInt(dayFallback.trim(), 10)
    const m = parseInt(monthFallback.trim(), 10)
    if (!isNaN(d) && !isNaN(m) && d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      // Default to year 2000 if not known, or just a dummy anchor year for birth day/month
      const date = new Date(Date.UTC(2000, m - 1, d, 0, 0, 0))
      return date.toISOString().replace('T', ' ')
    }
  }

  return null
}

/**
 * Converte valor numérico com vírgula ou ponto para número.
 * Ex: "70,07" -> 70.07, "95" -> 95, "" -> 0
 */
export function parseCurrencyOrNumber(val?: string | number): number {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const str = String(val).trim()
  if (!str) return 0
  const normalized = str.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

/**
 * Normaliza URL de foto vinda do Bubble:
 * //31dbd48c758c... -> https://31dbd48c758c...
 */
export function normalizeBubblePhoto(url?: string): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed
  }
  return trimmed
}

/**
 * Monta endereço unificado em uma linha:
 * "Logradouro, Nº - Complemento, Bairro, Cidade/UF, CEP"
 */
export function formatAddress(parts: {
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
}): string {
  const log = (parts.logradouro || '').trim()
  const num = (parts.numero || '').trim()
  const comp = (parts.complemento || '').trim()
  const bairro = (parts.bairro || '').trim()
  const cidade = (parts.cidade || '').trim()
  const uf = (parts.uf || '').trim()
  const cep = (parts.cep || '').trim()

  const segments: string[] = []

  let streetPart = ''
  if (log) {
    streetPart = log
    if (num && num !== '0' && num !== 'S/N' && num !== 'S.N⁰') {
      streetPart += `, Nº ${num}`
    } else if (num) {
      streetPart += `, ${num}`
    }
  } else if (num) {
    streetPart = `Nº ${num}`
  }

  if (comp) {
    streetPart = streetPart ? `${streetPart} - ${comp}` : comp
  }

  if (streetPart) segments.push(streetPart)
  if (bairro) segments.push(bairro)

  if (cidade && uf) {
    segments.push(`${cidade}/${uf.toUpperCase()}`)
  } else if (cidade) {
    segments.push(cidade)
  } else if (uf) {
    segments.push(uf.toUpperCase())
  }

  if (cep && cep !== '00000-000') {
    segments.push(`CEP ${cep}`)
  }

  return segments.join(', ')
}

/**
 * Infere a modalidade da turma pelo nome:
 * "Natação Tarde" -> natacao
 * "Hidroginástica Manhã" -> hidroginastica
 * "Funcional" -> funcional
 */
export function inferClassType(className: string): 'natacao' | 'hidroginastica' | 'funcional' {
  const lower = className.toLowerCase()
  if (lower.includes('hidro')) return 'hidroginastica'
  if (lower.includes('funcional')) return 'funcional'
  return 'natacao'
}

/**
 * Mapeia situação do Bubble para status do sistema:
 * "TR" -> trancado
 * "Atestado" -> atestado
 * "Vencido" -> inadimplente
 * "Ausente" ou vazio -> ativo
 */
export function mapSituation(rawSituation?: string): {
  systemStatus: 'ativo' | 'inativo'
  situationTag: string
} {
  const trimmed = (rawSituation || '').trim()
  const lower = trimmed.toLowerCase()

  if (lower === 'tr') {
    return { systemStatus: 'inativo', situationTag: 'trancado' }
  }
  if (lower === 'atestado') {
    return { systemStatus: 'inativo', situationTag: 'atestado' }
  }
  if (lower === 'vencido') {
    return { systemStatus: 'ativo', situationTag: 'inadimplente' }
  }
  return { systemStatus: 'ativo', situationTag: 'ativo' }
}
