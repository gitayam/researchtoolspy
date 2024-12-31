from utilities.utils_openai import generate_advanced_query
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