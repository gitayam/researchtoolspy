# /researchtools_streamlit/app.py
import streamlit as st
from pages.sidebar_menu import sidebar_menu
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
    st.set_page_config(
        page_title="Irregular Research Tools - Enhance Your Research", 
        page_icon=":mag:",  # Use a more recognizable icon for social media
        layout="wide"f
    )

    # Add the full sidebar menu
    sidebar_menu()

    # Main content area - Home page
    st.title("Irregular Research Tools")
    st.image("media/research_logo.png", width=200)

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
        st.markdown("""
        Access powerful analytical frameworks to structure your research:
        
        - **[SWOT Analysis](/Frameworks?framework=swot)**: Strategic planning and evaluation
        - **[ACH Analysis](/Frameworks?framework=ach)**: Systematic hypothesis testing
        - **[COG Analysis](/Frameworks?framework=cog)**: Center of Gravity analysis
        - **[Deception Detection](/Frameworks?framework=deception)**: Identify potential deception
        - **[DIME Framework](/Frameworks?framework=dime)**: National power analysis
        - **[PMESII-PT](/Frameworks?framework=pmesii_pt)**: Operational environment analysis
        - **[DOTMLPF](/Frameworks?framework=dotmlpf)**: Capability gap analysis
        """)

    with col2:
        st.subheader("🔄 Transformers")
        st.markdown("""
        Transform and process your data efficiently:
        
        - **[CSV/JSON Converter](/Transformers)**: Convert between data formats
        - **[Advanced Query Generator](/Transformers)**: AI-powered search queries
        - **[Image Hash Generator](/Transformers)**: Generate image hashes for searches
        - **[URL Processor](/Transformers)**: Process and archive URLs
        """)

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
        st.subheader("�� Data Collection")
        st.markdown("""
        - **[Wayback Machine Tool](/WaybackTool)**: Archive and access historical web pages
        - **[Social Media Downloader](/Transformers)**: Download social media content
        - **[Research Datasets](https://irregularpedia.org/index.php/research-datasets)**
        """)

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

