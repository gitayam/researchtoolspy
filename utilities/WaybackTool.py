# /utilities/WaybackTool.py
import streamlit as st
import requests
from bs4 import BeautifulSoup
from manubot.cite.citekey import citekey_to_csl_item
from datetime import datetime
import uuid
import io
from fpdf import FPDF
from utilities.advanced_scraper import advanced_fetch_metadata
import hashlib
import os

# Import pdfkit for converting HTML to PDF.
import pdfkit

# Ensure saved_links is in session_state as a list for stacking multiple saved cards
if "saved_links" not in st.session_state:
    st.session_state["saved_links"] = []

def fetch_metadata(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except Exception as e:
        st.error(f"Error fetching URL metadata: {e}")
        return "No Title", "No Description", "No Keywords", "No Author", "No Date Published"
    
    soup = BeautifulSoup(response.content, 'html.parser')
    title = soup.title.string.strip() if soup.title and soup.title.string else "No Title"
    
    meta_description = soup.find('meta', attrs={'name': 'description'})
    description = meta_description['content'].strip() if meta_description and meta_description.get('content') else "No Description"
    
    meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
    keywords = meta_keywords['content'].strip() if meta_keywords and meta_keywords.get('content') else "No Keywords"
    
    meta_author = soup.find('meta', attrs={'name': 'author'})
    author = meta_author['content'].strip() if meta_author and meta_author.get('content') else "No Author"
    
    meta_date = soup.find('meta', attrs={'name': 'datePublished'})
    date_published = meta_date['content'].strip() if meta_date and meta_date.get('content') else "No Date Published"
    
    return title, description, keywords, author, date_published

def format_date(date_str, citation_format):
    """
    Given a date string in ISO format (e.g., "2018-10-10") and a citation format,
    return the date formatted appropriately.
    """
    try:
        dt = datetime.fromisoformat(date_str)
    except ValueError:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        except Exception:
            return date_str  # fallback: return the unformatted string
    citation_format = citation_format.upper()
    if citation_format == "APA":
        # APA: e.g., "2018, October 10"
        return dt.strftime("%Y, %B %d")
    elif citation_format == "MLA":
        # MLA: e.g., "10 Oct. 2018"
        return dt.strftime("%d %b %Y")
    elif citation_format == "CHICAGO":
        # Chicago: e.g., "October 10, 2018"
        return dt.strftime("%B %d, %Y")
    elif citation_format == "HARVARD":
        # Harvard: e.g., "2018, October 10"
        return dt.strftime("%Y, %B %d")
    elif citation_format == "IEEE":
        # IEEE: e.g., "Oct. 10, 2018"
        return dt.strftime("%b %d, %Y")
    else:
        return dt.strftime("%Y-%m-%d")

def generate_website_citation(url, citation_format="APA", access_date=None, date_published=None):
    """
    Generate a formatted website citation using Manubot data.
    Default citation_format is APA.
    """
    if not access_date:
        access_date = datetime.now().strftime('%Y-%m-%d')
    citekey = f"url:{url}"
    csl_item = citekey_to_csl_item(citekey)
    title = csl_item.get('title', 'No title found')
    
    # Build a list of author names from csl_item data.
    authors = csl_item.get('author', [])
    author_names = []
    for author_info in authors:
        if isinstance(author_info, dict):
            name = (author_info.get('literal') or 
                    f"{author_info.get('family', '')} {author_info.get('given', '')}".strip() or 
                    None)
            if name:
                author_names.append(name)
                
    if not author_names:
        formatted_authors = 'Author Unknown'
    elif len(author_names) == 1:
        formatted_authors = author_names[0]
    elif len(author_names) == 2:
        formatted_authors = f"{author_names[0]} & {author_names[1]}"
    else:
        formatted_authors = f"{', '.join(author_names[:-1])}, & {author_names[-1]}"
    
    if date_published != "No Date Published":
        # If the date is an ISO string with a time, cut it at the "T" to get just the date portion.
        date_str = date_published.split("T")[0] if "T" in date_published else date_published
        formatted_date = format_date(date_str, citation_format)
    else:
        formatted_date = "(n.d.)"
    
    citation_format = citation_format.upper()
    if citation_format == "APA":
        citation = f"{formatted_authors}. {formatted_date}. {title}. Retrieved from {url} on {access_date}."
    elif citation_format == "MLA":
        citation = f'"{title}." {formatted_authors}, {formatted_date}, {url}. Accessed {access_date}.'
    elif citation_format == "CHICAGO":
        citation = f"{formatted_authors}. \"{title}.\" {formatted_date}. {url} (accessed {access_date})."
    elif citation_format == "HARVARD":
        citation = f"{formatted_authors} ({formatted_date}) {title}. Available at: {url} (Accessed: {access_date})."
    elif citation_format == "IEEE":
        citation = f"{formatted_authors}, \"{title},\" {formatted_date}. [Online]. Available: {url}. [Accessed: {access_date}]."
    else:
        citation = f"{formatted_authors}. {formatted_date}. {title}. Retrieved from {url} on {access_date}."
        
    return citation

def generate_pdf(card_data):
    """
    Generate a PDF file (as bytes) from a card's details,
    using TrueType fonts from the system (DejaVuSans).
    """
    pdf = FPDF()
    # Define system paths for the normal and bold fonts.
    normal_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    
    if not os.path.exists(normal_path):
        raise RuntimeError(f"Normal font file not found at {normal_path}. Please ensure DejaVuSans.ttf is available.")
    
    pdf.add_font('DejaVu', '', normal_path, uni=True)
    
    if os.path.exists(bold_path):
        pdf.add_font('DejaVu', 'B', bold_path, uni=True)
        bold_style = 'B'
    else:
        bold_style = ''
    
    pdf.add_page()
    pdf.set_font("DejaVu", bold_style, 16)
    pdf.cell(200, 10, txt="Archived Page Details", ln=True, align="C")
    pdf.ln(10)
    
    pdf.set_font("DejaVu", '', 12)
    pdf.multi_cell(0, 10, txt=f"URL: {card_data['url']}")
    pdf.ln(5)
    pdf.multi_cell(0, 10, txt=f"Bypass Link: https://12ft.io/{card_data['url']}")
    if card_data.get("archived_url"):
        pdf.ln(5)
        pdf.multi_cell(0, 10, txt=f"Archived URL: {card_data['archived_url']}")
    pdf.ln(5)
    pdf.multi_cell(0, 10, txt="Citation:")
    pdf.set_font("DejaVu", '', 10)
    pdf.multi_cell(0, 10, txt=card_data.get("citation", ""))
    pdf.ln(5)
    pdf.set_font("DejaVu", bold_style, 12)
    pdf.multi_cell(0, 10, txt="Metadata:")
    pdf.set_font("DejaVu", '', 10)
    metadata = card_data.get("metadata", {})
    pdf.multi_cell(0, 10, txt=f"Title: {metadata.get('title', 'N/A')}")
    pdf.multi_cell(0, 10, txt=f"Description: {metadata.get('description', 'N/A')}")
    pdf.multi_cell(0, 10, txt=f"Keywords: {metadata.get('keywords', 'N/A')}")
    pdf.multi_cell(0, 10, txt=f"Author: {metadata.get('author', 'N/A')}")
    pdf.multi_cell(0, 10, txt=f"Date Published: {metadata.get('date_published', 'N/A')}")
    pdf_bytes = pdf.output(dest="S").encode("latin1", errors="replace")
    return pdf_bytes

def generate_pdf_from_url(target_url):
    """
    Generate a PDF of the given URL using pdfkit.
    Returns the PDF as bytes.
    """
    try:
        # Update this path to point to your wkhtmltopdf executable.
        wkhtmltopdf_path = "/usr/bin/wkhtmltopdf"  # Adjust this path if necessary.
        config = pdfkit.configuration(wkhtmltopdf=wkhtmltopdf_path)
        options = {
            "quiet": "",
            # You can add additional options here, e.g.:
            # "no-outline": None,
            # "disable-smart-shrinking": "",
        }
        # pdfkit.from_url returns the PDF content as bytes when output_path is False.
        pdf_bytes = pdfkit.from_url(target_url, False, configuration=config, options=options)
        return pdf_bytes
    except Exception as e:
        st.error(f"Error generating PDF from {target_url}: {e}")
        return None

def display_link_card(url, citation, title, description, keywords, author, date_published, archived_url=None, use_expander=True, widget_id=None):
    """
    Render an improved card UI for link details.
    
    - The expander (or header) now uses the page title.
    - The card displays the Original Link, Bypass Link, Archived URL (if any),
      Citation, and Metadata.
    - PDF exports (for both the card details and the webpage) are processed only
      when the user clicks their respective export buttons. A spinner is shown
      during PDF generation, and errors are reported.
    - The downloaded file names use the page title (with spaces replaced by underscores).
    
    The widget_id parameter can be provided to create persistent and unique keys.
    """
    # Generate a unique key.
    if widget_id is None:
        unique_key = hashlib.md5(url.encode()).hexdigest() + "_" + uuid.uuid4().hex
    else:
        unique_key = widget_id

    # Compute a cleaned version of the title to use in filenames.
    title_filename = title.strip().replace(" ", "_")
    
    # Build the clickable links HTML.
    bypass_link = f"https://12ft.io/{url}"
    bypass_link_html = f'<a href="{bypass_link}" target="_blank">{bypass_link}</a>'

    # Construct the HTML for the card details.
    card_html = f"""
    <div style="border:1px solid #ddd; padding:15px; border-radius:8px; margin:10px 0; background-color:#f9f9f9;">
        <div style="font-size:20px; font-weight:bold; margin-bottom:10px;">Archived Page Details</div>
        <div style="margin-bottom:5px;"><strong>Original Link:</strong> <a href="{url}" target="_blank">{url}</a></div>
        <div style="margin-bottom:5px;"><strong>Bypass Link:</strong> {bypass_link_html}</div>
    """
    
    if archived_url:
        card_html += f'<div style="margin-bottom:5px;"><strong>Archived URL:</strong> <a href="{archived_url}" target="_blank">{archived_url}</a></div>'
    
    card_html += f"""
        <div style="margin-bottom:5px;">
           <strong>Citation:</strong><br>
           <code style="white-space: pre-wrap;">{citation}</code>
        </div>
        <div style="margin-bottom:5px;">
           <strong>Metadata:</strong>
           <ul style="list-style-type:none; padding-left:0;">
               <li><strong>Title:</strong> {title}</li>
               <li><strong>Description:</strong> {description}</li>
               <li><strong>Keywords:</strong> {keywords}</li>
               <li><strong>Author:</strong> {author}</li>
               <li><strong>Date Published:</strong> {date_published}</li>
           </ul>
        </div>
    </div>
    """
    
    # Display the card using an expander or a simple markdown header.
    if use_expander:
        with st.expander(f"Link Card - {title}", expanded=True):
            st.markdown(card_html, unsafe_allow_html=True)
    else:
        st.markdown(f"**Link Card - {title}**", unsafe_allow_html=True)
        st.markdown(card_html, unsafe_allow_html=True)
    
    # Create two columns for the export options.
    col1, col2 = st.columns(2)
    
    # ----------------------- Export Card as PDF -----------------------
    card_pdf_key = f"card_pdf_{unique_key}"
    with col1:
        card_pdf_placeholder = st.empty()
        if card_pdf_key in st.session_state:
            card_pdf_placeholder.download_button(
                label="Download Card PDF",
                data=st.session_state[card_pdf_key],
                file_name=f"{title_filename}_card.pdf",
                mime="application/pdf",
                key=f"download_card_{unique_key}"
            )
        else:
            if st.button("Export Card as PDF", key=f"generate_card_{unique_key}"):
                pdf_bytes = generate_pdf({
                    "url": url,
                    "archived_url": archived_url,
                    "citation": citation,
                    "metadata": {
                        "title": title,
                        "description": description,
                        "keywords": keywords,
                        "author": author,
                        "date_published": date_published
                    }
                })
                st.session_state[card_pdf_key] = io.BytesIO(pdf_bytes)
                # Update the placeholder immediately after PDF generation.
                card_pdf_placeholder.download_button(
                    label="Download Card PDF",
                    data=st.session_state[card_pdf_key],
                    file_name=f"{title_filename}_card.pdf",
                    mime="application/pdf",
                    key=f"download_card_{unique_key}"
                )
    
    # -------------------- Export Webpage as PDF -----------------------
    webpage_pdf_key = f"webpage_pdf_{unique_key}"
    with col2:
        webpage_pdf_placeholder = st.empty()
        if webpage_pdf_key in st.session_state:
            if st.session_state[webpage_pdf_key]:
                webpage_pdf_placeholder.download_button(
                    label="Download Webpage PDF",
                    data=st.session_state[webpage_pdf_key],
                    file_name=f"{title_filename}_webpage.pdf",
                    mime="application/pdf",
                    key=f"download_webpage_{unique_key}"
                )
            else:
                webpage_pdf_placeholder.info("Webpage PDF not available.")
        else:
            if st.button("Export Webpage as PDF", key=f"generate_webpage_{unique_key}"):
                with st.spinner("Generating webpage PDF..."):
                    target = archived_url if archived_url else url
                    pdf_webpage_bytes = generate_pdf_from_url(target)
                if pdf_webpage_bytes:
                    st.session_state[webpage_pdf_key] = io.BytesIO(pdf_webpage_bytes)
                    webpage_pdf_placeholder.download_button(
                        label="Download Webpage PDF",
                        data=st.session_state[webpage_pdf_key],
                        file_name=f"{title_filename}_webpage.pdf",
                        mime="application/pdf",
                        key=f"download_webpage_{unique_key}"
                    )
                else:
                    st.session_state[webpage_pdf_key] = None
                    webpage_pdf_placeholder.error("Error generating webpage PDF. Please check your configuration and logs.")

def wayback_tool_page(use_expander=True):
    # Ensure saved_links is initialized.
    if "saved_links" not in st.session_state:
        st.session_state["saved_links"] = []

    st.header("Wayback Machine Archive Tool")
    url = st.text_input("Enter URL to archive", key="wayback_url")
    
    citation_format = st.selectbox(
        "Select Citation Format",
        options=["APA", "MLA", "Chicago", "Harvard", "IEEE"],
        index=0,
        key="citation_format"
    )
    
    archived_url = None  
    if st.button("Archive URL"):
        if not url.strip():
            st.error("Please enter a valid URL.")
        else:
            # Get metadata using the advanced scraper.
            title, description, keywords, author, date_published = advanced_fetch_metadata(url)
            # Additional author detection: try article:author if plain meta author is not informative.
            if author == "No Author":
                meta_article_author = BeautifulSoup(requests.get(url).content, "lxml").find("meta", property="article:author")
                if meta_article_author and meta_article_author.get("content"):
                    author = meta_article_author["content"].strip()
            
            try:
                citation = generate_website_citation(
                    url,
                    citation_format=citation_format,
                    date_published=date_published
                )
            except Exception as e:
                st.warning(f"Could not generate citation: {e}")
                citation = f"Manual citation needed for: {url}"
            
            # Archive URL via the Wayback Machine.
            try:
                resp = requests.post(f"https://web.archive.org/save/{url}", timeout=15)
                if resp.status_code == 200:
                    archived_url = resp.url
                    st.success("Archived URL (Wayback Machine) successfully!")
                else:
                    st.error("Failed to archive the URL with Wayback Machine")
            except Exception as e:
                st.error(f"Error occurred while archiving: {e}")
            
            # Display the card.
            display_link_card(
                url, citation, title, description, keywords, author, date_published,
                archived_url=archived_url, use_expander=use_expander
            )
            
            # Save card details.
            saved_hash = str(uuid.uuid4())[:8]
            card_data = {
                "hash": saved_hash,
                "url": url,
                "bypass": f"https://12ft.io/{url}",
                "archived_url": archived_url,
                "citation": citation,
                "metadata": {
                    "title": title,
                    "description": description,
                    "keywords": keywords,
                    "author": author,
                    "date_published": date_published
                }
            }
            st.session_state["saved_links"].insert(0, card_data)
            st.info(f"Exported your card with hash: {saved_hash}")
    
    st.markdown("---")
    st.subheader("Load Saved Links")
    load_hash = st.text_input("Enter saved hash to load a specific card:", key="load_hash")
    if st.button("Load Saved"):
        found = False
        for card in st.session_state["saved_links"]:
            if card["hash"] == load_hash:
                st.success("Loaded saved link data:")
                display_link_card(
                    card["url"],
                    card["citation"],
                    card["metadata"]["title"],
                    card["metadata"]["description"],
                    card["metadata"]["keywords"],
                    card["metadata"]["author"],
                    card["metadata"]["date_published"],
                    archived_url=card.get("archived_url"),
                    use_expander=use_expander
                )
                found = True
                break
        if not found:
            st.error("No saved data found for this hash.")
    
    st.markdown("---")
    st.subheader("Manage Saved Link Cards")
    if st.button("Clear All Saved Cards"):
        st.session_state["saved_links"] = []
        st.success("All saved link cards have been cleared.")
    
    if st.session_state["saved_links"]:
        st.markdown("### Your Saved Link Cards:")
        for idx, card in enumerate(st.session_state["saved_links"]):
            container = st.container()
            with container.expander(f"Link Card [{card['hash']}] - {card['metadata']['title']}", expanded=False):
                display_link_card(
                    card["url"],
                    card["citation"],
                    card["metadata"]["title"],
                    card["metadata"]["description"],
                    card["metadata"]["keywords"],
                    card["metadata"]["author"],
                    card["metadata"]["date_published"],
                    archived_url=card.get("archived_url"),
                    use_expander=use_expander
                )
                if st.button("Remove this card", key=f"remove_{card['hash']}"):
                    st.session_state["saved_links"].pop(idx)
                    st.experimental_rerun()

def main():
    wayback_tool_page()

if __name__ == "__main__":
    main()