// Dialog da ficha de matrícula imprimível com contêiner de impressão DEDICADO.
//
// Mecânica de impressão (corrige 3 defeitos reportados na /matriculas):
// 1. Página em branco: a renderização do React 18 é assíncrona — chamar
//    window.print() na mesma linha após root.render() chegava à impressora
//    ANTES de a ficha ser gravada no contêiner. Agora o render é forçado a
//    acontecer na hora com flushSync, e só então a impressão dispara.
// 2. Fichas acumuladas: antes de cada impressão o contêiner #ficha-print-root
//    é ZERADO (replaceChildren, inclusive divs vazios residuais) e recebe
//    EXATAMENTE a ficha aberta no dialog — cada impressão sai com uma ficha.
// 3. Ficha cortada na 1ª página: o CSS de impressão (main.css) esconde o app
//    inteiro (body.ficha-printing > #root) e imprime só o nó clonado para
//    #ficha-print-root, que fica NO FLUXO NORMAL do body — conteúdo
//    multipáginas (termo, normas, assinaturas) paginado pelo navegador, sem
//    position:absolute (que corta após a 1ª folha no Chrome).
//
// Controle de reimpressão (migration 0030): o botão "Registrar assinatura"
// grava ficha_assinada_em = hoje e limpa ficha_pendente do aluno — nunca pela
// academyService.updateStudent, que remarcaria o pendente (ver comentario do
// método). Opcional (onSignatureRegistered) para quem quiser recarregar a lista.

import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PenLine, Printer, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { academyService } from '@/services/academy'
import {
  FichaSheet,
  requestToPrintable,
  studentToPrintable,
  type PrintableFichaData,
} from '@/components/FichaSheet'

// Reexports: as telas montam os dados com estes helpers e os tipos.
export { studentToPrintable, requestToPrintable }
export type { PrintableFichaData }

const PRINT_ROOT_ID = 'ficha-print-root'
const BODY_CLASS = 'ficha-printing'

let printReactRoot: Root | null = null

/** Desmonta o React root e remove TODO o conteúdo do contêiner de impressão. */
function destroyPrintRoot() {
  if (printReactRoot) {
    printReactRoot.unmount()
    printReactRoot = null
  }
  document.getElementById(PRINT_ROOT_ID)?.replaceChildren()
}

/** Cria (ou recicla) o contêiner de impressão dedicado, vazio, com um holder novo. */
function preparePrintRoot(): HTMLElement {
  destroyPrintRoot()

  let root = document.getElementById(PRINT_ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = PRINT_ROOT_ID
    document.body.appendChild(root)
  }
  // Garante contêiner sem resíduos (nem div vazio de impressão anterior).
  root.replaceChildren()

  const holder = document.createElement('div')
  root.appendChild(holder)
  printReactRoot = createRoot(holder)
  return root
}

/**
 * Imprime a ficha: grava a folha no contêiner dedicado de forma SINCRONA
 * (flushSync), marca o body para o CSS esconder o app e chama window.print.
 */
export function printFicha(data: PrintableFichaData, studentId?: string) {
  const root = preparePrintRoot()
  if (!printReactRoot) return

  // flushSync força o React a gravar a ficha no DOM AGORA — sem isso o
  // window.print() disparava com o contêiner ainda vazio (página em branco).
  flushSync(() => {
    printReactRoot!.render(<FichaSheet data={data} studentId={studentId} />)
  })

  document.body.classList.add(BODY_CLASS)
  window.print()
  document.body.classList.remove(BODY_CLASS)

  // Cleanup pós-impressão: remove a ficha do contêiner para não deixar
  // conteúdo residual entre impressões.
  window.setTimeout(destroyPrintRoot, 300)
}

export function PrintableFichaDialog({
  open,
  onOpenChange,
  data,
  studentId,
  onSignatureRegistered,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: PrintableFichaData | null
  studentId?: string
  /** Chamado após a assinatura ser gravada (para o chamador recarregar o aluno). */
  onSignatureRegistered?: () => void
}) {
  const { toast } = useToast()
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)

  // O diálogo fica montado entre aberturas: ao fechar, limpa o estado para a
  // próxima ficha (de outro aluno) reabrir com o botão "Registrar assinatura" ativo.
  useEffect(() => {
    if (!open) {
      setSigned(false)
      setSigning(false)
    }
  }, [open])

  if (!open || !data) return null

  const handleRegisterSignature = async () => {
    if (!studentId || signing) return
    setSigning(true)
    try {
      await academyService.registrarAssinaturaFicha(studentId)
      setSigned(true)
      toast({
        title: 'Assinatura registrada!',
        description: `Ficha de ${data.studentName} assinada em ${new Date().toLocaleDateString('pt-BR')} — pendência de reimpressão removida.`,
      })
      onSignatureRegistered?.()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao registrar assinatura',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="ficha-overlay fixed inset-0 z-[70] bg-black/60 overflow-y-auto p-4">
      {/* Barra de ações — não sai na impressão */}
      <div className="no-print sticky top-0 z-10 mx-auto max-w-[760px] flex items-center justify-between bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-2.5 mb-4">
        <div>
          <div className="text-sm font-bold text-[#0F1B3D]">Ficha de Matrícula Imprimível</div>
          <div className="text-[11px] text-[#6C757D]">
            Confira os dados e clique em "Imprimir" para gerar o documento para assinatura.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" />
            Fechar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold"
            disabled={!studentId || signing || signed}
            onClick={handleRegisterSignature}
            title={
              studentId
                ? 'Grava a data de hoje como assinatura da ficha e remove a pendência de reimpressão.'
                : 'Disponível apenas para fichas de alunos já cadastrados.'
            }
          >
            <PenLine className="w-4 h-4 mr-1" />
            {signed ? 'Assinatura registrada' : signing ? 'Registrando...' : 'Registrar assinatura'}
          </Button>
          <Button
            size="sm"
            onClick={() => data && printFicha(data, studentId)}
            className="bg-[#0F1B3D] hover:bg-[#1a2b57] text-white font-bold"
          >
            <Printer className="w-4 h-4 mr-1" />
            Imprimir ficha
          </Button>
        </div>
      </div>

      {/* Pré-visualização da folha imprimível (na tela) */}
      <div className="mx-auto max-w-[760px] bg-white mb-8">
        <div className="border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <FichaSheet data={data} studentId={studentId} />
        </div>
      </div>
    </div>
  )
}
