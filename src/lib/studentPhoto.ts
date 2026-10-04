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

/**
 * Verifica se um aluno está inativo (trancado, atestado, ou status inativo).
 * Alunos inativos devem ter suas fotos ignoradas sem gerar erro ou pendência.
 */
export function isStudentInactive(student?: Partial<StudentRecord> | null): boolean {
  if (!student) return false
  if (student.status === 'inativo') return true
  const sit = (student.situation || '').toLowerCase().trim()
  if (sit === 'trancado' || sit === 'atestado' || sit === 'inativo') return true
  const rawSit = (student.raw_situation || '').toLowerCase().trim()
  if (rawSit === 'tr' || rawSit === 'atestado' || rawSit === 'inativo') return true
  return false
}

export type MatchStatus =
  | 'matched'
  | 'needs_confirmation'
  | 'ambiguous'
  | 'unmatched'
  | 'ignored_inactive'

export interface PhotoMatchResult {
  status: MatchStatus
  student?: StudentRecord
  candidates?: StudentRecord[]
  candidateNames?: string[]
  reason?: string
}

/**
 * Tenta casar o nome do arquivo com a lista de alunos:
 * 1. Separação de ativos e inativos: se o match (exato ou aproximado) for de um aluno inativo,
 *    o resultado é marcado como 'ignored_inactive' (pulado silenciosamente sem contar como pendência/erro).
 * 2. Match EXATO normalizado com aluno ativo:
 *    -> status: 'matched' (seguro, vinculado automaticamente).
 * 3. Match APROXIMADO / CONTENÇÃO / PARCIAL com único aluno ativo candidato:
 *    -> status: 'needs_confirmation' (NÃO anexa automaticamente, exige aprovação na UI mostrando foto nova vs atual).
 * 4. Múltiplos candidatos:
 *    -> status: 'ambiguous' (ou 'needs_confirmation' com a lista de candidatos).
 * 5. Nenhum candidato:
 *    -> status: 'unmatched'.
 */
export function matchPhotoNameToStudent(
  filename: string,
  students: StudentRecord[],
): PhotoMatchResult {
  const fileClean = cleanFilenameForMatch(filename)
  if (!fileClean) {
    return { status: 'unmatched' }
  }

  // Prepara candidatos ativos e inativos
  const prepActive: StudentMatchCandidate[] = []
  const prepInactive: StudentMatchCandidate[] = []

  for (const s of students) {
    const candidate: StudentMatchCandidate = {
      student: s,
      normalizedName: normalizeName(s.name),
    }
    if (isStudentInactive(s)) {
      prepInactive.push(candidate)
    } else {
      prepActive.push(candidate)
    }
  }

  // 1. Verifica primeiro match exato entre os ativos
  const exactActiveMatches = prepActive.filter((s) => s.normalizedName === fileClean)
  if (exactActiveMatches.length === 1) {
    return {
      status: 'matched',
      student: exactActiveMatches[0].student,
    }
  }
  if (exactActiveMatches.length > 1) {
    return {
      status: 'ambiguous',
      candidates: exactActiveMatches.map((m) => m.student),
      candidateNames: exactActiveMatches.map((m) => m.student.name),
      reason: 'Mais de um aluno ativo com nome idêntico.',
    }
  }

  // 2. Se não casou exatamente com ativo, verifica se casa exatamente com aluno inativo
  const exactInactiveMatches = prepInactive.filter((s) => s.normalizedName === fileClean)
  if (exactInactiveMatches.length >= 1) {
    return {
      status: 'ignored_inactive',
      student: exactInactiveMatches[0].student,
      reason: `Aluno inativo (${exactInactiveMatches[0].student.raw_situation || exactInactiveMatches[0].student.situation || 'inativo'}). Foto ignorada.`,
    }
  }

  // 3. Tentativa por contenção ou correspondência parcial
  if (fileClean.length >= 3) {
    const fileWords = fileClean.split(' ').filter(Boolean)

    const findCandidates = (list: StudentMatchCandidate[]) =>
      list.filter((s) => {
        if (s.normalizedName.length < 3) return false
        const studentWords = s.normalizedName.split(' ').filter(Boolean)

        // Caso A: Nome do arquivo contém o nome do aluno ou vice-versa
        if (fileClean.includes(s.normalizedName) || s.normalizedName.includes(fileClean)) {
          return true
        }

        // Caso B: Todas as palavras do aluno estão no arquivo (mínimo 2 palavras)
        if (studentWords.length >= 2 && studentWords.every((w) => fileWords.includes(w))) {
          return true
        }

        // Caso C: Todas as palavras do arquivo estão no nome do aluno (mínimo 2 palavras)
        if (fileWords.length >= 2 && fileWords.every((w) => studentWords.includes(w))) {
          return true
        }

        // Caso D: Primeiro nome idêntico + ao menos um sobrenome coincidente
        if (
          fileWords.length >= 2 &&
          studentWords.length >= 2 &&
          fileWords[0] === studentWords[0] &&
          fileWords.slice(1).some((w) => studentWords.slice(1).includes(w))
        ) {
          return true
        }

        return false
      })

    const containmentActive = findCandidates(prepActive)

    if (containmentActive.length === 1) {
      // Correspondência aproximada / parcial: NÃO é match automático direto,
      // exige confirmação prévia do usuário conforme regra 1
      return {
        status: 'needs_confirmation',
        student: containmentActive[0].student,
        candidates: [containmentActive[0].student],
        candidateNames: [containmentActive[0].student.name],
        reason: 'Correspondência aproximada/parcial. Confirmação necessária antes de anexar.',
      }
    }

    if (containmentActive.length > 1) {
      return {
        status: 'ambiguous',
        candidates: containmentActive.map((m) => m.student),
        candidateNames: containmentActive.map((m) => m.student.name),
        reason: 'Múltiplos alunos ativos encontrados com nomes semelhantes.',
      }
    }

    // Se não encontrou ativo, verifica se a contenção era de um aluno inativo
    const containmentInactive = findCandidates(prepInactive)
    if (containmentInactive.length >= 1) {
      return {
        status: 'ignored_inactive',
        student: containmentInactive[0].student,
        reason: `Aluno inativo (${containmentInactive[0].student.raw_situation || containmentInactive[0].student.situation || 'inativo'}). Foto ignorada.`,
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
