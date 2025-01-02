# /researchtools_streamlit/pages/COG_Analysis.py

import streamlit as st
from dotenv import load_dotenv
from utilities.utils_openai import chat_gpt, generate_cog_options
import csv
import io

load_dotenv()

def cog_analysis():
    st.title("Enhanced Center of Gravity (COG) Analysis Flow")

    st.write("""
    This flow helps you:
    1. Identify the entity type and basic details (Name, Goals, Areas of Presence).
    2. See relevant domain considerations (Diplomatic, Information, etc.) based on the entity type.
    3. Generate or manually define potential Centers of Gravity.
    4. Identify Critical Capabilities & Requirements (CC & CR).
    5. For each selected capability, identify Critical Vulnerabilities (CV).
    6. Define or AI-generate Scoring Criteria.
    7. Prioritize those vulnerabilities (Traditional or Logarithmic approach).
    8. Optionally export results to CSV, PDF, or graph format.
    """)

    # ---------------------
    # 1) Basic Info
    # ---------------------
    domain_guidance = {
        "Friendly": {
            "description": """
**Friendly COG**:  
Assess our foundational strengths across various domains providing potential risks to mitigate.
            """,
            "questions": [
                "What international alliances and diplomatic relations fortify our position?",
                "Which communication and propaganda efforts are most influential?",
                "What units, capabilities, or systems are crucial for our success?",
                "What economic policies and resources ensure our sustained operations?",
                "What are our capabilities for defending and attacking in the digital realm?",
                "How do our satellite and space-based operations enhance our strategic goals?"
            ]
        },
        "Adversary": {
            "description": """
**Adversary COG**:  
Pinpoint the adversary’s vital sources of power and potential targets:
            """,
            "questions": [
                "How do their international relationships affect their strategic capabilities?",
                "What misinformation or psychological operations do they deploy?",
                "Which military assets are essential to their operational success?",
                "Which economic dependencies are exploitable?",
                "What are their cyber vulnerabilities?",
                "Do they rely heavily on space-based assets?"
            ]
        },
        "Host Nation": {
            "description": """
**Host Nation COG**:  
Assess the host nation’s pivotal strengths and vulnerabilities:
            """,
            "questions": [
                "What is the host nation’s stance, and how does it influence the conflict?",
                "What are their capabilities in managing or disseminating information?",
                "What military aspects of the host nation could influence their role in the conflict?",
                "How do the economic conditions affect their alignment in the conflict?",
                "Assess the cyberinfrastructure and defenses of the host nation.",
                "Evaluate the host nation’s reliance and capabilities on space-based assets."
            ]
        },
        "Customer": {
            "description": """
**Customer COG**:  
Focus on purchasing and viewership criteria rather than the usual levers of power:
            """,
            "questions": [
                "Which communication channels are most influential for their decisions?",
                "What drives their buying or subscription choices?",
                "Are there brand or relationship factors that keep them engaged?",
                "Financial or budget constraints that affect their decisions?",
                "How do peer networks or social communities guide preferences?"
            ]
        }
    }

    entity_type = st.selectbox(
        "Select Entity Type for COG Analysis",
        list(domain_guidance.keys()),
        help="Which entity are you analyzing a Center of Gravity for?"
    )
    entity_name = st.text_input("Name of Entity", help="e.g., 'Competitor X', 'Host Nation Y', etc.")
    entity_goals = st.text_area("Entity Goals", help="e.g., Achieve X objective, strengthen brand, control a region...")
    entity_presence = st.text_area("Entity Areas of Presence", help="Where is this entity located/influential?")

    st.markdown("---")
    st.write("### Domain Considerations")
    st.markdown(domain_guidance[entity_type]["description"])

    # Display input fields for each question
    domain_answers = {}
    for question in domain_guidance[entity_type]["questions"]:
        answer = st.text_area(question, help="Provide your insights or data here.")
        domain_answers[question] = answer

    # ---------------------
    # 2) Generate CoGs
    # ---------------------
    st.markdown("---")
    st.subheader("Identify / Generate Possible Centers of Gravity")

    if "cog_suggestions" not in st.session_state:
        st.session_state["cog_suggestions"] = []

    desired_end_state = st.text_input(
        "Desired End State or Effect (Optional)",
        help="What outcome do you want? Helps AI generate relevant CoGs."
    )

    if st.button("Generate Possible Centers of Gravity"):
        if not entity_type or not entity_name.strip():
            st.warning("Please set the entity type and name before generating suggestions.")
        else:
            try:
                # Customize your prompt for CoG generation
                prompt = (
                    "You're an advanced operational/strategic AI. Here are the details:\n"
                    f"- Entity Type: {entity_type}\n"
                    f"- Entity Name: {entity_name}\n"
                    f"- Goals: {entity_goals}\n"
                    f"- Areas of Presence: {entity_presence}\n"
                    f"- Desired End State: {desired_end_state}\n"
                    "Propose 3-5 potential Centers of Gravity (sources of power and morale) for this entity. "
                    "Separate them with semicolons, no bullet points."
                )
                cog_text = generate_cog_options(
                    user_details="",  # if needed
                    desired_end_state=desired_end_state or "",
                    entity_type=entity_type,
                    custom_prompt=prompt,
                    model="gpt-3.5-turbo"
                )
                suggestions = [c.strip() for c in cog_text.split(";") if c.strip()]
                st.session_state["cog_suggestions"] = suggestions
                st.success("AI-Generated Possible Centers of Gravity:")
                for i, cog_s in enumerate(suggestions, 1):
                    st.write(f"{i}. {cog_s}")
            except Exception as e:
                st.error(f"Error generating CoGs: {e}")

    if st.session_state["cog_suggestions"]:
        user_selected_cog = st.selectbox(
            "Select a CoG from AI suggestions (or type your own)",
            ["(None)"] + st.session_state["cog_suggestions"]
        )
    else:
        user_selected_cog = "(None)"

    user_cog = st.text_input(
        "Or manually define the COG here",
        help="e.g. 'Key Influencer Network; Critical Infrastructure Hub; ...'"
    )
    final_cog = user_cog.strip() if user_cog.strip() else (
        user_selected_cog if user_selected_cog != "(None)" else ""
    )
    st.markdown(f"**Selected CoG**: {final_cog if final_cog else '(None)'}")

    # ---------------------
    # 3) Capabilities & Requirements
    # ---------------------
    st.markdown("---")
    st.subheader("Identify Critical Capabilities & Requirements")

    # We'll store capabilities as a list instead of a single text field
    if "capabilities" not in st.session_state:
        st.session_state["capabilities"] = []

    new_capability = st.text_input("Add a Critical Capability", help="One capability at a time.")
    if st.button("Add Capability"):
        if new_capability.strip():
            st.session_state["capabilities"].append(new_capability.strip())
            st.success(f"Added capability: {new_capability.strip()}")
        else:
            st.warning("Capability cannot be empty.")

    # AI helper to suggest capabilities
    if st.button("AI: Suggest Capabilities"):
        if not final_cog:
            st.warning("Please specify or select a CoG first.")
        else:
            try:
                system_msg = {"role": "system", "content": "You are an AI specialized in COG analysis."}
                user_msg = {
                    "role": "user",
                    "content": (
                        "List ~5 critical capabilities (actions or functions) the CoG can perform, "
                        "semicolon separated. Here are the details:\n"
                        f"Entity Type: {entity_type}\n"
                        f"Entity Name: {entity_name}\n"
                        f"Goals: {entity_goals}\n"
                        f"Areas of Presence: {entity_presence}\n"
                        f"CoG: {final_cog}\n"
                    )
                }
                response = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
                new_suggestions = [cap.strip() for cap in response.split(";") if cap.strip()]
                st.session_state["capabilities"].extend(new_suggestions)
                st.success("AI-suggested capabilities added.")
            except Exception as e:
                st.error(f"Error suggesting capabilities: {e}")

    # Show and allow removing capabilities
    if st.session_state["capabilities"]:
        st.write("Current Capabilities:")
        for i, cap in enumerate(st.session_state["capabilities"]):
            st.write(f"{i+1}. {cap}")
        if st.button("Clear All Capabilities"):
            st.session_state["capabilities"].clear()

    # Requirements stored as a simple text area or can store them similarly in a list
    if "requirements_text" not in st.session_state:
        st.session_state["requirements_text"] = ""

    requirements_label = """
Enter any known *Requirements* (resources, conditions) that the CoG must have in order 
to perform its critical capabilities. Separate them by semicolons or lines.
"""
    st.session_state["requirements_text"] = st.text_area(
        "Critical Requirements",
        help=requirements_label,
        value=st.session_state["requirements_text"],
        height=100
    )

    if st.button("AI: Suggest Requirements"):
        if not final_cog:
            st.warning("Please specify/select a CoG first.")
        else:
            try:
                system_msg = {"role": "system", "content": "You are an AI that identifies requirements for a CoG."}
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Entity Type: {entity_type}\n"
                        f"Entity Name: {entity_name}\n"
                        f"Goals: {entity_goals}\n"
                        f"Areas of Presence: {entity_presence}\n"
                        f"CoG: {final_cog}\n\n"
                        "List about 5 critical requirements (resources/conditions the CoG needs) as semicolons."
                    )
                }
                resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
                st.session_state["requirements_text"] += f"\n{resp}"
                st.success("Appended AI-suggested requirements.")
            except Exception as e:
                st.error(f"Error suggesting requirements: {e}")

    # ---------------------
    # 4) Vulnerabilities: Per Capability
    # ---------------------
    st.markdown("---")
    st.subheader("Identify Critical Vulnerabilities")

    st.write("""
Attach vulnerabilities to the specific capability they threaten. 
Use AI or manual entry. 
""")

    # We'll keep vulnerabilities in a dict keyed by capability -> list of vulnerabilities
    if "vulnerabilities_dict" not in st.session_state:
        st.session_state["vulnerabilities_dict"] = {}

    for cap in st.session_state["capabilities"]:
        if cap not in st.session_state["vulnerabilities_dict"]:
            st.session_state["vulnerabilities_dict"][cap] = []

    # Let the user pick a capability from a dropdown to add vulnerabilities
    if st.session_state["capabilities"]:
        selected_cap = st.selectbox(
            "Select a Capability to Add Vulnerabilities",
            st.session_state["capabilities"]
        )
        new_vulnerability = st.text_input(
            f"New Vulnerability for '{selected_cap}'",
            help="Example: 'Inadequate trained personnel to operate mission-critical system'"
        )
        if st.button(f"Add Vulnerability to '{selected_cap}'"):
            if new_vulnerability.strip():
                st.session_state["vulnerabilities_dict"][selected_cap].append(new_vulnerability.strip())
                st.success(f"Added vulnerability to {selected_cap}")
            else:
                st.warning("Vulnerability cannot be empty.")

        # AI: Suggest vulnerabilities for this capability + requirements context
        if st.button(f"AI: Suggest Vulnerabilities for '{selected_cap}'"):
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI that identifies critical vulnerabilities for a CoG capability."
                }
                # Combine relevant context
                user_msg_content = (
                    f"Entity Type: {entity_type}\n"
                    f"Entity Name: {entity_name}\n"
                    f"Goals: {entity_goals}\n"
                    f"Areas of Presence: {entity_presence}\n"
                    f"CoG: {final_cog}\n"
                    f"Selected Capability: {selected_cap}\n\n"
                    "Requirements potentially relevant:\n" + st.session_state["requirements_text"] + "\n\n"
                    "List 3-5 vulnerabilities for this capability. Use semicolons, no bullet points."
                )
                user_msg = {"role": "user", "content": user_msg_content}
                vuln_resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
                new_vulns = [v.strip() for v in vuln_resp.split(";") if v.strip()]
                st.session_state["vulnerabilities_dict"][selected_cap].extend(new_vulns)
                st.success(f"AI-suggested vulnerabilities added to {selected_cap}.")
            except Exception as e:
                st.error(f"Error generating vulnerabilities: {e}")

    # Display vulnerabilities by capability
    if st.session_state["capabilities"]:
        st.write("### Current Vulnerabilities by Capability")
        for cap in st.session_state["capabilities"]:
            vulns_for_cap = st.session_state["vulnerabilities_dict"].get(cap, [])
            if vulns_for_cap:
                st.markdown(f"**Capability:** {cap}")
                for idx, v_item in enumerate(vulns_for_cap, 1):
                    st.write(f"{idx}. {v_item}")
                st.markdown("---")

    # For scoring, we'll gather all vulnerabilities from all capabilities
    all_vulnerabilities_list = []
    for cap in st.session_state["capabilities"]:
        for v_item in st.session_state["vulnerabilities_dict"].get(cap, []):
            # We'll keep track of them as (capability, vulnerability)
            all_vulnerabilities_list.append((cap, v_item))

    # ---------------------
    # 5) Define Criteria & Score
    # ---------------------
    st.subheader("Define / Edit Scoring Criteria")
    st.write("""
    By default, we have "Impact", "Attainability", "Strategic Advantage Potential".
    You can add/edit them below.
    """)

    if "criteria" not in st.session_state:
        st.session_state["criteria"] = ["Impact", "Attainability", "Strategic Advantage Potential"]

    criteria_text = st.text_area(
        "Current Criteria (one per line)",
        value="\n".join(st.session_state["criteria"]),
        height=100
    )
    if st.button("Update Criteria"):
        new_list = [c.strip() for c in criteria_text.split("\n") if c.strip()]
        st.session_state["criteria"] = new_list
        st.success("Criteria updated.")

    if st.button("AI: Suggest Additional Criteria"):
        try:
            system_msg = {"role": "system", "content": "You propose new scoring criteria for vulnerability analysis."}
            user_msg = {
                "role": "user",
                "content": "Suggest 2 new scoring criteria, semicolon-delimited."
            }
            resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            new_crits = [c.strip() for c in resp.split(";") if c.strip()]
            st.session_state["criteria"].extend(new_crits)
            st.success("AI Proposed Additional Criteria:")
            for i, c in enumerate(new_crits, 1):
                st.write(f"{i}. {c}")
        except Exception as e:
            st.error(f"Error: {e}")

    st.markdown("---")
    # 6) Score Approach
    scoring_approach = st.selectbox(
        "Scoring Approach",
        ["Traditional (1-5)", "Logarithmic (1,3,5,8,12)"],
        help="Pick how you'd like to score vulnerabilities across your chosen criteria."
    )

    log_scale_options = [1, 3, 5, 8, 12]

    # We'll store scores in a dict of (capability, vulnerability, criterion) -> int
    if "vulnerability_scores" not in st.session_state:
        st.session_state["vulnerability_scores"] = {}

    st.write("### Score Each Vulnerability on Each Criterion")
    if all_vulnerabilities_list and st.session_state["criteria"]:
        with st.expander("Criteria for Assessment"):
            st.write("""
            **Impact on COG (I):** How significantly would exploiting the vulnerability affect the COG?
            - **Definition:** Evaluate how a vulnerability affects the COG’s essential functionality or stability. This includes considering both the immediate impact and the potential for escalated disruptions or impairments over time.
            - **Application:** Analysis should include a detailed examination of how the vulnerability might compromise the COG, considering scenarios of varying severity and their probable impacts on the COG's operations and objectives.

            **Attainability (A):** How feasible is exploiting the vulnerability with available resources?
            - **Definition:** Assesses the feasibility of exploiting or mitigating the vulnerability, given the available resources, capabilities, and situational constraints.
            - **Application:** This involves evaluating the logistical, technological, and temporal resources required to address the vulnerability effectively. It should consider both the available resources and those that can be realistically obtained or mobilized.

            **Strategic Advantage Potential (SAP):** Measures how addressing the vulnerability can provide strategic advantages or enable further actions that strengthen the COG or degrade an adversary's position.
            - **Definition:** Focus on identifying opportunities for additional strategic actions post-mitigation or exploitation. These could include enhanced security measures, increased political leverage, or any actions further weakening the opposition.
            """)
        for (cap, vuln) in all_vulnerabilities_list:
            st.markdown(f"• Capability: **{cap}**; Vulnerability: **{vuln}**")
            crit_cols = st.columns(len(st.session_state["criteria"]))
            for i, crit in enumerate(st.session_state["criteria"]):
                key_ = (cap, vuln, crit)  # tuple as dictionary key
                if key_ not in st.session_state["vulnerability_scores"]:
                    st.session_state["vulnerability_scores"][key_] = 1  # default

                if "Traditional" in scoring_approach:
                    st.session_state["vulnerability_scores"][key_] = crit_cols[i].slider(
                        f"{crit[:10]} ({vuln[:15]})",
                        min_value=1, max_value=5,
                        value=st.session_state["vulnerability_scores"][key_],
                        key=str(key_)
                    )
                else:
                    # Logarithmic
                    current_val = st.session_state["vulnerability_scores"][key_]
                    if current_val not in log_scale_options:
                        current_val = 1
                    st.session_state["vulnerability_scores"][key_] = crit_cols[i].selectbox(
                        f"{crit[:10]} ({vuln[:15]})",
                        options=log_scale_options,
                        index=log_scale_options.index(current_val),
                        key=str(key_) + "_log"
                    )

    # ---------------------
    # 7) Calculate & Show Priorities
    # ---------------------
    if st.button("Calculate & Show Priorities"):
        if not all_vulnerabilities_list:
            st.warning("No vulnerabilities to score yet.")
        else:
            # Summarize final scores
            final_scores = []
            for (cap, vuln) in all_vulnerabilities_list:
                total_score = 0
                detail_list = []
                for crit in st.session_state["criteria"]:
                    val = st.session_state["vulnerability_scores"].get((cap, vuln, crit), 1)
                    total_score += val
                    detail_list.append(f"{crit}={val}")
                final_scores.append((cap, vuln, total_score, detail_list))

            # Sort top-down
            final_scores.sort(key=lambda x: x[2], reverse=True)
            st.subheader("Prioritized Vulnerabilities by Composite Score")
            for idx, (cap, v, score, details) in enumerate(final_scores, 1):
                st.write(f"{idx}. **[{cap}]** {v} – Composite: **{score}** ({', '.join(details)})")

    st.markdown("---")
    # ---------------------
    # 8) Export / Save Options
    # ---------------------
    st.subheader("Export / Save Results")

    col_export1, col_export2, col_export3 = st.columns(3)

    with col_export1:
        if st.button("Export Vulnerabilities as CSV"):
            vulns_csv = io.StringIO()
            writer = csv.writer(vulns_csv)
            # CSV header
            writer.writerow(["Capability", "Vulnerability", "Score Details", "Composite Score"])
            # Access the final_scores from local scope if it exists
            if "final_scores" in locals():
                for cap, vuln, total_score, detail_list in final_scores:
                    writer.writerow([cap, vuln, ", ".join(detail_list), total_score])
            csv_data = vulns_csv.getvalue()
            st.download_button(
                label="Download CSV",
                data=csv_data,
                file_name="COG_Vulnerabilities.csv",
                mime="text/csv"
            )

    with col_export2:
        # PDF generation placeholder
        st.write("PDF export placeholder")

    with col_export3:
        # Graph format placeholder
        st.write("Graph export placeholder (.gexf, .graphml, etc.)")


def main():
    cog_analysis()

if __name__ == "__main__":
    main()