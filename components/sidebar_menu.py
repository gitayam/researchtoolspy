import streamlit as st

def sidebar_menu():
    # Framework Quick Links
    st.sidebar.markdown("## Analysis Frameworks")
    st.sidebar.markdown("""
    - [SWOT Analysis](/SWOT_Analysis)
    - [ACH Analysis](/ACH_Analysis)
    - [COG Analysis](/COG_Analysis)
    - [Deception Detection](/Deception_Detection)
    - [DIME Framework](/DIME_Framework)
    - [PMESII-PT Framework](/PMESII_PT_Framework)
    - [DOTMLPF Framework](/DOTMLPF_Framework)
    - [Starbursting](/Starbursting)
    """)

    # Check if the user is logged in
    if "logged_in" in st.session_state and st.session_state["logged_in"]:
        st.sidebar.markdown("## Saved Frameworks")
        # Display user-specific saved frameworks
        account_number = st.session_state.get("account_number", "Unknown")
        st.sidebar.markdown(f"Welcome, User {account_number}")
        st.sidebar.markdown("""
        - [Saved SWOT Analysis](/Saved_SWOT_Analysis)
        - [Saved ACH Analysis](/Saved_ACH_Analysis)
        - [Saved COG Analysis](/Saved_COG_Analysis)
        - [Saved Deception Detection](/Saved_Deception_Detection)
        - [Saved DIME Framework](/Saved_DIME_Framework)
        - [Saved PMESII-PT Framework](/Saved_PMESII_PT_Framework)
        - [Saved DOTMLPF Framework](/Saved_DOTMLPF_Framework)
        - [Saved Starbursting](/Saved_Starbursting)
        """)
    else:
        st.sidebar.markdown("## User Login")
        st.sidebar.markdown("""
        - [Login](/Login)
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
