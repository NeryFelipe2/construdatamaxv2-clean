/**
 * useSoltarArquivo — os handlers de arrastar-e-soltar, sem opinião sobre aparência.
 *
 * ⚠️ Mora num arquivo só dele por causa da regra `react-refresh/only-export-components`: um
 * arquivo que exporta componente E função perde o recarregamento rápido no desenvolvimento.
 *
 * ─── DUAS COISAS QUE O PADRÃO COPIADO PELO PRODUTO ERRAVA ─────────────────────
 * 1. **`preventDefault` no `onDragOver` é obrigatório.** Sem ele o navegador nunca dispara o
 *    `drop` — a área parece funcionar e simplesmente não recebe nada.
 * 2. **`onDragLeave` sozinho pisca.** Ele dispara ao passar de um filho para outro dentro da
 *    própria área, então o realce apagava e acendia com o cursor se movendo por dentro. Aqui há
 *    um contador de profundidade: só apaga quando as saídas alcançam as entradas.
 *
 * ⚠️ Isto não substitui a guarda global de `src/main.tsx`. Ela impede o acidente quando a pessoa
 * erra o alvo; isto aqui é o alvo.
 */
import { useCallback, useRef, useState } from 'react'

/**
 * O que está sendo arrastado é ARQUIVO?
 *
 * ⚠️ Existe porque o produto arrasta outras coisas: o Planejamento reordena linhas de tabela
 * arrastando, o Relatório 360 tem um kanban, e navegador nenhum distingue isso sozinho. Sem esta
 * checagem, arrastar uma linha de trecho acenderia a área de importar planilha — e soltar ali
 * chamaria o leitor com zero arquivos.
 *
 * `types` é `DOMStringList`-ish: no Chrome vem `['Files']`, no Safari pode vir com outros itens
 * junto. Por isso é `includes`, não igualdade.
 */
export function arrastaArquivo(types: readonly string[] | DOMStringList | undefined): boolean {
  if (!types) return false
  return Array.from(types as ArrayLike<string>).includes('Files')
}

export interface UsoDeSoltar {
  /** `true` enquanto há arquivo pairando sobre a área. */
  arrastando: boolean
  /** Espalhe no elemento que deve receber o arquivo. */
  props: {
    onDragEnter: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }
}

/**
 * Os handlers, sem opinião nenhuma sobre aparência.
 *
 * Use quando a área já existe e só falta receber o arquivo — uma célula de tabela, uma barra de
 * ações, um `<label>` que já é botão. Quando não existe, use `<AreaDeSoltar>`.
 */
export function useSoltarArquivo(
  aoSoltar: (arquivos: File[]) => void,
  opcoes: { desabilitado?: boolean } = {},
): UsoDeSoltar {
  const [arrastando, setArrastando] = useState(false)
  /** ⚠️ Entradas menos saídas. Ver o item 2 do cabeçalho. */
  const profundidade = useRef(0)

  const limpar = useCallback(() => { profundidade.current = 0; setArrastando(false) }, [])

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (opcoes.desabilitado) return
    // Só reage a ARQUIVO. Sem isto, arrastar uma linha de tabela (o reordenar do Planejamento) ou
    // um texto selecionado acenderia a área de importação.
    if (!arrastaArquivo(e.dataTransfer.types)) return
    e.preventDefault()
    profundidade.current += 1
    setArrastando(true)
  }, [opcoes.desabilitado])

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (opcoes.desabilitado) return
    if (!arrastaArquivo(e.dataTransfer.types)) return
    // Obrigatório: sem este preventDefault o `drop` nunca dispara.
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [opcoes.desabilitado])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (opcoes.desabilitado) return
    e.preventDefault()
    profundidade.current -= 1
    if (profundidade.current <= 0) limpar()
  }, [opcoes.desabilitado, limpar])

  const onDrop = useCallback((e: React.DragEvent) => {
    if (opcoes.desabilitado) return
    e.preventDefault()
    // Impede a guarda global de `main.tsx` de também tratar este evento. Ela não faria mal (só
    // repetiria o preventDefault), mas parar aqui deixa a intenção explícita.
    e.stopPropagation()
    limpar()
    const arquivos = Array.from(e.dataTransfer.files ?? [])
    if (arquivos.length) aoSoltar(arquivos)
  }, [opcoes.desabilitado, limpar, aoSoltar])

  return { arrastando, props: { onDragEnter, onDragOver, onDragLeave, onDrop } }
}
