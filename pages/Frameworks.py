# /pages/Frameworks.py

import os
import streamlit as st
from dotenv import load_dotenv
from utilities.utils_openai import generate_advanced_query
from pages.frameworks.COG import cog_analysis
from pages.frameworks.SWOT import swot_page
from pages.frameworks.ACH import ach_page
from pages.frameworks.DeceptionDetection import deception_detection
from sidebar_menu import sidebar_menu

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
        "DOTMLPF Framework": "DOTMLPF"
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
        st.subheader("DIME Framework")
        st.write("""
        **DIME** stands for **Diplomatic, Information, Military, and Economic**. 
        It's used to analyze and plan the application of national power in pursuit of strategic ends.
        
        **How to use**: Identify how each dimension (D/I/M/E) contributes to or hinders 
        the desired objective in your current problemset.
        """)
    elif st.session_state.current_framework == "PMESII":
        st.subheader("PMESII-PT Framework")
        st.write("""
        **PMESII-PT**: **Political, Military, Economic, Social, Information, 
        Infrastructure, Physical Environment, and Time**. 
        This framework helps you analyze and understand the operating environment in a systemic way.
        
        **How to use**: For each PMESII-PT dimension, consider key actors, systems, or conditions 
        relevant to your problem statement.
        """)
    elif st.session_state.current_framework == "DOTMLPF":
        st.subheader("DOTMLPF Framework")
        st.write("""
        **DOTMLPF**: **Doctrine, Organization, Training, Materiel, Leadership and Education, Personnel, 
        and Facilities**. Typically used to assess capability gaps and solutions in military contexts.
        
        **How to use**: Evaluate each pillar (D/O/T/M/L/P/F) in the context of your problemset: 
        where do shortfalls exist, and how do we address them?
        """)
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

def main():
    frameworks_page()

if __name__ == "__main__":
    main()