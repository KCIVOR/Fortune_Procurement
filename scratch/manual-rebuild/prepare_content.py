import json
import re
import sys
from pathlib import Path

from docx import Document


SOURCE = Path(r"C:\Users\Rovick\Desktop\Procurement Documents\Fortune-Procurement-System-User-Manual.docx")
OUTPUT = Path("scratch/manual-rebuild/content.json")


def clean(value: str) -> str:
    replacements = {
        "\u00e2\u20ac\u201d": "-", "\u00e2\u20ac\u201c": "-",
        "\u00e2\u20ac\u02dc": "'", "\u00e2\u20ac\u2122": "'",
        "\u00e2\u20ac\u0153": '"', "\u00e2\u20ac\ufffd": '"',
        "\u00a0": " ", "\u2022": "-",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"\s[\u201c\u201d]\s", " - ", value)
    return re.sub(r"\s+", " ", value).strip()


def section_value(parts: list[tuple[str, str]], heading: str) -> list[str]:
    for index, (kind, text) in enumerate(parts):
        if text == heading:
            result = []
            for next_kind, next_text in parts[index + 1:]:
                if next_kind == "h2":
                    break
                if next_text:
                    result.append(next_text)
            return result
    return []


def main() -> None:
    doc = Document(SOURCE)
    raw_sections: list[tuple[str, list[tuple[str, str]]]] = []
    current_title = None
    current: list[tuple[str, str]] = []

    for paragraph in doc.paragraphs:
        text = clean(paragraph.text)
        style = paragraph.style.name if paragraph.style else ""
        if style == "Heading 1":
            if current_title:
                raw_sections.append((current_title, current))
            current_title, current = text, []
        elif current_title:
            current.append(("h2" if style == "Heading 2" else "body", text))
    if current_title:
        raw_sections.append((current_title, current))

    intro_parts = next(parts for title, parts in raw_sections if title == "Introduction")
    introduction = "\n\n".join(text for _kind, text in intro_parts if text)
    introduction = introduction.replace("process - from", "process - from")

    features = []
    for title, parts in raw_sections:
        if title == "Introduction":
            continue
        purpose = section_value(parts, "What it's for")
        location = section_value(parts, "Where to find it")
        steps = section_value(parts, "Steps")
        tips = section_value(parts, "Tips and things to watch out for")
        preamble = []
        for kind, text in parts:
            if text == "What it's for":
                break
            if kind == "body" and text:
                preamble.append(text)
        purpose_text = " ".join(preamble + purpose)
        features.append({
            "title": title,
            "purpose": purpose_text,
            "location": " ".join(location),
            "steps": steps,
            "tips": tips,
        })

    by_title = {item["title"]: item for item in features}
    by_title["Creating a Raw Material or Service Request Directly (PR2)"]["location"] = (
        'Planning Staff: click "My Requests" in the left sidebar, then click "New Request".'
    )
    by_title["Managing a Supplier's Product Catalog (Procurement)"]["location"] = (
        'Procurement: click "Product Catalog" in the left sidebar.'
    )
    by_title["Updating Delivery Status (Supplier)"]["location"] = (
        'Supplier: click "Deliveries" in the left sidebar.'
    )
    by_title["Managing Users (Admin)"]["location"] = (
        'Admin: click "Users" in the left sidebar.'
    )

    additions = [
        {
            "title": "Bulk Importing Users (Admin)",
            "purpose": "Who uses this: Admin. Adds many user accounts from one file and shows a one-time temporary password for each successfully imported user.",
            "location": 'Admin: click "Users" in the left sidebar, then click "Bulk Import".',
            "steps": [
                "Click Download Template if you need the expected column names.",
                "Upload a file containing Full Name, Email, Department, and Position. The file can contain up to 500 rows.",
                "Map the file columns to the required fields, then review the proposed department and position matches.",
                "Correct any unresolved department or position, then start the import.",
                "Review the successful and failed rows when the import finishes.",
                "Download the CSV or copy the credentials before closing the window if any users were imported successfully.",
            ],
            "tips": [
                "Each successful import receives a unique temporary password. It is shown only in the results window and cannot be recovered later.",
            ],
        },
        {
            "title": "Viewing System Roles (Admin)",
            "purpose": "Who uses this: Admin. Shows the system roles, the number of users assigned to each role, and the date each role was created.",
            "location": 'Admin: click "Roles" in the left sidebar.',
            "steps": [
                "Open the Roles page.",
                "Review the role name, assigned-user count, and created date.",
                "Use the page controls to move through the list when there is more than one page.",
            ],
            "tips": [
                "Roles are informational and read-only. Create, edit, and deactivate user accounts from Users instead.",
            ],
        },
        {
            "title": "Sharing and Reviewing Wishlist Ideas",
            "purpose": "Who uses this: Everyone and Admin. Lets users suggest improvements to the procurement system. Admin can review the complete list and record the outcome.",
            "location": 'Click the heart icon labeled "Wishlist" in the top header.',
            "steps": [
                "Enter a title and description for the improvement you would like to suggest. You can also add an optional category.",
                "Click Submit idea. Your idea appears in My ideas with its current status.",
                "While an idea is Open, use Edit or Delete to change or remove your own idea.",
                "If you are an Admin, search the submitted ideas or filter them by status.",
                "For an Admin update, choose Open, Planned, In progress, Completed, or Declined, add an optional note, and click Save changes.",
            ],
            "tips": [
                "Ideas that are no longer Open cannot be edited or deleted by the person who submitted them.",
                "An Admin note appears with the submitted idea when one has been saved.",
            ],
        },
    ]

    insert_after = "Managing Users (Admin)"
    position = next(i for i, item in enumerate(features) if item["title"] == insert_after) + 1
    features[position:position] = [additions[0], additions[1]]
    features.insert(next(i for i, item in enumerate(features) if item["title"] == "Reporting a Bug or Issue"), additions[2])

    content = {
        "app_name": "Fortune Procurement System",
        "manual_title": "User Manual",
        "version": "1.1",
        "date": "September 2026",
        "introduction": introduction,
        "features": features,
        "needs_clarification": [],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(content, indent=2, ensure_ascii=True), encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(features)} features.")


if __name__ == "__main__":
    main()
