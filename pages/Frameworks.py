# /pages/Frameworks.py

import os
import streamlit as st
import sys
from dotenv import load_dotenv
from utilities.gpt import generate_advanced_query
from components.sidebar_menu import sidebar_menu
import importlib

# Add the parent directory to sys.path if needed
# sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

def framework_sidebar():
    """Framework-specific sidebar navigation that honors a default from URL parameters"""
    st.sidebar.markdown("## 🧭 Framework Navigation")
    
    # Framework navigation with radio buttons - reordered to match the image
    framework_options = {
        "SWOT Analysis": "SWOT",
        "DIME Framework": "DIME",
        "COG Analysis": "COG",
        "PMESII-PT Framework": "PMESII",
        "DOTMLPF Framework": "DOTMLPF",
        "ACH Analysis": "ACH",
        "Starbursting": "STARBURSTING",
        "Deception Detection": "DECEPTION",
        "Behavioral Analysis": "BEHAVIOR",
        "Fundamental Flow": "FLOW"
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
        key="framework_sidebar_radio"
    )
    
    # Add a button to go to the frameworks landing page
    if st.sidebar.button("🏠 Return to Frameworks Home"):
        # Clear query parameters and session state
        st.query_params.clear()
        if "selected_framework" in st.session_state:
            st.session_state.pop("selected_framework")
        if "current_framework" in st.session_state:
            st.session_state.pop("current_framework")
        st.rerun()
    
    # Update session state with the selected framework
    selected_value = framework_options[selected_label]
    st.session_state["current_framework"] = selected_value
    
    # Map the selected value to the correct query parameter
    framework_param_map = {
        "SWOT": "swot",
        "DIME": "dime",
        "COG": "cog",
        "PMESII": "pmesii_pt",
        "DOTMLPF": "dotmlpf",
        "ACH": "ach",
        "STARBURSTING": "starbursting",
        "DECEPTION": "deception_detection",
        "BEHAVIOR": "behavior_analysis",
        "FLOW": "fundamental_flow"
    }
    
    # Add debug logging
    st.sidebar.write(f"Debug - Selected value: {selected_value}")
    st.sidebar.write(f"Debug - Framework param: {framework_param_map.get(selected_value)}")
    
    # If the framework changed, update the query parameter and trigger a rerun
    if "last_selected_framework" not in st.session_state or st.session_state["last_selected_framework"] != selected_value:
        st.session_state["last_selected_framework"] = selected_value
        if selected_value in framework_param_map:
            # Set the framework parameter and rerun to load the selected framework
            st.query_params["framework"] = framework_param_map[selected_value]
            st.rerun()
    
    # Framework-specific resources and links
    st.sidebar.markdown("## 📚 Framework Resources")
    if st.session_state.get("current_framework") == "COG":
        st.sidebar.markdown("""
        ### COG Analysis Resources
        - [Understanding Center of Gravity Analysis](https://www.jcs.mil/Portals/36/Documents/Doctrine/concepts/jcb_cog_analysis_method.pdf)
        - [COG Analysis in Military Planning](https://apps.dtic.mil/sti/pdfs/ADA479862.pdf)
        """)
    elif st.session_state.get("current_framework") == "PMESII":
        st.sidebar.markdown("""
        ### PMESII-PT Resources
        - [PMESII-PT Analysis Overview](https://www.jcs.mil/Portals/36/Documents/Doctrine/pubs/jp5_0.pdf)
        - [Operational Environment Analysis](https://armypubs.army.mil/epubs/DR_pubs/DR_a/pdf/web/atp2-01x3.pdf)
        """)
    elif st.session_state.get("current_framework") == "DIME":
        st.sidebar.markdown("""
        ### DIME Framework Resources
        - [DIME in National Power](https://www.jcs.mil/Portals/36/Documents/Doctrine/pubs/jp1_0.pdf)
        - [Strategic Assessment Using DIME](https://apps.dtic.mil/sti/pdfs/AD1012789.pdf)
        """)
    elif st.session_state.get("current_framework") == "DOTMLPF":
        st.sidebar.markdown("""
        ### DOTMLPF Resources
        - [DOTMLPF Analysis Guide](https://www.dau.edu/tools/t/DoD-Analysis-of-Alternatives-(AoA)-Handbook)
        - [Capability Assessment Framework](https://www.dau.edu/tools/t/JCIDS-Manual)
        """)
    elif st.session_state.get("current_framework") == "SWOT":
        st.sidebar.markdown("""
        ### SWOT Analysis Resources
        - [Strategic Planning with SWOT](https://hbr.org/1996/01/making-swot-analysis-work)
        - [SWOT in Military Context](https://apps.dtic.mil/sti/pdfs/ADA485935.pdf)
        """)
    elif st.session_state.get("current_framework") == "ACH":
        st.sidebar.markdown("""
        ### ACH Resources
        - [Analysis of Competing Hypotheses](https://www.cia.gov/static/955180a45afe3f5013772c313b16face/ACH-Methodology-Explained.pdf)
        - [ACH in Intelligence Analysis](https://www.e-education.psu.edu/research/sites/default/files/ACH.pdf)
        """)
    elif st.session_state.get("current_framework") == "STARBURSTING":
        st.sidebar.markdown("""
        ### Starbursting Resources
        - [Starbursting Technique Guide](https://www.mindtools.com/pages/article/newCT_91.htm)
        - [Question-Based Analysis Methods](https://www.strategyskills.com/critical-thinking-tools/)
        """)
    elif st.session_state.get("current_framework") == "DECEPTION":
        st.sidebar.markdown("""
        ### Deception Detection Resources
        - [Deception Detection Guide](https://www.dni.gov/files/NCSC/documents/campaign/Deception_Detection_Guide.pdf)
        - [Counter-Deception Analysis](https://www.cia.gov/library/center-for-the-study-of-intelligence/kent-csi/vol6no1/html/v06i1a05p_0001.htm)
        """)
    elif st.session_state.get("current_framework") == "BEHAVIOR":
        st.sidebar.markdown("""
        ### Behavioral Analysis Resources
        - [Behavioral Analysis Methods](https://www.cia.gov/library/center-for-the-study-of-intelligence/kent-csi/vol15no1/html/v15i1a03p_0001.htm)
        - [Human Behavior Analysis Guide](https://www.dni.gov/files/NCSC/documents/campaign/Behavioral_Analysis_Guide.pdf)
        """)
    elif st.session_state.get("current_framework") == "FLOW":
        st.sidebar.markdown("""
        ### Fundamental Flow Resources
        - [Flow Theory in Operations](https://www.sciencedirect.com/science/article/pii/S2212827119305839)
        - [Flow Analysis Methods](https://www.researchgate.net/publication/326462067_Flow_Analysis_Methods)
        """)
    
    # Wiki Links section
    st.sidebar.markdown("## [**🌐 Research Wiki Pages**](https://irregularpedia.org/index.php/Category:Research)")
    
    # Plan and Prepare section
    st.sidebar.subheader("📋 Plan and Prepare")
    st.sidebar.markdown("""
    - [Research Planning Guide](https://Irregularpedia.org/index.php/research-planning)
    - [Structured Analytic Techniques (SATs)](https://Irregularpedia.org/index.php/structured-analytic-techniques)
    - [PMESII-PT](https://Irregularpedia.org/index.php/pmesii-pt)
    - [Center of Gravity (COG) Analysis](https://Irregularpedia.org/index.php/cog)
    - [Research Templates](https://Irregularpedia.org/index.php/research-template)
    """)

    # Gather section
    st.sidebar.subheader("🔍 Gather")
    st.sidebar.markdown("""
    - [Research Datasets](https://Irregularpedia.org/index.php/research-datasets)
    - [Darkweb Links](https://Irregularpedia.org/index.php/darkweb-links)
    - [Research Tools](https://Irregularpedia.org/index.php/research-platforms)
    - [Leaks and Compilations](https://Irregularpedia.org/index.php/leaks)
    - [Citation](https://Irregularpedia.org/index.php/research-citation)
    - [AI-Prompting for Advanced Queries](https://Irregularpedia.org/index.php/ai-prompting)
    """)

    # Common framework tools
    st.sidebar.markdown("## 🛠️ Common Tools")
    st.sidebar.markdown("""
    - [Export Templates](https://example.com/templates)
    - [Analysis Guidelines](https://example.com/guidelines)
    - [Methodology References](https://example.com/references)
    """)

def frameworks_page():
    """Main entry point for the frameworks page."""
    # Add custom CSS for styling
    st.markdown("""
    <style>
    /* Base styles for both light and dark mode */
    .block-container {
        max-width: 95% !important;
        padding: 1rem;
    }
    
    /* Framework cards styling */
    .framework-card {
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 15px;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        border: 1px solid rgba(49, 51, 63, 0.2);
        cursor: pointer;
    }
    </style>
    """, unsafe_allow_html=True)
    
    st.title("🧩 Analysis Frameworks")
    
    # Add framework sidebar first, then the main sidebar menu
    framework_sidebar()
    sidebar_menu()
    
    # Get the framework from query parameters
    query_params = st.query_params
    framework = query_params.get("framework", None)
    
    # Add debug logging for query parameters
    st.write("Debug - Query parameters:", dict(query_params))
    st.write("Debug - Framework from query params:", framework)
    
    # If a framework is selected, load it using importlib
    if framework:
        import importlib
        
        # Map framework parameters to their respective modules and functions
        framework_map = {
            "swot": {"module": "frameworks.swot", "function": "swot_page"},
            "ach": {"module": "frameworks.ach", "function": "ach_page"},
            "cog": {"module": "frameworks.cog", "function": "cog_analysis"},
            "deception_detection": {"module": "frameworks.deception_detection", "function": "deception_detection"},
            "deception": {"module": "frameworks.deception_detection", "function": "deception_detection"},
            "dime": {"module": "frameworks.dime", "function": "dime_page"},
            "pmesii_pt": {"module": "frameworks.pmesii_pt", "function": "pmesii_pt_page"},
            "pmesii": {"module": "frameworks.pmesii_pt", "function": "pmesii_pt_page"},
            "dotmlpf": {"module": "frameworks.dotmlpf", "function": "dotmlpf_page"},
            "starbursting": {"module": "frameworks.starbursting", "function": "starbursting_page"},
            "behavior_analysis": {"module": "frameworks.behavior_analysis", "function": "behavior_analysis_page"},
            "fundamental_flow": {"module": "frameworks.fundamental_flow", "function": "fundamental_flow_page"}
        }
        
        # Add debug logging
        st.write(f"Debug - Selected framework: {framework}")
        st.write(f"Debug - Available frameworks: {list(framework_map.keys())}")
        st.write(f"Debug - Session state:", dict(st.session_state))
        
        # Handle legacy parameter names
        if framework == "pmesii":
            framework = "pmesii_pt"
        elif framework == "deception":
            framework = "deception_detection"
        
        if framework in framework_map:
            try:
                # Get module info
                module_info = framework_map[framework]
                module_name = module_info["module"]
                function_name = module_info["function"]
                
                st.write(f"Debug - Loading module: {module_name}")
                st.write(f"Debug - Function to call: {function_name}")
                
                # Import the module
                module = importlib.import_module(module_name)
                
                # Get and call the function
                if hasattr(module, function_name):
                    function = getattr(module, function_name)
                    st.write(f"Debug - Found function {function_name} in module {module_name}")
                    function()
                else:
                    st.error(f"Function '{function_name}' not found in module '{module_name}'")
                    st.error(f"Available functions in {module_name}: {[name for name in dir(module) if callable(getattr(module, name)) and not name.startswith('_')]}")
            except ImportError as e:
                st.error(f"Could not import module '{module_name}': {e}")
                st.write(f"Debug - Import error details: {str(e)}")
            except Exception as e:
                st.error(f"Error loading framework '{framework}': {e}")
                st.write(f"Debug - Error details: {str(e)}")
                import traceback
                st.write("Debug - Full traceback:", traceback.format_exc())
        else:
            st.error(f"Unknown framework: {framework}")
            st.write(f"Debug - Framework not found in framework_map")
        return
    
    # Display framework selection if none specified
    st.markdown("""
    <div class="dark-mode-compatible">
    <h3 style="color: #4880EC;">Welcome to the Analysis Frameworks Hub! 🚀</h3>
    
    <p>Select a framework from the options below to begin your analysis journey.
    Each framework provides specialized tools and methodologies for different analytical needs.</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Display the framework cards and rest of the page
    display_frameworks_page()

def main():
    # First check if we have a selected framework in session state (from URL processor)
    selected_framework = st.session_state.get("selected_framework", None)
    
    # If we have a selected framework, use it and clear it from session state
    if selected_framework:
        framework = selected_framework
        # Clear it to avoid reusing it
        st.session_state.pop("selected_framework", None)
        
        # Map the framework name to the correct value for current_framework
        framework_to_current_map = {
            "swot": "SWOT",
            "dime": "DIME",
            "cog": "COG",
            "pmesii": "PMESII",
            "pmesii_pt": "PMESII",
            "dotmlpf": "DOTMLPF",
            "ach": "ACH",
            "starbursting": "STARBURSTING",
            "deception": "DECEPTION",
            "deception_detection": "DECEPTION",
            "behavior_analysis": "BEHAVIOR",
            "fundamental_flow": "FLOW"
        }
        
        # Update current_framework in session state to ensure sidebar shows the correct selection
        if framework in framework_to_current_map:
            st.session_state["current_framework"] = framework_to_current_map[framework]
            
        # Set query parameter for URL sharing
        st.query_params["framework"] = framework
        
        # Get framework data if available
        framework_data = st.session_state.get("framework_data", None)
        if framework_data and framework_data["type"] == framework:
            # Store framework-specific data
            if framework == "dime":
                st.session_state["dime_input_scenario"] = framework_data["content"]
                st.session_state["dime_input_title"] = framework_data["title"]
            elif framework == "starbursting":
                st.session_state["starbursting_topic"] = framework_data["title"]
                st.session_state["starbursting_description"] = framework_data["content"]
            elif framework == "swot":
                st.session_state["swot_objective"] = framework_data["title"]
                st.session_state["swot_description"] = framework_data["content"]
            elif framework == "ach":
                st.session_state["ach_scenario"] = framework_data["content"]
                st.session_state["ach_title"] = framework_data["title"]
            
            # Clear framework data to avoid reuse
            st.session_state.pop("framework_data", None)
    else:
        # Otherwise, parse query parameters from the URL
        query_params = st.query_params
        framework = query_params.get('framework', None)
        
        if framework:
            # Map the framework name to the correct value for current_framework
            framework_to_current_map = {
                "swot": "SWOT",
                "dime": "DIME",
                "cog": "COG",
                "pmesii": "PMESII",
                "pmesii_pt": "PMESII",
                "dotmlpf": "DOTMLPF",
                "ach": "ACH",
                "starbursting": "STARBURSTING",
                "deception": "DECEPTION",
                "deception_detection": "DECEPTION",
                "behavior_analysis": "BEHAVIOR",
                "fundamental_flow": "FLOW"
            }
            
            # Update current_framework in session state to ensure sidebar shows the correct selection
            if framework in framework_to_current_map:
                st.session_state["current_framework"] = framework_to_current_map[framework]

    # Set up sidebar for framework navigation - only once
    framework_sidebar()
    
    # Map framework parameters to their respective modules and functions
    framework_map = {
        "swot": {"module": "frameworks.swot", "function": "swot_page"},
        "ach": {"module": "frameworks.ach", "function": "ach_page"},
        "cog": {"module": "frameworks.cog", "function": "cog_analysis"},
        "deception_detection": {"module": "frameworks.deception_detection", "function": "deception_detection"},
        "deception": {"module": "frameworks.deception_detection", "function": "deception_detection"},
        "dime": {"module": "frameworks.dime", "function": "dime_page"},
        "pmesii_pt": {"module": "frameworks.pmesii_pt", "function": "pmesii_pt_page"},
        "pmesii": {"module": "frameworks.pmesii_pt", "function": "pmesii_pt_page"},
        "dotmlpf": {"module": "frameworks.dotmlpf", "function": "dotmlpf_page"},
        "starbursting": {"module": "frameworks.starbursting", "function": "starbursting_page"},
        "behavior_analysis": {"module": "frameworks.behavior_analysis", "function": "behavior_analysis_page"},
        "fundamental_flow": {"module": "frameworks.fundamental_flow", "function": "fundamental_flow_page"}
    }
    
    # Handle the framework loading with better error handling
    try:
        if framework in framework_map:
            # Try to import the module
            module_info = framework_map[framework]
            module_name = module_info["module"]
            function_name = module_info["function"]
            
            try:
                # Import the module
                module = importlib.import_module(module_name)
                
                # Check if the function exists in the module
                if hasattr(module, function_name):
                    # Get the function from the module
                    function = getattr(module, function_name)
                    
                    # Call the function
                    function()
                else:
                    st.error(f"Function '{function_name}' not found in module '{module_name}'")
                    st.error(f"Available functions in {module_name}: {[name for name in dir(module) if callable(getattr(module, name)) and not name.startswith('_')]}")
                    display_frameworks_page()
            except ImportError as e:
                st.error(f"Could not import module '{module_name}': {e}")
                display_frameworks_page()
            except Exception as e:
                st.error(f"Error loading framework '{framework}': {e}")
                display_frameworks_page()
        else:
            # Don't call frameworks_page() directly as it would call framework_sidebar() again
            # Instead, set up the frameworks page content without calling framework_sidebar()
            display_frameworks_page()
    except Exception as e:
        st.error(f"Error loading framework: {e}")
        st.error("Falling back to frameworks page")
        display_frameworks_page()

# Create a new function to display frameworks page content without calling framework_sidebar()
def display_frameworks_page():
    # This function contains the content of frameworks_page() without the framework_sidebar() call
    # Add custom CSS for styling
    st.markdown("""
    <style>
    /* Base styles for both light and dark mode */
    .block-container {
        max-width: 95% !important;
        padding: 1rem;
    }
    
    /* Framework cards styling */
    .framework-card {
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 15px;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        border: 1px solid rgba(49, 51, 63, 0.2);
        cursor: pointer;
    }
    
    /* Framework links styling */
    .framework-link {
        display: flex;
        align-items: center;
        padding: 10px;
        margin-bottom: 10px;
        border-radius: 8px;
        transition: all 0.2s ease;
        cursor: pointer;
    }
    
    .framework-link .icon {
        font-size: 1.5em;
        margin-right: 10px;
    }
    
    /* Category headers */
    .category-header {
        padding: 10px;
        border-radius: 5px;
        margin-bottom: 15px;
        font-weight: 600;
        text-align: center;
    }
    
    /* Light mode specific styles */
    @media (prefers-color-scheme: light) {
        .framework-card {
            background-color: white;
            color: #262730;
            border: 1px solid #e6e6e6;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .framework-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
        }
        
        .framework-link {
            background-color: #f0f2f6;
            color: #262730;
            border: 1px solid #e6e6e6;
        }
        
        .framework-link:hover {
            background-color: #e6e9ef;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .category-header {
            background-color: #0068c9;
            color: white;
        }
        
        h3 {
            color: #0068c9 !important;
        }
        
        .dark-mode-compatible p {
            color: #262730;
        }
    }
    
    /* Dark mode specific styles */
    @media (prefers-color-scheme: dark) {
        .framework-card {
            background-color: #1e1e1e;
            color: #fafafa;
            border: 1px solid #333;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        
        .framework-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
        }
        
        .framework-link {
            background-color: #2e2e2e;
            color: #fafafa;
            border: 1px solid #444;
        }
        
        .framework-link:hover {
            background-color: #3e3e3e;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        
        .category-header {
            background-color: #4da6ff;
            color: #0e1117;
        }
        
        h3 {
            color: #4da6ff !important;
        }
        
        .dark-mode-compatible p {
            color: #fafafa;
        }
    }
    
    /* Error section styling */
    .error-section {
        padding: 20px;
        border-radius: 10px;
        margin-top: 20px;
    }
    
    @media (prefers-color-scheme: light) {
        .error-section {
            background-color: #fff3f3;
            border: 1px solid #ffcccb;
        }
    }
    
    @media (prefers-color-scheme: dark) {
        .error-section {
            background-color: #3a2a2a;
            border: 1px solid #5a3a3a;
        }
    }
    </style>
    """, unsafe_allow_html=True)
    
    st.title("🧩 Analysis Frameworks")
    
    # Add the main sidebar menu (but not the framework sidebar which is already added)
    sidebar_menu()
    
    st.markdown("""
    <div class="dark-mode-compatible">
    <h3 style="color: #4880EC;">Welcome to the Analysis Frameworks Hub! 🚀</h3>
    
    <p>Select a framework from the options below to begin your analysis journey.
    Each framework provides specialized tools and methodologies for different analytical needs.</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Use a wider layout with 3 columns
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown('<p class="subheader">🎯 Strategic Analysis</p>', unsafe_allow_html=True)
        
        # SWOT Analysis Card
        if st.button("📊 SWOT Analysis", key="swot_button_display"):
            st.query_params["framework"] = "swot"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">📊</div>
            <div class="card-content">
                <h4>SWOT Analysis</h4>
                <p>Analyze Strengths, Weaknesses, Opportunities, and Threats</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # DIME Framework Card
        if st.button("🌐 DIME Framework", key="dime_button_display"):
            st.query_params["framework"] = "dime"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">🌐</div>
            <div class="card-content">
                <h4>DIME Framework</h4>
                <p>Diplomatic, Information, Military, and Economic analysis</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # COG Analysis Card
        if st.button("⚔️ COG Analysis", key="cog_button_display"):
            st.query_params["framework"] = "cog"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">⚔️</div>
            <div class="card-content">
                <h4>COG Analysis</h4>
                <p>Center of Gravity analysis for strategic planning</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown('<p class="subheader">🔄 Operational Analysis</p>', unsafe_allow_html=True)
        
        # PMESII-PT Framework Card
        if st.button("🧩 PMESII-PT Framework", key="pmesii_button_display"):
            st.query_params["framework"] = "pmesii_pt"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">🧩</div>
            <div class="card-content">
                <h4>PMESII-PT Framework</h4>
                <p>Political, Military, Economic, Social, Infrastructure, Information, Physical Environment, and Time</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # DOTMLPF Framework Card
        if st.button("🛠️ DOTMLPF Framework", key="dotmlpf_button_display"):
            st.query_params["framework"] = "dotmlpf"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">🛠️</div>
            <div class="card-content">
                <h4>DOTMLPF Framework</h4>
                <p>Doctrine, Organization, Training, Materiel, Leadership, Personnel, and Facilities</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # ACH Analysis Card
        if st.button("⚖️ ACH Analysis", key="ach_button_display"):
            st.query_params["framework"] = "ach"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">⚖️</div>
            <div class="card-content">
                <h4>ACH Analysis</h4>
                <p>Analysis of Competing Hypotheses for intelligence assessment</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown('<p class="subheader">🔍 Specialized Analysis</p>', unsafe_allow_html=True)
        
        # Starbursting Card
        if st.button("✨ Starbursting", key="starbursting_button_display"):
            st.query_params["framework"] = "starbursting"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">✨</div>
            <div class="card-content">
                <h4>Starbursting</h4>
                <p>Question-based brainstorming technique for comprehensive analysis</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Fundamental Flow Card
        if st.button("🌊 Fundamental Flow", key="flow_button_display"):
            st.write("Debug - Fundamental Flow button clicked")
            st.write("Debug - Setting query parameter to 'fundamental_flow'")
            st.query_params["framework"] = "fundamental_flow"
            st.write("Debug - Query parameters after setting:", dict(st.query_params))
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">🌊</div>
            <div class="card-content">
                <h4>Fundamental Flow</h4>
                <p>Analyze and visualize the five fundamental flows: People, Material, Data, Energy, and Money</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Deception Detection Card
        if st.button("🕵️ Deception Detection", key="deception_button_display"):
            st.query_params["framework"] = "deception_detection"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">🕵️</div>
            <div class="card-content">
                <h4>Deception Detection</h4>
                <p>Identify and analyze potential deception in information</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Behavioral Analysis Card
        if st.button("🧠 Behavioral Analysis", key="behavior_button_display"):
            st.query_params["framework"] = "behavior_analysis"
            st.rerun()
        
        st.markdown("""
        <div class="framework-card">
            <div class="card-icon">🧠</div>
            <div class="card-content">
                <h4>Behavioral Analysis</h4>
                <p>Analyze patterns and motivations in human behavior</p>
            </div>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Add cards for framework descriptions
    st.markdown("""
    <div class="dark-mode-compatible">
    <h3 style="color: #4880EC;">Need Help Choosing? 💡</h3>
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("""
        <div class="info-card" style="border-left: 5px solid #4880EC;">
            <h4 style="color: #4880EC;">Strategic Analysis</h4>
            <p>For high-level planning and decision-making. Ideal for organizational strategy, competitive analysis, and long-term planning.</p>
        </div>
        """, unsafe_allow_html=True)
        
    with col2:
        st.markdown("""
        <div class="info-card" style="border-left: 5px solid #019CAD;">
            <h4 style="color: #019CAD;">Operational Analysis</h4>
            <p>For detailed implementation and execution planning. Perfect for tactical operations, resource allocation, and process improvement.</p>
        </div>
        """, unsafe_allow_html=True)
        
    with col3:
        st.markdown("""
        <div class="info-card" style="border-left: 5px solid #7B68EE;">
            <h4 style="color: #7B68EE;">Specialized Analysis</h4>
            <p>For focused examination of specific aspects or behaviors. Useful for targeted investigations, behavioral patterns, and specialized domains.</p>
        </div>
        """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()