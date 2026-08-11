from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs"
BG = (8, 18, 34, 255)
INK = (238, 242, 244, 255)
MUTED = (128, 144, 160, 255)
LINE = (150, 166, 180, 255)
DIM = (64, 82, 102, 255)
ACCENT = (255, 255, 255, 255)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for path in (
        Path("C:/Windows/Fonts") / name,
        Path("C:/Windows/Fonts") / "consola.ttf",
        Path("C:/Windows/Fonts") / "arial.ttf",
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def clamp(v: float, a: float = 0.0, b: float = 1.0) -> float:
    return max(a, min(b, v))


def ease(v: float) -> float:
    v = clamp(v)
    return 1 - pow(1 - v, 3)


def fade(t: float, start: float, dur: float) -> int:
    return int(255 * ease((t - start) / dur))


def rgba(c: tuple[int, int, int, int], a: int) -> tuple[int, int, int, int]:
    return (c[0], c[1], c[2], int(c[3] * a / 255))


def tx(x: float, y: float, o: tuple[float, float], s: float) -> tuple[int, int]:
    return (round(o[0] + x * s), round(o[1] + y * s))


def line(
    draw: ImageDraw.ImageDraw,
    p1: tuple[int, int],
    p2: tuple[int, int],
    fill: tuple[int, int, int, int],
    width: int,
    progress: float = 1.0,
) -> None:
    progress = clamp(progress)
    x = p1[0] + (p2[0] - p1[0]) * progress
    y = p1[1] + (p2[1] - p1[1]) * progress
    draw.line((p1[0], p1[1], x, y), fill=fill, width=width)


def dashed(
    draw: ImageDraw.ImageDraw,
    p1: tuple[int, int],
    p2: tuple[int, int],
    fill: tuple[int, int, int, int],
    width: int,
    dash: int,
    gap: int,
    progress: float,
) -> None:
    x1, y1 = p1
    x2, y2 = p2
    dist = math.hypot(x2 - x1, y2 - y1) * clamp(progress)
    if dist <= 0:
        return
    full = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / full, (y2 - y1) / full
    at = 0
    while at < dist:
        end = min(at + dash, dist)
        draw.line(
            (x1 + ux * at, y1 + uy * at, x1 + ux * end, y1 + uy * end),
            fill=fill,
            width=width,
        )
        at += dash + gap


def rect_outline(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    width: int,
    progress: float,
) -> None:
    x1, y1, x2, y2 = box
    if x1 == x2 or y1 == y2:
        return
    pts = [(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)]
    total = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(4))
    left = total * clamp(progress)
    for i in range(4):
        a, b = pts[i], pts[i + 1]
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if left <= 0:
            break
        line(draw, a, b, fill, width, min(1, left / seg))
        left -= seg


def text(
    draw: ImageDraw.ImageDraw,
    pos: tuple[int, int],
    value: str,
    fill: tuple[int, int, int, int],
    fnt: ImageFont.FreeTypeFont,
    alpha: int,
    anchor: str | None = None,
) -> None:
    draw.text(pos, value, fill=rgba(fill, alpha), font=fnt, anchor=anchor)


def star(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill, width: int, p: float) -> None:
    for i in range(8):
        if p < i / 8:
            continue
        a = math.pi * i / 4
        q = clamp((p - i / 8) * 8)
        x = cx + math.cos(a) * r * q
        y = cy + math.sin(a) * r * q
        draw.line((cx, cy, x, y), fill=fill, width=width)


def schedule(draw: ImageDraw.ImageDraw, o, s: float, t: float, y: int, p: float) -> None:
    a = int(220 * p)
    for x in (700, 800, 900):
        dashed(draw, tx(x, y - 62, o, s), tx(x, y + 52, o, s), rgba(DIM, a), max(1, int(2 * s)), int(5 * s), int(7 * s), p)
    dashed(draw, tx(610, y - 47, o, s), tx(955, y - 47, o, s), rgba(DIM, a), max(1, int(2 * s)), int(5 * s), int(7 * s), p)
    line(draw, tx(610, y + 52, o, s), tx(955, y + 52, o, s), rgba(LINE, a), max(2, int(2 * s)), p)
    bars = [(720, y - 37, 820, y - 20), (780, y - 10, 915, y + 7), (855, y + 18, 975, y + 35)]
    for i, box in enumerate(bars):
        rect_outline(draw, (*tx(box[0], box[1], o, s), *tx(box[2], box[3], o, s)), rgba(LINE, a), max(2, int(2 * s)), clamp((p - i * 0.12) / 0.75))
    dot_x = 855 + 120 * clamp((t - 2.2) / 6.0)
    draw.ellipse((*tx(dot_x - 5, y + 18, o, s), *tx(dot_x + 5, y + 28, o, s)), fill=rgba(ACCENT, int(a * 0.9)))


def indicators(draw: ImageDraw.ImageDraw, o, s: float, y: int, p: float) -> None:
    a = int(220 * p)
    for gy in (y - 38, y - 5, y + 28):
        dashed(draw, tx(610, gy, o, s), tx(955, gy, o, s), rgba(DIM, a), max(1, int(2 * s)), int(5 * s), int(7 * s), p)
    line(draw, tx(610, y + 47, o, s), tx(955, y + 47, o, s), rgba(LINE, a), max(2, int(2 * s)), p)
    vals = [23, 36, 48, 42, 58, 69]
    for i, v in enumerate(vals):
        x = 640 + i * 50
        h = v * ease(clamp((p - i * 0.08) / 0.65))
        rect_outline(draw, (*tx(x, y + 47 - h, o, s), *tx(x + 18, y + 47, o, s)), rgba(LINE, a), max(2, int(2 * s)), 1)
    pts = [(625, y + 12), (690, y), (750, y - 18), (795, y - 8), (840, y - 27), (930, y - 50)]
    for i in range(len(pts) - 1):
        line(draw, tx(*pts[i], o, s), tx(*pts[i + 1], o, s), rgba(LINE, a), max(2, int(2 * s)), clamp((p - i * 0.12) / 0.6))
    for i, pt in enumerate(pts[2:]):
        if p > 0.45 + i * 0.08:
            r = 4 * s
            c = tx(*pt, o, s)
            draw.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=rgba(ACCENT, a))


def site(draw: ImageDraw.ImageDraw, o, s: float, y: int, p: float) -> None:
    a = int(220 * p)
    line(draw, tx(610, y + 56, o, s), tx(960, y + 56, o, s), rgba(LINE, a), max(2, int(2 * s)), p)
    rect_outline(draw, (*tx(700, y - 40, o, s), *tx(765, y + 56, o, s)), rgba(LINE, a), max(2, int(2 * s)), p)
    line(draw, tx(713, y - 27, o, s), tx(752, y - 27, o, s), rgba(LINE, a), max(2, int(2 * s)), p)
    for i in range(4):
        for j in range(3):
            rect_outline(draw, (*tx(760 + i * 26, y - 15 + j * 24, o, s), *tx(786 + i * 26, y + 9 + j * 24, o, s)), rgba(LINE, a), max(1, int(2 * s)), clamp((p - (i + j) * 0.06) / 0.7))
    for x in (666, 905, 938):
        c = tx(x, y + 47, o, s)
        r = max(3, int(5 * s))
        draw.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), outline=rgba(LINE, a), width=max(1, int(2 * s)))
        line(draw, (c[0], c[1] + r), (c[0], c[1] + int(13 * s)), rgba(LINE, a), max(1, int(2 * s)), p)


def render_frame(w: int, h: int, fps: int, frame: int, duration: float) -> Image.Image:
    t = frame / fps
    img = Image.new("RGBA", (w, h), BG)
    draw = ImageDraw.Draw(img)
    side = min(w, h)
    s = side / 1080
    o = ((w - side) / 2, (h - side) / 2)
    f_brand = font("consolab.ttf", round(28 * s))
    f_label = font("consolab.ttf", round(24 * s))
    f_small = font("consola.ttf", round(17 * s))
    f_tiny = font("consola.ttf", round(14 * s))
    f_footer = font("consola.ttf", round(18 * s))
    f_logo = font("georgiab.ttf", round(88 * s))

    for i in range(70):
        x = int((37 * i * s + frame * 0.15) % w)
        y = int((83 * i * s + 19 * i) % h)
        draw.point((x, y), fill=(255, 255, 255, 18))

    text(draw, tx(64, 44, o, s), "CONSTRUDATA", INK, f_brand, fade(t, 0.15, 0.9))
    rows = [("Cronograma", 195), ("Indicadores", 375), ("Canteiro", 555)]
    starts = [0.65, 1.55, 2.45]
    for (label, y), start in zip(rows, starts):
        p = ease((t - start) / 1.05)
        a = fade(t, start, 0.65)
        text(draw, tx(64, y - 11, o, s), label, INK, f_label, a)
        line(draw, tx(300, y, o, s), tx(610, y, o, s), rgba(DIM, int(210 * p)), max(2, int(3 * s)), p)
        if label == "Cronograma":
            schedule(draw, o, s, t, y, p)
        elif label == "Indicadores":
            indicators(draw, o, s, y, p)
        else:
            site(draw, o, s, y, p)

    bottom_p = ease((t - 3.55) / 1.0)
    line(draw, tx(64, 676, o, s), tx(1016, 676, o, s), rgba(DIM, int(215 * bottom_p)), max(2, int(3 * s)), bottom_p)
    a = fade(t, 3.95, 0.8)
    text(draw, tx(64, 718, o, s), "VISUALIZADO EM:", INK, f_small, a)
    for i, item in enumerate(("> DASHBOARD DE OBRA", "> CRONOGRAMA LPS", "> ALERTAS DE DESVIO")):
        text(draw, tx(64, 750 + i * 28, o, s), item, MUTED, f_tiny, int(a * clamp((t - 4.25 - i * 0.18) / 0.45)))
    text(draw, tx(580, 718, o, s), "DADOS + ACAO", INK, f_small, a)
    text(draw, tx(580, 750, o, s), "REDUZ RETRABALHO E ATRASOS COM A", MUTED, f_tiny, a)
    text(draw, tx(580, 778, o, s), "INFORMACAO CERTA, NA HORA CERTA, PARA", MUTED, f_tiny, a)
    text(draw, tx(580, 806, o, s), "QUEM DECIDE.", MUTED, f_tiny, a)

    logo_a = fade(t, 5.1, 1.2)
    text(draw, tx(133, 900, o, s), "Dados", INK, f_logo, logo_a)
    star(draw, *tx(575, 895, o, s), round(42 * s), rgba(INK, logo_a), max(2, int(3 * s)), ease((t - 5.7) / 1.0))
    text(draw, tx(650, 900, o, s), "Obra", INK, f_logo, logo_a)
    text(draw, tx(540, 1030, o, s), "CONSTRUDATA.SOFTWARE", MUTED, f_footer, fade(t, 6.4, 0.8), anchor="mm")

    pulse = int(25 + 18 * math.sin(t * math.pi * 2 / 2.8))
    vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    v = ImageDraw.Draw(vignette)
    v.rectangle((0, 0, w, h), outline=(255, 255, 255, pulse), width=max(1, int(1.5 * s)))
    return Image.alpha_composite(img, vignette).convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(OUT_DIR / "construdata_dados_obra_2160.mp4"))
    parser.add_argument("--poster", default=str(OUT_DIR / "construdata_dados_obra_poster.png"))
    parser.add_argument("--width", type=int, default=2160)
    parser.add_argument("--height", type=int, default=2160)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--duration", type=float, default=10.0)
    args = parser.parse_args()

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    total = int(args.fps * args.duration)
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{args.width}x{args.height}",
        "-r",
        str(args.fps),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "15",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(out),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for frame in range(total):
        proc.stdin.write(render_frame(args.width, args.height, args.fps, frame, args.duration).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    poster = Path(args.poster)
    poster.parent.mkdir(parents=True, exist_ok=True)
    render_frame(args.width, args.height, args.fps, total - 1, args.duration).save(poster)
    print(out)
    print(poster)


if __name__ == "__main__":
    main()
