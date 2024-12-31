# /researchtools_streamlit/app.py
import streamlit as st
from sidebar_menu import sidebar_menu
# This file is the main entry. Using Streamlit multi-page mode, you typically
# create multiple files in a "pages/" subfolder. Streamlit will auto-detect them
# and show them in the sidebar.

def main():
    st.set_page_config(page_title="Research Tools", layout="wide")
    st.title("Research Tools Streamlit")
    sidebar_menu()
    st.markdown("""
    Welcome to the **Research Tools**!
    This platform is a collection of community-created and curated research tools and links.
    Use the sidebar to navigate between different functionalities:
    - **Home**: Text transformers to assist while using other tools. Includes:
        - CSV to JSON and JSON to CSV converters for data format transformation.
        - Image SHA for reverse image search to find similar images across the web.
        - Wayback Tool for accessing archived web pages via archive links.
        - Text analysis tools for extracting insights from textual data.
    - **Frameworks**: Tools for structured analysis, including:
        - COG Analysis for understanding centers of gravity in strategic contexts.
        - PMESII-PT framework for analyzing political, military, economic, social, information, infrastructure, physical environment, and time factors.
    - **Wayback Tool**: Direct access to archived web pages for historical research.
    - **Image Search**: Tools for finding and analyzing images across various platforms.
    """)

if __name__ == "__main__":
    main()

