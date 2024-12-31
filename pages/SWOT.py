# /researchtools_streamlit/pages/SWOT.py

import streamlit as st
from dotenv import load_dotenv
from utils_openai import chat_gpt  # or any AI helper function

load_dotenv()

def swot_page():
    st.title("SWOT Analysis")

    st.write("""
    **Summary**  
    SWOT (Strengths, Weaknesses, Opportunities, Threats) is a decision-making technique 
    that identifies internal and external factors that can help or hinder an organization or project.  
    It's typically used in the preliminary stages of strategic planning or problem-solving.

    **Internal Factors**: Strengths & Weaknesses (e.g. human resources, financial situation, processes).  
    **External Factors**: Opportunities & Threats (e.g. trends, market conditions, legislation).

    Use the steps below to define your objective, list SWOT items, and identify strategies.
    """)

    st.markdown("---")

    #
    # Step 1: Define Objective
    #
    st.subheader("Step 1: Define the Objective")
    objective = st.text_input(
        label="Objective",
        value="",
        placeholder="Ex: ‘Increase market share in Region X’ or ‘Enhance collaboration within the team.’",
        help="Clearly state the goal or purpose of this SWOT analysis. E.g., a project or business objective."
    )

    st.markdown("---")

    #
    # Step 2: List Strengths, Weaknesses, Opportunities, Threats
    #
    st.subheader("Step 2: List Strengths, Weaknesses, Opportunities, and Threats")

    # Generic AI call for each category
    def ai_suggest_swot(category):
        """Ask AI for suggestions in a given SWOT category, referencing the user’s objective."""
        try:
            system_msg = {
                "role": "system",
                "content": (
                    "You are an AI that helps generate items for a SWOT analysis. "
                    "Your output should be semicolon-separated, with no bullet points."
                )
            }
            user_msg = {
                "role": "user",
                "content": (
                    f"SWOT Objective: {objective}\n"
                    f"Generate 3-5 {category} in semicolon-separated format, no bullet points."
                )
            }
            response = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            return response
        except Exception as e:
            st.error(f"AI Error: {e}")
            return ""

    # Strengths
    st.write("**Strengths** (internal advantages): characteristics or resources that give you an edge.")
    if "swot_strengths" not in st.session_state:
        st.session_state["swot_strengths"] = ""
    col_strengths_left, col_strengths_right = st.columns([2,1])
    with col_strengths_left:
        st.session_state["swot_strengths"] = st.text_area(
            label="Strengths",
            value=st.session_state["swot_strengths"],
            height=100,
            placeholder="e.g. Strong brand recognition; Skilled workforce; Innovative tech stack",
            help="List or separate by semicolons. These are internal positives."
        )
    with col_strengths_right:
        if st.button("AI: Suggest Strengths"):
            ai_text = ai_suggest_swot("Strengths")
            if ai_text:
                st.session_state["swot_strengths"] += "\n" + ai_text
                st.success("Appended AI suggestions to Strengths.")

    st.markdown("---")

    # Weaknesses
    st.write("**Weaknesses** (internal disadvantages): internal issues or limitations holding you back.")
    if "swot_weaknesses" not in st.session_state:
        st.session_state["swot_weaknesses"] = ""
    col_weak_left, col_weak_right = st.columns([2,1])
    with col_weak_left:
        st.session_state["swot_weaknesses"] = st.text_area(
            label="Weaknesses",
            value=st.session_state["swot_weaknesses"],
            height=100,
            placeholder="e.g. Limited funding; High staff turnover; Outdated processes",
            help="List or separate by semicolons. These are internal negatives."
        )
    with col_weak_right:
        if st.button("AI: Suggest Weaknesses"):
            ai_text = ai_suggest_swot("Weaknesses")
            if ai_text:
                st.session_state["swot_weaknesses"] += "\n" + ai_text
                st.success("Appended AI suggestions to Weaknesses.")

    st.markdown("---")

    # Opportunities
    st.write("**Opportunities** (external positives): external trends or circumstances you can leverage.")
    if "swot_opportunities" not in st.session_state:
        st.session_state["swot_opportunities"] = ""
    col_opp_left, col_opp_right = st.columns([2,1])
    with col_opp_left:
        st.session_state["swot_opportunities"] = st.text_area(
            label="Opportunities",
            value=st.session_state["swot_opportunities"],
            height=100,
            placeholder="e.g. Emerging market; Partnerships; New tech solutions",
            help="List or separate by semicolons. External conditions you can exploit."
        )
    with col_opp_right:
        if st.button("AI: Suggest Opportunities"):
            ai_text = ai_suggest_swot("Opportunities")
            if ai_text:
                st.session_state["swot_opportunities"] += "\n" + ai_text
                st.success("Appended AI suggestions to Opportunities.")

    st.markdown("---")

    # Threats
    st.write("**Threats** (external negatives): external risks, challenges, or obstacles.")
    if "swot_threats" not in st.session_state:
        st.session_state["swot_threats"] = ""
    col_thr_left, col_thr_right = st.columns([2,1])
    with col_thr_left:
        st.session_state["swot_threats"] = st.text_area(
            label="Threats",
            value=st.session_state["swot_threats"],
            height=100,
            placeholder="e.g. Competitive rivalry; Regulatory changes; Economic downturn",
            help="List or separate by semicolons. External conditions that could cause trouble."
        )
    with col_thr_right:
        if st.button("AI: Suggest Threats"):
            ai_text = ai_suggest_swot("Threats")
            if ai_text:
                st.session_state["swot_threats"] += "\n" + ai_text
                st.success("Appended AI suggestions to Threats.")

    st.markdown("---")

    #
    # Step 3: Identify Strategies
    #
    st.subheader("Step 3: Strategies for Action")

    st.write("""
    **Exploiting Strengths & Opportunities**: e.g. Use Strength 1 to maximize Opportunity 1  
    **Mitigating Weaknesses & Threats**: e.g. Address Weakness 2 to avoid Threat 1  
    """)

    if "swot_strategies" not in st.session_state:
        st.session_state["swot_strategies"] = ""

    def ai_suggest_strategies():
        """Propose strategies for exploiting S & O, and mitigating W & T, based on user input."""
        try:
            combined_input = (
                f"Objective: {objective}\n"
                "Strengths:\n" + st.session_state["swot_strengths"] + "\n\n"
                "Weaknesses:\n" + st.session_state["swot_weaknesses"] + "\n\n"
                "Opportunities:\n" + st.session_state["swot_opportunities"] + "\n\n"
                "Threats:\n" + st.session_state["swot_threats"] + "\n\n"
                "Propose strategies for exploiting Strengths & Opportunities and mitigating Weaknesses & Threats. "
                "Semicolon-separated, no bullet points."
            )
            system_msg = {
                "role": "system",
                "content": (
                    "You are an AI that drafts recommended strategies from a SWOT analysis, focusing on S-O, W-T, etc."
                )
            }
            user_msg = {"role": "user", "content": combined_input}
            resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            return resp
        except Exception as e:
            st.error(f"AI Error: {e}")
            return ""

    col_strat_main, col_strat_button = st.columns([2,1])
    with col_strat_main:
        st.session_state["swot_strategies"] = st.text_area(
            label="Proposed Strategies",
            value=st.session_state["swot_strategies"],
            height=120,
            placeholder="e.g.\n1) Use Strength A to leverage Opportunity X\n2) Address Weakness B to avoid Threat Y",
            help="Write or paste your strategies here. S/O strategies, W/T strategies, etc."
        )
    with col_strat_button:
        if st.button("AI: Suggest Strategies"):
            strategies_text = ai_suggest_strategies()
            if strategies_text:
                st.session_state["swot_strategies"] += "\n" + strategies_text
                st.success("Appended AI strategies to the text area.")

    st.markdown("---")

    st.info("""
**Done!**  
Use this analysis as a starting point for deeper strategic planning or integration with other frameworks.
You can further refine strategies or transfer them into actionable plans.
""")

def main():
    swot_page()

if __name__ == "__main__":
    main()