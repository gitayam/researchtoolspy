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
        help="Which model to use for generating the advanced query."
    )
    return search_platform, model