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
import pdfkit
import logging
import time
import concurrent.futures
import re
from typing import List, Union, Dict, Any, Optional
from urllib.parse import urlparse
import validators
from xhtml2pdf import pisa
import subprocess

logging.basicConfig(level=logging.INFO)

# Ensure saved_links is in session_state as a list for stacking multiple saved cards
if "saved_links" not in st.session_state:
    st.session_state["saved_links"] = []


def fetch_metadata(url):
    """
    Fetch metadata from a given URL. This is important to do before citing the URL.
    """
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
        return dt.strftime("%Y, %B %d")
    elif citation_format == "MLA":
        return dt.strftime("%d %b %Y")
    elif citation_format == "CHICAGO":
        return dt.strftime("%B %d, %Y")
    elif citation_format == "HARVARD":
        return dt.strftime("%Y, %B %d")
    elif citation_format == "IEEE":
        return dt.strftime("%b %d, %Y")
    else:
        return dt.strftime("%Y-%m-%d")


def clean_author_name(author_str, citation_format):
    """
    Remove a leading 'By ' if present and, for APA format, convert a full name
    into "Last, F." style.
    """
    author_str = author_str.strip()
    if author_str.lower().startswith("by "):
        author_str = author_str[3:].strip()
    if citation_format.upper() == "APA":
        parts = author_str.split()
        if len(parts) >= 2:
            last_name = parts[-1]
            initials = " ".join([p[0].upper() + "." for p in parts[:-1]])
            return f"{last_name}, {initials}"
    return author_str


def generate_website_citation(url, citation_format="APA", access_date=None, date_published=None, author=None):
    """
    Generate a formatted website citation using Manubot data.
    Default citation_format is APA.
    """
    if not access_date:
        access_date = datetime.now().strftime('%Y-%m-%d')
    citekey = f"url:{url}"
    csl_item = citekey_to_csl_item(citekey)
    title = csl_item.get('title', 'No title found')

    # Use the provided author if available, otherwise fallback to csl_item data.
    authors = csl_item.get('author', [])
    author_names = [] # This is the list of authors that will be used in the citation.
    if author:
        author_names.append(author)
    else:
        # if the author is not provided, we will use the authors from the csl_item.
        # the csl_item is the metadata from the URL.
        for author_info in authors:
            if isinstance(author_info, dict):
                name = (author_info.get('literal') or 
                        f"{author_info.get('family', '')} {author_info.get('given', '')}".strip() or 
                        None)
                if name:
                    author_names.append(name)
    # if the author_names is empty, we will use 'Author Unknown'
    if not author_names:
        formatted_authors = 'Author Unknown'
    # if the author_names is a single author, we will use the clean_author_name function.
    elif len(author_names) == 1:
        # if the author_names is a single author, we will use the clean_author_name function.
        formatted_authors = clean_author_name(author_names[0], citation_format)
    elif len(author_names) == 2:
        # if the author_names is a list of two authors, we will use the clean_author_name function.
        formatted_authors = f"{clean_author_name(author_names[0], citation_format)} & {clean_author_name(author_names[1], citation_format)}"
    else:
        # if the author_names is a list of more than two authors, we will use the clean_author_name function.
        formatted_authors = f"{', '.join([clean_author_name(n, citation_format) for n in author_names[:-1]])}, & {clean_author_name(author_names[-1], citation_format)}"

    # if the date_published is not 'No Date Published', we will use the format_date function.
    if date_published != "No Date Published":
        date_str = date_published.split("T")[0] if "T" in date_published else date_published
        formatted_date = format_date(date_str, citation_format)
    else:
        # if the date_published is 'No Date Published', we will use '(n.d.)'
        formatted_date = "(n.d.)"

    citation_format = citation_format.upper()
    if citation_format == "APA":
        # Example: Lussenhop, J. (2020, August 25). Title. Retrieved from URL on access_date.
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
    Generate a PDF from card data.
    
    Args:
        card_data: Dictionary containing URL, citation, and metadata
        
    Returns:
        bytes: PDF content as bytes
    """
    try:
        # Create HTML content for the PDF
        html_content = f"""
        <html>
        <head>
            <title>{card_data['metadata']['title']}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #2c3e50; }}
                h2 {{ color: #3498db; }}
                .section {{ margin-bottom: 20px; }}
                .label {{ font-weight: bold; }}
                .content {{ margin-left: 20px; }}
                .url {{ word-break: break-all; }}
            </style>
        </head>
        <body>
            <h1>{card_data['metadata']['title']}</h1>
            
            <div class="section">
                <div class="label">URL:</div>
                <div class="content url">{card_data['url']}</div>
            </div>
            
            <div class="section">
                <div class="label">Archived URL:</div>
                <div class="content url">{card_data.get('archived_url', 'Not archived')}</div>
            </div>
            
            <div class="section">
                <div class="label">Citation:</div>
                <div class="content">{card_data['citation']}</div>
            </div>
            
            <div class="section">
                <div class="label">Description:</div>
                <div class="content">{card_data['metadata']['description']}</div>
            </div>
            
            <div class="section">
                <div class="label">Keywords:</div>
                <div class="content">{card_data['metadata']['keywords']}</div>
            </div>
            
            <div class="section">
                <div class="label">Author:</div>
                <div class="content">{card_data['metadata']['author']}</div>
            </div>
            
            <div class="section">
                <div class="label">Date Published:</div>
                <div class="content">{card_data['metadata']['date_published']}</div>
            </div>
        </body>
        </html>
        """
        
        # Convert HTML to PDF
        output = io.BytesIO()
        pisa_status = pisa.CreatePDF(io.StringIO(html_content), dest=output)
        
        # Return PDF content
        if not pisa_status.err:
            return output.getvalue()
        else:
            logging.error("Error generating PDF with pisa")
            return None
    except Exception as e:
        logging.error(f"Error generating PDF: {e}")
        return None


def generate_pdf_from_url(target_url):
    """
    Generate a PDF of the given URL using pdfkit.
    Returns the PDF as bytes, or None if failed.
    """
    try:
        # Try to find wkhtmltopdf in common locations
        wkhtmltopdf_paths = [
            "/usr/bin/wkhtmltopdf",
            "/usr/local/bin/wkhtmltopdf",
            "/opt/homebrew/bin/wkhtmltopdf",  # Common macOS Homebrew location
            "C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe",
            "wkhtmltopdf"  # Try to use from PATH
        ]
        
        wkhtmltopdf_path = None
        for path in wkhtmltopdf_paths:
            try:
                if os.path.exists(path):
                    wkhtmltopdf_path = path
                    break
            except Exception:
                continue
        
        if not wkhtmltopdf_path:
            logging.warning("wkhtmltopdf not found in common locations. Trying without explicit path.")
            try:
                config = pdfkit.configuration()
            except Exception as e:
                logging.error(f"Error creating pdfkit configuration: {e}")
                return None
        else:
            try:
                config = pdfkit.configuration(wkhtmltopdf=wkhtmltopdf_path)
            except Exception as e:
                logging.error(f"Error creating pdfkit configuration with path {wkhtmltopdf_path}: {e}")
                return None
        
        options = {
            "quiet": "",
            "no-outline": None,
            "javascript-delay": 1000,  # Delay to allow JS to load; adjust as needed.
            "enable-local-file-access": "",
            "custom-header": [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/90.0.4430.93 Safari/537.36")],
        }
        
        try:
            pdf_bytes = pdfkit.from_url(target_url, False, configuration=config, options=options)
            if not pdf_bytes:
                raise ValueError("No PDF content generated; check the target URL or wkhtmltopdf options.")
            return pdf_bytes
        except Exception as e:
            logging.error(f"Error generating PDF with pdfkit: {e}")
            return None
    except Exception as e:
        logging.error(f"Error in generate_pdf_from_url for {target_url}: {e}")
        return None


def async_generate_pdf_from_url(target_url):
    """
    Generate a PDF from a URL using multiple methods in order of preference:
    1. pdfkit (wkhtmltopdf)
    2. xhtml2pdf
    3. Playwright
    
    Args:
        target_url: URL to convert to PDF
        
    Returns:
        bytes: PDF content as bytes
    """
    try:
        # Try using pdfkit first
        pdf_bytes = generate_pdf_from_url(target_url)
        if pdf_bytes:
            logging.info("Successfully generated PDF using pdfkit")
            return pdf_bytes
        
        # If pdfkit fails, try using xhtml2pdf
        logging.info("pdfkit failed, trying xhtml2pdf")
        try:
            import requests
            from xhtml2pdf import pisa
            
            # Fetch the HTML content
            response = requests.get(target_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/90.0.4430.93 Safari/537.36"
            })
            response.raise_for_status()
            html_content = response.text
            
            # Convert HTML to PDF
            output = io.BytesIO()
            pisa_status = pisa.CreatePDF(io.StringIO(html_content), dest=output)
            
            if not pisa_status.err:
                logging.info("Successfully generated PDF using xhtml2pdf")
                return output.getvalue()
        except Exception as e:
            logging.error(f"Error generating PDF with xhtml2pdf: {e}")
        
        # If xhtml2pdf fails, try using Playwright
        logging.info("xhtml2pdf failed, trying Playwright")
        pdf_bytes = generate_pdf_using_playwright(target_url)
        if pdf_bytes:
            logging.info("Successfully generated PDF using Playwright")
            return pdf_bytes
        
        logging.error("All PDF generation methods failed")
        return None
    except Exception as e:
        logging.error(f"Error generating PDF from {target_url}: {e}")
        return None


def display_link_card(url, citation, title, description, keywords, author, date_published, archived_url=None, use_expander=True, widget_id=None, referenced_links=None):
    """
    Render an improved card UI for link details with export options.
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
        <div style="margin-bottom:5px;">
           <strong>Citation:</strong><br>
           <code style="white-space: pre-wrap;">{citation}</code>
        </div>
        <div style="margin-bottom:5px;"><strong>Original Link:</strong> <a href="{url}" target="_blank">{url}</a></div>
        <div style="margin-bottom:5px;"><strong>Bypass Link:</strong> {bypass_link_html}</div>
    """
    if archived_url:
        card_html += f'<div style="margin-bottom:5px;"><strong>Archived URL:</strong> <a href="{archived_url}" target="_blank">{archived_url}</a></div>'

    # Add referenced links if provided
    if referenced_links:
        card_html += '<div style="margin-bottom:5px;"><strong>Referenced Links:</strong><ul>'
        for link in referenced_links:
            card_html += f'<li><a href="{link}" target="_blank">{link}</a></li>'
        card_html += '</ul></div>'

    card_html += "</div>"

    # Display the card.
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
                with st.spinner("Generating card PDF..."):
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
                
                if pdf_bytes:
                    st.session_state[card_pdf_key] = pdf_bytes
                    card_pdf_placeholder.download_button(
                        label="Download Card PDF",
                        data=pdf_bytes,
                        file_name=f"{title_filename}_card.pdf",
                        mime="application/pdf",
                        key=f"download_card_{unique_key}"
                    )
                else:
                    card_pdf_placeholder.error("Error generating card PDF. Please check logs.")

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
                webpage_pdf_placeholder.warning("Webpage PDF generation failed. Try installing PDF tools.")
                # Show instructions for installing PDF tools
                with st.expander("PDF Tools Installation Instructions"):
                    st.markdown("""
                    To enable PDF export, you need to install one of the following tools:
                    
                    1. **wkhtmltopdf** (recommended):
                       - macOS: `brew install wkhtmltopdf`
                       - Linux: `sudo apt-get install wkhtmltopdf`
                       - Windows: Download from [wkhtmltopdf.org](https://wkhtmltopdf.org/downloads.html)
                    
                    2. **Playwright** (alternative):
                       - Install with pip: `pip install playwright`
                       - Install browsers: `playwright install`
                    """)
        else:
            if st.button("Export Webpage as PDF", key=f"generate_webpage_{unique_key}"):
                with st.spinner("Generating webpage PDF (this may take a moment)..."):
                    # Check if PDF tools are installed
                    tools_status = check_pdf_tools_installed()
                    
                    if not tools_status["wkhtmltopdf"] and not tools_status["playwright"]:
                        st.warning("PDF generation tools are not installed. PDF export may not work properly.")
                        with st.expander("PDF Tools Installation Instructions"):
                            st.markdown("""
                            To enable PDF export, you need to install one of the following tools:
                            
                            1. **wkhtmltopdf** (recommended):
                               - macOS: `brew install wkhtmltopdf`
                               - Linux: `sudo apt-get install wkhtmltopdf`
                               - Windows: Download from [wkhtmltopdf.org](https://wkhtmltopdf.org/downloads.html)
                            
                            2. **Playwright** (alternative):
                               - Install with pip: `pip install playwright`
                               - Install browsers: `playwright install`
                            """)
                    
                    target = archived_url if archived_url else url
                    pdf_webpage_bytes = async_generate_pdf_from_url(target)
                    
                    if pdf_webpage_bytes:
                        st.session_state[webpage_pdf_key] = pdf_webpage_bytes
                        webpage_pdf_placeholder.download_button(
                            label="Download Webpage PDF",
                            data=pdf_webpage_bytes,
                            file_name=f"{title_filename}_webpage.pdf",
                            mime="application/pdf",
                            key=f"download_webpage_{unique_key}"
                        )
                        st.success("PDF generated successfully!")
                    else:
                        st.session_state[webpage_pdf_key] = None
                        webpage_pdf_placeholder.warning("Failed to generate PDF. Please install PDF tools.")
                        with st.expander("PDF Tools Installation Instructions"):
                            st.markdown("""
                            To enable PDF export, you need to install one of the following tools:
                            
                            1. **wkhtmltopdf** (recommended):
                               - macOS: `brew install wkhtmltopdf`
                               - Linux: `sudo apt-get install wkhtmltopdf`
                               - Windows: Download from [wkhtmltopdf.org](https://wkhtmltopdf.org/downloads.html)
                            
                            2. **Playwright** (alternative):
                               - Install with pip: `pip install playwright`
                               - Install browsers: `playwright install`
                            """)


def wayback_tool_page(use_expander=True):
    if "saved_links" not in st.session_state:
        st.session_state["saved_links"] = []

    st.header("Wayback Machine Archive Tool")
    url = st.text_input("Enter URL to archive", key="wayback_url")

    # Create two columns solely for the citation format selector and Process URL button
    col1, col2 = st.columns([3, 1])
    with col1:
        citation_format = st.selectbox(
            "Select Citation Format",
            options=["APA", "MLA", "Chicago", "Harvard", "IEEE"],
            index=0,
            key="citation_format"
        )
    with col2:
        process_url_button = st.button("Process URL")

    # The following processes are handled at full width (outside the columns)
    if process_url_button:
        if not url.strip():
            st.error("Please enter a valid URL.")
        else:
            title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(url)
            if author == "No Author" and editor:
                author = editor

            try:
                citation = generate_website_citation(
                    url,
                    citation_format=citation_format,
                    date_published=date_published,
                    author=author
                )
            except Exception as e:
                st.warning(f"Could not generate citation: {e}")
                citation = f"Manual citation needed for: {url}"

            try:
                resp = requests.post(f"https://web.archive.org/save/{url}", timeout=15)
                if resp.status_code == 200:
                    archived_url = resp.url
                    st.success("Archived URL (Wayback Machine) successfully!")
                else:
                    st.error("Failed to archive the URL with Wayback Machine")
            except Exception as e:
                st.error(f"Error occurred while archiving: {e}")

            # Display the link card at full width
            display_link_card(
                url, citation, title, description, keywords, author, date_published,
                archived_url=archived_url, use_expander=use_expander, referenced_links=referenced_links
            )

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
        import streamlit.components.v1 as components
        bibliography_text = ""
        for idx, card in enumerate(st.session_state["saved_links"], 1):
            bibliography_text += f"{idx}. {card['citation']}\n\n"
        components.html(f"""
        <html>
          <head>
            <script>
              function copyToClipboard() {{
                var element = document.getElementById("bibliographyText");
                element.select();
                document.execCommand("copy");
                alert("Bibliography copied to clipboard!");
              }}
            </script>
          </head>
          <body>
            <textarea id="bibliographyText" style="position: absolute; left: -1000px; top: -1000px;">{bibliography_text}</textarea>
            <button onclick="copyToClipboard()" style="padding: 8px 16px; font-size: 16px;">Copy All Bibliography</button>
          </body>
        </html>
        """, height=120)

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
                    st.rerun()


def generate_pdf_using_playwright(target_url):
    """
    Generate a PDF of the given URL using Playwright.
    
    Args:
        target_url: URL to convert to PDF
        
    Returns:
        bytes: PDF content as bytes
    """
    try:
        from playwright.sync_api import sync_playwright
        
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Navigate to the URL with a timeout
            page.goto(target_url, wait_until="networkidle", timeout=30000)
            
            # Wait for content to load
            page.wait_for_timeout(2000)
            
            # Generate PDF
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "1cm", "right": "1cm", "bottom": "1cm", "left": "1cm"}
            )
            
            browser.close()
            return pdf_bytes
    except Exception as e:
        print(f"Error generating PDF using Playwright: {e}")
        return None


def main():
    wayback_tool_page()


if __name__ == "__main__":
    main()

class URLProcessor:
    """Consolidated URL processing utilities"""
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate if a string is a proper URL"""
        return validators.url(url) is True
    
    @staticmethod
    def normalize_url(url: str) -> str:
        """Normalize URL by adding schema if missing"""
        if not url.startswith(('http://', 'https://')):
            return f'https://{url}'
        return url
    
    @staticmethod
    def process_urls(urls: Union[str, List[str]]) -> List[str]:
        """Process a list of URLs - normalize and validate"""
        if isinstance(urls, str):
            urls = [urls]
            
        processed = []
        for url in urls:
            url = URLProcessor.normalize_url(url.strip())
            if URLProcessor.validate_url(url):
                processed.append(url)
        
        return processed
    
    @staticmethod
    def extract_domain(url: str) -> str:
        """Extract domain from URL"""
        parsed = urlparse(URLProcessor.normalize_url(url))
        return parsed.netloc
    
    @staticmethod
    def extract_urls_from_text(text: str) -> List[str]:
        """Extract URLs from text content"""
        url_pattern = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+'
        return re.findall(url_pattern, text)

def url_processor_page():
    st.title("URL Processor & Analysis Tool")
    st.write("This tool helps you process, archive, and analyze URLs for research purposes.")
    
    # URL input
    url = st.text_input("Enter URL to process and analyze:", key="url_processor_input")
    
    # Create tabs for different processing options
    tab1, tab2, tab3 = st.tabs(["Basic Processing", "Archive & Citation", "Framework Analysis"])
    
    with tab1:
        st.subheader("Basic URL Processing")
        
        # Processing options
        with st.expander("Processing Options", expanded=True):
            extract_text = st.checkbox("Extract text content", value=True)
            extract_metadata = st.checkbox("Extract metadata", value=True)
            extract_links = st.checkbox("Extract links", value=True)
        
        # Process button
        if st.button("Process URL", key="process_url_basic"):
            if url:
                with st.spinner("Processing URL..."):
                    # Extract metadata
                    if extract_metadata:
                        try:
                            title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(url)
                            
                            st.subheader("URL Metadata")
                            metadata_cols = st.columns(2)
                            with metadata_cols[0]:
                                st.write("**Title:**", title)
                                st.write("**Description:**", description)
                                st.write("**Keywords:**", keywords)
                            with metadata_cols[1]:
                                st.write("**Author:**", author if author != "No Author" else editor)
                                st.write("**Date Published:**", date_published)
                            
                            # Store in session state for other tabs
                            st.session_state["url_metadata"] = {
                                "url": url,
                                "title": title,
                                "description": description,
                                "keywords": keywords,
                                "author": author if author != "No Author" else editor,
                                "date_published": date_published,
                                "referenced_links": referenced_links
                            }
                        except Exception as e:
                            st.error(f"Error extracting metadata: {e}")
                    
                    # Extract text content
                    if extract_text:
                        try:
                            from utilities.advanced_scraper import scrape_body_content
                            content = scrape_body_content(url)
                            
                            st.subheader("Page Content")
                            st.text_area("Extracted Text", value=content, height=300)
                            
                            # Store in session state for other tabs
                            st.session_state["url_content"] = content
                        except Exception as e:
                            st.error(f"Error extracting content: {e}")
                    
                    # Extract links
                    if extract_links:
                        try:
                            if "referenced_links" in locals() and referenced_links:
                                st.subheader("Referenced Links")
                                for link in referenced_links:
                                    st.write(f"- [{link}]({link})")
                            else:
                                st.info("No referenced links found.")
                        except Exception as e:
                            st.error(f"Error extracting links: {e}")
            else:
                st.warning("Please enter a URL")
    
    with tab2:
        st.subheader("Archive & Citation")
        
        # Citation format
        citation_format = st.selectbox(
            "Select Citation Format",
            options=["APA", "MLA", "Chicago", "Harvard", "IEEE"],
            index=0,
            key="citation_format_url_processor"
        )
        
        # Archive options
        archive_url_checkbox = st.checkbox("Archive URL with Wayback Machine", value=True)
        
        if st.button("Archive & Generate Citation", key="archive_url_button"):
            if url:
                with st.spinner("Processing..."):
                    # Get metadata if not already fetched
                    if "url_metadata" not in st.session_state:
                        try:
                            title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(url)
                            if author == "No Author" and editor:
                                author = editor
                        except Exception as e:
                            st.warning(f"Could not fetch metadata: {e}")
                            title = "No Title"
                            description = "No Description"
                            keywords = "No Keywords"
                            author = "No Author"
                            date_published = "No Date Published"
                            referenced_links = []
                    else:
                        metadata = st.session_state["url_metadata"]
                        title = metadata["title"]
                        description = metadata["description"]
                        keywords = metadata["keywords"]
                        author = metadata["author"]
                        date_published = metadata["date_published"]
                        referenced_links = metadata.get("referenced_links", [])
                    
                    # Generate citation
                    try:
                        citation = generate_website_citation(
                            url,
                            citation_format=citation_format,
                            date_published=date_published,
                            author=author
                        )
                        st.subheader("Citation")
                        st.code(citation)
                    except Exception as e:
                        st.warning(f"Could not generate citation: {e}")
                        citation = f"Manual citation needed for: {url}"
                    
                    # Archive URL if requested
                    archived_url = None
                    if archive_url_checkbox:
                        try:
                            with st.spinner("Archiving URL with Wayback Machine..."):
                                resp = requests.post(f"https://web.archive.org/save/{url}", timeout=15)
                                if resp.status_code == 200:
                                    archived_url = resp.url
                                    st.success(f"URL archived successfully: [Wayback Machine]({archived_url})")
                                else:
                                    st.error("Failed to archive the URL with Wayback Machine")
                        except Exception as e:
                            st.error(f"Error occurred while archiving: {e}")
                    
                    # Display the link card
                    display_link_card(
                        url, citation, title, description, keywords, author, date_published,
                        archived_url=archived_url, use_expander=True, referenced_links=referenced_links
                    )
                    
                    # Store card data in session state
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
                    
                    if "saved_links" not in st.session_state:
                        st.session_state["saved_links"] = []
                    
                    st.session_state["saved_links"].insert(0, card_data)
                    st.info(f"Exported your card with hash: {saved_hash}")
            else:
                st.warning("Please enter a URL")
    
    with tab3:
        st.subheader("Framework Analysis")
        st.write("Analyze the URL content using one of our analytical frameworks.")
        
        # Framework selection
        framework = st.selectbox(
            "Select Framework",
            options=["DIME Analysis", "Starbursting", "SWOT Analysis", "ACH Analysis"],
            index=0,
            key="framework_selection"
        )
        
        # Check if we have content to analyze
        has_content = "url_content" in st.session_state or "url_metadata" in st.session_state
        
        if not has_content:
            st.info("Process a URL in the 'Basic Processing' tab first to enable framework analysis.")
        
        # Framework-specific options
        if framework == "DIME Analysis":
            if has_content:
                st.write("DIME Analysis examines Diplomatic, Information, Military, and Economic factors.")
                if st.button("Analyze with DIME Framework"):
                    # Store data for DIME framework
                    content = st.session_state.get("url_content", "")
                    metadata = st.session_state.get("url_metadata", {})
                    
                    # Store with framework-specific prefix
                    st.session_state["dime_input_scenario"] = content
                    st.session_state["dime_input_title"] = metadata.get("title", "URL Analysis")
                    st.session_state["selected_framework"] = "dime"
                    st.session_state["framework_data"] = {
                        "type": "dime",
                        "content": content,
                        "title": metadata.get("title", "URL Analysis")
                    }
                    
                    # Redirect to Frameworks page
                    st.switch_page("pages/Frameworks.py")
        
        elif framework == "Starbursting":
            if has_content:
                st.write("Starbursting helps generate questions about a topic using who, what, when, where, why, and how.")
                if st.button("Analyze with Starbursting Framework"):
                    # Store data for Starbursting framework
                    content = st.session_state.get("url_content", "")
                    metadata = st.session_state.get("url_metadata", {})
                    
                    # Store with framework-specific prefix
                    st.session_state["selected_framework"] = "starbursting"
                    st.session_state["starbursting_topic"] = metadata.get("title", "URL Analysis")
                    st.session_state["starbursting_description"] = content
                    st.session_state["framework_data"] = {
                        "type": "starbursting",
                        "content": content,
                        "title": metadata.get("title", "URL Analysis")
                    }
                    
                    # Redirect to Frameworks page
                    st.switch_page("pages/Frameworks.py")
        
        elif framework == "SWOT Analysis":
            if has_content:
                st.write("SWOT Analysis examines Strengths, Weaknesses, Opportunities, and Threats.")
                if st.button("Analyze with SWOT Framework"):
                    # Store data for SWOT framework
                    content = st.session_state.get("url_content", "")
                    metadata = st.session_state.get("url_metadata", {})
                    
                    # Store with framework-specific prefix
                    st.session_state["swot_objective"] = metadata.get("title", "URL Analysis")
                    st.session_state["swot_description"] = content
                    st.session_state["selected_framework"] = "swot"
                    st.session_state["framework_data"] = {
                        "type": "swot",
                        "content": content,
                        "title": metadata.get("title", "URL Analysis")
                    }
                    
                    # Redirect to Frameworks page
                    st.switch_page("pages/Frameworks.py")
        
        elif framework == "ACH Analysis":
            if has_content:
                st.write("Analysis of Competing Hypotheses (ACH) helps evaluate multiple hypotheses.")
                if st.button("Analyze with ACH Framework"):
                    # Store data for ACH framework
                    content = st.session_state.get("url_content", "")
                    metadata = st.session_state.get("url_metadata", {})
                    
                    # Store with framework-specific prefix
                    st.session_state["ach_scenario"] = content
                    st.session_state["ach_title"] = metadata.get("title", "URL Analysis")
                    st.session_state["selected_framework"] = "ach"
                    st.session_state["framework_data"] = {
                        "type": "ach",
                        "content": content,
                        "title": metadata.get("title", "URL Analysis")
                    }
                    
                    # Redirect to Frameworks page
                    st.switch_page("pages/Frameworks.py")

def extract_domain(url: str) -> str:
    """Extract the domain from a URL."""
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    # Remove www. prefix if present
    if domain.startswith('www.'):
        domain = domain[4:]
    # Extract the main domain (e.g., example.co.uk from subdomain.example.co.uk)
    parts = domain.split('.')
    if len(parts) > 2:
        # Handle special cases like .co.uk, .com.au, etc.
        if parts[-2] in ['co', 'com', 'org', 'net', 'gov', 'edu'] and len(parts[-1]) == 2:
            return '.'.join(parts[-3:])
    return '.'.join(parts[-2:]) if len(parts) > 1 else domain

def clean_url(url: str) -> str:
    """Clean a URL by removing tracking parameters and normalizing paths."""
    # Parse the URL
    parsed_url = urlparse(url)
    
    # Remove tracking parameters (like utm_*)
    query_params = []
    if parsed_url.query:
        for param in parsed_url.query.split('&'):
            if '=' in param:
                key, value = param.split('=', 1)
                if not key.startswith('utm_'):
                    query_params.append(f"{key}={value}")
    
    # Normalize path (remove duplicate slashes)
    path = re.sub(r'/+', '/', parsed_url.path)
    
    # Reconstruct the URL
    clean_query = '&'.join(query_params)
    scheme = parsed_url.scheme or 'https'
    netloc = parsed_url.netloc
    
    if clean_query:
        return f"{scheme}://{netloc}{path}?{clean_query}"
    else:
        return f"{scheme}://{netloc}{path}"

def fetch_wayback_snapshots(url: str) -> Optional[str]:
    """Fetch the closest snapshot from the Wayback Machine."""
    wayback_api_url = f"https://archive.org/wayback/available?url={url}"
    
    try:
        response = requests.get(wayback_api_url)
        if response.status_code == 200:
            data = response.json()
            if "archived_snapshots" in data and "closest" in data["archived_snapshots"]:
                return data["archived_snapshots"]["closest"]["url"]
        return None
    except Exception as e:
        logging.error(f"Error fetching Wayback snapshots: {e}")
        return None

def archive_url(url: str) -> Optional[str]:
    """Archive a URL using the Wayback Machine's save API."""
    save_api_url = "https://web.archive.org/save/"
    
    try:
        response = requests.post(save_api_url + url)
        if response.status_code == 200:
            # Extract the archived URL from the response
            archived_url = f"https://web.archive.org/web/{int(time.time())}/{url}"
            return archived_url
        else:
            logging.error(f"Failed to archive URL: {response.status_code}")
            return None
    except Exception as e:
        logging.error(f"Error archiving URL: {e}")
        return None

def check_pdf_tools_installed():
    """
    Check if the required PDF generation tools are installed.
    
    Returns:
        dict: Status of each tool
    """
    tools_status = {
        "xhtml2pdf": True,  # Always available as it's a Python package
        "wkhtmltopdf": False,
        "playwright": False
    }
    
    # Check wkhtmltopdf
    try:
        # Try to find wkhtmltopdf in common locations
        wkhtmltopdf_paths = [
            "/usr/bin/wkhtmltopdf",
            "/usr/local/bin/wkhtmltopdf",
            "/opt/homebrew/bin/wkhtmltopdf",  # Common macOS Homebrew location
            "C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe",
            "wkhtmltopdf"  # Try to use from PATH
        ]
        
        for path in wkhtmltopdf_paths:
            try:
                if os.path.exists(path):
                    # Try to execute it to make sure it's working
                    try:
                        result = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=5)
                        if result.returncode == 0:
                            tools_status["wkhtmltopdf"] = True
                            logging.info(f"wkhtmltopdf found at {path}: {result.stdout.strip()}")
                            break
                    except (subprocess.SubprocessError, FileNotFoundError):
                        continue
            except Exception:
                continue
        
        if not tools_status["wkhtmltopdf"]:
            # Try to use pdfkit's configuration to find wkhtmltopdf
            try:
                import pdfkit
                config = pdfkit.configuration()
                if config.wkhtmltopdf:
                    tools_status["wkhtmltopdf"] = True
                    logging.info(f"wkhtmltopdf found via pdfkit at {config.wkhtmltopdf}")
            except Exception as e:
                logging.warning(f"Error checking pdfkit configuration: {e}")
    except Exception as e:
        logging.warning(f"Error checking wkhtmltopdf: {e}")
    
    # Check playwright
    try:
        import importlib.util
        playwright_installed = importlib.util.find_spec("playwright") is not None
        
        if playwright_installed:
            logging.info("Playwright package is installed")
            try:
                from playwright.sync_api import sync_playwright
                try:
                    with sync_playwright() as p:
                        try:
                            browser = p.chromium.launch()
                            browser.close()
                            tools_status["playwright"] = True
                            logging.info("Playwright browsers are installed and working")
                        except Exception as e:
                            # Playwright is installed but browsers are not
                            logging.warning(f"Playwright is installed but browsers failed to launch: {e}")
                except Exception as e:
                    # Playwright is installed but there was an error launching it
                    logging.warning(f"Error launching Playwright: {e}")
            except ImportError:
                logging.warning("Playwright package is installed but cannot be imported")
        else:
            logging.warning("Playwright package is not installed")
    except Exception as e:
        logging.warning(f"Error checking Playwright: {e}")
    
    return tools_status