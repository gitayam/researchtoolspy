# /researchtools_streamlit/app.py
import streamlit as st
from components.sidebar_menu import sidebar_menu
# Remove direct imports of framework modules
# We'll use dynamic imports instead when needed

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
            {"name": "SWOT Analysis", "key": "swot", "desc": "Strategic planning and evaluation"},
            {"name": "ACH Analysis", "key": "ach", "desc": "Systematic hypothesis testing"},
            {"name": "COG Analysis", "key": "cog", "desc": "Center of Gravity analysis"},
            {"name": "Deception Detection", "key": "deception_detection", "desc": "Identify potential deception"},
            {"name": "DIME Framework", "key": "dime", "desc": "National power analysis"},
            {"name": "PMESII-PT", "key": "pmesii_pt", "desc": "Operational environment analysis"},
            {"name": "DOTMLPF", "key": "dotmlpf", "desc": "Capability gap analysis"},
            {"name": "Starbursting", "key": "starbursting", "desc": "Question-based exploration"},
            {"name": "Behavioral Analysis", "key": "behavior_analysis", "desc": "Human behavior patterns"},
            {"name": "CauseWay", "key": "causeway", "desc": "LOREM IPSUM"}
        ]
        
        for framework in frameworks:
            with st.container():
                col_a, col_b = st.columns([3, 1])
                with col_a:
                    st.markdown(f"### {framework['name']}")
                    st.write(framework['desc'])
                with col_b:
                    if st.button("Open", key=f"btn_{framework['key']}"):
                        # Set the selected framework in session state
                        st.session_state["selected_framework"] = framework['key']
                        st.switch_page("pages/Frameworks.py")
                st.markdown("---")

    with col2:
        st.subheader("🔄 Transformers")
        
        # Create clickable cards for each tool
        tools = [
            {"name": "CSV/JSON Converter", "key": "converter", "desc": "Convert between data formats"},
            {"name": "Advanced Query Generator", "key": "query_generator", "desc": "AI-powered search queries"},
            {"name": "Image Hash Generator", "key": "image_hash", "desc": "Generate image hashes for searches"},
            {"name": "URL Processor", "key": "url_processor", "desc": "Process and archive URLs"}
        ]
        
        for tool in tools:
            with st.container():
                col_a, col_b = st.columns([3, 1])
                with col_a:
                    st.markdown(f"### {tool['name']}")
                    st.write(tool['desc'])
                with col_b:
                    if st.button("Open", key=f"btn_{tool['key']}"):
                        st.switch_page("pages/Transformers.py")
                        st.query_params["tool"] = tool['key']
                st.markdown("---")

    # Research Tools Section
    st.header("🔍 Research Tools")
    col3, col4 = st.columns(2)
    
    with col3:
        st.subheader("📚 Documentation")
        
        docs = [
            {"name": "Research Planning Guide", "url": "https://irregularpedia.org/index.php/research-planning"},
            {"name": "Structured Analytic Techniques", "url": "https://irregularpedia.org/index.php/Structured_Analytic_Techniques_(SATs)"},
            {"name": "PMESII-PT Framework", "url": "https://irregularpedia.org/index.php/PMESII-PT"},
            {"name": "Center of Gravity Analysis", "url": "https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide"},
            {"name": "Research Templates", "url": "https://irregularpedia.org/index.php/Research_Template"}
        ]
        
        for doc in docs:
            st.markdown(f"- [{doc['name']}]({doc['url']})")

    with col4:
        st.subheader("📥 Data Collection")
        
        data_tools = [
            {"name": "Wayback Machine Tool", "desc": "Archive and access historical web pages", "page": "Transformers", "param": "url_processor"},
            {"name": "Social Media Downloader", "desc": "Download social media content", "page": "Transformers", "param": "social_media_download"},
            {"name": "Research Datasets", "url": "https://irregularpedia.org/index.php/research-datasets"}
        ]
        
        for tool in data_tools:
            if "url" in tool:
                st.markdown(f"- [{tool['name']}]({tool['url']})")
            else:
                if st.button(tool['name'], key=f"btn_data_{tool['param']}"):
                    st.switch_page(f"pages/{tool['page']}.py")
                    st.query_params["tool"] = tool['param']
                st.markdown(f"  {tool['desc']}")

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

