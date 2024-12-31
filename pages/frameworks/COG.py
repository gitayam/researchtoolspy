# /researchtools_streamlit/pages/COG_Analysis.py

import streamlit as st
from dotenv import load_dotenv
from utilities.utils_openai import chat_gpt, generate_cog_options

load_dotenv()

def cog_analysis():
    st.title("Enhanced COG Analysis Flow")

    st.write("""
    This flow helps you:
    1. Define your Desired Effect.
    2. Select/Confirm a Center of Gravity (COG) and specify entity context.
    3. Identify Critical Capabilities & Requirements (CC & CR).
    4. Identify Critical Vulnerabilities (CV).
    5. Define or AI-generate Scoring Criteria.
    6. Prioritize those vulnerabilities (Traditional or Logarithmic approach).
    """)

    # --------------------------------------------------------------------------------
    # 1) Basic Info
    # --------------------------------------------------------------------------------
    user_details = st.text_input(
        "User / Org Details",
        help="Context about the user/organization performing this analysis."
    )
    desired_end_state = st.text_input(
        "Desired End State / Effect",
        help="E.g., 'Increase community engagement with user-generated content.'"
    )

    st.markdown("---")

    # --------------------------------------------------------------------------------
    # 2) Center of Gravity
    # --------------------------------------------------------------------------------
    if "cog_suggestions" not in st.session_state:
        st.session_state["cog_suggestions"] = []

    entity_type = st.selectbox(
        "Entity Type for COG Analysis",
        ["Friendly", "Adversary", "Competitor", "Customer", "Host Nation"],
        help="Which entity do you want to analyze a Center of Gravity for?"
    )

    # New field: Entity Context
    entity_context = st.text_area(
        "Entity Context",
        help="Where is it? What limitations or constraints apply? E.g., geographic area, resources, or environment."
    )

    if st.button("Generate Possible Centers of Gravity"):
        if not desired_end_state.strip():
            st.warning("Please provide a Desired End State first.")
        else:
            try:
                # We'll enhance the prompt to incorporate entity_context
                cog_text = generate_cog_options(
                    user_details=user_details,
                    desired_end_state=desired_end_state,
                    entity_type=entity_type,
                    custom_prompt=(
                        "You're an advanced operational planner. "
                        "Consider the following context:\n"
                        f"- User/Org: {user_details}\n"
                        f"- Entity Context: {entity_context}\n"
                        "Propose 3–5 potential Centers of Gravity (CoGs) specifically for this entity type. "
                        "Explain or reference major strengths/resources that define each CoG. "
                        "Separate them with semicolons, no bullet points."
                    ),
                    model="gpt-3.5-turbo"
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

    # --------------------------------------------------------------------------------
    # 3) Critical Capabilities & Requirements
    # --------------------------------------------------------------------------------
    st.subheader("Identify Critical Capabilities & Requirements")
    st.write("""
    - You can ask AI to propose them, then manually modify in the text areas below.
    - Or just type them manually from the start.
    """)

    # Single text areas instead of line-by-line
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
                        f"User/Org: {user_details}\n"
                        f"Entity Type: {entity_type}\n"
                        f"Context: {entity_context}\n"
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
                        f"User/Org: {user_details}\n"
                        f"Entity Type: {entity_type}\n"
                        f"Context: {entity_context}\n"
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

    # --------------------------------------------------------------------------------
    # 4) Identify Critical Vulnerabilities
    # --------------------------------------------------------------------------------
    st.subheader("Identify Critical Vulnerabilities (CV)")
    st.write("""
    - AI can propose them based on your CoG, capabilities, and requirements,
      or you can manually type them in a single text area.
    """)

    if "vulnerabilities_list" not in st.session_state:
        st.session_state["vulnerabilities_list"] = ""

    def get_cap_req_text() -> str:
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
                        f"Desired End State: {desired_end_state}\n"
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

    # --------------------------------------------------------------------------------
    # 5) Define Criteria & Score
    # --------------------------------------------------------------------------------
    st.subheader("Define / Edit Scoring Criteria")
    st.write("""
    - By default, we have "Impact", "Attainability", "Potential for Follow-up".
    - You can add/edit. Then pick Traditional or Logarithmic. We'll parse your vulnerabilities and let you score them.
    """)

    if "criteria" not in st.session_state:
        st.session_state["criteria"] = ["Impact", "Attainability", "Potential for Follow-up"]

    # Let user see & edit existing criteria in a single text box or keep it line-based
    # For simplicity, let's keep them line-based:
    st.write("Current Criteria (one per line):")
    criteria_text = st.text_area(
        "Edit Criteria",
        value="\n".join(st.session_state["criteria"]),
        height=100
    )
    if st.button("Update Criteria"):
        new_list = [c.strip() for c in criteria_text.split("\n") if c.strip()]
        st.session_state["criteria"] = new_list
        st.success("Criteria updated.")

    # Optionally AI propose 2 new
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

    # Score Approach
    scoring_approach = st.selectbox(
        "Scoring Approach",
        ["Traditional (1-5)", "Logarithmic (1,3,5,8,12)"],
        help="Pick how you'd like to score vulnerabilities across your chosen criteria."
    )

    log_scale_options = [1, 3, 5, 8, 12]

    if "vulnerability_scores" not in st.session_state:
        st.session_state["vulnerability_scores"] = {}

    # We parse vulnerabilities from st.session_state["vulnerabilities_list"]
    # Then we create a dynamic table
    st.write("### Score Each Vulnerability on Each Criterion")

    # Clean parse vulnerabilities into a list
    vulns_parsed = []
    if st.session_state["vulnerabilities_list"].strip():
        # Either semicolons or lines
        if ";" in st.session_state["vulnerabilities_list"]:
            vulns_parsed = [v.strip() for v in st.session_state["vulnerabilities_list"].split(";") if v.strip()]
        else:
            vulns_parsed = [v.strip() for v in st.session_state["vulnerabilities_list"].split("\n") if v.strip()]

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

            # Sort desc
            final_scores.sort(key=lambda x: x[1], reverse=True)
            st.subheader("Prioritized Vulnerabilities by Composite Score")
            for idx, (v, score, details) in enumerate(final_scores, 1):
                st.write(f"{idx}. **{v}**  — Composite: **{score}** ({', '.join(details)})")

    st.write("---")
    st.info("Flow completed. Feel free to refine or expand further.")


def main():
    cog_analysis()


if __name__ == "__main__":
    main()