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
        "Behavioral Analysis": "BEHAVIOR"
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
    
    # Update session state and redirect to the selected framework
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
        "BEHAVIOR": "behavior_analysis"
    }
    
    # If the framework changed, update the query parameter
    if "last_selected_framework" not in st.session_state or st.session_state["last_selected_framework"] != selected_value:
        st.session_state["last_selected_framework"] = selected_value
        if selected_value in framework_param_map:
            st.query_params["framework"] = framework_param_map[selected_value]
    
    # Framework-specific resources and links
    st.sidebar.markdown("## 📚 Framework Resources")
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
    # Add custom CSS for styling
    st.markdown("""
    <style>
    /* Wider container */
    .block-container {
        max-width: 95% !important;
        padding-top: 1rem;
        padding-right: 1rem;
        padding-left: 1rem;
        padding-bottom: 1rem;
    }
    
    /* Dark mode compatibility */
    .dark-mode-compatible {
        background-color: rgba(38, 39, 48, 0.2);
        color: #FAFAFA;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
        width: 100%;
    }
    
    /* Button styling */
    div.stButton > button {
        background: linear-gradient(to right, #4880EC, #019CAD);
        color: white;
        border-radius: 10px;
        border: none;
        padding: 10px 15px;
        font-weight: bold;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        width: 100%;
    }
    
    div.stButton > button:hover {
        background: linear-gradient(to right, #019CAD, #4880EC);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.2);
        transform: translateY(-2px);
    }
    
    h1 {
        background: linear-gradient(to right, #4880EC, #019CAD);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 3em !important;
        font-weight: 800 !important;
        text-align: center;
        margin-bottom: 30px !important;
    }
    
    h3 {
        color: #4880EC;
        margin-top: 20px !important;
    }
    
    .subheader {
        font-weight: bold;
        color: #019CAD;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 15px;
    }
    
    hr {
        margin-top: 30px;
        margin-bottom: 30px;
        border: 0;
        height: 1px;
        background-image: linear-gradient(to right, rgba(0, 0, 0, 0), rgba(72, 128, 236, 0.75), rgba(0, 0, 0, 0));
    }
    
    /* Framework Card Styles - Dark mode compatible */
    .framework-card {
        background-color: rgba(38, 39, 48, 0.2);
        color: #FAFAFA;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 20px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        transition: all 0.3s ease;
        cursor: pointer;
        border-left: 5px solid #4880EC;
        height: 100%;
        min-height: 120px;
    }
    
    .framework-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
        border-left: 5px solid #019CAD;
        background-color: rgba(38, 39, 48, 0.4);
    }
    
    .card-icon {
        font-size: 2.5em;
        margin-right: 15px;
        color: #4880EC;
        flex-shrink: 0;
    }
    
    .card-content {
        flex: 1;
    }
    
    .card-content h4 {
        margin: 0;
        color: #4880EC;
        font-weight: bold;
        margin-bottom: 5px;
    }
    
    .card-content p {
        margin: 0;
        font-size: 0.9em;
        color: #CCCCCC;
    }
    
    /* Info cards - Dark mode compatible */
    .info-card {
        padding: 20px;
        border-radius: 10px;
        background-color: rgba(38, 39, 48, 0.2);
        border-left: 5px solid #4880EC;
        margin-bottom: 20px;
        color: #FAFAFA;
        width: 100%;
    }
    
    .info-card h4 {
        color: #4880EC;
        margin-top: 0;
    }
    
    .info-card p {
        color: #CCCCCC;
    }
    
    /* Framework links - Dark mode compatible */
    .framework-link {
        text-decoration: none;
        display: block;
        padding: 10px;
        border-radius: 5px;
        background-color: rgba(38, 39, 48, 0.2);
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        transition: all 0.2s ease;
        width: 100%;
    }
    
    .framework-link:hover {
        background-color: rgba(38, 39, 48, 0.4);
        transform: translateX(5px);
    }
    
    .framework-link span.icon {
        font-size: 1.5em;
        margin-right: 10px;
    }
    
    .framework-link span.text {
        color: #4880EC;
        font-weight: bold;
    }
    
    /* Hide the actual buttons */
    div.stButton {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }
    
    /* But make sure buttons are visible when they're not part of the card system */
    div.stButton.standalone-button {
        position: static;
        opacity: 1;
        pointer-events: auto;
    }
    
    /* Column container for better spacing */
    .column-container {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        width: 100%;
    }
    
    .column {
        flex: 1;
        min-width: 300px;
    }
    </style>
    """, unsafe_allow_html=True)
    
    st.title("🧩 Analysis Frameworks")
    
    # Add both sidebar menus
    sidebar_menu()
    framework_sidebar()
    
    # Get the framework from query parameters
    query_params = st.query_params
    framework = query_params.get("framework", None)
    
    # Display framework selection if none specified
    if not framework:
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
            
            # SWOT Analysis Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=swot" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">📊</div>
                    <div class="card-content">
                        <h4>SWOT Analysis</h4>
                        <p>Analyze Strengths, Weaknesses, Opportunities, and Threats</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
            
            # DIME Framework Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=dime" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">🌐</div>
                    <div class="card-content">
                        <h4>DIME Framework</h4>
                        <p>Diplomatic, Information, Military, and Economic analysis</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
            
            # COG Analysis Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=cog" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">⚔️</div>
                    <div class="card-content">
                        <h4>COG Analysis</h4>
                        <p>Center of Gravity analysis for strategic planning</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
        
        with col2:
            st.markdown('<p class="subheader">🔄 Operational Analysis</p>', unsafe_allow_html=True)
            
            # PMESII-PT Framework Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=pmesii_pt" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">🧩</div>
                    <div class="card-content">
                        <h4>PMESII-PT Framework</h4>
                        <p>Political, Military, Economic, Social, Infrastructure, Information, Physical Environment, and Time</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
            
            # DOTMLPF Framework Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=dotmlpf" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">🛠️</div>
                    <div class="card-content">
                        <h4>DOTMLPF Framework</h4>
                        <p>Doctrine, Organization, Training, Materiel, Leadership, Personnel, and Facilities</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
            
            # ACH Analysis Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=ach" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">⚖️</div>
                    <div class="card-content">
                        <h4>ACH Analysis</h4>
                        <p>Analysis of Competing Hypotheses for intelligence assessment</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
        
        with col3:
            st.markdown('<p class="subheader">🔍 Specialized Analysis</p>', unsafe_allow_html=True)
            
            # Starbursting Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=starbursting" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">✨</div>
                    <div class="card-content">
                        <h4>Starbursting</h4>
                        <p>Question-based brainstorming technique for comprehensive analysis</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
            
            # Deception Detection Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=deception_detection" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">🕵️</div>
                    <div class="card-content">
                        <h4>Deception Detection</h4>
                        <p>Identify and analyze potential deception in information</p>
                    </div>
                </div>
            </a>
            """, unsafe_allow_html=True)
            
            # Behavioral Analysis Card - Direct link
            st.markdown("""
            <a href="/Frameworks?framework=behavior_analysis" target="_self" style="text-decoration: none;">
                <div class="framework-card">
                    <div class="card-icon">🧠</div>
                    <div class="card-content">
                        <h4>Behavioral Analysis</h4>
                        <p>Analyze patterns and motivations in human behavior</p>
                    </div>
                </div>
            </a>
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
    
    # Update the current_framework in session state based on the query parameter
    framework_to_session_map = {
        "swot": "SWOT",
        "dime": "DIME",
        "cog": "COG",
        "pmesii_pt": "PMESII",
        "dotmlpf": "DOTMLPF",
        "ach": "ACH",
        "starbursting": "STARBURSTING",
        "deception_detection": "DECEPTION",
        "behavior_analysis": "BEHAVIOR"
    }
    
    if framework in framework_to_session_map:
        st.session_state["current_framework"] = framework_to_session_map[framework]
    
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
        st.markdown("""
        <div class="dark-mode-compatible">
        <h3 style="color: #4880EC;">Please select a valid framework from the options below:</h3>
        </div>
        """, unsafe_allow_html=True)
        
        # Create a more visually appealing list of framework links
        col1, col2, col3 = st.columns(3)
        
        frameworks_list = list(framework_map.keys())
        col_size = len(frameworks_list) // 3 + (1 if len(frameworks_list) % 3 > 0 else 0)
        
        for i, col in enumerate([col1, col2, col3]):
            with col:
                start_idx = i * col_size
                end_idx = min((i + 1) * col_size, len(frameworks_list))
                for key in frameworks_list[start_idx:end_idx]:
                    emoji = "🔍"  # Default emoji
                    if key == "swot": emoji = "📊"
                    elif key == "ach": emoji = "⚖️"
                    elif key == "cog": emoji = "⚔️"
                    elif key == "deception_detection": emoji = "🕵️"
                    elif key == "dime": emoji = "🌐"
                    elif key == "pmesii_pt": emoji = "🧩"
                    elif key == "dotmlpf": emoji = "🛠️"
                    elif key == "starbursting": emoji = "✨"
                    elif key == "behavior_analysis": emoji = "🧠"
                    
                    st.markdown(f"""
                    <a href="/Frameworks?framework={key}" target="_self" style="text-decoration: none;">
                        <div class="framework-link">
                            <span class="icon">{emoji}</span>
                            <span class="text">{key.replace('_', ' ').title()}</span>
                        </div>
                    </a>
                    """, unsafe_allow_html=True)

def load_framework():
    # Get the framework parameter from URL
    params = st.query_params
    framework = params.get("framework", [None])[0]
    
    if not framework:
        st.error("No framework specified. Please select a framework from the sidebar.")
        return
    
    # Map framework parameters to their respective functions
    framework_map = {
        "swot": swot_page,
        "ach": ach_page,
        "cog": cog_analysis,
        "deception_detection": deception_detection,
        "dime": dime_page,
        "pmesii_pt": pmesii_pt_page,
        "dotmlpf": dotmlpf_page,
        "starbursting": starbursting_page,
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