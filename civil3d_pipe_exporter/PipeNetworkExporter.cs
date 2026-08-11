using System.Globalization;
using System.Text;
using System.Text.Json;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using Autodesk.Civil.ApplicationServices;
using Autodesk.Civil.DatabaseServices;

using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
using AcDbObject = Autodesk.AutoCAD.DatabaseServices.DBObject;

[assembly: ExtensionApplication(typeof(ConstruData.Civil3D.PipeNetworkExporter.PipeNetworkExporterPlugin))]
[assembly: CommandClass(typeof(ConstruData.Civil3D.PipeNetworkExporter.PipeNetworkExporterPlugin))]

namespace ConstruData.Civil3D.PipeNetworkExporter;

public sealed class PipeNetworkExporterPlugin : IExtensionApplication
{
    private const string CommandName = "CD_EXPORT_PIPENET";

    public void Initialize()
    {
        var doc = AcApp.DocumentManager.MdiActiveDocument;
        doc?.Editor.WriteMessage($"\n[ConstruData] Pipe exporter carregado. Comando: {CommandName}");
    }

    public void Terminate()
    {
    }

    [CommandMethod(CommandName)]
    public static void ExportPipeNetworks()
    {
        var doc = AcApp.DocumentManager.MdiActiveDocument;
        if (doc is null)
        {
            return;
        }

        var editor = doc.Editor;

        try
        {
            var civilDocument = CivilApplication.ActiveDocument;
            if (civilDocument is null)
            {
                editor.WriteMessage("\n[ConstruData] Nenhum CivilDocument ativo.");
                return;
            }

            var outputPaths = OutputPaths.Create(doc.Name);
            Directory.CreateDirectory(outputPaths.DirectoryPath);

            editor.WriteMessage($"\n[ConstruData] Exportando Pipe Networks para: {outputPaths.DirectoryPath}");

            ExportDocument exportDocument;
            using (var transaction = doc.Database.TransactionManager.StartTransaction())
            {
                exportDocument = BuildExportDocument(doc, civilDocument, transaction);
            }

            var jsonOptions = new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            };

            File.WriteAllText(outputPaths.JsonPath, JsonSerializer.Serialize(exportDocument, jsonOptions), Encoding.UTF8);
            WriteNetworksCsv(outputPaths.NetworksCsvPath, exportDocument.Networks);
            WritePipesCsv(outputPaths.PipesCsvPath, exportDocument.Networks);
            WriteStructuresCsv(outputPaths.StructuresCsvPath, exportDocument.Networks);

            editor.WriteMessage(
                $"\n[ConstruData] Export concluido. Redes={exportDocument.Summary.NetworkCount}, " +
                $"Pipes={exportDocument.Summary.PipeCount}, Structures={exportDocument.Summary.StructureCount}");
            editor.WriteMessage($"\n[ConstruData] JSON: {outputPaths.JsonPath}");
            editor.WriteMessage($"\n[ConstruData] CSV redes: {outputPaths.NetworksCsvPath}");
            editor.WriteMessage($"\n[ConstruData] CSV pipes: {outputPaths.PipesCsvPath}");
            editor.WriteMessage($"\n[ConstruData] CSV structures: {outputPaths.StructuresCsvPath}");

            if (exportDocument.Warnings.Count > 0)
            {
                editor.WriteMessage($"\n[ConstruData] Avisos: {exportDocument.Warnings.Count}");
            }
        }
        catch (System.Exception ex)
        {
            editor.WriteMessage($"\n[ConstruData] Erro no export: {ex.Message}");
        }
    }

    private static ExportDocument BuildExportDocument(Document doc, CivilDocument civilDocument, Transaction transaction)
    {
        var drawingPath = doc.Name ?? string.Empty;
        var networkIds = civilDocument.GetPipeNetworkIds();
        var warnings = new List<string>();
        var networks = new List<NetworkExport>();

        foreach (ObjectId networkId in networkIds)
        {
            try
            {
                var network = (Network)transaction.GetObject(networkId, OpenMode.ForRead);
                networks.Add(BuildNetworkExport(network, transaction, warnings));
            }
            catch (System.Exception ex)
            {
                warnings.Add($"Falha ao abrir network {networkId}: {ex.Message}");
            }
        }

        var summary = new ExportSummary
        {
            NetworkCount = networks.Count,
            PipeCount = networks.Sum(n => n.Pipes.Count),
            StructureCount = networks.Sum(n => n.Structures.Count),
        };

        return new ExportDocument
        {
            Generator = "ConstruData Civil 3D Pipe Exporter",
            GeneratedAtUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            DrawingName = Path.GetFileName(drawingPath),
            DrawingPath = drawingPath,
            Summary = summary,
            Networks = networks.OrderBy(n => n.Name, StringComparer.OrdinalIgnoreCase).ToList(),
            Warnings = warnings,
        };
    }

    private static NetworkExport BuildNetworkExport(Network network, Transaction transaction, List<string> warnings)
    {
        var networkExport = new NetworkExport
        {
            Handle = network.Handle.ToString(),
            Name = network.Name,
            Description = network.Description,
            PartsListName = network.PartsListName,
            ReferenceAlignmentName = SafeGet(() => network.ReferenceAlignmentName, warnings, $"Network {network.Name} ReferenceAlignmentName"),
            ReferenceSurfaceName = SafeGet(() => network.ReferenceSurfaceName, warnings, $"Network {network.Name} ReferenceSurfaceName"),
        };

        var structuresById = new Dictionary<ObjectId, StructureExport>();

        foreach (ObjectId structureId in network.GetStructureIds())
        {
            try
            {
                var structure = (Structure)transaction.GetObject(structureId, OpenMode.ForRead);
                var export = new StructureExport
                {
                    Handle = structure.Handle.ToString(),
                    Name = structure.Name,
                    DisplayName = structure.DisplayName,
                    Description = structure.Description,
                    PartDescription = structure.PartDescription,
                    Material = structure.Material,
                    PartFamilyName = structure.PartFamilyName,
                    PartSizeName = structure.PartSizeName,
                    StyleName = structure.StyleName,
                    NetworkName = structure.NetworkName,
                    Location = PointExport.From(structure.Location),
                    Easting = structure.Easting,
                    Northing = structure.Northing,
                    RimElevation = structure.RimElevation,
                    SumpElevation = structure.SumpElevation,
                    SumpDepth = structure.SumpDepth,
                    ConnectedPipesCount = structure.ConnectedPipesCount,
                    DiameterOrWidth = structure.DiameterOrWidth,
                    InnerDiameterOrWidth = structure.InnerDiameterOrWidth,
                    StructureType = structure.StructureType.ToString(),
                };

                networkExport.Structures.Add(export);
                structuresById[structureId] = export;
            }
            catch (System.Exception ex)
            {
                warnings.Add($"Network {network.Name}: falha ao exportar structure {structureId}: {ex.Message}");
            }
        }

        foreach (ObjectId pipeId in network.GetPipeIds())
        {
            try
            {
                var pipe = (Pipe)transaction.GetObject(pipeId, OpenMode.ForRead);
                var startRef = ResolvePartReference(pipe.StartStructureId, transaction);
                var endRef = ResolvePartReference(pipe.EndStructureId, transaction);

                var export = new PipeExport
                {
                    Handle = pipe.Handle.ToString(),
                    Name = pipe.Name,
                    DisplayName = pipe.DisplayName,
                    Description = pipe.Description,
                    PartDescription = pipe.PartDescription,
                    Material = pipe.Material,
                    PartFamilyName = pipe.PartFamilyName,
                    PartSizeName = pipe.PartSizeName,
                    StyleName = pipe.StyleName,
                    NetworkName = pipe.NetworkName,
                    StartStructureHandle = startRef.Handle,
                    StartStructureName = startRef.Name,
                    EndStructureHandle = endRef.Handle,
                    EndStructureName = endRef.Name,
                    StartPoint = PointExport.From(pipe.StartPoint),
                    EndPoint = PointExport.From(pipe.EndPoint),
                    Length2D = pipe.Length2D,
                    Length2DCenterToCenter = pipe.Length2DCenterToCenter,
                    Length3D = pipe.Length3D,
                    Length3DCenterToCenter = pipe.Length3DCenterToCenter,
                    Slope = pipe.Slope,
                    InnerDiameterOrWidth = pipe.InnerDiameterOrWidth,
                    OuterDiameterOrWidth = pipe.OuterDiameterOrWidth,
                    ManningCoefficient = pipe.HasManningCoefficient ? pipe.ManningCoefficient : null,
                    CrossSectionalShape = pipe.CrossSectionalShape.ToString(),
                };

                networkExport.Pipes.Add(export);

                AppendConnection(structuresById, pipe.StartStructureId, export);
                AppendConnection(structuresById, pipe.EndStructureId, export);
            }
            catch (System.Exception ex)
            {
                warnings.Add($"Network {network.Name}: falha ao exportar pipe {pipeId}: {ex.Message}");
            }
        }

        networkExport.Structures = networkExport.Structures
            .OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        networkExport.Pipes = networkExport.Pipes
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return networkExport;
    }

    private static void AppendConnection(Dictionary<ObjectId, StructureExport> structuresById, ObjectId structureId, PipeExport pipe)
    {
        if (structureId.IsNull)
        {
            return;
        }

        if (!structuresById.TryGetValue(structureId, out var structure))
        {
            return;
        }

        if (!structure.ConnectedPipeHandles.Contains(pipe.Handle, StringComparer.OrdinalIgnoreCase))
        {
            structure.ConnectedPipeHandles.Add(pipe.Handle);
        }

        if (!structure.ConnectedPipeNames.Contains(pipe.Name, StringComparer.OrdinalIgnoreCase))
        {
            structure.ConnectedPipeNames.Add(pipe.Name);
        }
    }

    private static PartReference ResolvePartReference(ObjectId objectId, Transaction transaction)
    {
        if (objectId.IsNull)
        {
            return new PartReference(null, null);
        }

        try
        {
            var dbObject = transaction.GetObject(objectId, OpenMode.ForRead);
            if (dbObject is Part part)
            {
                return new PartReference(part.Name, part.Handle.ToString());
            }

            if (dbObject is AcDbObject generic)
            {
                return new PartReference(null, generic.Handle.ToString());
            }
        }
        catch
        {
            // Intentionally ignored. Missing references should not abort the export.
        }

        return new PartReference(null, null);
    }

    private static string? SafeGet(Func<string> getter, List<string> warnings, string context)
    {
        try
        {
            return getter();
        }
        catch (System.Exception ex)
        {
            warnings.Add($"{context}: {ex.Message}");
            return null;
        }
    }

    private static void WriteNetworksCsv(string path, IReadOnlyCollection<NetworkExport> networks)
    {
        var lines = new List<string>
        {
            "network_handle,network_name,description,parts_list_name,reference_alignment_name,reference_surface_name,pipe_count,structure_count"
        };

        foreach (var network in networks.OrderBy(n => n.Name, StringComparer.OrdinalIgnoreCase))
        {
            lines.Add(Csv(
                network.Handle,
                network.Name,
                network.Description,
                network.PartsListName,
                network.ReferenceAlignmentName,
                network.ReferenceSurfaceName,
                network.Pipes.Count,
                network.Structures.Count));
        }

        File.WriteAllLines(path, lines, Encoding.UTF8);
    }

    private static void WritePipesCsv(string path, IReadOnlyCollection<NetworkExport> networks)
    {
        var lines = new List<string>
        {
            "network_name,pipe_handle,pipe_name,display_name,description,part_description,material,part_family_name,part_size_name,style_name,start_structure_handle,start_structure_name,end_structure_handle,end_structure_name,start_x,start_y,start_z,end_x,end_y,end_z,length_2d,length_2d_center_to_center,length_3d,length_3d_center_to_center,slope,inner_diameter_or_width,outer_diameter_or_width,manning_coefficient,cross_sectional_shape"
        };

        foreach (var pipe in networks.SelectMany(n => n.Pipes.Select(p => (Network: n, Pipe: p))))
        {
            lines.Add(Csv(
                pipe.Network.Name,
                pipe.Pipe.Handle,
                pipe.Pipe.Name,
                pipe.Pipe.DisplayName,
                pipe.Pipe.Description,
                pipe.Pipe.PartDescription,
                pipe.Pipe.Material,
                pipe.Pipe.PartFamilyName,
                pipe.Pipe.PartSizeName,
                pipe.Pipe.StyleName,
                pipe.Pipe.StartStructureHandle,
                pipe.Pipe.StartStructureName,
                pipe.Pipe.EndStructureHandle,
                pipe.Pipe.EndStructureName,
                pipe.Pipe.StartPoint.X,
                pipe.Pipe.StartPoint.Y,
                pipe.Pipe.StartPoint.Z,
                pipe.Pipe.EndPoint.X,
                pipe.Pipe.EndPoint.Y,
                pipe.Pipe.EndPoint.Z,
                pipe.Pipe.Length2D,
                pipe.Pipe.Length2DCenterToCenter,
                pipe.Pipe.Length3D,
                pipe.Pipe.Length3DCenterToCenter,
                pipe.Pipe.Slope,
                pipe.Pipe.InnerDiameterOrWidth,
                pipe.Pipe.OuterDiameterOrWidth,
                pipe.Pipe.ManningCoefficient,
                pipe.Pipe.CrossSectionalShape));
        }

        File.WriteAllLines(path, lines, Encoding.UTF8);
    }

    private static void WriteStructuresCsv(string path, IReadOnlyCollection<NetworkExport> networks)
    {
        var lines = new List<string>
        {
            "network_name,structure_handle,structure_name,display_name,description,part_description,material,part_family_name,part_size_name,style_name,x,y,z,easting,northing,rim_elevation,sump_elevation,sump_depth,diameter_or_width,inner_diameter_or_width,connected_pipes_count,connected_pipe_names,connected_pipe_handles,structure_type"
        };

        foreach (var structure in networks.SelectMany(n => n.Structures.Select(s => (Network: n, Structure: s))))
        {
            lines.Add(Csv(
                structure.Network.Name,
                structure.Structure.Handle,
                structure.Structure.Name,
                structure.Structure.DisplayName,
                structure.Structure.Description,
                structure.Structure.PartDescription,
                structure.Structure.Material,
                structure.Structure.PartFamilyName,
                structure.Structure.PartSizeName,
                structure.Structure.StyleName,
                structure.Structure.Location.X,
                structure.Structure.Location.Y,
                structure.Structure.Location.Z,
                structure.Structure.Easting,
                structure.Structure.Northing,
                structure.Structure.RimElevation,
                structure.Structure.SumpElevation,
                structure.Structure.SumpDepth,
                structure.Structure.DiameterOrWidth,
                structure.Structure.InnerDiameterOrWidth,
                structure.Structure.ConnectedPipesCount,
                string.Join(";", structure.Structure.ConnectedPipeNames.OrderBy(x => x, StringComparer.OrdinalIgnoreCase)),
                string.Join(";", structure.Structure.ConnectedPipeHandles.OrderBy(x => x, StringComparer.OrdinalIgnoreCase)),
                structure.Structure.StructureType));
        }

        File.WriteAllLines(path, lines, Encoding.UTF8);
    }

    private static string Csv(params object?[] values)
    {
        return string.Join(",", values.Select(ToCsvField));
    }

    private static string ToCsvField(object? value)
    {
        var text = value switch
        {
            null => string.Empty,
            double number => number.ToString("0.############", CultureInfo.InvariantCulture),
            float number => number.ToString("0.############", CultureInfo.InvariantCulture),
            IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString() ?? string.Empty,
        };

        if (text.Contains('"'))
        {
            text = text.Replace("\"", "\"\"");
        }

        if (text.IndexOfAny([',', '"', '\n', '\r']) >= 0)
        {
            return $"\"{text}\"";
        }

        return text;
    }

    private sealed record PartReference(string? Name, string? Handle);

    private sealed class OutputPaths
    {
        public required string DirectoryPath { get; init; }
        public required string JsonPath { get; init; }
        public required string NetworksCsvPath { get; init; }
        public required string PipesCsvPath { get; init; }
        public required string StructuresCsvPath { get; init; }

        public static OutputPaths Create(string drawingPath)
        {
            var baseDirectory = Path.GetDirectoryName(drawingPath);
            if (string.IsNullOrWhiteSpace(baseDirectory) || !Directory.Exists(baseDirectory))
            {
                baseDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            }

            var safeStem = SanitizeFileName(Path.GetFileNameWithoutExtension(drawingPath));
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture);
            var exportDirectory = Path.Combine(baseDirectory, "_construdata_exports");
            var basename = $"{safeStem}_pipe_network_export_{timestamp}";

            return new OutputPaths
            {
                DirectoryPath = exportDirectory,
                JsonPath = Path.Combine(exportDirectory, $"{basename}.json"),
                NetworksCsvPath = Path.Combine(exportDirectory, $"{basename}_networks.csv"),
                PipesCsvPath = Path.Combine(exportDirectory, $"{basename}_pipes.csv"),
                StructuresCsvPath = Path.Combine(exportDirectory, $"{basename}_structures.csv"),
            };
        }

        private static string SanitizeFileName(string? value)
        {
            var fallback = string.IsNullOrWhiteSpace(value) ? "drawing" : value;
            foreach (var invalid in Path.GetInvalidFileNameChars())
            {
                fallback = fallback.Replace(invalid, '_');
            }

            return fallback.Trim();
        }
    }
}

public sealed class ExportDocument
{
    public required string Generator { get; init; }
    public required string GeneratedAtUtc { get; init; }
    public required string DrawingName { get; init; }
    public required string DrawingPath { get; init; }
    public required ExportSummary Summary { get; init; }
    public required List<NetworkExport> Networks { get; init; }
    public required List<string> Warnings { get; init; }
}

public sealed class ExportSummary
{
    public int NetworkCount { get; init; }
    public int PipeCount { get; init; }
    public int StructureCount { get; init; }
}

public sealed class NetworkExport
{
    public required string Handle { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public string? PartsListName { get; init; }
    public string? ReferenceAlignmentName { get; init; }
    public string? ReferenceSurfaceName { get; init; }
    public List<PipeExport> Pipes { get; set; } = [];
    public List<StructureExport> Structures { get; set; } = [];
}

public sealed class PipeExport
{
    public required string Handle { get; init; }
    public required string Name { get; init; }
    public string? DisplayName { get; init; }
    public string? Description { get; init; }
    public string? PartDescription { get; init; }
    public string? Material { get; init; }
    public string? PartFamilyName { get; init; }
    public string? PartSizeName { get; init; }
    public string? StyleName { get; init; }
    public string? NetworkName { get; init; }
    public string? StartStructureHandle { get; init; }
    public string? StartStructureName { get; init; }
    public string? EndStructureHandle { get; init; }
    public string? EndStructureName { get; init; }
    public required PointExport StartPoint { get; init; }
    public required PointExport EndPoint { get; init; }
    public double Length2D { get; init; }
    public double Length2DCenterToCenter { get; init; }
    public double Length3D { get; init; }
    public double Length3DCenterToCenter { get; init; }
    public double Slope { get; init; }
    public double InnerDiameterOrWidth { get; init; }
    public double OuterDiameterOrWidth { get; init; }
    public double? ManningCoefficient { get; init; }
    public string? CrossSectionalShape { get; init; }
}

public sealed class StructureExport
{
    public required string Handle { get; init; }
    public required string Name { get; init; }
    public string? DisplayName { get; init; }
    public string? Description { get; init; }
    public string? PartDescription { get; init; }
    public string? Material { get; init; }
    public string? PartFamilyName { get; init; }
    public string? PartSizeName { get; init; }
    public string? StyleName { get; init; }
    public string? NetworkName { get; init; }
    public required PointExport Location { get; init; }
    public double Easting { get; init; }
    public double Northing { get; init; }
    public double RimElevation { get; init; }
    public double SumpElevation { get; init; }
    public double SumpDepth { get; init; }
    public int ConnectedPipesCount { get; init; }
    public double DiameterOrWidth { get; init; }
    public double InnerDiameterOrWidth { get; init; }
    public string? StructureType { get; init; }
    public List<string> ConnectedPipeNames { get; init; } = [];
    public List<string> ConnectedPipeHandles { get; init; } = [];
}

public sealed class PointExport
{
    public double X { get; init; }
    public double Y { get; init; }
    public double Z { get; init; }

    public static PointExport From(Point3d point)
    {
        return new PointExport
        {
            X = point.X,
            Y = point.Y,
            Z = point.Z,
        };
    }
}
