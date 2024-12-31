# /researchtools_streamlit/pages/SWOT.py

import streamlit as st
from dotenv import load_dotenv
from utilities.utils_openai import chat_gpt  # or any AI helper function
from xhtml2pdf import pisa  # The pure-Python PDF converter
import io

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
                st.experimental_rerun()

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
                st.experimental_rerun()

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
                st.experimental_rerun()

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
                st.experimental_rerun()

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
                st.experimental_rerun()

    st.markdown("---")

    # Export to PDF
    st.subheader("Export SWOT Analysis as PDF")

    def create_swot_html_report(objective, strengths, weaknesses, opportunities, threats, strategies):
        """Generate an HTML snippet showing the SWOT analysis in a report format."""
        def to_list(text):
            if ";" in text:
                items = [x.strip() for x in text.split(";") if x.strip()]
            else:
                items = [x.strip() for x in text.split("\n") if x.strip()]
            bullet_html = "".join(f"<li>{item}</li>" for item in items)
            return bullet_html or "<li>(None)</li>"

        strengths_html = to_list(strengths)
        weaknesses_html = to_list(weaknesses)
        opportunities_html = to_list(opportunities)
        threats_html = to_list(threats)
        strategies_html = to_list(strategies)

        html = f"""
        <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            h2   {{ text-align: center; }}
            table{{ width: 100%; border-collapse: collapse; }}
            td   {{ border: 1px solid #ddd; vertical-align: top; padding: 10px; }}
            th   {{ border: 1px solid #ddd; background: #f2f2f2; padding: 10px; }}
            ul   {{ margin: 0; padding: 0 0 0 20px; }}
          </style>
        </head>
        <body>
          <h2>SWOT Analysis Report</h2>
          <h3>Objective</h3>
          <p>{objective}</p>
          <table>
            <tr>
              <th>Strengths</th>
              <th>Weaknesses</th>
            </tr>
            <tr>
              <td><ul>{strengths_html}</ul></td>
              <td><ul>{weaknesses_html}</ul></td>
            </tr>
            <tr>
              <th>Opportunities</th>
              <th>Threats</th>
            </tr>
            <tr>
              <td><ul>{opportunities_html}</ul></td>
              <td><ul>{threats_html}</ul></td>
            </tr>
          </table>
          <h3>Strategies for Action</h3>
          <ul>{strategies_html}</ul>
        </body>
        </html>
        """
        return html

    def convert_html_to_pdf(source_html):
        """Convert HTML to PDF using xhtml2pdf."""
        output = io.BytesIO()
        pisa_status = pisa.CreatePDF(io.StringIO(source_html), dest=output)
        return output.getvalue() if not pisa_status.err else None

    if st.button("Export SWOT Analysis to PDF"):
        # Generate HTML from current SWOT data
        swot_html = create_swot_html_report(
            objective=objective,
            strengths=st.session_state["swot_strengths"],
            weaknesses=st.session_state["swot_weaknesses"],
            opportunities=st.session_state["swot_opportunities"],
            threats=st.session_state["swot_threats"],
            strategies=st.session_state["swot_strategies"]
        )

        # Convert HTML to PDF
        pdf_bytes = convert_html_to_pdf(swot_html)
        if pdf_bytes:
            # Provide download
            st.download_button(
                label="Download SWOT Analysis PDF",
                data=pdf_bytes,
                file_name="SWOT-Analysis.pdf",
                mime="application/pdf"
            )
        else:
            st.error("Error generating PDF.")

    st.info("Use the 'Export to PDF' button to download your SWOT analysis as a PDF.")

    st.info("""
**Done!**  
Use this analysis as a starting point for deeper strategic planning or integration with other frameworks.
You can further refine strategies or transfer them into actionable plans.
""")

def main():
    swot_page()

if __name__ == "__main__":
    main()