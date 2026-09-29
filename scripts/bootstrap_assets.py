"""One-time bootstrap of the brand kit into assets/ (run by the release workflow).

Source: the octopus kit committed in Kairzen/undrwrldcub-site at the design-handoff commit.
Derived sizes (32, 64, apple-touch 180) are generated from the 512 master.
After the first run assets/ is committed and this script is no longer used.
"""
import io
import pathlib
import urllib.request

from PIL import Image

SRC = "https://raw.githubusercontent.com/Kairzen/undrwrldcub-site/521cc76b86afc59fe48cfa485d9817ad32c13704/public/brand/"
OUT = pathlib.Path("assets")
OUT.mkdir(exist_ok=True)

for name in ["favicon.ico", "octopus-192.png", "octopus-512.png", "octopus-full.png"]:
    data = urllib.request.urlopen(SRC + name, timeout=60).read()
    (OUT / name).write_bytes(data)
    print(f"fetched {name} ({len(data)} bytes)")

master = Image.open(io.BytesIO((OUT / "octopus-512.png").read_bytes())).convert("RGBA")

# The 512 master is a wide emblem padded to a square with stray specks, which makes small
# icons tiny. Crop to the solid artwork (alpha > 128), then pad back to a square.
solid = master.getchannel("A").point(lambda a: 255 if a > 128 else 0)
left, top, right, bottom = solid.getbbox()
art = master.crop((left, top, right, bottom))
side = max(art.size)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.alpha_composite(art, ((side - art.width) // 2, (side - art.height) // 2))

for size in (32, 64):
    square.resize((size, size), Image.LANCZOS).save(OUT / f"octopus-{size}.png", optimize=True)
    print(f"generated octopus-{size}.png")

# iOS ignores transparency, so the touch icon sits on the brand background.
touch = Image.new("RGBA", (180, 180), (0x0E, 0x0C, 0x12, 255))
icon = square.resize((160, 160), Image.LANCZOS)
touch.alpha_composite(icon, (10, 10))
touch.convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
print("generated apple-touch-icon.png")
