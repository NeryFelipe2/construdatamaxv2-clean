#!/usr/bin/env bash
# verificar.sh — o gate de verdade.
#
# POR QUE ESTE ARQUIVO EXISTE: `npx tsc --noEmit` na raiz checa ZERO arquivos
# (tsconfig.json tem "files": [] e só project references), e `npm run build`
# é só `vite build`, que remove os tipos sem conferir. Os dois passavam verdes
# com um identificador inexistente no código — foi assim que `CalendarRange is
# not defined` chegou em produção e quebrou o módulo DRE.
#
# O projeto tem erros de tipo pré-existentes, então o critério não é "zero
# erros": é "nenhum erro NOVO em relação ao baseline".
set -u
cd "$(dirname "$0")"

echo "── typecheck (tsconfig.app.json — o que realmente cobre src/) ──"
npx tsc -p tsconfig.app.json --noEmit 2>&1 | tee /tmp/tsc-atual.txt | tail -5
grep -oE "^src/[^(]+\([0-9]+,[0-9]+\): error TS[0-9]+" /tmp/tsc-atual.txt \
  | sed 's/([0-9]*,[0-9]*)//' | sort | uniq -c | sort -rn > /tmp/tsc-atual-assinaturas.txt

NOVOS=$(diff <(awk '{$1="";print}' .tsc-baseline.txt | sort) \
             <(awk '{$1="";print}' /tmp/tsc-atual-assinaturas.txt | sort) \
        | grep '^>' | sed 's/^> //')

if [ -n "$NOVOS" ]; then
  echo; echo "!! ERROS DE TIPO NOVOS (não estavam no baseline):"
  echo "$NOVOS" | sed 's/^/   /'
  echo; echo "Se forem intencionais, atualize o baseline:"
  echo "   npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -oE '^src/[^(]+\([0-9]+,[0-9]+\): error TS[0-9]+' | sed 's/([0-9]*,[0-9]*)//' | sort | uniq -c | sort -rn > .tsc-baseline.txt"
  exit 1
fi
echo "OK — nenhum erro de tipo novo."

echo; echo "── build ──"
npm run build 2>&1 | grep -E "error|built in" | tail -3

echo; echo "── ícone/componente usado sem importar (o bug do CalendarRange) ──"
python - <<'PY'
import os,re
faltas=[]
for root,_,files in os.walk("src"):
    for f in files:
        if not f.endswith((".tsx",".ts")): continue
        p=os.path.join(root,f); t=open(p,encoding='utf-8',errors='ignore').read()
        nomes=set()
        for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]*)\}\s*from", t, re.S):
            for x in m.group(1).split(','):
                x=x.strip().replace('type ','').split(' as ')
                nomes.add(x[-1].strip() if len(x)>1 else x[0].strip())
        nomes |= set(re.findall(r"(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)", t))
        usados = set(re.findall(r"icon:\s*([A-Z][A-Za-z0-9]*)", t)) | set(re.findall(r"<([A-Z][A-Za-z0-9]*)\s+size=", t))
        f2 = usados - nomes - {'Icone','Icon','Component','React'}
        if f2: faltas.append((p, sorted(f2)))
if faltas:
    print("!! USADO SEM IMPORTAR:")
    for p,n in faltas: print("  ", p, "->", ", ".join(n))
    raise SystemExit(1)
print("OK — nada usado sem importar.")
PY
