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
    st.title("DOTMLPF Analysis Framework")
    st.write("""
    The DOTMLPF Analysis Framework helps you assess organization capabilities across several key areas:
    
    - **Doctrine**: The principles and strategies guiding operations.
    - **Organization**: The structure and distribution of forces.
    - **Training**: The preparedness and skills of personnel.
    - **Materiel**: The equipment, technology, and resources available.
    - **Leadership**: The quality and effectiveness of command.
    - **Personnel**: The manpower, expertise, and morale.
    - **Facilities**: The infrastructure and support systems.
    
    You can use this framework to analyze friendly forces, adversary forces, or our own.
    """)

    # New input field for Organization
    organization_input = st.text_input("Enter Organization Details:", max_chars=240)

    # Choose the force type to analyze
    force_type = st.selectbox("Select Force Type", ["Friendly", "Adversary", "Our Own"])

    goal_input = st.text_input("Enter Goal of the Analysis:", max_chars=240)
    st.markdown("---")

    # Define the DOTMLPF categories
    dotmlpf_categories = [
        "Doctrine", "Organization", "Training",
        "Materiel", "Leadership", "Personnel", "Facilities"
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
                system_msg = {
                    "role": "system",
                    "content": (
                        f"You are an experienced intelligence analyst specializing in DOTMLPF assessments of organizations with a goal of {goal_input}  {organization_input} . "
                        f"Provide a concise analysis for the following category relative to the force type of {organization_input}."
                    )
                }
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Force Type: {force_type}\n"
                        f"Category: {cat}\n"
                        f"Current Input: {user_text}\n"
                        "Provide 3 key points or recommendations for assessing or improving this area."
                    )
                }
                ai_response = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
                st.text_area(f"AI Suggested {cat} Analysis:", value=ai_response, height=100, key=f"ai_resp_{cat}")
            except Exception as e:
                st.error(f"Error generating AI suggestion for {cat}: {e}")
        st.markdown("---")

    # Button to generate a consolidated summary from all categories
    if st.button("Generate Consolidated DOTMLPF Summary"):
        try:
            summary_prompt = f"Based on the following DOTMLPF analysis for {force_type} forces, provide a concise summary with key insights and recommendations:\n"
            for cat in dotmlpf_categories:
                analysis = user_inputs.get(cat, "")
                summary_prompt += f"\n{cat}: {analysis}\n"
            system_msg = {
                "role": "system",
                "content": f"You are an expert military strategist focused on {goal_input}. Summarize the following DOTMLPF analysis."
            }
            user_msg = {"role": "user", "content": summary_prompt}
            summary_response = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            st.subheader("Consolidated DOTMLPF Summary")
            st.write(summary_response)
        except Exception as e:
            st.error(f"Error generating summary: {e}")

    # Option to export the analysis as JSON
    if st.button("Export DOTMLPF Analysis as JSON"):
        analysis_data = {
            "force_type": force_type,
            "goal": goal_input,
            "organization": organization_input,
            "DOTMLPF": {cat: user_inputs.get(cat, "") for cat in dotmlpf_categories}
        }
        json_data = json.dumps(analysis_data, indent=2)
        st.download_button(
            label="Download JSON",
            data=json_data,
            file_name="DOTMLPF_Analysis.json",
            mime="application/json"
        )

def main():
    dotmlpf_page()

if __name__ == "__main__":
    main()