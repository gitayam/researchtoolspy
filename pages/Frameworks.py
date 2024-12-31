# /researchtools_streamlit/pages/2_🔎_Frameworks.py

import streamlit as st
from utils_openai import generate_advanced_query

def frameworks_page():
    st.header("Frameworks")

    st.subheader("COG Analysis (AI-Guided)")
    cog_input = st.text_area("Describe your scenario, conflict, or strategic objective here...")
    if st.button("Generate COG Analysis"):
        try:
            result = generate_advanced_query(cog_input, "COG Analysis AI", "gpt-3.5-turbo")
            st.success("AI Analysis Output:")
            st.write(result)
        except Exception as e:
            st.error(f"Error generating COG Analysis: {e}")

    st.markdown("## COG Analysis")
    st.write("COG (Center of Gravity) analysis is ...")

    st.markdown("## Structured Analytic Techniques")
    st.write("Structured analytic techniques are systematic...")

    st.markdown("## DIME")
    st.write("DIME stands for Diplomatic, Information, Military, and Economic...")

    st.markdown("## PMESII-PT")
    st.write("PMESII-PT is a framework for analyzing the operational environment...")

    st.markdown("## DOTMLPF")
    st.write("DOTMLPF is a framework used by the military...")

def main():
    frameworks_page()

if __name__ == "__main__":
    main()