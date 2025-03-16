import streamlit as st

def sidebar_menu():
    # Framework section - simplified with just the heading
    st.sidebar.markdown("""
    ## 🧭 Analysis Frameworks
    """, unsafe_allow_html=True)
    
    # Note: We're removing the non-working "📋 Frameworks Home" link
    # The framework_sidebar() function in pages/Frameworks.py already provides
    # a working "Return to Frameworks Home" button
    
    # Tools section
    st.sidebar.markdown("""
    ## 🛠️ Tools
    - <a href="/Transformers?tool=converter" target="_self">CSV/JSON Converter</a>
    - <a href="/Transformers?tool=query_generator" target="_self">Advanced Query Generator</a>
    - <a href="/Transformers?tool=image_hash" target="_self">Image Hash Generator</a>
    - <a href="/Transformers?tool=url_processor" target="_self">URL Processor</a>
    - <a href="/Transformers?tool=social_media_download" target="_self">Social Media Downloader</a>
    """, unsafe_allow_html=True)
    
    # Research Wiki section
    st.sidebar.markdown("""
    ## 📚 Research Resources
    """)
    
    # Plan and Prepare section
    st.sidebar.markdown("""
    ### 📋 Plan and Prepare
    - [Research Planning Guide](https://Irregularpedia.org/index.php/research-planning)
    - [Structured Analytic Techniques](https://irregularpedia.org/index.php/Structured_Analytic_Techniques_(SATs))
    - [PMESII-PT Framework](https://irregularpedia.org/index.php/PMESII-PT)
    - [Center of Gravity Analysis](https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide)
    - [Research Templates](https://irregularpedia.org/index.php/Research_Template)
    """)

    # Gather section
    st.sidebar.markdown("""
    ### 🔍 Gather
    - [Research Datasets](https://Irregularpedia.org/index.php/research-datasets)
    - [Darkweb Links](https://Irregularpedia.org/index.php/darkweb-links)
    - [Research Tools](https://Irregularpedia.org/index.php/research-platforms)
    - [Leaks and Compilations](https://Irregularpedia.org/index.php/leaks)
    - [Citation Guidelines](https://Irregularpedia.org/index.php/research-citation)
    - [AI-Prompting for Queries](https://Irregularpedia.org/index.php/ai-prompting)
    """) 