from pathlib import Path
import fitz
root = Path(__file__).resolve().parent
with fitz.open(root / 'preview.pdf') as pdf:
    for i, page in enumerate(pdf, 1):
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(root / f'page-{i}.png')
        print(f'Page {i}: {len(page.get_text())} text characters')
