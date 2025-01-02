# /researchtools_streamlit/app.py
import streamlit as st
from sidebar_menu import sidebar_menu
# This file is the main entry. Using Streamlit multi-page mode, you typically
# create multiple files in a "pages/" subfolder. Streamlit will auto-detect them
# and show them in the sidebar.

def main():
    st.set_page_config(
        page_title="Irregular Research Tools - Enhance Your Research", 
        page_icon=":mag:",  # Use a more recognizable icon for social media
        layout="wide"
    )
    st.title("Irregular Research Tools")
    st.image("media/research_logo.png", width=200)  # Replace with your logo path and adjust width as needed

    sidebar_menu()
    st.markdown("""
    Welcome to the **Research Tools**!
    This platform is a collection of community-created and curated research tools and links.
    Use the sidebar to navigate between different functionalities:
    - **Transformers**: [Text transformers](pages/Transformers.py) to assist while using other tools. Includes:
        - CSV to JSON and JSON to CSV converters for data format transformation.
        - Image SHA for reverse image search to find similar images across the web.
        - Wayback Tool for accessing archived web pages via archive links.
        - Text analysis tools for extracting insights from textual data.
    - **Frameworks**: Tools for structured analysis, including:
        - [COG Analysis](pages/frameworks/COG.py) for understanding centers of gravity in strategic contexts.
        - [SWOT Analysis](pages/frameworks/SWOT.py) for analyzing strengths, weaknesses, opportunities, and threats.
        - [ACH Analysis](pages/frameworks/ACH.py) for analyzing competing hypotheses.
        - [PMESII-PT framework](pages/frameworks/PMESII-PT.py) for analyzing political, military, economic, social, information, infrastructure, physical environment, and time factors.
    - **Wayback Tool**: Direct access to archived web pages for historical research.
    - **Image Search**: Tools for finding and analyzing images across various platforms.
    """)

    # Add footer with GitHub link
    st.markdown(
        """
        <hr>
        <div style='text-align: center;'>
            <a href="https://github.com/gitayam/researchtoolspy.git" target="_blank">
                <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" width="30">
                GitHub Repository
            </a>
        </div>
        """,
        unsafe_allow_html=True
    )

if __name__ == "__main__":
    main()

