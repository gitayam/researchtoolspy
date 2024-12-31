# /researchtools_streamlit/pages/WaybackTool.py

import streamlit as st
import requests
from bs4 import BeautifulSoup
from manubot.cite.citekey import citekey_to_csl_item
from datetime import datetime

def fetch_metadata(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            title = soup.title.string if soup.title else 'No title found'
            description = soup.find('meta', attrs={'name': 'description'})
            description_content = description['content'] if description else 'No description found'
            keywords = soup.find('meta', attrs={'name': 'keywords'})
            keywords_content = keywords['content'] if keywords else 'No keywords found'
            author = soup.find('meta', attrs={'name': 'author'})
            author_content = author['content'] if author else 'No author found'
            date_published = soup.find('meta', attrs={'name': 'datePublished'})
            date_published_content = date_published['content'] if date_published else 'No date published found'
            return title, description_content, keywords_content, author_content, date_published_content
        else:
            return 'Failed to fetch metadata', '', '', '', ''
    except Exception as e:
        return f"Error occurred: {e}", '', '', ''

def wayback_tool_page():
    st.header("Wayback Machine Archive Tool")
    url = st.text_input("Enter URL to archive", "")
    if url:
        # Fetch metadata to then generate a citation
        title, description, keywords, author, date_published = fetch_metadata(url)
        try:
            citation = generate_website_citation(url, date_published=date_published)
        except Exception as e:
            st.warning(f"Could not generate citation: {str(e)}")
            citation = f"Manual citation needed for: {url}"

    if st.button("Archive URL"):
        try:
            # Attempt to archive the URL using Wayback Machine
            resp = requests.post(f"https://web.archive.org/save/{url}")
            if resp.status_code == 200:
                st.write("Archived URL (Wayback Machine):")
                st.write(resp.url)
            else:
                st.write("Failed to archive the URL with Wayback Machine")
        except Exception as e:
            st.write(f"Error occurred while archiving with Wayback Machine: {e}")

        # Output the 12ft.io bypass link
        # Label section Archive and Bypass Links
        st.write("Archive and Bypass Links:")
        st.write("12ft.io Bypass URL:")
        st.write(f"https://12ft.io/{url}")

        ## Section for citation
        st.write("Citation:")
        st.code(citation, language=None)

        # Label section Metadata
        with st.expander("Metadata", expanded=False):
            st.write("Page Title:", title)
            st.write("Author:", author)
            st.write("Description:", description)
            st.write("Keywords:", keywords)
            st.write("Date Published:", date_published)
def generate_website_citation(url, access_date=None, date_published=None):
    if not access_date:
        access_date = datetime.now().strftime('%Y-%m-%d')
    citekey = f"url:{url}"
    csl_item = citekey_to_csl_item(citekey)
    title = csl_item.get('title', 'No title found')
    
    # More robust author extraction
    authors = csl_item.get('author', [])
    if authors and isinstance(authors, list):
        # Try to get author name from various possible fields
        author_info = authors[0]
        if isinstance(author_info, dict):
            author = (
                author_info.get('literal') or 
                f"{author_info.get('family', '')} {author_info.get('given', '')}".strip() or 
                'Author Unknown'
            )
        else:
            author = 'Author Unknown'
    else:
        author = 'Author Unknown'
    
    # Use "(n.d.)" if no published date is found
    published_date = date_published if date_published != 'No date published found' else '(n.d.)'
    
    citation = f"{author}. {published_date}. {title}. Retrieved from {url} on {access_date}"
    return citation

def main():
    wayback_tool_page()

if __name__ == "__main__":
    main()