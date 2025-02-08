# /pages/Frameworks.py

import os
import streamlit as st
from dotenv import load_dotenv
from utilities.gpt import generate_advanced_query
from frameworks.cog import cog_analysis
from frameworks.swot import swot_page
from frameworks.ach import ach_page
from frameworks.deception_detection import deception_detection
from frameworks.dime import dime_page
from components.sidebar_menu import sidebar_menu
from frameworks.pmesii_pt import pmesii_pt_page
from frameworks.dotmlpf import dotmlpf_page
from frameworks.starbursting import starbursting_page

load_dotenv()

def framework_sidebar():
    """Framework-specific sidebar navigation that honors a default from URL parameters"""
    st.sidebar.markdown("## Framework Navigation")
    
    # Framework navigation with radio buttons
    framework_options = {
        "SWOT Analysis": "SWOT",
        "ACH Analysis": "ACH",
        "COG Analysis": "COG",
        "Deception Detection": "DECEPTION",
        "DIME Framework": "DIME",
        "PMESII-PT Framework": "PMESII",
        "DOTMLPF Framework": "DOTMLPF",
        "Starbursting": "STARBURSTING"
    }
    
    # Create lists of labels and their corresponding values
    labels = list(framework_options.keys())
    values = list(framework_options.values())
    
    # Determine default index based on the session state's current framework
    default_index = 0
    current = st.session_state.get("current_framework")
    if current in values:
        default_index = values.index(current)
    
    selected_label = st.sidebar.radio(
        "Select Framework",
        options=labels,
        index=default_index,
    )
    st.session_state.current_framework = framework_options[selected_label]
    
    # Framework-specific resources and links
    st.sidebar.markdown("## Framework Resources")
    if st.session_state.current_framework == "COG":
        st.sidebar.markdown("""
        ### COG Analysis Resources
        - [COG Analysis Guide](https://irregularpedia.org/index.php/cog)
        - [Strange & Iron COG Paper](https://example.com/cog-paper)
        - [COG Templates](https://example.com/cog-templates)
        """)
    elif st.session_state.current_framework == "SWOT":
        st.sidebar.markdown("""
        ### SWOT Analysis Resources
        - [SWOT Guide](https://irregularpedia.org/index.php/swot)
        - [SWOT Templates](https://example.com/swot-templates)
        - [Example SWOT Analyses](https://example.com/swot-examples)
        """)
    elif st.session_state.current_framework == "ACH":
        st.sidebar.markdown("""
        ### ACH Resources
        - [ACH Methodology](https://irregularpedia.org/index.php/ach)
        - [Heuer's ACH Book](https://example.com/heuer-ach)
        - [ACH Templates](https://example.com/ach-templates)
        """)
    
    # Wiki Links section
    st.sidebar.markdown("## [**Research Wiki Pages**](https://irregularpedia.org/index.php/Category:Research)")
    
    # Plan and Prepare section
    st.sidebar.subheader("Plan and Prepare")
    st.sidebar.markdown("""
    - [Research Planning Guide](https://Irregularpedia.org/index.php/research-planning)
    - [Structured Analytic Techniques (SATs)](https://Irregularpedia.org/index.php/structured-analytic-techniques)
    - [PMESII-PT](https://Irregularpedia.org/index.php/pmesii-pt)
    - [Center of Gravity (COG) Analysis](https://Irregularpedia.org/index.php/cog)
    - [Research Templates](https://Irregularpedia.org/index.php/research-template)
    """)

    # Gather section
    st.sidebar.subheader("Gather")
    st.sidebar.markdown("""
    - [Research Datasets](https://Irregularpedia.org/index.php/research-datasets)
    - [Darkweb Links](https://Irregularpedia.org/index.php/darkweb-links)
    - [Research Tools](https://Irregularpedia.org/index.php/research-platforms)
    - [Leaks and Compilations](https://Irregularpedia.org/index.php/leaks)
    - [Citation](https://Irregularpedia.org/index.php/research-citation)
    - [AI-Prompting for Advanced Queries](https://Irregularpedia.org/index.php/ai-prompting)
    """)

    # Common framework tools
    st.sidebar.markdown("## Common Tools")
    st.sidebar.markdown("""
    - [Export Templates](https://example.com/templates)
    - [Analysis Guidelines](https://example.com/guidelines)
    - [Methodology References](https://example.com/references)
    """)

def frameworks_page():
    st.title("Analysis Frameworks")
    
    # Check URL parameters for a framework
    params = st.experimental_get_query_params()
    framework_param = params.get("framework", [None])[0]
    
    # If 'current_framework' is not already set in session_state, use URL param (make it uppercase to match our values)
    if 'current_framework' not in st.session_state or st.session_state.current_framework is None:
        if framework_param:
            st.session_state.current_framework = framework_param.upper()
        else:
            st.session_state.current_framework = None

    # Load framework-specific sidebar.
    # (This radio widget will now set the default based on the URL parameter.)
    framework_sidebar()
    
    # Main content area based on the current framework
    if st.session_state.current_framework == "COG":
        cog_analysis()
    elif st.session_state.current_framework == "SWOT":
        swot_page()
    elif st.session_state.current_framework == "ACH":
        ach_page()
    elif st.session_state.current_framework == "DECEPTION":
        deception_detection()
    elif st.session_state.current_framework == "DIME":
        dime_page()
    elif st.session_state.current_framework == "PMESII":
        pmesii_pt_page()
    elif st.session_state.current_framework == "DOTMLPF":
        dotmlpf_page()
    elif st.session_state.current_framework == "STARBURSTING":
        starbursting_page()
    else:
        # Default view when no framework is selected
        st.write("""
        Select a framework from the sidebar to begin your analysis. Each framework provides a structured
        approach to analyzing different aspects of your research problem.
        
        ### Available Frameworks:
        
        - **SWOT Analysis**: Analyze Strengths, Weaknesses, Opportunities, and Threats
        - **ACH Analysis**: Evaluate competing hypotheses systematically
        - **COG Analysis**: Identify and analyze Centers of Gravity
        - **Deception Detection**: Analyze potential deception indicators
        - **DIME Framework**: Analyze Diplomatic, Information, Military, and Economic factors
        - **PMESII-PT**: Analyze Political, Military, Economic, Social, Information, Infrastructure factors
        - **DOTMLPF**: Analyze Doctrine, Organization, Training, Material, Leadership, Personnel, and Facilities
        """)

    # Save user-specific frameworks based on the logged-in account number
    if "logged_in" in st.session_state and st.session_state["logged_in"]:
        account_number = st.session_state.get("account_number", "Unknown")
        saved_frameworks_key = f"saved_frameworks_{account_number}"
        if saved_frameworks_key not in st.session_state:
            st.session_state[saved_frameworks_key] = []
        
        # Add a button to save the current framework
        if st.button("Save Current Framework"):
            current_framework = st.session_state.get("current_framework")
            if current_framework and current_framework not in st.session_state[saved_frameworks_key]:
                st.session_state[saved_frameworks_key].append(current_framework)
                st.success(f"Framework '{current_framework}' saved for account {account_number}.")
            else:
                st.warning("No framework selected or framework already saved.")
        
        # Display saved frameworks
        st.subheader("Saved Frameworks")
        saved_frameworks = st.session_state.get(saved_frameworks_key, [])
        if saved_frameworks:
            for framework in saved_frameworks:
                st.write(f"- {framework}")
        else:
            st.write("No frameworks saved yet.")

        # URL processing also can save citations and processed urls if account is logged in
        st.subheader("URL Processing")
        url = st.text_input("Enter URL to process", key="url_processing")
        if st.button("Process URL"):
            if not url.strip():
                st.error("Please enter a valid URL.")
            else:
                title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(url)
                if author == "No Author" and editor:
                    author = editor

                try:
                    citation = generate_website_citation(
                        url,
                        citation_format="APA",
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
                    archived_url=archived_url, use_expander=True, referenced_links=referenced_links
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
                st.session_state[saved_frameworks_key].insert(0, card_data)
                st.info(f"Exported your card with hash: {saved_hash}")

def main():
    frameworks_page()

if __name__ == "__main__":
    main()
