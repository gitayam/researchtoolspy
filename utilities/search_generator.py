# /utilities/search_generator.py

from utilities.gpt import generate_advanced_query
import streamlit as st

def advanced_query_options():
    """
    Display advanced query options and return the selected search platform and model.
    """
    st.write("**Advanced Query Options**")
    
    # Create two columns for the dropdowns
    col1, col2 = st.columns(2)
    
    with col1:
        search_platform = st.selectbox(
            "Search Platform",
            ["Google", "Microsoft Portal", "Windows CMD Search"],
            help="Which platform's advanced query format to generate.",
            key="search_platform"
        )
    
    with col2:
        model = st.selectbox(
            "OpenAI Model",
            ["gpt-4o", "gpt-4o-mini"],
            index=1,
            help="Which model to use for generating the advanced query.",
            key="model_select"
        )
    
    st.text_input(
        "Search Query to expand based on the platform selected",
        placeholder="e.g., PDF of Policy covering TOPIC from 2 months ago until today",
        key="search_query"
    )
    
    return search_platform, model

def query_generator_page():
    st.title("Advanced Query Generator")
    st.write("This tool helps you generate advanced search queries for various search engines.")
    
    # Input for search topic
    search_topic = st.text_area("Enter your research topic or question:", height=100)
    
    # Search engine selection
    search_engine = st.selectbox("Select search engine:", ["Google", "Bing", "DuckDuckGo", "Yandex"])
    
    # Advanced options
    with st.expander("Advanced Options"):
        include_filetype = st.checkbox("Include filetype filters")
        include_site = st.checkbox("Include site-specific filters")
        
        if include_filetype:
            filetypes = st.multiselect("Select filetypes to include:", ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"])
        
        if include_site:
            sites = st.text_input("Enter sites to include (comma separated):")
    
    # Generate button
    if st.button("Generate Advanced Query"):
        if search_topic:
            st.success("Query generation placeholder - functionality coming soon!")
            st.code(f"Advanced query for {search_engine} would appear here")
        else:
            st.warning("Please enter a search topic")

def perform_search(query):
    # Example static data
    references = {
        "Article 1": "https://example.com/article1",
        "Research Paper A": "https://example.com/researchA",
        "Control the Panama Canal": "https://example.com/panama-canal",
        "Economic Influence in Panama": "https://example.com/economic-influence"
    }
    
    # Filter references based on the query
    results = {title: url for title, url in references.items() if query.lower() in title.lower()}
    return results