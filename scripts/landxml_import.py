#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
import re
import xml.etree.ElementTree as ET


TIMESTAMP_FORMAT = "%Y%m%d_%H%M%S"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Converte PipeNetworks de LandXML para JSON/CSV normalizados."
    )
    parser.add_argument("input", help="Arquivo .xml/.landxml de entrada.")
    parser.add_argument(
        "--output-dir",
        help="Diretorio de saida. Padrao: <pasta_do_xml>\\_construdata_exports",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Forca JSON identado.",
    )
    return parser.parse_args()


def local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def parse_float(value: str | None) -> float | None:
    value = normalize_text(value)
    if value is None:
        return None
    value = value.replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def iter_descendants(element: ET.Element, name: str):
    for child in element.iter():
        if local_name(child.tag) == name:
            yield child


def find_child(element: ET.Element, name: str) -> ET.Element | None:
    for child in list(element):
        if local_name(child.tag) == name:
            return child
    return None


def child_text(element: ET.Element, name: str) -> str | None:
    child = find_child(element, name)
    return normalize_text(child.text if child is not None else None)


def parse_point_text(value: str | None) -> tuple[float, float, float] | None:
    value = normalize_text(value)
    if not value:
        return None
    parts = [parse_float(token) for token in re.split(r"[\s,;]+", value) if token.strip()]
    coords = [part for part in parts if part is not None]
    if len(coords) < 2:
        return None
    northing = coords[0]
    easting = coords[1]
    elevation = coords[2] if len(coords) >= 3 else 0.0
    return (easting, northing, elevation)


def parse_point_list(value: str | None) -> list[tuple[float, float, float]]:
    value = normalize_text(value)
    if not value:
        return []

    numbers = [parse_float(token) for token in re.split(r"[\s,;]+", value) if token.strip()]
    coords = [number for number in numbers if number is not None]
    if len(coords) < 2:
        return []

    step = 3 if len(coords) % 3 == 0 else 2
    points: list[tuple[float, float, float]] = []
    for index in range(0, len(coords), step):
        if index + 1 >= len(coords):
            break
        northing = coords[index]
        easting = coords[index + 1]
        elevation = coords[index + 2] if step == 3 and index + 2 < len(coords) else 0.0
        points.append((easting, northing, elevation))
    return points


def find_point(
    element: ET.Element,
    preferred_names: tuple[str, ...],
    allow_pnt_list: bool = True,
) -> tuple[float, float, float] | None:
    for name in preferred_names:
        direct = child_text(element, name)
        if direct:
            point = parse_point_text(direct)
            if point:
                return point

    if allow_pnt_list:
        pnt_list = child_text(element, "PntList3D")
        if pnt_list:
            points = parse_point_list(pnt_list)
            if points:
                return points[0]

    return None


def sanitize_file_name(value: str) -> str:
    sanitized = value.strip() or "landxml"
    for invalid in '<>:"/\\|?*':
        sanitized = sanitized.replace(invalid, "_")
    return sanitized


def format_number(value: float | int | None) -> str:
    if value is None:
        return ""
    if isinstance(value, int):
        return str(value)
    return f"{value:.12f}".rstrip("0").rstrip(".")


def write_csv(path: Path, header: list[str], rows: list[list[object | None]]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.writer(stream)
        writer.writerow(header)
        for row in rows:
            writer.writerow([format_number(value) if isinstance(value, float) else ("" if value is None else value) for value in row])


def unit_to_meter_factor(unit_name: str | None) -> float:
    normalized = (unit_name or "").strip().lower()
    table = {
        "meter": 1.0,
        "meters": 1.0,
        "metre": 1.0,
        "metres": 1.0,
        "m": 1.0,
        "millimeter": 0.001,
        "millimeters": 0.001,
        "mm": 0.001,
        "centimeter": 0.01,
        "centimeters": 0.01,
        "cm": 0.01,
        "foot": 0.3048,
        "feet": 0.3048,
        "ft": 0.3048,
        "internationalfoot": 0.3048,
        "ussurveyfoot": 1200.0 / 3937.0,
        "inch": 0.0254,
        "inches": 0.0254,
        "in": 0.0254,
    }
    return table.get(normalized, 1.0)


def distance_2d(a: tuple[float, float, float] | None, b: tuple[float, float, float] | None) -> float | None:
    if a is None or b is None:
        return None
    return math.hypot(b[0] - a[0], b[1] - a[1])


def distance_3d(a: tuple[float, float, float] | None, b: tuple[float, float, float] | None) -> float | None:
    if a is None or b is None:
        return None
    return math.dist(a, b)


@dataclass
class PointExport:
    x: float
    y: float
    z: float

    @classmethod
    def from_tuple(cls, point: tuple[float, float, float] | None) -> "PointExport":
        if point is None:
            return cls(0.0, 0.0, 0.0)
        return cls(point[0], point[1], point[2])


@dataclass
class StructureExport:
    handle: str
    name: str
    display_name: str | None = None
    description: str | None = None
    part_description: str | None = None
    material: str | None = None
    part_family_name: str | None = None
    part_size_name: str | None = None
    style_name: str | None = None
    network_name: str | None = None
    location: PointExport = field(default_factory=lambda: PointExport(0.0, 0.0, 0.0))
    easting: float = 0.0
    northing: float = 0.0
    rim_elevation: float | None = None
    sump_elevation: float | None = None
    sump_depth: float | None = None
    connected_pipes_count: int = 0
    diameter_or_width: float | None = None
    inner_diameter_or_width: float | None = None
    structure_type: str | None = None
    connected_pipe_names: list[str] = field(default_factory=list)
    connected_pipe_handles: list[str] = field(default_factory=list)


@dataclass
class PipeExport:
    handle: str
    name: str
    display_name: str | None = None
    description: str | None = None
    part_description: str | None = None
    material: str | None = None
    part_family_name: str | None = None
    part_size_name: str | None = None
    style_name: str | None = None
    network_name: str | None = None
    start_structure_handle: str | None = None
    start_structure_name: str | None = None
    end_structure_handle: str | None = None
    end_structure_name: str | None = None
    start_point: PointExport = field(default_factory=lambda: PointExport(0.0, 0.0, 0.0))
    end_point: PointExport = field(default_factory=lambda: PointExport(0.0, 0.0, 0.0))
    length_2d: float | None = None
    length_2d_center_to_center: float | None = None
    length_3d: float | None = None
    length_3d_center_to_center: float | None = None
    slope: float | None = None
    inner_diameter_or_width: float | None = None
    outer_diameter_or_width: float | None = None
    manning_coefficient: float | None = None
    cross_sectional_shape: str | None = None


@dataclass
class NetworkExport:
    handle: str
    name: str
    description: str | None = None
    parts_list_name: str | None = None
    reference_alignment_name: str | None = None
    reference_surface_name: str | None = None
    pipes: list[PipeExport] = field(default_factory=list)
    structures: list[StructureExport] = field(default_factory=list)


def detect_units(root: ET.Element) -> tuple[float, float, dict[str, str | None]]:
    units_element = next(iter_descendants(root, "Units"), None)
    linear_unit = None
    diameter_unit = None

    if units_element is not None:
        for child in list(units_element):
            linear_unit = linear_unit or child.attrib.get("linearUnit")
            diameter_unit = diameter_unit or child.attrib.get("diameterUnit")

    linear_factor = unit_to_meter_factor(linear_unit)
    diameter_factor = unit_to_meter_factor(diameter_unit or linear_unit)
    return linear_factor, diameter_factor, {
        "linearUnit": linear_unit,
        "diameterUnit": diameter_unit or linear_unit,
    }


def element_handle(element: ET.Element, fallback: str) -> str:
    return (
        element.attrib.get("oID")
        or element.attrib.get("id")
        or element.attrib.get("name")
        or fallback
    )


def parse_structure(
    element: ET.Element,
    network_name: str,
    index: int,
    linear_factor: float,
    diameter_factor: float,
) -> StructureExport:
    handle = element_handle(element, f"struct_{index}")
    name = element.attrib.get("name") or handle
    point = find_point(element, ("Center", "Location", "Start"))
    if point is not None:
        point = (
            point[0] * linear_factor,
            point[1] * linear_factor,
            point[2] * linear_factor,
        )

    rim = parse_float(element.attrib.get("elevRim"))
    sump = parse_float(element.attrib.get("elevSump"))
    if rim is not None:
        rim *= linear_factor
    if sump is not None:
        sump *= linear_factor

    shape_child = None
    for child in list(element):
        lname = local_name(child.tag)
        if lname.endswith("Struct"):
            shape_child = child
            break

    diameter = None
    shape_name = None
    if shape_child is not None:
        shape_name = local_name(shape_child.tag)
        diameter = parse_float(shape_child.attrib.get("diameter"))
        if diameter is None:
            diameter = parse_float(shape_child.attrib.get("width"))
        if diameter is not None:
            diameter *= diameter_factor

    easting = point[0] if point is not None else 0.0
    northing = point[1] if point is not None else 0.0
    sump_depth = None
    if rim is not None and sump is not None:
        sump_depth = rim - sump

    return StructureExport(
        handle=handle,
        name=name,
        display_name=name,
        description=element.attrib.get("desc"),
        part_description=shape_name,
        material=element.attrib.get("material"),
        part_family_name=element.attrib.get("catalogRef"),
        part_size_name=element.attrib.get("sizeRef"),
        network_name=network_name,
        location=PointExport.from_tuple(point),
        easting=easting,
        northing=northing,
        rim_elevation=rim,
        sump_elevation=sump,
        sump_depth=sump_depth,
        diameter_or_width=diameter,
        inner_diameter_or_width=diameter,
        structure_type=shape_name,
    )


def parse_pipe(
    element: ET.Element,
    network_name: str,
    index: int,
    linear_factor: float,
    diameter_factor: float,
    structures_by_name: dict[str, StructureExport],
) -> PipeExport:
    handle = element_handle(element, f"pipe_{index}")
    name = element.attrib.get("name") or handle
    start_name = element.attrib.get("refStart")
    end_name = element.attrib.get("refEnd")
    start_structure = structures_by_name.get(start_name or "")
    end_structure = structures_by_name.get(end_name or "")

    point_list = parse_point_list(child_text(element, "PntList3D"))
    if point_list:
        point_list = [
            (point[0] * linear_factor, point[1] * linear_factor, point[2] * linear_factor)
            for point in point_list
        ]

    explicit_start = find_point(element, ("Start", "Center"), allow_pnt_list=False)
    explicit_end = find_point(element, ("End",), allow_pnt_list=False)
    if explicit_start is not None:
        explicit_start = (
            explicit_start[0] * linear_factor,
            explicit_start[1] * linear_factor,
            explicit_start[2] * linear_factor,
        )
    if explicit_end is not None:
        explicit_end = (
            explicit_end[0] * linear_factor,
            explicit_end[1] * linear_factor,
            explicit_end[2] * linear_factor,
        )

    start_point = (
        explicit_start
        or (point_list[0] if point_list else None)
        or ((start_structure.location.x, start_structure.location.y, start_structure.location.z) if start_structure else None)
    )
    end_point = (
        explicit_end
        or (point_list[-1] if point_list else None)
        or ((end_structure.location.x, end_structure.location.y, end_structure.location.z) if end_structure else None)
    )

    shape_child = None
    for child in list(element):
        lname = local_name(child.tag)
        if lname.endswith("Pipe"):
            shape_child = child
            break

    inner_diameter = parse_float(element.attrib.get("diameter"))
    outer_diameter = parse_float(element.attrib.get("outerDiameter"))
    cross_section_shape = None
    if shape_child is not None:
        cross_section_shape = local_name(shape_child.tag)
        inner_diameter = inner_diameter or parse_float(shape_child.attrib.get("diameter")) or parse_float(shape_child.attrib.get("width"))
        outer_diameter = outer_diameter or parse_float(shape_child.attrib.get("outerDiameter"))

    if inner_diameter is not None:
        inner_diameter *= diameter_factor
    if outer_diameter is not None:
        outer_diameter *= diameter_factor

    length_2d = parse_float(element.attrib.get("length"))
    if length_2d is not None:
        length_2d *= linear_factor

    length_3d = parse_float(element.attrib.get("length3D"))
    if length_3d is not None:
        length_3d *= linear_factor

    if length_2d is None:
        length_2d = distance_2d(start_point, end_point)
    if length_3d is None:
        length_3d = distance_3d(start_point, end_point)

    slope = parse_float(element.attrib.get("slope"))
    if slope is None and start_point and end_point and length_2d:
        dz = start_point[2] - end_point[2]
        slope = dz / length_2d if length_2d else None

    return PipeExport(
        handle=handle,
        name=name,
        display_name=name,
        description=element.attrib.get("desc"),
        part_description=cross_section_shape,
        material=element.attrib.get("material"),
        part_family_name=element.attrib.get("catalogRef"),
        part_size_name=element.attrib.get("sizeRef"),
        network_name=network_name,
        start_structure_handle=start_structure.handle if start_structure else None,
        start_structure_name=start_structure.name if start_structure else start_name,
        end_structure_handle=end_structure.handle if end_structure else None,
        end_structure_name=end_structure.name if end_structure else end_name,
        start_point=PointExport.from_tuple(start_point),
        end_point=PointExport.from_tuple(end_point),
        length_2d=length_2d,
        length_2d_center_to_center=length_2d,
        length_3d=length_3d,
        length_3d_center_to_center=length_3d,
        slope=slope,
        inner_diameter_or_width=inner_diameter,
        outer_diameter_or_width=outer_diameter,
        cross_sectional_shape=cross_section_shape,
    )


def parse_networks(root: ET.Element) -> tuple[list[NetworkExport], list[str], dict[str, str | None]]:
    linear_factor, diameter_factor, unit_info = detect_units(root)
    warnings: list[str] = []
    networks: list[NetworkExport] = []

    network_elements = [element for element in root.iter() if local_name(element.tag) == "PipeNetwork"]
    for network_index, network_element in enumerate(network_elements, start=1):
        handle = element_handle(network_element, f"network_{network_index}")
        name = network_element.attrib.get("name") or handle
        network = NetworkExport(
            handle=handle,
            name=name,
            description=network_element.attrib.get("desc"),
            parts_list_name=network_element.attrib.get("pipeCatalog"),
        )

        struct_parent = find_child(network_element, "Structs")
        pipe_parent = find_child(network_element, "Pipes")

        structure_elements = []
        pipe_elements = []
        if struct_parent is not None:
            structure_elements.extend(
                child for child in list(struct_parent) if local_name(child.tag) == "Struct"
            )
        structure_elements.extend(
            child for child in list(network_element) if local_name(child.tag) == "Struct"
        )

        if pipe_parent is not None:
            pipe_elements.extend(child for child in list(pipe_parent) if local_name(child.tag) == "Pipe")
        pipe_elements.extend(
            child for child in list(network_element) if local_name(child.tag) == "Pipe"
        )

        structures_by_name: dict[str, StructureExport] = {}
        seen_struct_handles: set[str] = set()
        for struct_index, struct_element in enumerate(structure_elements, start=1):
            structure = parse_structure(
                struct_element,
                network_name=name,
                index=struct_index,
                linear_factor=linear_factor,
                diameter_factor=diameter_factor,
            )
            if structure.handle in seen_struct_handles:
                continue
            seen_struct_handles.add(structure.handle)
            network.structures.append(structure)
            structures_by_name[structure.name] = structure

        seen_pipe_handles: set[str] = set()
        for pipe_index, pipe_element in enumerate(pipe_elements, start=1):
            pipe = parse_pipe(
                pipe_element,
                network_name=name,
                index=pipe_index,
                linear_factor=linear_factor,
                diameter_factor=diameter_factor,
                structures_by_name=structures_by_name,
            )
            if pipe.handle in seen_pipe_handles:
                continue
            seen_pipe_handles.add(pipe.handle)
            network.pipes.append(pipe)

        if not network.structures and not network.pipes:
            warnings.append(f"PipeNetwork '{name}' sem pipes e sem structures visiveis no XML.")

        connections = defaultdict(list)
        for pipe in network.pipes:
            if pipe.start_structure_handle:
                connections[pipe.start_structure_handle].append(pipe)
            if pipe.end_structure_handle and pipe.end_structure_handle != pipe.start_structure_handle:
                connections[pipe.end_structure_handle].append(pipe)

        for structure in network.structures:
            connected = connections.get(structure.handle, [])
            structure.connected_pipe_handles = sorted({pipe.handle for pipe in connected}, key=str.lower)
            structure.connected_pipe_names = sorted({pipe.name for pipe in connected}, key=str.lower)
            structure.connected_pipes_count = len(structure.connected_pipe_handles)

        network.structures.sort(key=lambda item: item.name.lower())
        network.pipes.sort(key=lambda item: item.name.lower())
        networks.append(network)

    if not networks:
        warnings.append("Nenhum elemento PipeNetwork foi encontrado no LandXML.")

    return networks, warnings, unit_info


def build_document(input_path: Path) -> dict[str, object]:
    tree = ET.parse(input_path)
    root = tree.getroot()
    networks, warnings, unit_info = parse_networks(root)

    summary = {
        "networkCount": len(networks),
        "pipeCount": sum(len(network.pipes) for network in networks),
        "structureCount": sum(len(network.structures) for network in networks),
    }

    return {
        "generator": "ConstruData LandXML Pipe Importer",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "drawingName": input_path.name,
        "drawingPath": str(input_path),
        "sourceFormat": "LandXML",
        "landXmlUnits": unit_info,
        "summary": summary,
        "networks": [
            {
                "handle": network.handle,
                "name": network.name,
                "description": network.description,
                "partsListName": network.parts_list_name,
                "referenceAlignmentName": network.reference_alignment_name,
                "referenceSurfaceName": network.reference_surface_name,
                "pipes": [
                    {
                        "handle": pipe.handle,
                        "name": pipe.name,
                        "displayName": pipe.display_name,
                        "description": pipe.description,
                        "partDescription": pipe.part_description,
                        "material": pipe.material,
                        "partFamilyName": pipe.part_family_name,
                        "partSizeName": pipe.part_size_name,
                        "styleName": pipe.style_name,
                        "networkName": pipe.network_name,
                        "startStructureHandle": pipe.start_structure_handle,
                        "startStructureName": pipe.start_structure_name,
                        "endStructureHandle": pipe.end_structure_handle,
                        "endStructureName": pipe.end_structure_name,
                        "startPoint": pipe.start_point.__dict__,
                        "endPoint": pipe.end_point.__dict__,
                        "length2D": pipe.length_2d,
                        "length2DCenterToCenter": pipe.length_2d_center_to_center,
                        "length3D": pipe.length_3d,
                        "length3DCenterToCenter": pipe.length_3d_center_to_center,
                        "slope": pipe.slope,
                        "innerDiameterOrWidth": pipe.inner_diameter_or_width,
                        "outerDiameterOrWidth": pipe.outer_diameter_or_width,
                        "manningCoefficient": pipe.manning_coefficient,
                        "crossSectionalShape": pipe.cross_sectional_shape,
                    }
                    for pipe in network.pipes
                ],
                "structures": [
                    {
                        "handle": structure.handle,
                        "name": structure.name,
                        "displayName": structure.display_name,
                        "description": structure.description,
                        "partDescription": structure.part_description,
                        "material": structure.material,
                        "partFamilyName": structure.part_family_name,
                        "partSizeName": structure.part_size_name,
                        "styleName": structure.style_name,
                        "networkName": structure.network_name,
                        "location": structure.location.__dict__,
                        "easting": structure.easting,
                        "northing": structure.northing,
                        "rimElevation": structure.rim_elevation,
                        "sumpElevation": structure.sump_elevation,
                        "sumpDepth": structure.sump_depth,
                        "connectedPipesCount": structure.connected_pipes_count,
                        "diameterOrWidth": structure.diameter_or_width,
                        "innerDiameterOrWidth": structure.inner_diameter_or_width,
                        "structureType": structure.structure_type,
                        "connectedPipeNames": structure.connected_pipe_names,
                        "connectedPipeHandles": structure.connected_pipe_handles,
                    }
                    for structure in network.structures
                ],
            }
            for network in networks
        ],
        "warnings": warnings,
    }


def output_paths(input_path: Path, explicit_output_dir: str | None) -> dict[str, Path]:
    output_dir = (
        Path(explicit_output_dir).expanduser().resolve()
        if explicit_output_dir
        else input_path.parent / "_construdata_exports"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime(TIMESTAMP_FORMAT)
    stem = sanitize_file_name(input_path.stem)
    base = f"{stem}_pipe_network_export_{timestamp}"
    return {
        "output_dir": output_dir,
        "json": output_dir / f"{base}.json",
        "networks_csv": output_dir / f"{base}_networks.csv",
        "pipes_csv": output_dir / f"{base}_pipes.csv",
        "structures_csv": output_dir / f"{base}_structures.csv",
    }


def write_outputs(document: dict[str, object], paths: dict[str, Path], pretty: bool) -> None:
    paths["json"].write_text(
        json.dumps(document, indent=2 if pretty else None, ensure_ascii=False),
        encoding="utf-8",
    )

    network_rows: list[list[object | None]] = []
    pipe_rows: list[list[object | None]] = []
    structure_rows: list[list[object | None]] = []

    for network in document["networks"]:
        network_rows.append(
            [
                network["handle"],
                network["name"],
                network["description"],
                network["partsListName"],
                network["referenceAlignmentName"],
                network["referenceSurfaceName"],
                len(network["pipes"]),
                len(network["structures"]),
            ]
        )

        for pipe in network["pipes"]:
            pipe_rows.append(
                [
                    network["name"],
                    pipe["handle"],
                    pipe["name"],
                    pipe["displayName"],
                    pipe["description"],
                    pipe["partDescription"],
                    pipe["material"],
                    pipe["partFamilyName"],
                    pipe["partSizeName"],
                    pipe["styleName"],
                    pipe["startStructureHandle"],
                    pipe["startStructureName"],
                    pipe["endStructureHandle"],
                    pipe["endStructureName"],
                    pipe["startPoint"]["x"],
                    pipe["startPoint"]["y"],
                    pipe["startPoint"]["z"],
                    pipe["endPoint"]["x"],
                    pipe["endPoint"]["y"],
                    pipe["endPoint"]["z"],
                    pipe["length2D"],
                    pipe["length2DCenterToCenter"],
                    pipe["length3D"],
                    pipe["length3DCenterToCenter"],
                    pipe["slope"],
                    pipe["innerDiameterOrWidth"],
                    pipe["outerDiameterOrWidth"],
                    pipe["manningCoefficient"],
                    pipe["crossSectionalShape"],
                ]
            )

        for structure in network["structures"]:
            structure_rows.append(
                [
                    network["name"],
                    structure["handle"],
                    structure["name"],
                    structure["displayName"],
                    structure["description"],
                    structure["partDescription"],
                    structure["material"],
                    structure["partFamilyName"],
                    structure["partSizeName"],
                    structure["styleName"],
                    structure["location"]["x"],
                    structure["location"]["y"],
                    structure["location"]["z"],
                    structure["easting"],
                    structure["northing"],
                    structure["rimElevation"],
                    structure["sumpElevation"],
                    structure["sumpDepth"],
                    structure["diameterOrWidth"],
                    structure["innerDiameterOrWidth"],
                    structure["connectedPipesCount"],
                    ";".join(structure["connectedPipeNames"]),
                    ";".join(structure["connectedPipeHandles"]),
                    structure["structureType"],
                ]
            )

    write_csv(
        paths["networks_csv"],
        [
            "network_handle",
            "network_name",
            "description",
            "parts_list_name",
            "reference_alignment_name",
            "reference_surface_name",
            "pipe_count",
            "structure_count",
        ],
        network_rows,
    )
    write_csv(
        paths["pipes_csv"],
        [
            "network_name",
            "pipe_handle",
            "pipe_name",
            "display_name",
            "description",
            "part_description",
            "material",
            "part_family_name",
            "part_size_name",
            "style_name",
            "start_structure_handle",
            "start_structure_name",
            "end_structure_handle",
            "end_structure_name",
            "start_x",
            "start_y",
            "start_z",
            "end_x",
            "end_y",
            "end_z",
            "length_2d",
            "length_2d_center_to_center",
            "length_3d",
            "length_3d_center_to_center",
            "slope",
            "inner_diameter_or_width",
            "outer_diameter_or_width",
            "manning_coefficient",
            "cross_sectional_shape",
        ],
        pipe_rows,
    )
    write_csv(
        paths["structures_csv"],
        [
            "network_name",
            "structure_handle",
            "structure_name",
            "display_name",
            "description",
            "part_description",
            "material",
            "part_family_name",
            "part_size_name",
            "style_name",
            "x",
            "y",
            "z",
            "easting",
            "northing",
            "rim_elevation",
            "sump_elevation",
            "sump_depth",
            "diameter_or_width",
            "inner_diameter_or_width",
            "connected_pipes_count",
            "connected_pipe_names",
            "connected_pipe_handles",
            "structure_type",
        ],
        structure_rows,
    )


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise SystemExit(f"Arquivo nao encontrado: {input_path}")

    document = build_document(input_path)
    paths = output_paths(input_path, args.output_dir)
    write_outputs(document, paths, pretty=args.pretty)

    result = {
        "input": str(input_path),
        "outputDir": str(paths["output_dir"]),
        "json": str(paths["json"]),
        "networksCsv": str(paths["networks_csv"]),
        "pipesCsv": str(paths["pipes_csv"]),
        "structuresCsv": str(paths["structures_csv"]),
        "summary": document["summary"],
        "warnings": document["warnings"],
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
