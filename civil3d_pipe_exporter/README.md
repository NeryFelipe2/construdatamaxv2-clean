# Civil 3D Pipe Network Exporter

Plugin .NET 8 para Civil 3D que exporta Pipe Networks para JSON e CSV.

## Comando

Depois de carregar a DLL no Civil 3D com `NETLOAD`, execute:

```text
CD_EXPORT_PIPENET
```

O plugin salva os arquivos na pasta:

```text
<PASTA_DO_DWG>\_construdata_exports\
```

Arquivos gerados por execução:

- `*_pipe_network_export_*.json`
- `*_pipe_network_export_*_networks.csv`
- `*_pipe_network_export_*_pipes.csv`
- `*_pipe_network_export_*_structures.csv`

## Dados exportados

### Networks

- nome
- descrição
- parts list
- alignment/surface de referência
- lista de pipes
- lista de structures

### Pipes

- handle
- nome
- display name
- descrição
- part family / part size / material
- style
- structure inicial e final
- pontos inicial e final
- comprimentos 2D/3D
- declividade
- diâmetro/largura interna e externa
- coeficiente de Manning, quando disponível
- shape da seção

### Structures

- handle
- nome
- display name
- descrição
- part family / part size / material
- style
- location / easting / northing
- rim elevation
- sump elevation
- sump depth
- largura/diâmetro
- quantidade de pipes conectados
- nomes e handles dos pipes conectados

## Build

Pré-requisitos:

- Visual Studio 2022 ou `dotnet` SDK 8
- Civil 3D 2026 instalado em `C:\Program Files\Autodesk\AutoCAD 2026`

Build via script:

```powershell
cd civil3d_pipe_exporter
.\build.ps1
```

Se o SDK não estiver instalado no sistema, o script baixa um SDK .NET 8 local para `civil3d_pipe_exporter\.dotnet\`.

Ou build direto:

```powershell
dotnet build .\PipeNetworkExporter.csproj -c Release
```

## Bundle Autodesk

O template de bundle está em:

- [PackageContents.xml](C:/Users/felip/Downloads/NOVA%20NS%20Versao%205/civil3d_pipe_exporter/bundle/PipeNetworkExporter.bundle/PackageContents.xml)

O `build.ps1` copia a DLL compilada para:

- `civil3d_pipe_exporter\bundle\PipeNetworkExporter.bundle\Contents\`

Depois disso você pode:

1. copiar a pasta `PipeNetworkExporter.bundle` para `C:\ProgramData\Autodesk\ApplicationPlugins\`
2. ou carregar a DLL manualmente com `NETLOAD`

## Observações

- O projeto foi configurado com referências locais para `acmgd.dll`, `acdbmgd.dll`, `accoremgd.dll` e `AeccDbMgd.dll`.
- Se o Civil 3D estiver em outro caminho, passe propriedades no build:

```powershell
dotnet build .\PipeNetworkExporter.csproj -c Release `
  -p:AutoCADRoot="D:\Autodesk\AutoCAD 2026" `
  -p:Civil3DRoot="D:\Autodesk\AutoCAD 2026\C3D"
```

- Este plugin lê Pipe Networks gravitacionais nativos do Civil 3D. Não cobre pressure networks nesta versão.
