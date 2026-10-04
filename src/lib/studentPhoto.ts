import pb from '@/lib/pocketbase/client'
import type { StudentRecord } from '@/types/database'

/**
 * Normaliza uma string para comparação de nomes:
 * - Remove acentuação (NFD)
 * - Converte para minúsculas
 * - Remove pontuações e caracteres especiais, mantendo apenas letras e números
 * - Colapsa espaços múltiplos em um único espaço
 */
export function normalizeName(name: string): string {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/[\s_]+/g, ' ')
    .trim()
}

/**
 * Limpa o nome do arquivo para extrair o nome do aluno:
 * - Remove extensões (.jpg, .jpeg, .png, .webp, .gif)
 * - Remove sufixos comuns de cópia/duplicação: (1), (2), - copia, _copia, - copy, etc.
 * - Normaliza o resultado
 */
export function cleanFilenameForMatch(filename: string): string {
  if (!filename) return ''
  // 1. Remove qualquer caminho se houver (ex: "fotos/joao.jpg" -> "joao.jpg")
  const baseName = filename.split(/[\\/]/).pop() || filename
  // 2. Remove extensão
  const withoutExt = baseName.replace(/\.[a-zA-Z0-9]+$/i, '')
  // 3. Remove sufixos numéricos e de cópia:
  // ex: "João Silva (1)", "João Silva - cópia", "João Silva_copia", "João Silva - 1"
  const cleaned = withoutExt
    .replace(/\s*\(\d+\)\s*$/i, '')
    .replace(/\s*-\s*(c[oó]pia|copy)\s*$/i, '')
    .replace(/[_]\s*(c[oó]pia|copy)\s*$/i, '')
    .replace(/\s*-\s*\d+\s*$/i, '')
  return normalizeName(cleaned)
}

export interface StudentMatchCandidate {
  student: StudentRecord
  normalizedName: string
}

export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched'

export interface PhotoMatchResult {
  status: MatchStatus
  student?: StudentRecord
  candidateNames?: string[]
}

/**
 * Tenta casar o nome do arquivo com a lista de alunos:
 * 1. Match exato normalizado
 * 2. Match de contenção única (se o nome limpo do arquivo contém o nome do aluno ou vice-versa)
 * 3. Se houver mais de um candidato na contenção, marca como ambíguo para revisão do usuário
 */
export function matchPhotoNameToStudent(
  filename: string,
  students: StudentRecord[],
): PhotoMatchResult {
  const fileClean = cleanFilenameForMatch(filename)
  if (!fileClean) {
    return { status: 'unmatched' }
  }

  const prepStudents: StudentMatchCandidate[] = students.map((s) => ({
    student: s,
    normalizedName: normalizeName(s.name),
  }))

  // 1. Tentativa de match exato
  const exactMatches = prepStudents.filter((s) => s.normalizedName === fileClean)
  if (exactMatches.length === 1) {
    return { status: 'matched', student: exactMatches[0].student }
  }
  if (exactMatches.length > 1) {
    return {
      status: 'ambiguous',
      candidateNames: exactMatches.map((m) => m.student.name),
    }
  }

  // 2. Tentativa por palavras-chave ou contenção segura:
  // Se o nome do arquivo contém o nome completo normalizado do aluno
  // OU se o nome do aluno contém o nome do arquivo (ex.: arquivo só com primeiro+último nome)
  // Só aceitamos se o nome tiver ao menos 4 caracteres para evitar falso-positivo em nomes muito curtos.
  if (fileClean.length >= 4) {
    const containmentMatches = prepStudents.filter((s) => {
      if (s.normalizedName.length < 4) return false
      // Se um contém o outro com fronteira de palavra
      const fileWords = fileClean.split(' ')
      const studentWords = s.normalizedName.split(' ')

      // Caso A: Nome do arquivo é "Joao Silva Foto" e aluno é "Joao Silva"
      if (fileClean.includes(s.normalizedName)) return true

      // Caso B: Todas as palavras do nome do aluno estão no arquivo
      if (studentWords.length >= 2 && studentWords.every((w) => fileWords.includes(w))) {
        return true
      }

      // Caso C: Todas as palavras do arquivo estão no nome do aluno (ex: arquivo "Joao Silva" e aluno "Joao Silva de Oliveira")
      if (fileWords.length >= 2 && fileWords.every((w) => studentWords.includes(w))) {
        return true
      }

      return false
    })

    if (containmentMatches.length === 1) {
      return { status: 'matched', student: containmentMatches[0].student }
    }
    if (containmentMatches.length > 1) {
      // Se há exatamente 1 com mais palavras coincidentes
      return {
        status: 'ambiguous',
        candidateNames: containmentMatches.map((m) => m.student.name),
      }
    }
  }

  return { status: 'unmatched' }
}

/**
 * Retorna a URL final da foto do aluno:
 * 1. Prioridade para arquivo hospedado no PocketBase (`photo_file`)
 * 2. Fallback para URL externa do Bubble (`photo`)
 * 3. Retorna null se não houver foto
 */
export function getStudentPhotoUrl(
  student?: Partial<StudentRecord> | null,
  thumb?: string,
): string | null {
  if (!student) return null

  // 1. Arquivo próprio do PocketBase
  if (student.photo_file && student.id && student.collectionId) {
    try {
      const recordObj = {
        id: student.id,
        collectionId: student.collectionId,
        collectionName: student.collectionName || 'students',
      }
      return pb.files.getURL(recordObj as any, student.photo_file, thumb ? { thumb } : undefined)
    } catch {
      // Fallback manual se getURL falhar
      const baseUrl = pb.baseURL || ''
      const thumbQuery = thumb ? `?thumb=${thumb}` : ''
      return `${baseUrl}/api/files/${student.collectionId}/${student.id}/${student.photo_file}${thumbQuery}`
    }
  }

  // 2. Link do Bubble existente
  if (student.photo && typeof student.photo === 'string' && student.photo.trim() !== '') {
    const trimmed = student.photo.trim()
    // Trata links do Bubble que começam com "//"
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`
    }
    return trimmed
  }

  return null
}
