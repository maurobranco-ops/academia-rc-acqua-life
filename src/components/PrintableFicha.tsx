// Dialog da ficha de matrícula imprimível com contêiner de impressão DEDICADO.
//
// Mecânica de impressão (corrige 2 defeitos reportados na /matriculas):
// 1. Fichas acumuladas: antes de cada impressão o contêiner #ficha-print-root
//    é ZERADO (replaceChildren) e recebe EXATAMENTE a ficha aberta no dialog —
//    cada Ctrl+P/impressão sai com uma única ficha.
// 2. Ficha cortada na 1ª página: o CSS de impressão (main.css) esconde o app
//    inteiro (body.ficha-printing > #root) e imprime só o nó clonado para
//    #ficha-print-root, que fica NO FLUXO NORMAL do body — conteúdo
//    multipáginas (termo, normas, assinaturas) paginado pelo navegador, sem
//    position:absolute (que corta após a 1ª folha no Chrome).

import { createRoot, type Root } from 'react-dom/client'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'
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

/** Limpa o contêiner de impressão dedicado e devolve-o, criando-o se preciso. */
function preparePrintRoot(): HTMLElement {
  let root = document.getElementById(PRINT_ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = PRINT_ROOT_ID
    document.body.appendChild(root)
  }
  // Zera qualquer ficha de impressão anterior (defeito das fichas acumuladas).
  if (printReactRoot) {
    printReactRoot.unmount()
    printReactRoot = null
  } else {
    root.replaceChildren()
  }
  return root
}

/**
 * Imprime a ficha: clona a folha para o contêiner dedicado, marca o body para
 * o CSS esconder o app e chama window.print de forma sincronizada.
 */
export function printFicha(data: PrintableFichaData, studentId?: string) {
  const root = preparePrintRoot()

  if (!printReactRoot) {
    const holder = document.createElement('div')
    root.appendChild(holder)
    printReactRoot = createRoot(holder)
  }
  printReactRoot.render(<FichaSheet data={data} studentId={studentId} />)

  document.body.classList.add(BODY_CLASS)
  window.print()
  document.body.classList.remove(BODY_CLASS)
}

export function PrintableFichaDialog({
  open,
  onOpenChange,
  data,
  studentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: PrintableFichaData | null
  studentId?: string
}) {
  if (!open || !data) return null

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
