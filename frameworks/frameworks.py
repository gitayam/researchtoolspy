import streamlit as st
from urllib.parse import urlparse, parse_qs

def main():
    # Parse query parameters from the URL
    query_params = st.query_params
    framework = query_params.get('framework', [None])[0]

    if framework == 'swot':
        st.header("SWOT Analysis")
        # Add SWOT Analysis content here
    elif framework == 'ach':
        st.header("ACH Analysis")
        # Add ACH Analysis content here
    elif framework == 'cog':
        st.header("COG Analysis")
        # Add COG Analysis content here
    elif framework == 'deception':
        st.header("Deception Detection")
        # Add Deception Detection content here
    elif framework == 'dime':
        st.header("DIME Framework")
        # Add DIME Framework content here
    elif framework == 'pmesii':
        st.header("PMESII-PT Framework")
        # Add PMESII-PT Framework content here
    elif framework == 'dotmlpf':
        st.header("DOTMLPF Framework")
        # Add DOTMLPF Framework content here
    elif framework == 'starbursting':
        st.header("Starbursting")
        # Add Starbursting content here
    elif framework == 'behavior_analysis':
        st.header("Behavioral Analysis")
        # Add Behavioral Analysis content here
    else:
        st.warning("Please select a framework from the sidebar to view its details.")

if __name__ == "__main__":
    main() 