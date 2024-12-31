# /researchtools_streamlit/app.py
import streamlit as st
from sidebar_menu import sidebar_menu
# This file is the main entry. Using Streamlit multi-page mode, you typically
# create multiple files in a "pages/" subfolder. Streamlit will auto-detect them
# and show them in the sidebar.

def main():
    st.set_page_config(page_title="Research Tools Streamlit", layout="wide")
    st.title("Research Tools Streamlit")
    sidebar_menu()
    st.markdown("""
    Welcome to the **Research Tools** re-implemented in Streamlit!
    Use the sidebar to navigate between different functionalities:
    - Home (CSV/JSON, advanced query, etc.)
    - Frameworks (COG Analysis, PMESII-PT, etc.)
    - Wayback Tool
    - Image Search
    """)

if __name__ == "__main__":
    main()

