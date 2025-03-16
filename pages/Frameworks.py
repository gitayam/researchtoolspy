# /pages/Frameworks.py

import os
import streamlit as st
import sys
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
import importlib

# Add the parent directory to sys.path if needed
# sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    
    # Add the sidebar menu
    sidebar_menu()
    
    # Get the framework from query parameters
    query_params = st.query_params
    framework = query_params.get("framework", None)
    
    # Display framework selection if none specified
    if not framework:
        st.write("Select a framework from the options below:")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.subheader("Strategic Analysis")
            if st.button("SWOT Analysis", use_container_width=True):
                st.experimental_set_query_params(framework="swot")
            if st.button("DIME Framework", use_container_width=True):
                st.query_params["framework"] = "dime"
            if st.button("COG Analysis", use_container_width=True):
                st.query_params["framework"] = "cog"
        
        with col2:
            st.subheader("Operational Analysis")
            if st.button("PMESII-PT Framework", use_container_width=True):
                st.query_params["framework"] = "pmesii_pt"
            if st.button("DOTMLPF Framework", use_container_width=True):
                st.query_params["framework"] = "dotmlpf"
            if st.button("ACH Analysis", use_container_width=True):
                st.query_params["framework"] = "ach"
        
        with col3:
            st.subheader("Specialized Analysis")
            if st.button("Starbursting", use_container_width=True):
                st.query_params["framework"] = "starbursting"
            if st.button("Deception Detection", use_container_width=True):
                st.query_params["framework"] = "deception_detection"
            if st.button("Behavioral Analysis", use_container_width=True):
                st.query_params["framework"] = "behavior_analysis"
        
        return
    
    # Map framework parameters to their respective module names and functions
    framework_map = {
        "swot": {"module": "frameworks.swot", "function": "swot_page"},
        "ach": {"module": "frameworks.ach", "function": "ach_page"},
        "cog": {"module": "frameworks.cog", "function": "cog_analysis"},
        "deception_detection": {"module": "frameworks.deception_detection", "function": "deception_detection"},
        "dime": {"module": "frameworks.dime", "function": "dime_page"},
        "pmesii_pt": {"module": "frameworks.pmesii_pt", "function": "pmesii_pt_page"},
        "dotmlpf": {"module": "frameworks.dotmlpf", "function": "dotmlpf_page"},
        "starbursting": {"module": "frameworks.starbursting", "function": "starbursting_page"},
        "behavior_analysis": {"module": "frameworks.behavior_analysis", "function": "behavior_analysis_page"}
    }
    
    # Handle legacy parameter names
    if framework == "pmesii":
        framework = "pmesii_pt"
    elif framework == "deception":
        framework = "deception_detection"
    
    # Render the selected framework
    if framework in framework_map:
        framework_info = framework_map[framework]
        module_name = framework_info["module"]
        function_name = framework_info["function"]
        
        try:
            # Try to import the module
            module = importlib.import_module(module_name)
            
            # Check if the function exists in the module
            if hasattr(module, function_name):
                function = getattr(module, function_name)
                function()  # Call the function
            else:
                st.error(f"Function '{function_name}' not found in module '{module_name}'")
                
                # Show what functions are available in the module
                st.write(f"Available functions in {module_name}:")
                for name in dir(module):
                    if callable(getattr(module, name)) and not name.startswith("_"):
                        st.write(f"- {name}")
        except ImportError as e:
            st.error(f"Could not import module '{module_name}': {e}")
        except Exception as e:
            st.error(f"Error rendering framework '{framework}': {e}")
    else:
        st.error(f"Unknown framework: {framework}")
        st.write("Please select a valid framework from the options below:")
        for key in framework_map.keys():
            st.write(f"- [{key.title()}](/Frameworks?framework={key})")

def load_framework():
    # Get the framework parameter from URL
    params = st.query_params
    framework = params.get("framework", [None])[0]
    
    if not framework:
        st.error("No framework specified. Please select a framework from the sidebar.")
        return
    
    # Map framework parameters to their respective functions
    framework_map = {
        "swot": swot,
        "ach": ach,
        "cog": cog,
        "deception": deception,
        "dime": dime,
        "pmesii": pmesii,
        "dotmlpf": dotmlpf,
        "starbursting": starbursting,
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