import type { StudentRecord } from '@/types/database'

export type StudentStatusKey = 'ativo' | 'isento' | 'inativo'

export interface StudentStatusDisplay {
  key: StudentStatusKey
  label: string
  badgeClass: string
}

/**
 * Semântica de status do aluno (regra do usuário, RC Acqua Life):
 * - "TR" (trancado) do Bubble = aluno INATIVADO — nunca "Ativo" + "Mensalidade Trancada" juntos.
 * - "Mensalidade congelada" (fee_suspended, aluno frequente que não paga — bolsa/cortesia/acordo)
 *   = status próprio "Isento".
 * A ordem de precedência é: inativo > isento > ativo (um aluno só tem UM badge de status).
 */
export function getStudentStatusDisplay(
  student?: Partial<StudentRecord> | null,
): StudentStatusDisplay {
  if (!student) {
    return {
      key: 'inativo',
      label: 'Inativo',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200 text-[10px]',
    }
  }

  // 1) Inativado: status gravado como inativo OU situação TR/atestado (importação do Bubble)
  const sit = (student.situation || '').toLowerCase().trim()
  const rawSit = (student.raw_situation || '').toLowerCase().trim()
  const isInactive =
    student.status === 'inativo' ||
    sit === 'trancado' ||
    sit === 'inativo' ||
    sit === 'tr' ||
    rawSit === 'tr' ||
    rawSit === 'inativo'

  if (isInactive) {
    return {
      key: 'inativo',
      label: 'Inativo',
      badgeClass: 'bg-red-50 text-red-600 border-red-200 text-[10px]',
    }
  }

  // 2) Isento: mensalidade congelada (aluno frequente que não paga)
  if (student.fee_suspended) {
    return {
      key: 'isento',
      label: 'Isento',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-bold',
    }
  }

  // 3) Ativo
  return {
    key: 'ativo',
    label: 'Ativo',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]',
  }
}
