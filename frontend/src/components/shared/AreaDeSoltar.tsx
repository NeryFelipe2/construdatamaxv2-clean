/**
 * AreaDeSoltar — arrastar e soltar arquivo, num lugar só.
 *
 * ─── POR QUE EXISTE ───────────────────────────────────────────────────────────
 * O produto tinha 48 pontos de importação e **7** aceitavam arrastar — cada um com uma cópia
 * manual do mesmo punhado de handlers. Nos outros 41, quem arrastava o arquivo para a tela via o
 * navegador **sair do aplicativo** e abrir o arquivo, descartando tudo que não estava gravado.
 *
 * ─── DUAS COISAS QUE O PADRÃO COPIADO ERRAVA ──────────────────────────────────
 * 1. **`preventDefault` no `onDragOver` é obrigatório.** Sem ele o navegador nunca dispara o
 *    `drop` — a área parece funcionar e simplesmente não recebe nada.
 * 2. **`onDragLeave` sozinho pisca.** Ele dispara ao passar de um filho para outro dentro da
 *    própria área, então o realce apagava e acendia enquanto o cursor se movia por dentro. Aqui
 *    há um contador de profundidade: só apaga quando as saídas alcançam as entradas.
 *
 * ⚠️ Isto não substitui a guarda global de `src/main.tsx`. Ela é que impede o acidente quando a
 * pessoa erra o alvo; esta área é o alvo.
 */
import { useRef } from 'react'
import { useSoltarArquivo } from '@/hooks/useSoltarArquivo'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AreaDeSoltarProps {
  /** Chamado com os arquivos soltos ou escolhidos. Sempre uma lista, mesmo com um só. */
  aoEscolher: (arquivos: File[]) => void
  /** O `accept` do input. Também vira o texto de ajuda quando `ajuda` não é passado. */
  aceita?: string
  varios?: boolean
  desabilitado?: boolean
  titulo?: string
  ajuda?: string
  /** Versão de uma linha, para barra de ações e célula de tabela. */
  compacto?: boolean
  className?: string
}

/**
 * O quadro tracejado — sempre visível, para ensinar que dá para arrastar.
 *
 * Clicar abre o seletor; arrastar solta direto. Os dois caminhos chamam `aoEscolher`.
 */
export function AreaDeSoltar({
  aoEscolher, aceita, varios = false, desabilitado = false,
  titulo, ajuda, compacto = false, className,
}: AreaDeSoltarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { arrastando, props } = useSoltarArquivo(aoEscolher, { desabilitado })

  function aoTrocar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    // ⚠️ Zera o input: sem isto, escolher o MESMO arquivo duas vezes seguidas não dispara
    // `change` na segunda, e a tela fica parecendo travada.
    e.target.value = ''
    if (arquivos.length) aoEscolher(arquivos)
  }

  const rotulo = titulo ?? (varios ? 'Arraste os arquivos aqui ou clique para selecionar'
                                   : 'Arraste o arquivo aqui ou clique para selecionar')
  const dica = ajuda ?? (aceita ? `Aceita ${aceita.split(',').map((a) => a.trim()).filter((a) => a.startsWith('.')).join(', ') || aceita}` : '')

  return (
    <div
      {...props}
      onClick={() => { if (!desabilitado) inputRef.current?.click() }}
      role="button"
      tabIndex={desabilitado ? -1 : 0}
      onKeyDown={(e) => { if (!desabilitado && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click() } }}
      aria-disabled={desabilitado}
      className={cn(
        'rounded-xl border-2 border-dashed text-center transition-colors',
        compacto ? 'px-3 py-2' : 'p-8',
        desabilitado
          ? 'cursor-not-allowed border-[#3d3d3d] bg-[#2c2c2c]/40 opacity-60'
          : arrastando
            ? 'cursor-copy border-[#f97316] bg-[#f97316]/10'
            : 'cursor-pointer border-[#525252] bg-[#3a3a3a]/40 hover:border-[#6b6b6b]',
        className,
      )}
    >
      {compacto ? (
        <span className="flex items-center justify-center gap-2 text-xs text-[#a3a3a3]">
          <Upload size={14} /> {rotulo}
        </span>
      ) : (
        <>
          <Upload size={36} className="mx-auto mb-2 text-[#a3a3a3]" />
          <div className="mb-1 text-sm font-semibold text-[#f5f5f5]">{rotulo}</div>
          {dica && <div className="text-xs text-[#a3a3a3]">{dica}</div>}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={aceita}
        multiple={varios}
        disabled={desabilitado}
        onChange={aoTrocar}
        onClick={(e) => e.stopPropagation()}
        className="hidden"
      />
    </div>
  )
}
