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
    5. Identify Critical Vulnerabilities (CV).
    6. Define or AI-generate Scoring Criteria.
    7. Prioritize those vulnerabilities (Traditional or Logarithmic approach).
    8. Optionally export results to CSV, PDF, or graph format.
    """)

    # Domain-based instructions or reminders depending on entity type
    domain_guidance = {
        "Friendly": """
**Friendly COG**:  
Assess our foundational strengths across various domains providing potential risks to mitigate.  
- Diplomatic: What international alliances and diplomatic relations fortify our position?  
- Information: Which communication and propaganda efforts are most influential?  
- Military: What units, capabilities, or systems are crucial for our success?  
- Economic: What economic policies and resources ensure our sustained operations?  
- Cyber: What are our capabilities for defending and attacking in the digital realm?  
- Space: How do our satellite and space-based operations enhance our strategic goals?
        """,
        "Adversary": """
**Adversary COG**:  
Pinpoint the adversary’s vital sources of power and potential targets:  
- Diplomatic: How do their international relationships affect their strategic capabilities?  
- Information: What misinformation or psychological operations do they deploy?  
- Military: Which military assets are essential to their operational success?  
- Economic: Which economic dependencies are exploitable?  
- Cyber: What are their cyber vulnerabilities?  
- Space: Do they rely heavily on space-based assets?
        """,
        "Host Nation": """
**Host Nation COG**:  
Assess the host nation’s pivotal strengths and vulnerabilities:  
- Diplomatic: What is the host nation’s stance, and how does it influence the conflict?  
- Information: What are their capabilities in managing or disseminating information?  
- Military: What military aspects of the host nation could influence their role in the conflict?  
- Economic: How do the economic conditions affect their alignment in the conflict?  
- Cyber: Assess the cyberinfrastructure and defenses of the host nation.  
- Space: Evaluate the host nation’s reliance and capabilities on space-based assets.
        """,
        "Customer": """
**Customer COG**:  
Focus on purchasing and viewership criteria rather than the usual levers of power:  
- Engagement Channels: Which communication channels are most influential for their decisions?  
- Purchasing Behavior: What drives their buying or subscription choices?  
- Brand Loyalty: Are there brand or relationship factors that keep them engaged?  
- Economic Constraints: Financial or budget constraints that affect their decisions?  
- Social Influence: How do peer networks or social communities guide preferences?
        """,
    }

    # 1) Basic Info
    # --------------------------------------------------------------------------------
    entity_type = st.selectbox(
        "Select Entity Type for COG Analysis",
        list(domain_guidance.keys()),
        help="Which entity are you analyzing a Center of Gravity for?"
    )

    entity_name = st.text_input(
        "Name of Entity",
        help="E.g. 'Our organization', 'Competitor X', 'Host Nation Y', etc."
    )
    entity_goals = st.text_area(
        "Entity Goals",
        help="Examples: Achieve X objective, strengthen brand recognition, control a region, etc."
    )
    entity_presence = st.text_area(
        "Entity Areas of Presence",
        help="Where is this entity located or influential? E.g. certain regions, industries, or domains."
    )

    # Show domain-specific reminders or questions
    st.markdown("---")
    st.write("### Domain Considerations")
    st.markdown(domain_guidance[entity_type])

    # 2) Generate Possible Centers of Gravity
    # --------------------------------------------------------------------------------
    st.markdown("---")
    st.subheader("Identify / Generate Possible Centers of Gravity")
    if "cog_suggestions" not in st.session_state:
        st.session_state["cog_suggestions"] = []

    desired_end_state = st.text_input(
        "Desired End State or Effect (Optional)",
        help="What outcome are you trying to achieve? Helps AI generate relevant CoGs."
    )

    if st.button("Generate Possible Centers of Gravity"):
        if not entity_type or not entity_name.strip():
            st.warning("Please provide at least the entity type and name before generating suggestions.")
        else:
            try:
                custom_prompt = (
                    "You're an advanced operational/strategic AI. "
                    "Refer to the details:\n"
                    f"- Entity Type: {entity_type}\n"
                    f"- Entity Name: {entity_name}\n"
                    f"- Goals: {entity_goals}\n"
                    f"- Areas of Presence: {entity_presence}\n"
                    f"- Desired End State: {desired_end_state}\n"
                    f"- Domain Context: {domain_guidance[entity_type]}\n"
                    "Propose 3-5 potential Centers of Gravity (sources of power and morale) Entity Name has to achieve their Goals"
                    "for this entity in its context. Consider the domain-specific guidance provided. "
                    "Separate them with semicolons, no bullet points."
                )

                cog_text = generate_cog_options(
                    user_details="",  # not used now
                    desired_end_state=desired_end_state or "",
                    entity_type=entity_type,
                    custom_prompt=custom_prompt,
                    model="gpt-4o-mini"
                )
                suggestions = [c.strip() for c in cog_text.split(";") if c.strip()]
                st.session_state["cog_suggestions"] = suggestions
                st.success("Possible Centers of Gravity:")
                for idx, cog_item in enumerate(suggestions, 1):
                    st.write(f"{idx}. {cog_item}")
            except Exception as e:
                st.error(f"Error generating CoG suggestions: {e}")

    # Let user pick or refine final COG
    if st.session_state["cog_suggestions"]:
        user_selected_cog = st.selectbox(
            "Select a CoG from AI suggestions (or type below)",
            ["(None)"] + st.session_state["cog_suggestions"]
        )
    else:
        user_selected_cog = "(None)"

    manual_cog = st.text_input(
        "Or manually enter your CoG",
        help="E.g. 'Key influencer network', 'Critical logistics hub', etc."
    )

    final_cog = manual_cog.strip() if manual_cog.strip() else (
        user_selected_cog if user_selected_cog != "(None)" else ""
    )

    st.markdown("---")

    # 3) Critical Capabilities & Requirements
    # --------------------------------------------------------------------------------
    st.subheader("Identify Critical Capabilities & Requirements")

    if "capabilities_text" not in st.session_state:
        st.session_state["capabilities_text"] = ""
    if "requirements_text" not in st.session_state:
        st.session_state["requirements_text"] = ""

    col_cap, col_req = st.columns(2)

    # AI propose capabilities
    if col_cap.button("AI: Suggest Capabilities"):
        if not final_cog:
            st.warning("Please specify a CoG first.")
        else:
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI specialized in COG. Provide critical capabilities as a semicolon list."
                }
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Entity Type: {entity_type}\n"
                        f"Entity Name: {entity_name}\n"
                        f"Goals: {entity_goals}\n"
                        f"Areas of Presence: {entity_presence}\n"
                        f"CoG: {final_cog}\n"
                        "List ~5 critical capabilities (actions the CoG can do) as semicolons."
                    )
                }
                response = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
                st.session_state["capabilities_text"] = response
                st.success("AI-proposed capabilities added to text area.")
            except Exception as e:
                st.error(f"Error: {e}")

    st.session_state["capabilities_text"] = col_cap.text_area(
        "Capabilities (semicolons or paragraphs)",
        value=st.session_state["capabilities_text"],
        height=150
    )

    # AI propose requirements
    if col_req.button("AI: Suggest Requirements"):
        if not final_cog:
            st.warning("Please specify a CoG first.")
        else:
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI specialized in COG. Provide critical requirements as a semicolon list."
                }
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Entity Type: {entity_type}\n"
                        f"Entity Name: {entity_name}\n"
                        f"Goals: {entity_goals}\n"
                        f"Areas of Presence: {entity_presence}\n"
                        f"CoG: {final_cog}\n"
                        "List ~5 critical requirements (resources/conditions the CoG needs) as semicolons."
                    )
                }
                response = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
                st.session_state["requirements_text"] = response
                col_req.success("AI-proposed requirements added to text area.")
            except Exception as e:
                col_req.error(f"Error: {e}")

    st.session_state["requirements_text"] = col_req.text_area(
        "Requirements (semicolons or paragraphs)",
        value=st.session_state["requirements_text"],
        height=150
    )

    st.markdown("---")

    # 4) Identify Critical Vulnerabilities
    # --------------------------------------------------------------------------------
    st.subheader("Identify Critical Vulnerabilities (CV)")
    st.write("AI can propose them based on your CoG, capabilities, and requirements, or you can type them manually.")

    if "vulnerabilities_list" not in st.session_state:
        st.session_state["vulnerabilities_list"] = ""

    def get_cap_req_text() -> str:
        """Helper to combine the current capabilities & requirements text."""
        return (
            "Capabilities:\n" + st.session_state["capabilities_text"] + "\n"
            "Requirements:\n" + st.session_state["requirements_text"] + "\n"
        )

    if st.button("AI: Suggest Vulnerabilities"):
        if not final_cog:
            st.warning("Please finalize a CoG first.")
        else:
            try:
                system_vuln = {
                    "role": "system",
                    "content": (
                        "You are an AI that identifies critical vulnerabilities for a CoG, "
                        "focusing on missing or fragile capabilities/requirements."
                    )
                }
                user_vuln = {
                    "role": "user",
                    "content": (
                        f"Entity Type: {entity_type}\n"
                        f"Entity Name: {entity_name}\n"
                        f"Goals: {entity_goals}\n"
                        f"Areas of Presence: {entity_presence}\n"
                        f"CoG: {final_cog}\n\n"
                        f"{get_cap_req_text()}\n"
                        "List 3-5 vulnerabilities. Use semicolons, no bullet points."
                    )
                }
                vuln_result = chat_gpt([system_vuln, user_vuln], model="gpt-3.5-turbo")
                st.session_state["vulnerabilities_list"] += "\n" + vuln_result
                st.success("AI-Identified Vulnerabilities appended to text area.")
            except Exception as e:
                st.error(f"Error: {e}")

    st.session_state["vulnerabilities_list"] = st.text_area(
        "Vulnerabilities (semicolons or paragraphs)",
        value=st.session_state["vulnerabilities_list"],
        height=150
    )

    st.markdown("---")

    # 5) Define Criteria & Score
    # --------------------------------------------------------------------------------
    st.subheader("Define / Edit Scoring Criteria")
    st.write("""
    - By default, we have "Impact", "Attainability", "Potential for Follow-up".
    - You can add/edit them below.
    """)

    if "criteria" not in st.session_state:
        st.session_state["criteria"] = ["Impact", "Attainability", "Potential for Follow-up"]

    criteria_text = st.text_area(
        "Current Criteria (one per line)",
        value="\n".join(st.session_state["criteria"]),
        height=100
    )
    if st.button("Update Criteria"):
        new_list = [c.strip() for c in criteria_text.split("\n") if c.strip()]
        st.session_state["criteria"] = new_list
        st.success("Criteria updated.")

    # Optionally AI propose new criteria
    if st.button("AI: Suggest Additional Criteria"):
        try:
            system_msg = {
                "role": "system",
                "content": "You propose new scoring criteria for vulnerability analysis. Return semicolon list."
            }
            user_msg = {"role": "user", "content": "Suggest 2 new scoring criteria, semicolon-delimited."}
            resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            new_crits = [c.strip() for c in resp.split(";") if c.strip()]
            st.session_state["criteria"].extend(new_crits)
            st.success("AI Proposed Additional Criteria:")
            for idx, c in enumerate(new_crits, 1):
                st.write(f"{idx}. {c}")
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

    if "vulnerability_scores" not in st.session_state:
        st.session_state["vulnerability_scores"] = {}

    st.write("### Score Each Vulnerability on Each Criterion")
    # Parse vulnerabilities into a list
    vulns_parsed = []
    if st.session_state["vulnerabilities_list"].strip():
        if ";" in st.session_state["vulnerabilities_list"]:
            vulns_parsed = [
                v.strip()
                for v in st.session_state["vulnerabilities_list"].split(";")
                if v.strip()
            ]
        else:
            vulns_parsed = [
                v.strip()
                for v in st.session_state["vulnerabilities_list"].split("\n")
                if v.strip()
            ]

    if vulns_parsed and st.session_state["criteria"]:
        for vuln in vulns_parsed:
            st.write(f"**{vuln}**")
            crit_cols = st.columns(len(st.session_state["criteria"]))
            for i, crit in enumerate(st.session_state["criteria"]):
                key_ = f"{vuln}_{crit}"
                if key_ not in st.session_state["vulnerability_scores"]:
                    st.session_state["vulnerability_scores"][key_] = 1  # default

                if "Traditional" in scoring_approach:
                    st.session_state["vulnerability_scores"][key_] = crit_cols[i].slider(
                        f"{crit[:10]} ({vuln[:15]})",
                        min_value=1, max_value=5,
                        value=st.session_state["vulnerability_scores"][key_],
                        key=key_
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
                        key=key_ + "_log"
                    )

    # 7) Calculate & Show Priorities
    if st.button("Calculate & Show Priorities"):
        if not vulns_parsed:
            st.warning("No vulnerabilities to score yet.")
        else:
            final_scores = []
            for vuln in vulns_parsed:
                sum_score = 0
                detail_list = []
                for crit in st.session_state["criteria"]:
                    key_ = f"{vuln}_{crit}"
                    val = st.session_state["vulnerability_scores"].get(key_, 1)
                    sum_score += val
                    detail_list.append(f"{crit}={val}")
                final_scores.append((vuln, sum_score, detail_list))

            final_scores.sort(key=lambda x: x[1], reverse=True)
            st.subheader("Prioritized Vulnerabilities by Composite Score")
            for idx, (v, score, details) in enumerate(final_scores, 1):
                st.write(f"{idx}. **{v}** — Composite: **{score}** ({', '.join(details)})")

    st.markdown("---")

    # 8) Export / Save Options
    st.subheader("Export / Save Results")

    col_export1, col_export2, col_export3 = st.columns(3)

    with col_export1:
        if st.button("Export Vulnerabilities as CSV"):
            vulns_csv = io.StringIO()
            writer = csv.writer(vulns_csv)
            writer.writerow(["Vulnerability", "Score Details", "Composite Score"])
            for vuln, total_score, detail_list in getattr(locals().get("final_scores", []), "__iter__", lambda: [])():
                writer.writerow([vuln, ", ".join(detail_list), total_score])
            st.download_button(
                label="Download CSV",
                data=vulns_csv.getvalue(),
                file_name="COG_Vulnerabilities.csv",
                mime="text/csv"
            )

    with col_export2:
        # This is just a placeholder so you can later add your PDF generation
        st.write("PDF export placeholder (integrate with xhtml2pdf or similar).")

    with col_export3:
        # This is just a placeholder for exporting to a graph format like GEXF or GraphML
        st.write("Graph export placeholder (generate .gexf or .graphml).")


def main():
    cog_analysis()


if __name__ == "__main__":
    main()