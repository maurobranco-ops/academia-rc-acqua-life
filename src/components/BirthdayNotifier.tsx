import { PartyPopper } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useBirthdays, type BirthdayEntry } from '@/hooks/use-birthdays'
import { getStudentPhotoUrl } from '@/lib/studentPhoto'
import { WHATSAPP_CONNECTOR_READY } from '@/lib/birthday'

interface BirthdayNotifierProps {
  refreshKey?: string
}

/** Ícone de festa do cabeçalho: aparece só quando há aniversariantes hoje. */
export function BirthdayNotifier({ refreshKey }: BirthdayNotifierProps) {
  const { birthdays } = useBirthdays(refreshKey)

  if (birthdays.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-[#0F1B3D] hover:bg-slate-50 transition shrink-0"
          aria-label="Aniversariantes do dia"
        >
          <PartyPopper className="w-5 h-5 text-[#D4AF37]" />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF6B6B] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {birthdays.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[calc(100vw-2rem)] max-w-sm sm:w-96 p-0 rounded-xl shadow-xl border-slate-200"
      >
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="font-bold text-sm text-[#0F1B3D]">Aniversariantes do dia</p>
          <p className="text-[11px] text-[#6C757D]">
            {birthdays.length === 1
              ? '1 aluno faz aniversário hoje'
              : `${birthdays.length} alunos fazem aniversário hoje`}
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {birthdays.map((entry) => (
            <BirthdayItem key={entry.student.id} entry={entry} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function BirthdayItem({ entry }: { entry: BirthdayEntry }) {
  const { student, classNames, age } = entry
  const photoUrl = getStudentPhotoUrl(student, '100x100')
  const turmaText = classNames.length > 0 ? `Turma ${classNames.join(', ')}` : 'Sem turma ativa'

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <Avatar className="w-10 h-10 shrink-0 bg-slate-100">
        {photoUrl ? (
          <AvatarImage src={photoUrl} alt={student.name} className="object-cover" />
        ) : null}
        <AvatarFallback className="text-xs bg-[#0F1B3D] text-white">
          {student.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-bold text-[#1E2A3A] break-words">{student.name}</p>
        <p className="text-[11px] text-slate-500 break-words">
          {turmaText} · completa {age} anos
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!WHATSAPP_CONNECTOR_READY}
          className="text-xs w-full sm:w-auto whitespace-normal h-auto py-1.5"
        >
          Enviar parabéns por WhatsApp
        </Button>
        {!WHATSAPP_CONNECTOR_READY && (
          <p className="text-[11px] text-[#6C757D]">
            Disponível quando o WhatsApp da academia for conectado.
          </p>
        )}
      </div>
    </div>
  )
}
