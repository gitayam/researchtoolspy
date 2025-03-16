import streamlit as st

def sidebar_menu():
    # Framework Quick Links with direct links
    st.sidebar.markdown("## Analysis Frameworks")
    
    # Use target="_self" to ensure links open in the same tab
    st.sidebar.markdown("""
    - <a href="/Frameworks?framework=swot" target="_self">SWOT Analysis</a>
    - <a href="/Frameworks?framework=ach" target="_self">ACH Analysis</a>
    - <a href="/Frameworks?framework=starbursting" target="_self">Starbursting</a>
    - <a href="/Frameworks?framework=deception_detection" target="_self">Deception Detection</a>
    - <a href="/Frameworks?framework=cog" target="_self">COG Analysis</a>
    - <a href="/Frameworks?framework=dime" target="_self">DIME Framework</a>
    - <a href="/Frameworks?framework=pmesii_pt" target="_self">PMESII-PT Framework</a>
    - <a href="/Frameworks?framework=dotmlpf" target="_self">DOTMLPF Framework</a>
    - <a href="/Frameworks?framework=behavior_analysis" target="_self">Behavioral Analysis</a>
    """, unsafe_allow_html=True)
    
    # Tools section
    st.sidebar.markdown("## Tools")
    st.sidebar.markdown("""
    - <a href="/Transformers?tool=converter" target="_self">CSV/JSON Converter</a>
    - <a href="/Transformers?tool=query_generator" target="_self">Advanced Query Generator</a>
    - <a href="/Transformers?tool=image_hash" target="_self">Image Hash Generator</a>
    - <a href="/Transformers?tool=url_processor" target="_self">URL Processor</a>
    """, unsafe_allow_html=True)
    
    # Wiki Links
    st.sidebar.markdown("## [**Research Wiki Pages**](https://irregularpedia.org/index.php/Category:Research)")
    
    st.sidebar.subheader("Plan and Prepare")
    st.sidebar.markdown("""
    - [Research Planning Guide](https://Irregularpedia.org/index.php/research-planning)
    - [Structured Analytic Techniques (SATs)](https://Irregularpedia.org/index.php/structured-analytic-techniques)
    - [PMESII-PT](https://Irregularpedia.org/index.php/pmesii-pt)
    - [Center of Gravity (COG) Analysis](https://Irregularpedia.org/index.php/cog)
    - [Research Templates](https://Irregularpedia.org/index.php/research-template)
    """)

    st.sidebar.subheader("Gather")
    st.sidebar.markdown("""
    - [Research Datasets](https://Irregularpedia.org/index.php/research-datasets)
    - [Darkweb Links](https://Irregularpedia.org/index.php/darkweb-links)
    - [Research Tools](https://Irregularpedia.org/index.php/research-platforms)
    - [Leaks and Compilations](https://Irregularpedia.org/index.php/leaks)
    - [Citation](https://Irregularpedia.org/index.php/research-citation)
    - [AI-Prompting for Advanced Queries](https://Irregularpedia.org/index.php/ai-prompting)
    """) 