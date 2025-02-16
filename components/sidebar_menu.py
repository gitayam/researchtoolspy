import streamlit as st

def sidebar_menu():
    # Framework Quick Links with fallback direct links
    st.sidebar.markdown("## Analysis Frameworks")
    st.sidebar.markdown("""
    - [SWOT Analysis](/Frameworks?framework=swot)
    - [ACH Analysis](/Frameworks?framework=ach)
    - [Starbursting](/Frameworks?framework=starbursting)
    - [Deception Detection](/Frameworks?framework=deception)
    - [COG Analysis](/Frameworks?framework=cog)
    - [DIME Framework](/Frameworks?framework=dime)
    - [PMESII-PT Framework](/Frameworks?framework=pmesii)
    - [DOTMLPF Framework](/Frameworks?framework=dotmlpf)
    - [Behavioral Analysis](/Frameworks?framework=behavior_analysis)
    Having trouble with the links? [View all frameworks](/Frameworks)
    """)
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

    st.sidebar.subheader("Process and Analyze")
    st.sidebar.markdown("""
    - [Forms for Processing](https://Irregularpedia.org/index.php/forms)
    - [R Studio Guide](https://Irregularpedia.org/index.php/rstudio)
    """) 