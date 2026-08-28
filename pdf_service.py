import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

OUTPUT_DIR = "generated_pdfs"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def generate_result_pdf(full_name, test_name, answers, correct_count, wrong_count, percentage, ticket_number):
    """
    answers: list of dicts {"order": int, "selected": "A"/None, "correct": "A", "is_correct": bool}
    """
    filename = os.path.join(OUTPUT_DIR, f"natija_{ticket_number}.pdf")
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    y = height - 30 * mm
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y, "TEST NATIJASI")

    y -= 15 * mm
    c.setFont("Helvetica", 12)
    c.drawString(25 * mm, y, f"F.I.SH: {full_name}")
    y -= 8 * mm
    c.drawString(25 * mm, y, f"Test: {test_name}")
    y -= 8 * mm
    c.drawString(25 * mm, y, f"Chipta: {ticket_number}")

    y -= 12 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(25 * mm, y, "Javoblar:")
    y -= 8 * mm
    c.setFont("Helvetica", 11)

    for item in answers:
        if y < 25 * mm:
            c.showPage()
            y = height - 25 * mm
            c.setFont("Helvetica", 11)
        selected = item["selected"] or "-"
        mark = "to'g'ri" if item["is_correct"] else "xato"
        line = f"{item['order']}-savol: {selected}  ({mark})"
        c.drawString(28 * mm, y, line)
        y -= 7 * mm

    y -= 10 * mm
    if y < 40 * mm:
        c.showPage()
        y = height - 30 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(25 * mm, y, f"To'g'ri javoblar: {correct_count}")
    y -= 8 * mm
    c.drawString(25 * mm, y, f"Noto'g'ri javoblar: {wrong_count}")
    y -= 8 * mm
    c.drawString(25 * mm, y, f"Natija: {percentage:.0f}%")

    c.save()
    return filename
