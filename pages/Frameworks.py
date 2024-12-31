# /researchtools_streamlit/pages/2_🔎_Frameworks.py

import os
import streamlit as st
from dotenv import load_dotenv
from utils_openai import generate_advanced_query
from pages.COG import cog_analysis
from pages.SWOT import swot_page
load_dotenv()

def frameworks_page():
    st.title("Frameworks")

    # A dropdown to select which framework to show
    frameworks_list = [
        "COG Analysis (AI-Guided)",
        "DIME",
        "PMESII-PT",
        "DOTMLPF",
        "SWOT Analysis"
    ]

    selected_framework = st.selectbox("Select a Framework", frameworks_list)

    # Load environment vars but allow user override
    default_problemset = os.getenv("AREA_OF_FOCUS", "")
    default_constraints = os.getenv("CONSTRAINTS", "None")
    default_restraints = os.getenv("RESTRAINTS", "None")
    default_objective = os.getenv("OPERATIONAL_OBJECTIVE", "")

 
    # Depending on which framework is selected, render dynamic content.
    if selected_framework == "COG Analysis (AI-Guided)":
        st.subheader("COG Analysis (AI-Guided)")
        st.write("""
        **Center of Gravity (COG)** analysis helps identify the primary source of strength or vulnerability 
        for a friendly or adversarial force. It includes mapping critical vulnerabilities, capabilities, 
        and critical requirements. 
        """)

        # Call the cog_analysis function from cog.py
        cog_analysis()

    elif selected_framework == "DIME":
        st.subheader("DIME Framework")
        st.write("""
        **DIME** stands for **Diplomatic, Information, Military, and Economic**. 
        It’s used to analyze and plan the application of national power in pursuit of strategic ends.
        """)

        st.write("""
        **How to use**: Identify how each dimension (D/I/M/E) contributes to or hinders 
        the desired objective in your current problemset.
        """)

    elif selected_framework == "PMESII-PT":
        st.subheader("PMESII-PT Framework")
        st.write("""
        **PMESII-PT**: **Political, Military, Economic, Social, Information, 
        Infrastructure, Physical Environment, and Time**. 
        This framework helps you analyze and understand the operating environment in a systemic way.
        """)

        st.write("""
        **How to use**: For each PMESII-PT dimension, consider key actors, systems, or conditions 
        relevant to your problem statement.
        """)

    elif selected_framework == "DOTMLPF":
        st.subheader("DOTMLPF Framework")
        st.write("""
        **DOTMLPF**: **Doctrine, Organization, Training, Materiel, Leadership and Education, Personnel, 
        and Facilities**. Typically used to assess capability gaps and solutions in military contexts.
        """)

        st.write("""
        **How to use**: Evaluate each pillar (D/O/T/M/L/P/F) in the context of your problemset: 
        where do shortfalls exist, and how do we address them?
        """)

    elif selected_framework == "SWOT Analysis":
        st.subheader("SWOT Analysis")
        st.write("""
        **SWOT**: **Strengths, Weaknesses, Opportunities, and Threats**. 
        This framework helps you analyze and understand the operating environment in a systemic way.
        """)
        swot_page()

    st.markdown("---")
    st.write("""
    *All fields are editable and can be used to tailor your framework analysis. 
    For now, each field is labeled "FILL_ME_HERE" as a placeholder for real guidance tooltips.*
    """)


def main():
    frameworks_page()

if __name__ == "__main__":
    main()