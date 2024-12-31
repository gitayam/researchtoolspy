from utilities.utils_openai import generate_advanced_query
import streamlit as st

def advanced_query_options():
    """
    Display advanced query options and return the selected search platform and model.
    """
    st.write("**Advanced Query Options**")
    search_platform = st.selectbox(
        "Search Platform",
        ["Google", "Microsoft Portal", "Windows CMD Search"],
        help="Which platform's advanced query format to generate."
    )
    model = st.selectbox(
        "OpenAI Model",
        ["gpt-4o", "gpt-4o-mini"],
        index=1,
        help="Which model to use for generating the advanced query."
    )
    
    st.text_input(
        "Search Query to expand based on the platform selected",
        placeholder="e.g., PDF of Policy covering TOPIC from 2 months ago until today",
        key="search_query"
    )
    
    return search_platform, model