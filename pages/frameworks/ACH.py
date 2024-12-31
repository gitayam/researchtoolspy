# /researchtools_streamlit/pages/ach.py
import streamlit as st
from dotenv import load_dotenv
from utilities.utils_openai import chat_gpt  # If you want AI to assist
import pandas as pd

load_dotenv()

def ach_page():
    st.title("Analysis of Competing Hypotheses (ACH)")

    st.write("""
    **Analysis of Competing Hypotheses** (ACH) helps evaluate multiple competing explanations
    or hypotheses for the observed data. This approach was popularized by Richards Heuer at the CIA.
    
    **Steps**:
    1. List possible Hypotheses.
    2. List key Pieces of Evidence or Arguments.
    3. For each piece of evidence, evaluate how Consistent, Inconsistent, or Neutral it is with each hypothesis.
    4. Identify which hypothesis has the fewest inconsistencies.
    5. Refine or add evidence as needed to challenge your initial assumptions.
    """)

    st.markdown("---")

    #
    # Step 1: Hypotheses
    #
    st.subheader("Step 1: List Hypotheses")

    if "ach_hypotheses" not in st.session_state:
        st.session_state["ach_hypotheses"] = ""

    def ai_suggest_hypotheses():
        """Call AI to propose 3–5 example hypotheses."""
        try:
            existing_hypotheses = st.session_state["ach_hypotheses"]
            system_msg = {"role": "system", "content": "You are an AI helping with ACH. Return semicolon-limited text."}
            user_msg = {
                "role": "user",
                "content": (
                    f"Based on the existing hypotheses: {existing_hypotheses}, "
                    "suggest 3 to 5 similar hypotheses (semicolon separated) for a scenario or problem."
                )
            }
            resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            return resp
        except Exception as e:
            st.error(f"AI error: {e}")
            return ""

    col_hyp_left, col_hyp_right = st.columns([3,1])
    with col_hyp_left:
        st.session_state["ach_hypotheses"] = st.text_area(
            "Hypotheses (semicolon or newline separated)",
            value=st.session_state["ach_hypotheses"],
            placeholder="Hypothesis A\nHypothesis B\nHypothesis C",
            height=100
        )
    with col_hyp_right:
        if st.button("AI: Suggest Hypotheses"):
            text = ai_suggest_hypotheses()
            if text:
                st.session_state["ach_hypotheses"] += "\n" + text
                st.experimental_rerun()

    st.markdown("---")

    #
    # Step 2: Evidence / Arguments
    #
    st.subheader("Step 2: List Key Pieces of Evidence or Arguments")

    if "ach_evidence" not in st.session_state:
        st.session_state["ach_evidence"] = ""

    def ai_suggest_evidence():
        """Call AI to propose 3–5 example pieces of evidence or arguments for the scenario."""
        try:
            existing_hypotheses = st.session_state["ach_hypotheses"]
            system_msg = {"role": "system", "content": "You are an AI that suggests evidence for ACH."}
            user_msg = {
                "role": "user",
                "content": (
                    f"Based on the current hypotheses: {existing_hypotheses}, "
                    "suggest 3 to 5 pieces of evidence or arguments (semicolon separated) that are relevant to these hypotheses."
                )
            }
            resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            return resp
        except Exception as e:
            st.error(f"AI error: {e}")
            return ""

    col_evid_left, col_evid_right = st.columns([3,1])
    with col_evid_left:
        st.session_state["ach_evidence"] = st.text_area(
            "Evidence / Arguments",
            value=st.session_state["ach_evidence"],
            placeholder="Evidence #1\nEvidence #2\netc.",
            height=100
        )
    with col_evid_right:
        if st.button("AI: Suggest Evidence"):
            text = ai_suggest_evidence()
            if text:
                st.session_state["ach_evidence"] += "\n" + text
                st.experimental_rerun()

    st.markdown("---")

    #
    # Build the Matrix
    #
    st.subheader("Step 3: Evaluate Consistency of Each Piece of Evidence with Each Hypothesis")

    # Parse the user input into lists
    def parse_list(input_text):
        # Split by semicolon first, then split each resulting part by newline
        parts = input_text.split(';')
        result = []
        for part in parts:
            result.extend([x.strip() for x in part.split('\n') if x.strip()])
        return result

    hypotheses_list = parse_list(st.session_state["ach_hypotheses"])
    evidence_list = parse_list(st.session_state["ach_evidence"])

    # We'll keep a data structure (in st.session_state) for the consistency matrix
    # For example: "matrix[(evidence_i, hypothesis_j)] = 'Consistent' or 'Inconsistent' or 'Neutral'"
    if "ach_matrix" not in st.session_state:
        st.session_state["ach_matrix"] = {}

    # Make sure session_state has a record for each (evid, hyp) pair
    for e in evidence_list:
        for h in hypotheses_list:
            key_ = (e, h)
            if key_ not in st.session_state["ach_matrix"]:
                st.session_state["ach_matrix"][key_] = "Neutral"

    # Display each piece of evidence, then a row of selectboxes for each hypothesis
    if hypotheses_list and evidence_list:
        for ev in evidence_list:
            st.markdown(f"**Evidence**: {ev}")  # Title for this piece of evidence
            columns = st.columns(len(hypotheses_list))  # One column per hypothesis
            for i, hyp in enumerate(hypotheses_list):
                old_val = st.session_state["ach_matrix"][(ev, hyp)]
                new_val = columns[i].selectbox(
                    label=f"{hyp}",
                    options=["Consistent", "Inconsistent", "Neutral"],
                    index=["Consistent", "Inconsistent", "Neutral"].index(old_val),
                    key=f"{ev}_{hyp}_selectbox"
                )
                st.session_state["ach_matrix"][(ev, hyp)] = new_val
            st.write("---")
    else:
        st.info("Add at least one hypothesis and one piece of evidence to compare them.")

    st.markdown("---")

    #
    # Step 4: Identify the "Inconsistencies" Count
    #
    st.subheader("Step 4: Assess Inconsistencies / Conflicts")

    st.write("""
    Typically in ACH, the hypothesis with the **fewest** “Inconsistent” marks 
    may be considered more likely. This is a simplified approach, 
    but it helps highlight which hypothesis is contradicted by the most evidence.
    """)

    if hypotheses_list and evidence_list:
        # We'll do a total "inconsistent" count for each hypothesis
        counts = {h: 0 for h in hypotheses_list}
        for e in evidence_list:
            for h in hypotheses_list:
                val = st.session_state["ach_matrix"][(e, h)]
                if val == "Inconsistent":
                    counts[h] += 1

        # Display results
        sorted_hyps = sorted(counts.items(), key=lambda x: x[1])
        st.write("**Inconsistency Counts** (lower is better):")
        for hyp, inc_count in sorted_hyps:
            st.write(f"- **{hyp}**: {inc_count} inconsistencies")

        best_hyp = sorted_hyps[0][0] if sorted_hyps else None
        st.success(f"Tentative Conclusion: Hypothesis with fewest inconsistencies is: **{best_hyp}**")
    else:
        st.info("No matrix to analyze. Add Hypotheses and Evidence first.")

    st.markdown("---")

    st.info("""
**Done!**  
Use these steps to refine or add new evidence. This simple approach helps highlight which hypothesis might best fit the data. 
For advanced usage, consider weighting the evidence, handling uncertain or contradictory sources, 
and performing sensitivity analysis to test key assumptions.
""")

def main():
    ach_page()

if __name__ == "__main__":
    main()