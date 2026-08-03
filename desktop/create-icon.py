from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "assets"
OUT.mkdir(parents=True, exist_ok=True)

scale = 4
size = 256 * scale
image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)

def box(values):
    return tuple(int(value * scale) for value in values)

# Deep slate frame matching the desktop title bar.
draw.rounded_rectangle(box((6, 6, 250, 250)), radius=42 * scale, fill=(31, 42, 45, 255))

# Quiet teal inset gives the icon a recognisable edge at small sizes.
draw.rounded_rectangle(box((18, 18, 238, 238)), radius=34 * scale, fill=(8, 124, 128, 255))

# The white writing page with a folded top-right corner.
page = [(58, 42), (173, 42), (211, 80), (211, 218), (58, 218)]
draw.polygon([(x * scale, y * scale) for x, y in page], fill=(248, 250, 249, 255))
draw.rounded_rectangle(box((45, 42, 211, 218)), radius=15 * scale, fill=(248, 250, 249, 255))
draw.polygon([(173 * scale, 42 * scale), (211 * scale, 80 * scale), (173 * scale, 80 * scale)], fill=(205, 225, 222, 255))

# A geometric W remains legible from 16 px through 256 px.
w_points = [(75, 100), (98, 177), (128, 119), (157, 177), (182, 100)]
draw.line([(x * scale, y * scale) for x, y in w_points], fill=(5, 96, 100, 255), width=15 * scale, joint="curve")
for x, y in w_points:
    draw.ellipse(box((x - 7.5, y - 7.5, x + 7.5, y + 7.5)), fill=(5, 96, 100, 255))

# Two restrained writing lines complete the document metaphor.
draw.rounded_rectangle(box((77, 194, 145, 200)), radius=3 * scale, fill=(119, 153, 153, 255))
draw.rounded_rectangle(box((77, 207, 124, 213)), radius=3 * scale, fill=(171, 193, 191, 255))

resample = Image.Resampling.LANCZOS
png = image.resize((512, 512), resample)
png.save(OUT / "app-icon.png")

ico_source = image.resize((256, 256), resample)
ico_source.save(
    OUT / "app-icon.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

print(OUT / "app-icon.ico")
