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
    # Initialize session storage for AI responses to ensure they persist.
    if "dotmlpf_summary" not in st.session_state:
        st.session_state["dotmlpf_summary"] = ""
    if "tradoc_alignment" not in st.session_state:
        st.session_state["tradoc_alignment"] = ""
    if "command_endorsement" not in st.session_state:
        st.session_state["command_endorsement"] = ""

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

    # Input field for Organization
    organization_input = st.text_input("Enter Organization Details:", max_chars=240)

    # Choose the force type to analyze
    force_type = st.selectbox("Select Force Type", ["Friendly", "Adversary", "Our Own"])

    # Prompt the user for their analysis goal
    goal_input = st.text_input("Enter Goal of the Analysis:", max_chars=240)

    # Provide guiding questions for problem definition
    st.markdown("**Guiding Questions for Defining Your Problem Statement**")
    st.write("""
    1. What is the primary objective or end state you want to achieve through this analysis?
    2. How does this analysis align with broader strategic or organizational goals?
    3. Which stakeholders are most impacted, and what outcomes are they expecting?
    4. What constraints, timelines, or resources (e.g., budget, manpower) shape your current challenges?
    5. Are there any known threats, gaps, or shortfalls that precipitated this analysis?
    """)

    # If "Our Own" is selected, request a focused operational gap
    if force_type == "Our Own":
        operational_gap_input = st.text_area(
            "Describe the operational gap or capability shortfall preventing your mission requirement from being met:"
        )
    else:
        # For Friendly or Adversary, we don't prompt for an operational gap
        operational_gap_input = ""

    st.markdown("---")

    # DOTMLPF-P categories
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
                # Base prompt referencing TRADOC, JCIDS, and CBA for all force types
                base_system_prompt = (
                    "You are an experienced military capability analyst specializing in DOTMLPF-P assessments. "
                    f"Your role is to evaluate the following force type: {force_type}.\n\n"
                    "In accordance with the TRADOC Capability Development Document (CDD) guidelines, you will:\n"
                    "• Identify capability gaps using Capability-Based Assessment (CBA) methodology.\n"
                    "• Reference Key Performance Parameters (KPPs) and Key System Attributes (KSAs) for performance tracking.\n"
                    "• Consider System of Systems (SoS) dependencies and operational risks.\n"
                    "• Address Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities, and Policy.\n\n"
                    "Produce three specific, measurable, and actionable questions focused on identifying gaps, risks, "
                    "and modernization opportunities for the selected category. Questions should align with TRADOC "
                    "evaluation criteria and—where applicable—JCIDS capability development.\n"
                )

                # Add specialized guidance when force_type == "Our Own"
                if force_type == "Our Own":
                    # Incorporate references to resourcing strategies, acquisition pathways, etc.
                    base_system_prompt += (
                        "\nSince this analysis focuses on 'Our Own' forces, ensure all recommendations align with:\n"
                        "1. JCIDS Capability Development Process: consider whether new acquisition programs or modifications to existing systems are needed.\n"
                        "2. Capability Tradeoff Analysis: explore DOTMLPF-P alternatives to mitigate the gap.\n"
                        "3. Resourcing Strategies: evaluate funding or acquisition pathways (e.g., APFIT, Rapid Prototyping) to accelerate closing the gap.\n"
                        "4. Doctrine and Policy Alignment: assess whether TRADOC directives, Army Regulations, or relevant AWFCs/POM cycles should be updated.\n\n"
                        "For the following category, generate recommendations that align with capability modernization, force structure adaptation, and resource allocation. "
                        "If an operational gap is provided, connect these recommendations to that gap.\n"
                    )

                system_msg = {"role": "system", "content": base_system_prompt}

                # Build user message based on the force type
                if force_type == "Our Own":
                    user_msg_content = (
                        f"Force Type: {force_type}\n"
                        f"Goal: {goal_input}\n"
                        f"Organization: {organization_input}\n"
                        f"Operational Gap: {operational_gap_input}\n"
                        f"Category: {cat}\n"
                        f"Current Input Provided: {user_text}\n\n"
                        "Please generate three TRADOC-aligned, specific, measurable, and actionable questions "
                        "to evaluate this DOTMLPF-P category in relation to the operational gap. "
                        "In your questions or prompts, incorporate JCIDS, capability tradeoff analyses, "
                        "and potential resourcing strategies (e.g., APFIT, POM cycles, or rapid prototyping). "
                        "Highlight modernization opportunities and how policy/doctrine might need to evolve."
                    )
                else:
                    user_msg_content = (
                        f"Force Type: {force_type}\n"
                        f"Goal: {goal_input}\n"
                        f"Organization: {organization_input}\n"
                        f"Category: {cat}\n"
                        f"Current Input Provided: {user_text}\n\n"
                        "Please generate three TRADOC-aligned, specific, measurable, and actionable questions "
                        "to evaluate this DOTMLPF-P category. Address potential capability gaps, risks, "
                        "and modernization opportunities consistent with TRADOC and JCIDS guidelines."
                    )

                user_msg = {"role": "user", "content": user_msg_content}

                # Call AI
                ai_response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.text_area(
                    f"AI Suggested {cat} Analysis:",
                    value=ai_response,
                    height=120,
                    key=f"ai_resp_{cat}"
                )
            except Exception as e:
                st.error(f"Error generating AI suggestion for {cat}: {e}")

            st.markdown("---")

    # Button to generate a consolidated summary from all categories
    if st.button("Generate Consolidated DOTMLPF-P Summary"):
        try:
            summary_prompt = (
                "Based on the following DOTMLPF-P analysis, provide a concise summary with "
                "key insights and TRADOC-aligned recommendations:\n"
            )

            for cat in dotmlpf_categories:
                analysis = user_inputs.get(cat, "")
                summary_prompt += f"\n{cat}: {analysis}\n"

            # Additional instructions if force type is "Our Own"
            if force_type == "Our Own":
                summary_prompt += (
                    "\nSince these are 'Our Own' forces, focus on:\n"
                    "• JCIDS capability development (e.g., new acquisition vs. modification)\n"
                    "• Capability tradeoff analysis across DOTMLPF-P\n"
                    "• Relevant resourcing strategies (APFIT, Rapid Prototyping, POM cycles)\n"
                    "• Potential doctrine/policy updates (Army Regulations, TRADOC directives, AWFC tie-ins)\n"
                    "Connect each recommendation to the identified operational gap and highlight modernization or resource allocation paths.\n"
                )

            system_msg = {
                "role": "system",
                "content": (
                    f"You are an expert military strategist focused on {goal_input}. Summarize the DOTMLPF-P "
                    "analysis below in alignment with TRADOC guidelines, JCIDS capability metrics, and any "
                    "operational gap (if provided). Where relevant, incorporate references to acquisition pathways, "
                    "capability tradeoff analyses, and policy/doctrine alignment."
                )
            }

            if force_type == "Our Own":
                user_msg_content = (
                    f"Operational Gap: {operational_gap_input}\n\n"
                    f"{summary_prompt}"
                )
            else:
                user_msg_content = summary_prompt

            user_msg = {"role": "user", "content": user_msg_content}

            summary_response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")

            # Store the summary in session state
            st.session_state["dotmlpf_summary"] = summary_response

            st.subheader("Consolidated DOTMLPF-P Summary")
            st.write(summary_response)

            # ──────────────────────────────────────────────────────────────────
            #  New Section: Command Endorsement Strategy (only for "Our Own")
            # ──────────────────────────────────────────────────────────────────
            st.subheader("Command Endorsement Strategy")
            if force_type == "Our Own":
                # Build a command endorsement prompt incorporating the final summary as context
                endorsement_prompt = (
                    "You are a senior-level advisor with the authority to recommend endorsements at multiple echelons.\n\n"
                    "Given the following DOTMLPF-P summary (including any operational gap and recommendations):\n\n"
                    f"{summary_response}\n\n"
                    "Provide specific command endorsement strategies for:\n"
                    "1. **Operational Level** (e.g., Force providers, TRADOC Centers of Excellence)\n"
                    "2. **Strategic Level** (e.g., Army Futures Command, ASA(ALT), Joint Staff)\n"
                    "3. **Policy Level** (e.g., DoD Directives, Congressional funding requests)\n\n"
                    "For each level, identify the relevant command authorities and detail what kind of endorsement is needed, "
                    "such as:\n"
                    "- A **doctrinal update** (e.g., changes to TRADOC directives, Army Regulations)\n"
                    "- A **resource allocation** (e.g., applying for APFIT, rapid prototyping funds, or POM adjustments)\n"
                    "- A **force structure change** (e.g., reorganizing units or re-aligning personnel)\n"
                    "- A **new acquisition program** (e.g., starting or modifying a Program of Record)\n\n"
                    "Tie each recommendation to the capability shortfalls, modernization goals, or doctrinal needs identified "
                    "in the summary. Where applicable, reference Army Warfighting Challenges (AWFCs) or Program Objective "
                    "Memorandum (POM) cycles to illustrate how these endorsements fit into broader Joint Force and TRADOC planning."
                )

                command_response = chat_gpt(
                    [{"role": "system", "content": endorsement_prompt}],
                    model="gpt-4o-mini"
                )

                st.session_state["command_endorsement"] = command_response
                st.write(command_response)

        except Exception as e:
            st.error(f"Error generating summary or endorsement strategy: {e}")

    # Button to generate TRADOC alignment details for all force types
    st.markdown("---")
    st.subheader("TRADOC Alignment")
    st.write("Click below to generate TRADOC alignment considerations—covering JCIDS, KPPs/KSAs, and resourcing strategies.")
    if st.button("Generate TRADOC Alignment"):
        try:
            # Build a prompt referencing the existing summary (if any)
            alignment_prompt = (
                "You are an expert in TRADOC capability development and Joint Capabilities Integration Development System (JCIDS). "
                "Given the following DOTMLPF-P Summary:\n\n"
                f"{st.session_state['dotmlpf_summary']}\n\n"
                "Identify specific ways to align recommendations with:\n"
                "- JCIDS requirements or acquisition milestones\n"
                "- Key Performance Parameters (KPPs) and Key System Attributes (KSAs)\n"
                "- Resourcing options (POM, APFIT, Rapid Prototyping)\n\n"
                "Structure the output as bullet points or short paragraphs so it can be easily referenced by senior leaders."
            )

            alignment_msg = {
                "role": "system",
                "content": alignment_prompt
            }
            alignment_response = chat_gpt([alignment_msg], model="gpt-4o-mini")
            st.session_state["tradoc_alignment"] = alignment_response

            st.write(alignment_response)

        except Exception as e:
            st.error(f"Error generating TRADOC alignment: {e}")

    # Option to export the analysis as JSON
    if st.button("Export DOTMLPF-P Analysis as JSON"):
        # If "Our Own", capture operational_gap_input; otherwise, it's blank
        analysis_data = {
            "force_type": force_type,
            "goal": goal_input,
            "organization": organization_input,
            "operational_gap": operational_gap_input if force_type == "Our Own" else "",
            "DOTMLPF-P": {cat: user_inputs.get(cat, "") for cat in dotmlpf_categories},
            "TRADOC_Alignment": st.session_state["tradoc_alignment"],
            "Command_Endorsement": st.session_state["command_endorsement"] if force_type == "Our Own" else "",
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