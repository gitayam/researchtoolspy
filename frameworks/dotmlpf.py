# /frameworks/DOTMLPF.py
"""
DOTMLPF Analysis Framework
"""
import streamlit as st
from utilities.gpt import chat_gpt
from dotenv import load_dotenv
import json

load_dotenv()

def dotmlpf_page():
    st.title("DOTMLPF-P Analysis Framework")
    st.write("""
    The DOTMLPF-P Analysis Framework helps you assess organization capabilities across several key areas:
    
    - **Doctrine**: The principles and strategies guiding operations.
    - **Organization**: The structure and distribution of forces.
    - **Training**: The preparedness and skills of personnel.
    - **Materiel**: The equipment, technology, and resources available.
    - **Leadership**: The quality and effectiveness of command.
    - **Personnel**: The manpower, expertise, and morale.
    - **Facilities**: The infrastructure and support systems.
    - **Policy**: The policies and frameworks governing procedures and resource allocation.
    
    You can use this framework to analyze friendly forces, adversary forces, or our own.
    """)

    # New input field for Organization
    organization_input = st.text_input("Enter Organization Details:", max_chars=240)

    # Choose the force type to analyze
    force_type = st.selectbox("Select Force Type", ["Friendly", "Adversary", "Our Own"])

    goal_input = st.text_input("Enter Goal of the Analysis:", max_chars=240)
    st.markdown("---")

    # Always use DOTMLPF-P categories
    dotmlpf_categories = [
        "Doctrine", "Organization", "Training",
        "Materiel", "Leadership", "Personnel",
        "Facilities", "Policy"
    ]

    # Dictionary to hold user inputs for each category
    user_inputs = {}

    # Loop through each category: display a text area and an AI suggestion button
    for cat in dotmlpf_categories:
        st.subheader(cat)
        # Allow the user to enter their current analysis/observations
        user_text = st.text_area(f"Enter your analysis/observations for {cat}:", key=cat)
        user_inputs[cat] = user_text

        # AI suggestion button for the category
        if st.button(f"AI: Suggest {cat} Analysis", key=f"ai_{cat}"):
            try:
                # Build a system prompt including TRADOC references
                base_system_prompt = (
                    "You are an experienced military capability analyst specializing in DOTMLPF-P assessments, "
                    "with a focus on evaluating Doctrine, Organization, Training, Materiel, Leadership, Personnel, "
                    "Facilities, and Policy. Your objective is to assess organizational capabilities and gaps based on "
                    "the TRADOC Capability Development Document (CDD) guidelines.\n\n"
                    "Your responses should be grounded in TRADOC principles, including:\n"
                    "• Capability gaps as defined in the Capability Development Document (CDD)\n"
                    "• Threat assessments following TRADOC threat validation procedures\n"
                    "• Joint Capabilities Integration and Development System (JCIDS) guidelines\n"
                    "• Key Performance Parameters (KPPs), Key System Attributes (KSAs), and Additional Performance Attributes (APAs)\n"
                    "• System of Systems (SoS) and Family of Systems (FoS) considerations\n\n"
                    "Your role is to identify deficiencies, gaps, and risks using TRADOC-defined evaluation criteria "
                    "and provide structured, actionable recommendations for capability enhancement."
                )

                # If "Our Own" is selected, incorporate additional instructions
                if force_type == "Our Own":
                    # Append extra guidance for 'Our Own' scenario, focusing on capability dev + modernization
                    base_system_prompt += (
                        "\n\nSince you are assessing 'Our Own' forces, please provide enhanced recommendations "
                        "focused on capability development, force modernization, and future operational requirements "
                        "using TRADOC capability trade and resourcing strategies.\n"
                    )

                system_msg = {
                    "role": "system",
                    "content": base_system_prompt
                }

                # Build user message
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Force Type: {force_type}\n"
                        f"Goal: {goal_input}\n"
                        f"Organization: {organization_input}\n"
                        f"Category: {cat}\n"
                        f"Current Input Provided: {user_text}\n\n"
                        "Generate 3 specific, measurable, and actionable questions guided by TRADOC "
                        "to further evaluate this aspect of the organization's capabilities. "
                        "Identify potential gaps and risks, and align the questions "
                        "with JCIDS, capability development documents, and TRADOC evaluation criteria."
                    )
                }

                ai_response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.text_area(
                    f"AI Suggested {cat} Analysis:",
                    value=ai_response,
                    height=100,
                    key=f"ai_resp_{cat}"
                )
            except Exception as e:
                st.error(f"Error generating AI suggestion for {cat}: {e}")

            st.markdown("---")

    # Button to generate a consolidated summary from all categories
    if st.button("Generate Consolidated DOTMLPF-P Summary"):
        try:
            summary_prompt = (
                "Based on the following DOTMLPF-P analysis, provide a concise summary with key insights "
                "and TRADOC-aligned recommendations:\n"
            )
            for cat in dotmlpf_categories:
                analysis = user_inputs.get(cat, "")
                summary_prompt += f"\n{cat}: {analysis}\n"

            # If "Our Own" is selected, add nuance to the instructions
            if force_type == "Our Own":
                summary_prompt += (
                    "\nNote: Since you are assessing our own forces, focus on capability development, "
                    "force modernization, and future operational requirements under TRADOC capability trade "
                    "and resourcing strategies.\n"
                )

            system_msg = {
                "role": "system",
                "content": (
                    f"You are an expert military strategist focused on {goal_input}. "
                    "Summarize the following DOTMLPF-P analysis in alignment with TRADOC guidelines "
                    "and JCIDS capability development metrics."
                )
            }
            user_msg = {"role": "user", "content": summary_prompt}
            summary_response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            st.subheader("Consolidated DOTMLPF-P Summary")
            st.write(summary_response)
        except Exception as e:
            st.error(f"Error generating summary: {e}")

    # Option to export the analysis as JSON
    if st.button("Export DOTMLPF-P Analysis as JSON"):
        analysis_data = {
            "force_type": force_type,
            "goal": goal_input,
            "organization": organization_input,
            "DOTMLPF-P": {cat: user_inputs.get(cat, "") for cat in dotmlpf_categories}
        }
        json_data = json.dumps(analysis_data, indent=2)
        st.download_button(
            label="Download JSON",
            data=json_data,
            file_name="DOTMLPF-P_Analysis.json",
            mime="application/json"
        )

def main():
    dotmlpf_page()

if __name__ == "__main__":
    main()