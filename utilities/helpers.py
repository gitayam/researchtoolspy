import streamlit as st
from docx import Document
from docx.shared import Pt
import re
import io
import openpyxl
from openpyxl.styles import NamedStyle, Font, PatternFill, Border, Side
import pandas as pd
from io import BytesIO

def initialize_session_keys(keys, default=""):
    for key in keys:
        if key not in st.session_state:
            st.session_state[key] = default


initialize_session_keys(["dotmlpf_summary", "tradoc_alignment", "command_endorsement", "improved_problem_statement"])

def remove_markdown(md_text: str) -> str:
    """Remove markdown formatting from text."""
    if not md_text:
        return ""
    # Remove bold, italics, inline code and links
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', md_text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'_(.*?)_', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    text = re.sub(r'^#+\s', '', text, flags=re.MULTILINE)
    text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
    return text

def create_docx_document(title: str, sections: dict) -> io.BytesIO:
    """
    Create a DOCX document with a specified title and sections.

    Args:
      title: The document title.
      sections: A dictionary where keys are section headings and values are section contents (plain text).

    Returns:
      A BytesIO object containing the DOCX file.
    """
    document = Document()
    # Set default font
    style = document.styles["Normal"]
    font = style.font
    font.name = "Arial"
    font.size = Pt(12)

    document.add_heading(title, level=0)
    for heading, content in sections.items():
        document.add_heading(heading, level=1)
        # Remove markdown formatting to improve DOCX readability.
        text_content = remove_markdown(content)
        document.add_paragraph(text_content)

    docx_io = io.BytesIO()
    document.save(docx_io)
    docx_io.seek(0)
    return docx_io

def apply_excel_styling(ws, headers: list, total_row: int):
    """
    Apply common Excel styling using openpyxl.
    
    This applies header styles, auto-adjusts column widths and sets thin borders.
    """
    # Create a header style
    header_style = NamedStyle(name='header')
    header_style.font = Font(bold=True)
    header_style.fill = PatternFill(start_color='E0E0E0', end_color='E0E0E0', fill_type='solid')
    
    # Add the style if not already present
    if 'header' not in ws.parent.named_styles:
        ws.parent.add_named_style(header_style)

    # Set header cells style
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.style = header_style

    # Auto-adjust column widths
    for column_cells in ws.columns:
        max_length = 0
        for cell in column_cells:
            if cell.value:
                max_length = max(max_length, len(str(cell.value)))
        ws.column_dimensions[column_cells[0].column_letter].width = max_length + 2

    # Apply borders to all cells in the range
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    for row in ws.iter_rows(min_row=1, max_row=total_row, min_col=1, max_col=len(headers)):
        for cell in row:
            cell.border = thin_border

def export_ach_matrix_to_excel(hypotheses_list, evidence_list, ach_matrix, evidence_weights) -> bytes:
    """
    Export the ACH matrix to Excel using Pandas for basic tabular export.
    
    If detailed formatting is required, consider using openpyxl to further adjust styling.
    """
    data = []
    for ev in evidence_list:
        row = {"Evidence": ev, "Weight": evidence_weights.get(ev, 0)}
        for hyp in hypotheses_list:
            row[hyp] = ach_matrix.get((ev, hyp), "N/A")
        data.append(row)
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='ACH Matrix')
        writer.save()
    output.seek(0)
    return output.getvalue()
