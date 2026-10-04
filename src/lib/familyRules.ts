import type { StudentRecord, PlanRecord } from '@/types/database'

/**
 * Normaliza o nome do responsável para agrupamento confiável
 */
export function normalizeGuardianName(name?: string): string {
  if (!name) return ''
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * Verifica se um aluno pertence a uma família com múltiplos alunos pelo nome do responsável
 */
export function getFamilyStudents(
  student: StudentRecord,
  allStudents: StudentRecord[],
): StudentRecord[] {
  const guardian = normalizeGuardianName(student.guardian_name)
  if (!guardian) {
    return [student]
  }

  const normalized = guardian.toLowerCase()
  return allStudents.filter(
    (s) => normalizeGuardianName(s.guardian_name).toLowerCase() === normalized,
  )
}

/**
 * Representa um grupo familiar
 */
export interface FamilyGroup {
  guardianName: string
  guardianCpf?: string
  guardianPhone?: string
  guardianEmail?: string
  students: StudentRecord[]
  totalMonthlyFee: number
  totalDiscountedFeeOnTime: number
  hasFamilyDiscount: boolean
}

/**
 * Agrupa alunos pelo nome do responsável.
 * Alunos sem responsável ou com responsável vazio são agrupados individualmente
 * ou sob o seu próprio nome para não mesclar estudantes sem parentesco.
 */
export function groupStudentsByGuardian(
  students: StudentRecord[],
  plans: PlanRecord[],
): FamilyGroup[] {
  const planMap = new Map(plans.map((p) => [p.id, p]))

  // Map: chave = guardianName normalizado em lowercase
  const groupsMap = new Map<string, FamilyGroup>()

  for (const student of students) {
    const rawGuardian = normalizeGuardianName(student.guardian_name)
    // Se não tiver responsável, trata individualmente usando o próprio aluno
    const isStandalone = !rawGuardian
    const groupKey = isStandalone ? `_individual_${student.id}` : rawGuardian.toLowerCase()
    const displayName = isStandalone
      ? `Aluno: ${student.name} (Sem responsável informado)`
      : rawGuardian

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        guardianName: displayName,
        guardianCpf: student.guardian_cpf || undefined,
        guardianPhone: student.guardian_phone || student.phone || student.whatsapp || undefined,
        guardianEmail: student.guardian_email || student.email || undefined,
        students: [],
        totalMonthlyFee: 0,
        totalDiscountedFeeOnTime: 0,
        hasFamilyDiscount: false,
      })
    }

    const group = groupsMap.get(groupKey)!
    group.students.push(student)

    // Preenche dados adicionais de contato do responsável se ainda não tiver
    if (!group.guardianCpf && student.guardian_cpf) group.guardianCpf = student.guardian_cpf
    if (!group.guardianPhone && (student.guardian_phone || student.phone || student.whatsapp)) {
      group.guardianPhone = student.guardian_phone || student.phone || student.whatsapp
    }
    if (!group.guardianEmail && (student.guardian_email || student.email)) {
      group.guardianEmail = student.guardian_email || student.email
    }
  }

  // Calcula totais de cada grupo
  const groups = Array.from(groupsMap.values())
  for (const group of groups) {
    const isMultiStudentFamily =
      group.students.length > 1 && !group.guardianName.startsWith('Aluno:')

    let totalFull = 0
    let totalOnTime = 0

    for (const st of group.students) {
      const plan = st.plan_id ? planMap.get(st.plan_id) : undefined
      const isFamilyPlan =
        (plan && plan.name.toLowerCase().includes('fam')) ||
        st.monthly_fee === 100 ||
        isMultiStudentFamily

      // Valor cheio do plano
      const baseFee =
        st.monthly_fee && st.monthly_fee > 0
          ? st.monthly_fee
          : plan?.monthly_price || (isFamilyPlan ? 100 : 110)

      totalFull += baseFee

      // Desconto família de R$ 10,00 por aluno quando pago até o vencimento
      const discount = isFamilyPlan ? 10 : 0
      totalOnTime += Math.max(0, baseFee - discount)
    }

    group.totalMonthlyFee = totalFull
    group.totalDiscountedFeeOnTime = totalOnTime
    group.hasFamilyDiscount =
      isMultiStudentFamily ||
      group.students.some((s) => {
        const p = s.plan_id ? planMap.get(s.plan_id) : undefined
        return p?.name.toLowerCase().includes('fam')
      })
  }

  // Ordena grupos com mais alunos primeiro ou alfabeticamente
  groups.sort((a, b) => {
    // Famílias com 2+ alunos primeiro
    if (a.students.length > 1 && b.students.length <= 1) return -1
    if (b.students.length > 1 && a.students.length <= 1) return 1
    return a.guardianName.localeCompare(b.guardianName, 'pt-BR')
  })

  return groups
}

/**
 * Calcula o valor de cobrança de um aluno considerando se é plano Família
 * e o valor com desconto caso pago até o vencimento.
 */
export function calculateStudentCharge(
  student: StudentRecord,
  plans: PlanRecord[],
  allStudents: StudentRecord[],
  paidDateOrDueDate?: { paidDate?: string; dueDate?: string },
): {
  baseAmount: number
  discountAmount: number
  finalAmount: number
  isFamilyPlan: boolean
  paidOnTime: boolean
} {
  const planMap = new Map(plans.map((p) => [p.id, p]))
  const plan = student.plan_id ? planMap.get(student.plan_id) : undefined

  const familyMembers = getFamilyStudents(student, allStudents)
  const isFamily =
    (plan && plan.name.toLowerCase().includes('fam')) ||
    familyMembers.length > 1 ||
    student.monthly_fee === 100

  // Valor cheio
  const baseAmount =
    student.monthly_fee && student.monthly_fee > 0
      ? student.monthly_fee
      : plan?.monthly_price || (isFamily ? 100 : 110)

  // Desconto família de R$ 10,00 por aluno
  const discountAmount = isFamily ? 10 : 0

  let paidOnTime = true
  if (paidDateOrDueDate?.paidDate && paidDateOrDueDate?.dueDate) {
    const paid = new Date(paidDateOrDueDate.paidDate).setHours(0, 0, 0, 0)
    const due = new Date(paidDateOrDueDate.dueDate).setHours(23, 59, 59, 999)
    paidOnTime = paid <= due
  }

  const finalAmount = paidOnTime ? Math.max(0, baseAmount - discountAmount) : baseAmount

  return {
    baseAmount,
    discountAmount,
    finalAmount,
    isFamilyPlan: isFamily,
    paidOnTime,
  }
}
