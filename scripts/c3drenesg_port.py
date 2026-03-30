#!/usr/bin/env python3
"""
Python port of the hydraulic core that can be reconstructed from C3DRENESG4.

Scope:
- IDF/rainfall equations from "EQUACOES DE CHUVA.INI"
- concentration time methods found in the .NET assembly
- population projection methods found in the .NET assembly
- gutter/sarjeta section loading from "SECOES DE SARJETAS.INI"
- Manning based section hydraulics for the gutter section families present

This does not replicate the Civil 3D integration layer. The AutoCAD/Civil 3D
commands remain tied to the original .NET DLLs.
"""

from __future__ import annotations

import argparse
import ast
import configparser
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Mapping, Optional


def _load_config(path: str | Path) -> configparser.ConfigParser:
    parser = configparser.ConfigParser()
    parser.optionxform = str
    last_error: Optional[Exception] = None
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            text = Path(path).read_text(encoding=encoding)
            parser.read_string(text)
            return parser
        except Exception as exc:  # pragma: no cover - best effort fallback
            last_error = exc
            parser = configparser.ConfigParser()
            parser.optionxform = str
    raise ValueError(f"Could not read config file {path}: {last_error}")


class SafeExpression:
    def __init__(self, expression: str) -> None:
        self.expression = expression.strip().replace("^", "**")
        self._tree = ast.parse(self.expression, mode="eval")
        self._validate(self._tree)

    def _validate(self, node: ast.AST) -> None:
        allowed = (
            ast.Expression,
            ast.BinOp,
            ast.UnaryOp,
            ast.Add,
            ast.Sub,
            ast.Mult,
            ast.Div,
            ast.Pow,
            ast.Mod,
            ast.USub,
            ast.UAdd,
            ast.Call,
            ast.Name,
            ast.Load,
            ast.Constant,
        )
        if not isinstance(node, allowed):
            raise ValueError(f"Unsupported expression node: {type(node).__name__}")
        for child in ast.iter_child_nodes(node):
            self._validate(child)

    def evaluate(self, **variables: float) -> float:
        env: Dict[str, float | Callable[..., float]] = {
            "log": math.log,
            "exp": math.exp,
            "sqrt": math.sqrt,
            "abs": abs,
            "pi": math.pi,
        }
        env.update(variables)
        return float(self._eval(self._tree.body, env))

    def _eval(self, node: ast.AST, env: Mapping[str, object]) -> float:
        if isinstance(node, ast.Constant):
            return float(node.value)
        if isinstance(node, ast.Name):
            if node.id not in env:
                raise ValueError(f"Unknown name: {node.id}")
            return float(env[node.id])  # type: ignore[arg-type]
        if isinstance(node, ast.UnaryOp):
            value = self._eval(node.operand, env)
            if isinstance(node.op, ast.USub):
                return -value
            if isinstance(node.op, ast.UAdd):
                return value
        if isinstance(node, ast.BinOp):
            left = self._eval(node.left, env)
            right = self._eval(node.right, env)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.Pow):
                return left**right
            if isinstance(node.op, ast.Mod):
                return left % right
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                raise ValueError("Only direct function calls are supported")
            func = env.get(node.func.id)
            if not callable(func):
                raise ValueError(f"Invalid callable: {node.func.id}")
            args = [self._eval(arg, env) for arg in node.args]
            return float(func(*args))
        raise ValueError(f"Unsupported expression: {ast.dump(node)}")


@dataclass(frozen=True)
class RainEquation:
    city: str
    expression: str

    def intensity_mm_h(self, tr_years: float, tc_minutes: float) -> float:
        evaluator = SafeExpression(self.expression)
        return evaluator.evaluate(Tr=tr_years, tr=tr_years, Tc=tc_minutes, tc=tc_minutes)


def load_rain_equations(path: str | Path) -> Dict[str, RainEquation]:
    parser = _load_config(path)
    result: Dict[str, RainEquation] = {}
    for _, raw in parser.items("EQS"):
        match = re.search(r",(?=\s*[-(]?\d)", raw)
        if not match:
            continue
        city = raw[: match.start()].strip()
        expression = raw[match.start() + 1 :].strip()
        result[city] = RainEquation(city=city, expression=expression)
    return result


@dataclass
class Catchment:
    length_m: float
    slope: float
    drop_m: float
    area_m2: float

    @property
    def length_km(self) -> float:
        return self.length_m / 1000.0

    @property
    def area_km2(self) -> float:
        return self.area_m2 / 1_000_000.0


def tc_tr55(catchment: Catchment, manual_tc_minutes: float) -> float:
    return float(manual_tc_minutes)


def tc_kerby(catchment: Catchment) -> float:
    return 60.0 * 37.0 * ((catchment.length_km * 0.5) / catchment.slope) ** 0.47


def tc_kirpich(catchment: Catchment) -> float:
    return 60.0 * 57.0 * ((catchment.length_km**3) / catchment.drop_m) ** 0.385


def tc_picking(catchment: Catchment) -> float:
    return 60.0 * 5.3 * ((catchment.length_km**2) / catchment.slope) ** (1.0 / 3.0)


def tc_usce(catchment: Catchment) -> float:
    return 60.0 * 18.0 * (catchment.length_km / (catchment.slope**0.25)) ** 0.76


def tc_ven_te_chow(catchment: Catchment) -> float:
    return 60.0 * 25.2 * (catchment.length_km / (catchment.slope**0.5)) ** 0.64


def tc_kirpich_modified(catchment: Catchment) -> float:
    return 60.0 * 85.2 * ((catchment.length_km**3) / catchment.drop_m) ** 0.385


def tc_passini(catchment: Catchment) -> float:
    return 60.0 * 6.42 * ((catchment.area_km2 * catchment.length_km) ** (1.0 / 3.0)) / (
        catchment.slope**0.5
    )


def tc_ventura(catchment: Catchment) -> float:
    return 60.0 * (240.0 * catchment.area_km2 * catchment.length_km / catchment.drop_m) ** 0.5


def tc_rossi(catchment: Catchment) -> float:
    return 60.0 * 46.2 * (catchment.length_km / (catchment.slope**0.5)) ** 0.295


def tc_giandotti(catchment: Catchment) -> float:
    num = 4.0 * (catchment.area_km2**0.5) + 1.5 * catchment.length_km
    den = 0.8 * (catchment.drop_m**0.5)
    return 3600.0 * num / den


def tc_dooge(catchment: Catchment) -> float:
    return 60.0 * 21.88 * (catchment.area_km2**0.41) / ((catchment.slope * 1000.0) ** 0.17)


def tc_bransby_williams(catchment: Catchment) -> float:
    den = (catchment.slope**0.2) * (catchment.area_km2**0.1)
    return 60.0 * 14.6 * catchment.length_km / den


def tc_john_collins(catchment: Catchment) -> float:
    hydraulic_diameter = math.sqrt((4.0 * catchment.area_m2) / math.pi)
    factor = ((catchment.area_m2 / 1_000_000.0) ** 2 / catchment.slope) ** 0.2
    return 60.0 * 44.0 * (catchment.length_m / hydraulic_diameter) * factor


DNOS_K = [2.0, 3.0, 4.0, 4.5, 5.0, 5.5]


def tc_dnos(catchment: Catchment, k_index: int) -> float:
    k = DNOS_K[k_index]
    num = (catchment.area_m2 / 10_000.0) ** 0.3 * (catchment.length_m**0.2)
    den = catchment.slope**0.4
    return 60.0 * (10.0 / k) * num / den


def tc_george_ribeiro(catchment: Catchment, rainfall_intensity_mm_h: float) -> float:
    modifier = 1.05 - 0.2 * rainfall_intensity_mm_h
    den = (100.0 * catchment.slope) ** 0.04
    return 60.0 * 16.0 * catchment.length_km * modifier / den


def tc_lag(catchment: Catchment, kn: float, lc_m: float) -> float:
    inner = 0.0053 * catchment.length_km * (lc_m / 1000.0) / (catchment.slope**5)
    return kn * (inner**0.38)


def tc_curve_number(catchment: Catchment, curve_number: int) -> float:
    storage_factor = 1000.0 / curve_number - 9.0
    return 60.0 * 108.0 * (catchment.length_km**1.3) * (storage_factor**0.7) / (
        catchment.drop_m**0.5
    )


TC_METHODS: Dict[str, Callable[..., float]] = {
    "kerby": tc_kerby,
    "kirpich": tc_kirpich,
    "picking": tc_picking,
    "usce": tc_usce,
    "vente_chow": tc_ven_te_chow,
    "kirpich_mod": tc_kirpich_modified,
    "passini": tc_passini,
    "ventura": tc_ventura,
    "rossi": tc_rossi,
    "giandotti": tc_giandotti,
    "dooge": tc_dooge,
    "bransby_williams": tc_bransby_williams,
    "john_collins": tc_john_collins,
    "dnos": tc_dnos,
    "george_ribeiro": tc_george_ribeiro,
    "lag": tc_lag,
    "cn": tc_curve_number,
    "tr55": tc_tr55,
}


def pop_arithmetic(pop_ini: float, ano_ini: int, pop_fim: float, ano_fim: int, ano_proj: int) -> float:
    k = (pop_fim - pop_ini) / (ano_fim - ano_ini)
    return pop_fim + k * (ano_proj - ano_fim)


def pop_geometric(pop_ini: float, ano_ini: int, pop_fim: float, ano_fim: int, ano_proj: int) -> float:
    k = (math.log(pop_fim) - math.log(pop_ini)) / (ano_fim - ano_ini)
    return pop_fim * math.exp(k * (ano_proj - ano_fim))


def pop_log_curve_raw(pop_ini: float, pop_fim: float) -> Dict[str, float]:
    pop_int = (pop_ini + pop_fim) / 2.0
    k = (
        (2.0 * pop_ini * pop_int * pop_fim) - ((pop_int**2) * (pop_ini + pop_fim))
    ) / ((pop_ini * pop_fim) - (pop_int**2))
    a = math.log((k - pop_ini) / pop_ini)
    d = pop_int - pop_ini
    b = (-1.0 / (0.4343 * d)) * math.log10(
        (pop_ini * (k - pop_int)) / (pop_int * (k - pop_ini))
    )
    t = a / b
    pop_proj = k / (1.0 + math.exp(a - b * t))
    return {"k": k, "a": a, "b": b, "t": t, "pop_proj": pop_proj}


class Section:
    full_depth: float

    def top_width(self, depth: float) -> float:
        raise NotImplementedError

    def wetted_area(self, depth: float) -> float:
        raise NotImplementedError

    def wetted_perimeter(self, depth: float) -> float:
        raise NotImplementedError

    @property
    def full_area(self) -> float:
        return self.wetted_area(self.full_depth)


@dataclass
class RectangularSection(Section):
    full_depth: float
    width: float

    def top_width(self, depth: float) -> float:
        return self.width

    def wetted_area(self, depth: float) -> float:
        return self.width * depth

    def wetted_perimeter(self, depth: float) -> float:
        return self.width + 2.0 * depth


@dataclass
class TrapezoidalSection(Section):
    full_depth: float
    base_width: float
    side_left: float
    side_right: float

    def top_width(self, depth: float) -> float:
        factor = depth / self.full_depth
        return self.base_width + factor * (self.side_left + self.side_right)

    def wetted_area(self, depth: float) -> float:
        return (self.base_width + self.top_width(depth)) * depth / 2.0

    def wetted_perimeter(self, depth: float) -> float:
        factor = depth / self.full_depth
        left = math.hypot(self.side_left * factor, depth)
        right = math.hypot(self.side_right * factor, depth)
        return self.base_width + left + right


@dataclass
class TriangularSection(Section):
    full_depth: float
    side_left: float
    side_right: float

    def top_width(self, depth: float) -> float:
        return (depth / self.full_depth) * (self.side_left + self.side_right)

    def wetted_area(self, depth: float) -> float:
        return self.top_width(depth) * depth / 2.0

    def wetted_perimeter(self, depth: float) -> float:
        factor = depth / self.full_depth
        left = math.hypot(self.side_left * factor, depth)
        right = math.hypot(self.side_right * factor, depth)
        return left + right


@dataclass
class DoubleTriangularSection(Section):
    full_depth: float
    side_left: float
    flat_width: float
    side_right: float
    break_depth: float

    def _top_left_partial(self, depth: float) -> float:
        return self.side_left * depth / self.break_depth

    def _top_right_partial(self, depth: float) -> float:
        return self.side_right * (depth - self.break_depth) / (self.full_depth - self.break_depth)

    def top_width(self, depth: float) -> float:
        if depth <= self.break_depth:
            return self.flat_width + self._top_left_partial(depth)
        return self.flat_width + self.side_left + self._top_right_partial(depth)

    def wetted_area(self, depth: float) -> float:
        if depth <= self.break_depth:
            return (self.flat_width + self.top_width(depth)) * depth / 2.0
        lower = self.flat_width * self.break_depth + self.side_left * self.break_depth / 2.0
        dy = depth - self.break_depth
        upper_base = self.flat_width + self.side_left
        upper_top = self.top_width(depth)
        return lower + (upper_base + upper_top) * dy / 2.0

    def wetted_perimeter(self, depth: float) -> float:
        if depth <= self.break_depth:
            left = math.hypot(self._top_left_partial(depth), depth)
            return self.flat_width + left
        left_full = math.hypot(self.side_left, self.break_depth)
        dy = depth - self.break_depth
        right_partial = math.hypot(self._top_right_partial(depth), dy)
        return self.flat_width + left_full + right_partial


@dataclass(frozen=True)
class GutterDefinition:
    name: str
    type_code: int
    family: str
    material: str
    description: str
    params: List[float]
    manning_n: float

    def build_section(self) -> Section:
        if self.type_code == 5:
            a, base, da, db = self.params
            return TrapezoidalSection(full_depth=a, base_width=base, side_left=da, side_right=db)
        if self.type_code == 6:
            a, width = self.params
            return RectangularSection(full_depth=a, width=width)
        if self.type_code == 7:
            a, da, db = self.params
            return TriangularSection(full_depth=a, side_left=da, side_right=db)
        if self.type_code == 8:
            a, da, flat_width, dc, mf = self.params
            return DoubleTriangularSection(
                full_depth=a,
                side_left=da,
                flat_width=flat_width,
                side_right=dc,
                break_depth=mf,
            )
        raise ValueError(f"Unsupported gutter type: {self.type_code}")


def load_gutter_catalog(path: str | Path) -> Dict[str, GutterDefinition]:
    parser = _load_config(path)

    materials: Dict[str, float] = {}
    for name, raw in parser.items("REVESTIMENTO"):
        parts = [piece.strip() for piece in raw.split(",")]
        materials[name.strip()] = float(parts[0])

    result: Dict[str, GutterDefinition] = {}
    for name, raw in parser.items("SARJETAS"):
        parts = [piece.strip() for piece in raw.split(",")]
        type_code = int(parts[0])
        family = parts[1]
        material = parts[2]
        description = parts[3]
        params = [float(piece) for piece in parts[4:] if piece]
        result[name] = GutterDefinition(
            name=name,
            type_code=type_code,
            family=family,
            material=material,
            description=description,
            params=params,
            manning_n=materials[material],
        )
    return result


@dataclass
class HydraulicResult:
    depth_m: float
    fill_ratio: float
    top_width_m: float
    area_m2: float
    perimeter_m: float
    hydraulic_radius_m: float
    velocity_m_s: float
    discharge_m3_s: float
    froude: float


def hydraulic_result(section: Section, depth: float, slope: float, manning_n: float, g: float = 9.81) -> HydraulicResult:
    depth = min(depth, section.full_depth)
    if depth <= 0:
        return HydraulicResult(
            depth_m=0.0,
            fill_ratio=0.0,
            top_width_m=0.0,
            area_m2=0.0,
            perimeter_m=0.0,
            hydraulic_radius_m=0.0,
            velocity_m_s=0.0,
            discharge_m3_s=0.0,
            froude=0.0,
        )
    area = section.wetted_area(depth)
    perimeter = section.wetted_perimeter(depth)
    top_width = section.top_width(depth)
    rh = area / perimeter
    velocity = (rh ** (2.0 / 3.0)) * (slope**0.5) / manning_n
    discharge = velocity * area
    froude = 0.0 if top_width <= 0 else velocity / math.sqrt(g * (area / top_width))
    return HydraulicResult(
        depth_m=depth,
        fill_ratio=depth / section.full_depth,
        top_width_m=top_width,
        area_m2=area,
        perimeter_m=perimeter,
        hydraulic_radius_m=rh,
        velocity_m_s=velocity,
        discharge_m3_s=discharge,
        froude=froude,
    )


def solve_depth_for_discharge(
    section: Section,
    slope: float,
    manning_n: float,
    target_discharge_m3_s: float,
    tol: float = 1e-6,
    max_iter: int = 100,
) -> HydraulicResult:
    if target_discharge_m3_s < 0:
        raise ValueError("target_discharge_m3_s must be >= 0")
    if target_discharge_m3_s == 0:
        return hydraulic_result(section, 0.0, slope, manning_n)

    lo = 0.0
    hi = section.full_depth
    hi_result = hydraulic_result(section, hi, slope, manning_n)
    if target_discharge_m3_s > hi_result.discharge_m3_s:
        raise ValueError(
            f"Target flow {target_discharge_m3_s:.6f} m3/s exceeds section capacity "
            f"{hi_result.discharge_m3_s:.6f} m3/s at full depth."
        )

    for _ in range(max_iter):
        mid = (lo + hi) / 2.0
        result = hydraulic_result(section, mid, slope, manning_n)
        error = result.discharge_m3_s - target_discharge_m3_s
        if abs(error) <= tol:
            return result
        if error > 0:
            hi = mid
        else:
            lo = mid
    return hydraulic_result(section, (lo + hi) / 2.0, slope, manning_n)


def circular_pipe_full_flow(diameter_m: float, slope: float, manning_n: float = 0.013) -> HydraulicResult:
    area = math.pi * diameter_m * diameter_m / 4.0
    perimeter = math.pi * diameter_m
    rh = area / perimeter
    velocity = (rh ** (2.0 / 3.0)) * (slope**0.5) / manning_n
    discharge = velocity * area
    top_width = diameter_m
    froude = velocity / math.sqrt(9.81 * (area / top_width))
    return HydraulicResult(
        depth_m=diameter_m,
        fill_ratio=1.0,
        top_width_m=top_width,
        area_m2=area,
        perimeter_m=perimeter,
        hydraulic_radius_m=rh,
        velocity_m_s=velocity,
        discharge_m3_s=discharge,
        froude=froude,
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Reconstructed Python core for C3DRENESG4")
    sub = parser.add_subparsers(dest="command", required=True)

    idf = sub.add_parser("idf", help="Evaluate a rainfall equation")
    idf.add_argument("--ini", required=True, help="Path to EQUACOES DE CHUVA.INI")
    idf.add_argument("--city", required=True)
    idf.add_argument("--tr", required=True, type=float, help="Return period in years")
    idf.add_argument("--tc", required=True, type=float, help="Concentration time in minutes")

    tc = sub.add_parser("tc", help="Run one of the concentration time methods")
    tc.add_argument("--method", required=True, choices=sorted(TC_METHODS))
    tc.add_argument("--length-m", required=True, type=float)
    tc.add_argument("--slope", required=True, type=float)
    tc.add_argument("--drop-m", required=True, type=float)
    tc.add_argument("--area-m2", required=True, type=float)
    tc.add_argument("--manual-tc", type=float, default=float("nan"))
    tc.add_argument("--k-index", type=int, default=0)
    tc.add_argument("--pr", type=float, default=0.0)
    tc.add_argument("--kn", type=float, default=0.0)
    tc.add_argument("--lc-m", type=float, default=0.0)
    tc.add_argument("--cn", type=int, default=80)

    sarj = sub.add_parser("sarjeta", help="Load a section from SECOES DE SARJETAS.INI and solve hydraulics")
    sarj.add_argument("--ini", required=True, help="Path to SECOES DE SARJETAS.INI")
    sarj.add_argument("--name", required=True, help="Section key such as SZC01 or MF01")
    sarj.add_argument("--slope", required=True, type=float, help="Longitudinal slope in m/m")
    mode = sarj.add_mutually_exclusive_group(required=True)
    mode.add_argument("--depth", type=float, help="Water depth in meters")
    mode.add_argument("--target-q", type=float, help="Target discharge in m3/s")

    pipe = sub.add_parser("pipe", help="Simple full-flow Manning check for circular pipe")
    pipe.add_argument("--diameter-m", required=True, type=float)
    pipe.add_argument("--slope", required=True, type=float)
    pipe.add_argument("--n", type=float, default=0.013)

    pop = sub.add_parser("pop", help="Population projection")
    pop.add_argument("--method", required=True, choices=["arithmetic", "geometric", "curve_log_raw"])
    pop.add_argument("--pop-ini", required=True, type=float)
    pop.add_argument("--ano-ini", required=True, type=int)
    pop.add_argument("--pop-fim", required=True, type=float)
    pop.add_argument("--ano-fim", required=True, type=int)
    pop.add_argument("--ano-proj", required=True, type=int)
    return parser


def _print_result(result: HydraulicResult) -> None:
    print(f"depth_m={result.depth_m:.6f}")
    print(f"fill_ratio={result.fill_ratio:.6f}")
    print(f"top_width_m={result.top_width_m:.6f}")
    print(f"area_m2={result.area_m2:.6f}")
    print(f"perimeter_m={result.perimeter_m:.6f}")
    print(f"hydraulic_radius_m={result.hydraulic_radius_m:.6f}")
    print(f"velocity_m_s={result.velocity_m_s:.6f}")
    print(f"discharge_m3_s={result.discharge_m3_s:.6f}")
    print(f"froude={result.froude:.6f}")


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.command == "idf":
        equations = load_rain_equations(args.ini)
        eq = equations[args.city]
        print(f"city={eq.city}")
        print(f"expression={eq.expression}")
        print(f"intensity_mm_h={eq.intensity_mm_h(args.tr, args.tc):.6f}")
        return 0

    if args.command == "tc":
        catchment = Catchment(
            length_m=args.length_m,
            slope=args.slope,
            drop_m=args.drop_m,
            area_m2=args.area_m2,
        )
        method = args.method
        if method == "tr55":
            value = tc_tr55(catchment, args.manual_tc)
        elif method == "dnos":
            value = tc_dnos(catchment, args.k_index)
        elif method == "george_ribeiro":
            value = tc_george_ribeiro(catchment, args.pr)
        elif method == "lag":
            value = tc_lag(catchment, args.kn, args.lc_m)
        elif method == "cn":
            value = tc_curve_number(catchment, args.cn)
        else:
            value = TC_METHODS[method](catchment)
        print(f"tc_{method}_minutes={value:.6f}")
        return 0

    if args.command == "sarjeta":
        catalog = load_gutter_catalog(args.ini)
        gutter = catalog[args.name]
        section = gutter.build_section()
        print(f"name={gutter.name}")
        print(f"type_code={gutter.type_code}")
        print(f"family={gutter.family}")
        print(f"material={gutter.material}")
        print(f"manning_n={gutter.manning_n:.6f}")
        print(f"params={gutter.params}")
        if args.depth is not None:
            _print_result(hydraulic_result(section, args.depth, args.slope, gutter.manning_n))
        else:
            _print_result(solve_depth_for_discharge(section, args.slope, gutter.manning_n, args.target_q))
        return 0

    if args.command == "pipe":
        _print_result(circular_pipe_full_flow(args.diameter_m, args.slope, args.n))
        return 0

    if args.command == "pop":
        if args.method == "arithmetic":
            value = pop_arithmetic(args.pop_ini, args.ano_ini, args.pop_fim, args.ano_fim, args.ano_proj)
            print(f"population={value:.6f}")
        elif args.method == "geometric":
            value = pop_geometric(args.pop_ini, args.ano_ini, args.pop_fim, args.ano_fim, args.ano_proj)
            print(f"population={value:.6f}")
        else:
            raw = pop_log_curve_raw(args.pop_ini, args.pop_fim)
            for key, value in raw.items():
                print(f"{key}={value:.6f}")
        return 0

    parser.error("Unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
