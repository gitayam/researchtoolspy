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
from frameworks.behavior_analysis import behavior_analysis_page
from frameworks import (
    swot, ach, cog, deception, 
    dime, pmesii, dotmlpf, starbursting
)

load_dotenv()

def framework_sidebar():
    """Framework-specific sidebar navigation that honors a default from URL parameters"""
    st.sidebar.markdown("## Framework Navigation")
    
    # Framework navigation with radio buttons
    framework_options = {
        "SWOT Analysis": "SWOT",
        "Starbursting": "STARBURSTING",
        "ACH Analysis": "ACH",
        "Behavioral Analysis": "BEHAVIOR",
        "Deception Detection": "DECEPTION",
        "COG Analysis": "COG",
        "DIME Framework": "DIME",
        "PMESII-PT Framework": "PMESII",
        "DOTMLPF Framework": "DOTMLPF",
    }
    
    # Create lists of labels and their corresponding values
    labels = list(framework_options.keys())
    values = list(framework_options.values())
    
    # Use the session state's current framework, if available, to establish the default radio selection
    default_index = 0
    current = st.session_state.get("current_framework")
    if current in values:
        default_index = values.index(current)
    
    selected_label = st.sidebar.radio(
        "Select Framework",
        options=labels,
        index=default_index,
    )
    st.session_state["current_framework"] = framework_options[selected_label]
    
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
    
    # Process URL query parameters to allow menu URLs to work.
    query_params = st.query_params
    if "framework" in query_params:
        # Normalize the input to uppercase to match our mapping values.
        framework_from_url = query_params["framework"][0].strip().upper()
        valid_frameworks = {
            "SWOT", "STARBURSTING", "ACH", "BEHAVIOR",
            "DECEPTION", "COG", "DIME", "PMESII", "DOTMLPF"
        }
        if framework_from_url in valid_frameworks:
            st.session_state["current_framework"] = framework_from_url
    else:
        if "current_framework" not in st.session_state:
            st.session_state["current_framework"] = "DIME"  # Default framework

    # Load framework-specific sidebar.
    # (This radio widget will now set the default based on the URL parameter.)
    framework_sidebar()
    
    # Main content area based on the current framework
    current_fw = st.session_state.get("current_framework", "DIME")
    if current_fw == "COG":
        cog_analysis()
    elif current_fw == "SWOT":
        swot_page()
    elif current_fw == "ACH":
        ach_page()
    elif current_fw == "DECEPTION":
        deception_detection()
    elif current_fw == "DIME":
        dime_page()
    elif current_fw == "PMESII":
        pmesii_pt_page()
    elif current_fw == "DOTMLPF":
        dotmlpf_page()
    elif current_fw == "STARBURSTING":
        starbursting_page()
    elif current_fw == "BEHAVIOR":
        behavior_analysis_page()
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

def load_framework():
    # Get the framework parameter from URL
    params = st.query_params
    framework = params.get("framework", [None])[0]
    
    if not framework:
        st.error("No framework specified. Please select a framework from the sidebar.")
        return
    
    # Map framework parameters to their respective modules/functions
    framework_map = {
        "swot": swot.render_swot_analysis,
        "starbursting": starbursting.render_starbursting,
        "ach": ach.render_ach_analysis,
        "deception": deception.render_deception_detection,
        "cog": cog.render_cog_analysis,
        "dime": dime.render_dime_framework,
        "pmesii": pmesii.render_pmesii_framework,
        "dotmlpf": dotmlpf.render_dotmlpf_framework,
        "behavior_analysis": behavior_analysis_page
    }
    
    # Render the selected framework
    if framework in framework_map:
        framework_map[framework]()
    else:
        st.error(f"Unknown framework: {framework}")

def main():
    frameworks_page()

if __name__ == "__main__":
    main()