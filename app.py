# /researchtools_streamlit/app.py
import streamlit as st
from components.sidebar_menu import sidebar_menu
from frameworks.cog import cog_analysis
from frameworks.swot import swot_page
from frameworks.ach import ach_page
from frameworks.deception_detection import deception_detection
from frameworks.dime import dime_page
from frameworks.pmesii_pt import pmesii_pt_page
from frameworks.dotmlpf import dotmlpf_page

# This file is the main entry. Using Streamlit multi-page mode, you typically
# create multiple files in a "pages/" subfolder. Streamlit will auto-detect them
# and show them in the sidebar.

def main():
    """
    Sets up and renders the homepage for the Irregular Research Tools platform.
    
    This includes configuring the Streamlit page, displaying the sidebar menu,
    and rendering various sections of the homepage.
    """
    st.set_page_config(
        page_title="Irregular Research Tools - Enhance Your Research", 
        page_icon=":mag:",  # Use a more recognizable icon for social media
        layout="wide"
    )

    # Add the full sidebar menu
    sidebar_menu()

    # Main content area - Home page
    st.title("Irregular Research Tools")
    st.image("media/research_logo.png", width=200, caption="Research Logo")

    # Introduction
    st.markdown("""
    Welcome to the **Irregular Research Tools** platform! This comprehensive suite of tools is designed 
    to enhance your research capabilities and streamline your analysis workflow.
    """)

    # Main Features Section
    st.header("🛠️ Our Tools")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📊 Analysis Frameworks")
        
        # Create clickable cards for each framework
        frameworks = [
            {"name": "SWOT Analysis", "url": "/Frameworks?framework=swot", "desc": "Strategic planning and evaluation"},
            {"name": "ACH Analysis", "url": "/Frameworks?framework=ach", "desc": "Systematic hypothesis testing"},
            {"name": "COG Analysis", "url": "/Frameworks?framework=cog", "desc": "Center of Gravity analysis"},
            {"name": "Deception Detection", "url": "/Frameworks?framework=deception_detection", "desc": "Identify potential deception"},
            {"name": "DIME Framework", "url": "/Frameworks?framework=dime", "desc": "National power analysis"},
            {"name": "PMESII-PT", "url": "/Frameworks?framework=pmesii_pt", "desc": "Operational environment analysis"},
            {"name": "DOTMLPF", "url": "/Frameworks?framework=dotmlpf", "desc": "Capability gap analysis"},
            {"name": "Starbursting", "url": "/Frameworks?framework=starbursting", "desc": "Question-based exploration"},
            {"name": "Behavioral Analysis", "url": "/Frameworks?framework=behavior_analysis", "desc": "Human behavior patterns"}
        ]
        
        for framework in frameworks:
            with st.container():
                st.markdown(f"""
                <div style="border:1px solid #ddd; padding:10px; border-radius:5px; margin-bottom:10px;">
                    <h4><a href="{framework['url']}" target="_self">{framework['name']}</a></h4>
                    <p>{framework['desc']}</p>
                </div>
                """, unsafe_allow_html=True)

    with col2:
        st.subheader("🔄 Transformers")
        
        # Create clickable cards for each tool
        tools = [
            {"name": "CSV/JSON Converter", "url": "/Transformers?tool=converter", "desc": "Convert between data formats"},
            {"name": "Advanced Query Generator", "url": "/Transformers?tool=query_generator", "desc": "AI-powered search queries"},
            {"name": "Image Hash Generator", "url": "/Transformers?tool=image_hash", "desc": "Generate image hashes for searches"},
            {"name": "URL Processor", "url": "/Transformers?tool=url_processor", "desc": "Process and archive URLs"}
        ]
        
        for tool in tools:
            with st.container():
                st.markdown(f"""
                <div style="border:1px solid #ddd; padding:10px; border-radius:5px; margin-bottom:10px;">
                    <h4><a href="{tool['url']}" target="_self">{tool['name']}</a></h4>
                    <p>{tool['desc']}</p>
                </div>
                """, unsafe_allow_html=True)

    # Research Tools Section
    st.header("🔍 Research Tools")
    col3, col4 = st.columns(2)
    
    with col3:
        st.subheader("📚 Documentation")
        st.markdown("""
        - **[Research Planning Guide](https://irregularpedia.org/index.php/research-planning)**
        - **[Structured Analytic Techniques](https://irregularpedia.org/index.php/structured-analytic-techniques)**
        - **[Research Templates](https://irregularpedia.org/index.php/research-template)**
        """)

    with col4:
        st.subheader("📥 Data Collection")
        st.markdown("""
        - **<a href="/Transformers?tool=url_processor" target="_self">Wayback Machine Tool</a>**: Archive and access historical web pages
        - **<a href="/Transformers?tool=social_media_download" target="_self">Social Media Downloader</a>**: Download social media content
        - **<a href="https://irregularpedia.org/index.php/research-datasets" target="_self">Research Datasets</a>**
        """, unsafe_allow_html=True)

    # Getting Started Section
    st.header("🚀 Getting Started")
    st.markdown("""
    1. **Choose Your Tool**: Select from the sidebar menu or click the links above
    2. **Access Documentation**: Visit our [Research Wiki](https://irregularpedia.org) for detailed guides
    3. **Start Analyzing**: Use our frameworks to structure your analysis
    4. **Transform Data**: Convert and process your data as needed
    5. **Save & Export**: Export your analysis in various formats
    """)

    # Latest Updates Section
    with st.expander("📢 Latest Updates"):
        st.markdown("""
        - Added new DOTMLPF framework implementation
        - Added new Starbursting framework implementation
        - Added new PMESII-PT framework implementation
        - Enhanced CSV/JSON converter capabilities
        - Improved Wayback Machine integration
        - Added export functionality to all frameworks
        """)

    # Footer
    st.markdown(
        """
        <hr>
        <div style='text-align: center;'>
            <a href="https://github.com/gitayam/researchtoolspy.git" target="_blank">
                <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" width="30">
                GitHub Repository
            </a>
            <p style='font-size: small; color: gray;'>Version 1.0.0</p>
        </div>
        """,
        unsafe_allow_html=True
    )

if __name__ == "__main__":
    main()

