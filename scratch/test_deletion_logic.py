import docx

doc = docx.Document("docs/HRIS Documentation (User Manual) as of Aug 12.docx")
body = doc.element.body
elements = list(body)

db_idx = -1
func_idx = -1
faq_idx = -1

for idx, elem in enumerate(elements):
    text = ''
    if elem.tag.endswith('p'):
        p = docx.text.paragraph.Paragraph(elem, doc)
        text = p.text.strip()
    if text == "Database Management & Data Table Operations":
        db_idx = idx
    elif text == "Functional Instructions":
        func_idx = idx
    elif text == "Troubleshooting & FAQs":
        faq_idx = idx

print(f"Original indices found - DB: {db_idx}, Func: {func_idx}, FAQ: {faq_idx}")

# Simulate DB deletion
if db_idx != -1 and func_idx != -1:
    print(f"Simulating deleting Database Management section from element {db_idx} to {func_idx - 1}...")
    temp_elements = list(elements)
    # Delete from list to see what remains
    del temp_elements[db_idx:func_idx]
    
    # Re-evaluate remaining elements
    new_func_idx = -1
    new_faq_idx = -1
    for idx, elem in enumerate(temp_elements):
        text = ''
        if elem.tag.endswith('p'):
            p = docx.text.paragraph.Paragraph(elem, doc)
            text = p.text.strip()
        if text == "Functional Instructions":
            new_func_idx = idx
        elif text == "Troubleshooting & FAQs":
            new_faq_idx = idx
            
    print(f"After DB deletion simulation - Func: {new_func_idx}, FAQ: {new_faq_idx}")
    
    if new_func_idx != -1:
        start_del = new_func_idx + 1
        if new_faq_idx != -1:
            end_del = new_faq_idx
        else:
            end_del = len(temp_elements)
        print(f"Simulating deleting Functional Instructions body from element {start_del} to {end_del - 1}...")
        # Check what elements would be deleted
        deleted_elements = temp_elements[start_del:end_del]
        print(f"Number of deleted elements: {len(deleted_elements)}")
        # Print the last few elements that are NOT deleted (i.e. from end_del to the end)
        remaining_after_func = temp_elements[end_del:]
        print(f"Number of remaining elements: {len(remaining_after_func)}")
        print("First 10 remaining elements text:")
        count = 0
        for elem in remaining_after_func:
            if count >= 10: break
            if elem.tag.endswith('p'):
                p = docx.text.paragraph.Paragraph(elem, doc)
                if p.text.strip():
                    print(f" - '{p.text.strip()}'")
                    count += 1
