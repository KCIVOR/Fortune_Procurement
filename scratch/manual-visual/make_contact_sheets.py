from pathlib import Path

from PIL import Image, ImageDraw


src = Path(r"C:\Users\Rovick\Desktop\project\scratch\manual-visual\render-v13-final")
out = src / "contact"
out.mkdir(exist_ok=True)

pages = sorted(src.glob("page-*.png"))
thumb_w = 260
thumb_h = 340
label_h = 30
cols = 4
rows = 3
per_sheet = cols * rows

for batch_index, start in enumerate(range(0, len(pages), per_sheet), start=1):
    batch = pages[start : start + per_sheet]
    sheet = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + label_h)), (230, 230, 230))

    for index, page_path in enumerate(batch):
        image = Image.open(page_path).convert("RGB")
        image.thumbnail((thumb_w, thumb_h))
        tile = Image.new("RGB", (thumb_w, thumb_h + label_h), "white")
        tile.paste(image, ((thumb_w - image.width) // 2, label_h))
        draw = ImageDraw.Draw(tile)
        draw.text((8, 8), page_path.stem, fill=(0, 0, 0))
        sheet.paste(tile, ((index % cols) * thumb_w, (index // cols) * (thumb_h + label_h)))

    sheet.save(out / f"contact-{batch_index:02d}.png")

print(f"{len(pages)} pages, {batch_index if pages else 0} contact sheets")
