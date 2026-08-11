# Importar pontos no Civil 3D - corrigido

Use este arquivo:

```text
ESTACAO_GENIVALDO_CIVIL3D_PXYZD.csv
```

Formato correto:

```text
P,X,Y,Z,D
Numero do ponto, X local, Y local, Cota, Descricao
```

O TXT original vem em linha `NEZ nome valor1 valor2 cota`.
Aqui foi convertido para CAD assim:

```text
X = segundo valor do NEZ
Y = primeiro valor do NEZ
Z = cota
D = nome original do ponto
```

Exemplo:

```text
NEZ CR6 10000.0000 5000.0000 100.000
vira
1,5000.0000,10000.0000,100.000,CR6
```

No Civil 3D:

```text
Import Points
Format: PXYZD comma delimited
```

Se o seu template nao tiver PXYZD, crie um Point File Format com colunas:

```text
Point Number, X, Y, Elevation, Description
Delimiter: comma
```
