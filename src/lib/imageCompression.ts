/**
 * Utilitário de compressão e redimensionamento de imagens no navegador via HTML Canvas.
 * Reduz dramaticamente o payload em MB enviado pela rede antes do upload para o PocketBase,
 * preservando nitidez e proporção adequadas para exibição de fotos de alunos.
 */

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: 'image/jpeg' | 'image/webp'
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  mimeType: 'image/jpeg',
}

/**
 * Redimensiona e comprime um arquivo de imagem se necessário.
 * Se o arquivo for menor que 150KB ou não for imagem redimensionável (ex: GIF animado),
 * retorna o arquivo original diretamente para poupar processamento.
 */
export async function compressImage(
  file: File | Blob,
  filename?: string,
  options?: CompressOptions,
): Promise<{ file: File | Blob; originalSize: number; compressedSize: number }> {
  const originalSize = file.size
  const originalName = (file instanceof File ? file.name : filename) || 'photo.jpg'
  const lowerName = originalName.toLowerCase()

  // Não comprime GIFs animados ou arquivos minúsculos (< 120KB)
  if (lowerName.endsWith('.gif') || originalSize < 120 * 1024) {
    return { file, originalSize, compressedSize: originalSize }
  }

  const { maxWidth, maxHeight, quality, mimeType } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img

      // Calcula novas dimensões mantendo aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        // Fallback para arquivo original caso canvas não esteja disponível
        resolve({ file, originalSize, compressedSize: originalSize })
        return
      }

      // Fundo branco caso haja transparência convertida para JPEG
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= originalSize) {
            // Se por algum motivo o blob comprimido ficou maior que o original, mantém o original
            resolve({ file, originalSize, compressedSize: originalSize })
            return
          }

          // Gera nome final garantindo extensão coerente
          const baseName = originalName.replace(/\.[^/.]+$/, '')
          const extension = mimeType === 'image/webp' ? '.webp' : '.jpg'
          const finalFilename = `${baseName}${extension}`
          const compressedFile = new File([blob], finalFilename, { type: mimeType })

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: blob.size,
          })
        },
        mimeType,
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Se der erro ao carregar imagem, mantém o original
      resolve({ file, originalSize, compressedSize: originalSize })
    }

    img.src = objectUrl
  })
}
