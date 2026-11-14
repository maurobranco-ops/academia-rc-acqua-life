import { cn } from '@/lib/utils'
import logoUrl from '@/assets/logo-sem-fundo-81244.png'

/**
 * Logotipo oficial da RC Acqua Life.
 *
 * A logo original tem texto navy sobre fundo transparente/claro — sobre o
 * fundo navy do app ela desapareceria. Por isso ela sempre é exibida dentro
 * de um "chip" branco arredondado com leve borda dourada, em qualquer
 * contexto (barra mobile, drawer, sidebar e telas de autenticação).
 */

interface LogoProps {
  /** Tamanho do chip quadrado em px (o conteúdo é ajustado proporcionalmente) */
  size?: number
  className?: string
}

export function LogoMark({ size = 40, className }: LogoProps) {
  return (
    <div
      className={cn(
        'shrink-0 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-md ring-1 ring-[#D4AF37]/50',
        className,
      )}
      style={{ width: size, height: size, padding: size * 0.09 }}
    >
      <img
        src={logoUrl}
        alt="Logo RC Acqua Life"
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  )
}

interface LogoFullProps {
  /** Renderiza o texto ao lado da marca (falso = apenas o chip) */
  withText?: boolean
  size?: number
  textClassName?: string
  subtitleClassName?: string
  className?: string
}

export function LogoFull({
  withText = true,
  size = 40,
  textClassName,
  subtitleClassName,
  className,
}: LogoFullProps) {
  if (!withText) return <LogoMark size={size} className={className} />
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <LogoMark size={size} />
      <div className="truncate min-w-0">
        <span
          className={cn(
            'font-bold text-sm text-white tracking-wide block leading-tight',
            textClassName,
          )}
        >
          RC Acqua Life
        </span>
        <span
          className={cn(
            'text-[10px] text-[#D4AF37] tracking-wider uppercase font-semibold',
            subtitleClassName,
          )}
        >
          Natação &amp; Hidro
        </span>
      </div>
    </div>
  )
}

export default LogoFull
