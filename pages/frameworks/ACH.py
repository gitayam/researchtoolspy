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
        """
        Call AI to propose 3–5 example hypotheses from a senior intelligence analyst perspective.
        Returns semicolon-separated text for each hypothesis.
        """
        try:
            existing_hypotheses = st.session_state["ach_hypotheses"]

            system_msg = {
                "role": "system",
                "content": (
                    "You are an AI with expertise in intelligence analysis, using the Analysis of Competing Hypotheses (ACH) approach. "
                    "You will propose a brief set of well-reasoned hypotheses, returning them as semicolon-limited text. "
                    "Be concise, yet ensure each hypothesis distinctly addresses possible underlying causes, scenarios, or factors."
                )
            }

            user_msg = {
                "role": "user",
                "content": (
                    f"Current hypotheses: {existing_hypotheses}\n\n"
                    "As a senior analyst applying ACH, propose 3–5 new or refined hypotheses (semicolon separated) that could explain or address "
                    "this scenario. Consider different angles, assumptions, and any gaps in the existing hypotheses. "
                    "Focus on plausible scenarios, mention potential uncertainties, and ensure each proposed hypothesis is distinct."
                )
            }

            resp = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            
            # Split the response by semicolons and format into new lines
            formatted_resp = "\n".join(resp.split(';'))
            return formatted_resp
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
    st.subheader("Step 2: List Key Pieces of Evidence or Arguments (Assign Weights)")

    if "ach_evidence" not in st.session_state:
        st.session_state["ach_evidence"] = ""

    # Initialize a dict to store weights for each piece of evidence.
    if "ach_evidence_weights" not in st.session_state:
        st.session_state["ach_evidence_weights"] = {}

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
            resp = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            
            # Split the response by semicolons and format into new lines
            formatted_resp = "\n".join(resp.split(';'))
            return formatted_resp
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
    # Step 2b: Assign Weights
    #
    st.write("Assign a weight for each piece of evidence (e.g., 1 = least significant / Opinion, 12 = extremely significant/ Fact).")
    def parse_list(input_text):
        # Split by semicolon, then newline
        parts = input_text.split(';')
        result = []
        for part in parts:
            result.extend([x.strip() for x in part.split('\n') if x.strip()])
        return result

    evidence_list = parse_list(st.session_state["ach_evidence"])

    # Define the logarithmic scale
    weight_options = [1, 3, 5, 8, 12]

    for evidence in evidence_list:
        if evidence not in st.session_state["ach_evidence_weights"]:
            # Default weight set to 1
            st.session_state["ach_evidence_weights"][evidence] = 1

    for ev in evidence_list:
        st.session_state["ach_evidence_weights"][ev] = st.selectbox(
            label=f"Weight for: {ev}",
            options=weight_options,
            index=weight_options.index(st.session_state["ach_evidence_weights"][ev]),
            format_func=lambda x: f"{x} (1 = least significant / Opinion, 12 = extremely significant / Fact)",
            key=f"{ev}_weight_selectbox"
        )

    st.markdown("---")

    #
    # Step 3: Evaluate Consistency of Each Piece of Evidence with Each Hypothesis
    #
    st.subheader("Step 3: Evaluate Consistency")

    hypotheses_list = parse_list(st.session_state["ach_hypotheses"])

    # We'll keep a data structure for the consistency matrix
    if "ach_matrix" not in st.session_state:
        st.session_state["ach_matrix"] = {}

    # Ensure session_state has a record for each (evid, hyp) pair
    for e in evidence_list:
        for h in hypotheses_list:
            key_ = (e, h)
            if key_ not in st.session_state["ach_matrix"]:
                st.session_state["ach_matrix"][key_] = "Neutral"

    if hypotheses_list and evidence_list:
        for ev in evidence_list:
            st.markdown(f"**Evidence**: {ev}")
            columns = st.columns(len(hypotheses_list))
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
    # Step 4: Weighted Inconsistency Counts
    #
    st.subheader("Step 4: Assess Weighted Inconsistencies / Conflicts")
    st.write("""
    In this weighted approach, each piece of evidence you marked "Inconsistent" applies its assigned weight
    to the hypothesis' total inconsistency score. 
    Then we normalize by the total weight of all evidence for clarity.
    """)

    if hypotheses_list and evidence_list:
        # Calculate total weight of all evidence for normalization
        total_evidence_weight = sum([st.session_state["ach_evidence_weights"][ev] for ev in evidence_list])

        # Weighted inconsistency count
        weighted_inconsistency = {h: 0.0 for h in hypotheses_list}

        for e in evidence_list:
            w = st.session_state["ach_evidence_weights"][e]
            for h in hypotheses_list:
                val = st.session_state["ach_matrix"][(e, h)]
                if val == "Inconsistent":
                    weighted_inconsistency[h] += w

        # Prepare display
        sorted_hyps = sorted(weighted_inconsistency.items(), key=lambda x: x[1])
        st.write("**Weighted Inconsistency Scores** (lower is better):")
        for hyp, inc_score in sorted_hyps:
            normalized = (inc_score / total_evidence_weight) * 100 if total_evidence_weight > 0 else 0
            st.write(f"- **{hyp}**: {inc_score:.2f} (Normalized: {normalized:.1f}%)")

        best_hyp = sorted_hyps[0][0] if sorted_hyps else None
        st.success(f"Tentative Conclusion: Hypothesis with the fewest weighted inconsistencies is: **{best_hyp}**")

    else:
        st.info("No matrix to analyze. Add Hypotheses and Evidence first.")

    st.markdown("---")
    st.info("""
**Done!**  
Use these steps to refine or add new evidence. Weighting helps you see which evidence
has the most impact on your analysis, offering a more nuanced view of each hypothesis.
""")

def main():
    ach_page()

if __name__ == "__main__":
    main()