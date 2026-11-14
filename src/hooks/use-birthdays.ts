import { useEffect, useState } from 'react'
import { academyService } from '@/services/academy'
import { ageOn, isBirthdayOn } from '@/lib/birthday'
import { isStudentInactive } from '@/lib/studentPhoto'
import type { EnrollmentRecord, StudentRecord } from '@/types/database'

export interface BirthdayEntry {
  student: StudentRecord
  classNames: string[]
  age: number
}

/** Alunos ativos que fazem aniversário hoje, com turmas ativas e idade que completam. */
export function useBirthdays(refreshKey?: string) {
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const today = new Date()
        const students = await academyService.getStudents()
        const todayStudents = students.filter(
          (s) => !isStudentInactive(s) && isBirthdayOn(s.birth_date, today),
        )

        if (todayStudents.length === 0) {
          if (!cancelled) setBirthdays([])
          return
        }

        const enrollments: EnrollmentRecord[] = await academyService.getEnrollments()
        const classesByStudent = new Map<string, string[]>()
        for (const enr of enrollments) {
          if (!enr.is_active) continue
          const className = enr.expand?.class_id?.name
          if (!className) continue
          const list = classesByStudent.get(enr.student_id) ?? []
          list.push(className)
          classesByStudent.set(enr.student_id, list)
        }

        const entries: BirthdayEntry[] = todayStudents
          .map((student) => ({
            student,
            classNames: classesByStudent.get(student.id) ?? [],
            age: ageOn(student.birth_date, today) ?? 0,
          }))
          .sort((a, b) => a.student.name.localeCompare(b.student.name, 'pt-BR'))

        if (!cancelled) setBirthdays(entries)
      } catch (err) {
        console.error('Erro ao carregar aniversariantes', err)
        if (!cancelled) setBirthdays([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return { birthdays, loading }
}
