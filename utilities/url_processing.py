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
    Generate a PDF file (as bytes) from a card's details,
    using TrueType fonts from the system (DejaVuSans).
    """

    # For more on FPDF, see: https://pyfpdf.readthedocs.io/en/latest/
    pdf = FPDF() # This is the PDF object that will be used to generate the PDF.
    normal_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

    if not os.path.exists(normal_path):
        # if the normal font file is not found, we will raise an error.
        raise RuntimeError(f"Normal font file not found at {normal_path}. Please ensure DejaVuSans.ttf is available.")

    pdf.add_font('DejaVu', '', normal_path, uni=True)
    # if the bold font file is found, we will add it to the PDF.
    if os.path.exists(bold_path):
        pdf.add_font('DejaVu', 'B', bold_path, uni=True)
        bold_style = 'B'
    else:
        bold_style = ''

    pdf.add_page() # This is the page that will be used to generate the PDF.
    pdf.set_font("DejaVu", bold_style, 16) # This is the font that will be used to generate the PDF.
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
    Returns the PDF as bytes, or None if failed.
    """
    try:
        wkhtmltopdf_path = "/usr/bin/wkhtmltopdf"  # Adjust if necessary.
        if not os.path.exists(wkhtmltopdf_path):
            raise FileNotFoundError(f"wkhtmltopdf not found at {wkhtmltopdf_path}.")
        config = pdfkit.configuration(wkhtmltopdf=wkhtmltopdf_path)
        options = {
            "quiet": "",
            "no-outline": None,
            "javascript-delay": 1000,  # Delay to allow JS to load; adjust as needed.
            "enable-local-file-access": "",
            "custom-header": [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/90.0.4430.93 Safari/537.36")],
        }
        pdf_bytes = pdfkit.from_url(target_url, False, configuration=config, options=options)
        if not pdf_bytes:
            raise ValueError("No PDF content generated; check the target URL or wkhtmltopdf options.")
        return pdf_bytes
    except Exception as e:
        st.error(f"Error generating PDF from {target_url}: {e}")
        logging.error(f"Error generating PDF from {target_url}: {e}")
        return None


def async_generate_pdf_from_url(target_url):
    """
    Generate a PDF in a background thread while updating a progress bar.
    This function simulates progress until the PDF is ready.
    """
    progress_bar = st.progress(0) # This is the progress bar that will be used to generate the PDF.
    status_text = st.empty() # This is the text that will be used to display the status of the PDF generation.
    status_text.text("Generating PDF...") # This is the text that will be used to display the status of the PDF generation.

    # This is the thread that will be used to generate the PDF.
    # threadpoolexecutor is a thread pool executor that will be used to generate the PDF by running the generate_pdf_from_url function in a separate thread.
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(generate_pdf_from_url, target_url)
        # Simulate a looping progress bar until the PDF generation is complete.
        while not future.done():
            for i in range(101):
                progress_bar.progress(i)
                time.sleep(0.05)
                if future.done():
                    break
        progress_bar.empty()
        status_text.empty()
        return future.result()


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
            # Existing export option using wkhtmltopdf
            if st.button("Export Webpage as PDF", key=f"generate_webpage_{unique_key}"):
                target = archived_url if archived_url else url
                pdf_webpage_bytes = async_generate_pdf_from_url(target)
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

            # Comment out or remove the Playwright export button
            # if st.button("Export Webpage as PDF (Playwright)", key=f"generate_webpage_pw_{unique_key}"):
            #     with st.spinner("Generating webpage PDF using Playwright..."):
            #         target = archived_url if archived_url else url
            #         pdf_webpage_bytes = generate_pdf_using_playwright(target)
            #     if pdf_webpage_bytes:
            #         st.session_state[webpage_pdf_key] = io.BytesIO(pdf_webpage_bytes)
            #         webpage_pdf_placeholder.download_button(
            #             label="Download Webpage PDF",
            #             data=st.session_state[webpage_pdf_key],
            #             file_name=f"{title_filename}_webpage.pdf",
            #             mime="application/pdf",
            #             key=f"download_webpage_pw_{unique_key}"
            #         )
            #     else:
            #         st.session_state[webpage_pdf_key] = None
            #         webpage_pdf_placeholder.error("Error generating webpage PDF using Playwright.")


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
    ...
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        st.error("Playwright is not installed. Please install it with 'pip install playwright' and run 'playwright install'.")
        return None

    # ... rest of the function code


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
    st.title("URL Processor")
    st.write("This tool helps you process and archive URLs for research purposes.")
    
    # URL input
    url = st.text_input("Enter URL:")
    
    # Processing options
    with st.expander("Processing Options"):
        archive = st.checkbox("Archive URL", value=True)
        extract_text = st.checkbox("Extract text content", value=True)
        extract_metadata = st.checkbox("Extract metadata", value=True)
        extract_links = st.checkbox("Extract links", value=True)
    
    # Process button
    if st.button("Process URL"):
        if url:
            st.success("URL processing placeholder - functionality coming soon!")
            
            # Show tabs for different results
            tab1, tab2, tab3, tab4 = st.tabs(["Content", "Metadata", "Links", "Archive"])
            
            with tab1:
                st.write("Text content would appear here")
            
            with tab2:
                st.write("Metadata would appear here")
            
            with tab3:
                st.write("Links would appear here")
            
            with tab4:
                st.write("Archive information would appear here")
        else:
            st.warning("Please enter a URL")