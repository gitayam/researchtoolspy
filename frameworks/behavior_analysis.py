import streamlit as st
import json
from utilities.gpt import chat_gpt
from utilities.helpers import create_docx_document

def behavior_analysis_page():
    # Configure page
    st.set_page_config(page_title="Action/Behavior Analysis", layout="wide")
    st.title("Action or Behavior Analysis")
    st.markdown(
        """
        This template builds upon the latest doctrine **TM 3-53.11 Influence Process Activity: Target Audience Analysis**.
        
        Provide an in-depth analysis of a specific behavior in a particular area. The process generates analytical questions, offers draft answers, and produces a comprehensive report.
        """
    )

    # Sidebar for quick help
    st.sidebar.title("Quick Help")
    st.sidebar.info(
        "Fill in the details on the main page. Hover over input fields for tooltips. "
        "Use recommendation buttons for GPT suggestions. Generate questions, answers, and final report sequentially."
    )

    with st.expander("Template Instructions", expanded=False):
        st.markdown(
            """
            **Purpose:**  
            To build upon the latest doctrine TM 3-53.11 by providing a detailed analysis of a behavior and its context.  
            This analysis produces a shared understanding of the behavior, relevant actors, locations, obstacles, symbols, etc.
            
            **How To Use This Template:**  
            1. Replace placeholders (e.g., `BEHAVIOR_HERE`, `COUNTRY_HERE`) with your specific information.
            2. Fill in the fields below with your observations and data.
            3. Use the provided buttons to generate analytical questions, get answer suggestions, and generate a final report.
            """
        )

    # Field metadata: label, placeholder, tooltip, and input type.
    fields = {
        "action_behavior": {
            "label": "Action or Behavior",
            "placeholder": "e.g., Suspicious financial transactions",
            "tooltip": "Enter the main action or behavior to be analyzed.",
            "type": "text"
        },
        "supporting_behaviors": {
            "label": "Supporting Behaviors Required",
            "placeholder": "e.g., Data manipulation, diversion tactics",
            "tooltip": "List any supporting behaviors that enable the main behavior.",
            "type": "area"
        },
        "location": {
            "label": "Location",
            "placeholder": "e.g., Washington D.C. or a specific region",
            "tooltip": "Specify the location where the behavior occurs.",
            "type": "text"
        },
        "behavior_breakdown": {
            "label": "Behavior Breakdown and Analysis",
            "placeholder": "Detail the components and nuances of the behavior.",
            "tooltip": "Provide an in-depth breakdown of the behavior.",
            "type": "area"
        },
        "behavior_timeline": {
            "label": "Behavior Timeline",
            "placeholder": "Generate an initial timeline of events for the behavior.",
            "tooltip": "Outline the sequence of events associated with the behavior.",
            "type": "area"
        },
        "instances": {
            "label": "Historical Examples of Behavior",
            "placeholder": "List instances including who, when, where, and why.",
            "tooltip": "Provide examples and details of when the behavior has occurred.",
            "type": "area"
        },
        "supporting_timeline": {
            "label": "Timeline of Supporting Behaviors",
            "placeholder": "Chronological timeline of supporting behaviors.",
            "tooltip": "Outline the timeline for supporting actions.",
            "type": "area"
        },
        "obstacles": {
            "label": "Obstacles and Challenges",
            "placeholder": "Identify challenges to achieving the action.",
            "tooltip": "List potential obstacles and challenges.",
            "type": "area"
        },
        "associated_symbols": {
            "label": "Associated Symbols and Signals",
            "placeholder": "Enter any symbols or signals related to the behavior.",
            "tooltip": "List symbols, signals, or codes linked to the behavior.",
            "type": "area"
        },
        "required_capabilities": {
            "label": "Required Capabilities",
            "placeholder": "e.g., Physical, Cognitive, Social, Economic capabilities required.",
            "tooltip": "Specify the capabilities necessary for the behavior.",
            "type": "area"
        },
        "social_norms": {
            "label": "Social Norms and Pressures",
            "placeholder": "Describe any societal norms or pressures involved.",
            "tooltip": "Detail the social context influencing the behavior.",
            "type": "area"
        },
        "motivations": {
            "label": "Motivations and Drivers",
            "placeholder": "What drives individuals to engage in this behavior?",
            "tooltip": "Explain the motivations behind the behavior.",
            "type": "area"
        },
        "consequences": {
            "label": "Consequences and Outcomes",
            "placeholder": "List consequences or outcomes of the behavior.",
            "tooltip": "Describe the outcomes and effects of the behavior.",
            "type": "area"
        },
        "environmental_factors": {
            "label": "Environmental and Situational Factors",
            "placeholder": "Detail any environmental or situational factors influencing the behavior.",
            "tooltip": "Provide context on environmental influences.",
            "type": "area"
        },
        "impact_strategies": {
            "label": "Strategies That Have Impacted the Behavior",
            "placeholder": "List strategies that have affected the behavior.",
            "tooltip": "Describe strategies and their impact.",
            "type": "area"
        },
        "primary_ta": {
            "label": "Potential Primary Target Audiences",
            "placeholder": "List primary target audiences.",
            "tooltip": "Specify the primary audience affected or targeted.",
            "type": "area"
        },
        "secondary_ta": {
            "label": "Potential Secondary Target Audiences",
            "placeholder": "List secondary target audiences.",
            "tooltip": "Specify secondary audiences involved.",
            "type": "area"
        },
        "engaging_actors": {
            "label": "Engaging Actors",
            "placeholder": "Who is engaging in the behavior?",
            "tooltip": "List the actors involved in the behavior.",
            "type": "area"
        },
        "beneficiaries": {
            "label": "Beneficiaries",
            "placeholder": "Who benefits from the behavior?",
            "tooltip": "Identify the beneficiaries.",
            "type": "area"
        },
        "harmed_parties": {
            "label": "Harmed Parties",
            "placeholder": "Who is harmed or negatively impacted?",
            "tooltip": "List parties that suffer adverse effects.",
            "type": "area"
        },
        "influencers": {
            "label": "Influencers and Stakeholders",
            "placeholder": "List influential actors and stakeholders.",
            "tooltip": "Identify influencers and stakeholders.",
            "type": "area"
        },
        "enablers": {
            "label": "Enablers and Supporters",
            "placeholder": "Who supports or enables the behavior?",
            "tooltip": "Identify enablers and supporters.",
            "type": "area"
        },
        "opposers": {
            "label": "Opposers and Detractors",
            "placeholder": "List those opposing the behavior.",
            "tooltip": "Identify opposers and detractors.",
            "type": "area"
        },
        "additional_notes": {
            "label": "Additional Notes",
            "placeholder": "Enter any additional notes or observations.",
            "tooltip": "Any further details you wish to add.",
            "type": "area"
        },
        "cultural_considerations": {
            "label": "Cultural Considerations",
            "placeholder": "List any cultural factors or considerations.",
            "tooltip": "Detail cultural considerations relevant to the behavior.",
            "type": "area"
        },
        "legal_ethics": {
            "label": "Legal and Ethical Implications",
            "placeholder": "Describe legal and ethical implications.",
            "tooltip": "Outline any legal or ethical issues.",
            "type": "area"
        }
    }

    analysis_details = {}
    st.header("Step 0: Enter Behavior Analysis Details")

    # Input Fields Container
    with st.container():
        for key, meta in fields.items():
            col1, col2 = st.columns([3, 1])
            with col1:
                if meta["type"] == "text":
                    analysis_details[key] = st.text_input(
                        meta["label"],
                        placeholder=meta["placeholder"],
                        key=key,
                        help=meta["tooltip"]
                    )
                else:
                    analysis_details[key] = st.text_area(
                        meta["label"],
                        placeholder=meta["placeholder"],
                        key=key,
                        height=100,
                        help=meta["tooltip"]
                    )
            with col2:
                # GPT recommendation buttons for selected fields
                if key in [
                    "behavior_timeline", "supporting_behaviors", "supporting_timeline",
                    "instances", "obstacles", "associated_symbols"
                ]:
                    if st.button(f"Recommend", key=f"btn_{key}", help=f"Get GPT suggestion for {meta['label']}"):
                        with st.spinner(f"Generating recommendation for {meta['label']}..."):
                            prompt = ""
                            if key == "behavior_timeline":
                                prompt = (
                                    f"Based on the behavior '{analysis_details.get('action_behavior', '')}' "
                                    f"and location '{analysis_details.get('location', '')}', generate a detailed initial timeline of events. "
                                    "List all smaller actions required to achieve this behavior, sequencing them step-by-step."
                                )
                            elif key == "supporting_behaviors":
                                prompt = (
                                    f"Identify supporting behaviors required to achieve the action '{analysis_details.get('action_behavior', '')}'. "
                                    "Provide clear recommendations."
                                )
                            elif key == "supporting_timeline":
                                prompt = (
                                    f"Based on the action '{analysis_details.get('action_behavior', '')}', generate a timeline of supporting behaviors "
                                    "that are necessary to facilitate this action. List them in sequential order."
                                )
                            elif key == "instances":
                                prompt = (
                                    f"Provide historical examples for the behavior '{analysis_details.get('action_behavior', '')}' detailing who, when, where, and why it occurred."
                                )
                            elif key == "obstacles":
                                prompt = (
                                    f"List potential obstacles and challenges to achieving the action '{analysis_details.get('action_behavior', '')}'. "
                                    "Provide detailed descriptions."
                                )
                            elif key == "associated_symbols":
                                prompt = (
                                    f"List symbols and signals that are associated with the behavior '{analysis_details.get('action_behavior', '')}'. "
                                    "Include contextual explanations if possible."
                                )
                            system_msg = {"role": "system", "content": "You are an expert analyst in behavior analysis."}
                            user_msg = {"role": "user", "content": prompt}
                            suggestion = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                            st.info(f"GPT Recommendation for {meta['label']}:\n{suggestion}")

    # Step 1: Generate Analytical Questions
    st.markdown("---")
    st.header("Step 1: Generate Analytical Questions")
    if st.button("Generate Analysis Questions"):
        # Ensure mandatory fields are filled
        if not analysis_details["action_behavior"] or not analysis_details["location"]:
            st.warning("Please provide at least the Action/Behavior and Location details before generating questions.")
        else:
            context = "\n".join(
                f"{meta['label']}: {analysis_details.get(key, '').strip()}" 
                for key, meta in fields.items() if analysis_details.get(key, "").strip()
            )
            prompt = (
                "Based on the following Action or Behavior Analysis data, generate a list of 5 analytical questions that help refine "
                "the understanding of the behavior, identify potential gaps, and explore challenges. Each question should start with an interrogative word (what, how, why, etc.). "
                "Return the list as a JSON array.\n\n"
                f"Data:\n{context}"
            )
            system_msg = {"role": "system", "content": "You are a strategic analyst specialized in behavior analysis."}
            user_msg = {"role": "user", "content": prompt}
            with st.spinner("Generating analytical questions..."):
                response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            try:
                questions = json.loads(response)
                st.session_state["behavior_questions"] = questions
                st.success("Analytical questions generated successfully!")
            except Exception as e:
                st.error(f"Error parsing questions from AI response: {e}")

    # Step 1b: Display Questions & Collect Answers
    if "behavior_questions" in st.session_state:
        st.markdown("---")
        st.header("Analysis Questions and Answers")
        for idx, question in enumerate(st.session_state["behavior_questions"], start=1):
            st.subheader(f"Question {idx}:")
            st.write(question)
            answer_key = f"behavior_answer_{idx}"
            st.text_area(f"Your answer for Question {idx}:", key=answer_key, height=100)
            if st.button(f"Suggest Answer for Question {idx}", key=f"suggest_btn_{idx}", help="Get GPT generated answer suggestion"):
                suggestion_prompt = (
                    "Based on the following Action or Behavior Analysis data and the question provided, generate a draft answer or template that can guide the analysis. "
                    "Ensure the answer is clear and actionable.\n\n"
                    "Data:\n" +
                    "\n".join(
                        f"{meta['label']}: {analysis_details.get(key, '').strip()}" 
                        for key, meta in fields.items() if analysis_details.get(key, "").strip()
                    ) +
                    f"\n\nQuestion: {question}"
                )
                system_msg = {"role": "system", "content": "You are an expert analyst in behavior analysis."}
                user_msg = {"role": "user", "content": suggestion_prompt}
                with st.spinner(f"Generating answer suggestion for Question {idx}..."):
                    suggestion = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.info(f"Suggested Answer for Question {idx}:\n{suggestion}")

    # Step 2: Generate Comprehensive Analysis Report
    st.markdown("---")
    st.header("Step 2: Generate Comprehensive Analysis Report")
    if st.button("Generate Analysis Report"):
        report_context = "Action or Behavior Analysis Data:\n"
        for key, meta in fields.items():
            value = analysis_details.get(key, "").strip()
            if value:
                report_context += f"{meta['label']}: {value}\n"
        if "behavior_questions" in st.session_state:
            report_context += "\nAnalysis Q&A:\n"
            for idx, question in enumerate(st.session_state["behavior_questions"], start=1):
                answer = st.session_state.get(f"behavior_answer_{idx}", "")
                report_context += f"Q{idx}: {question}\nA{idx}: {answer}\n"
        report_prompt = (
            "Based on the following Action or Behavior Analysis data and the corresponding Q&A, generate a comprehensive report that summarizes "
            "the key insights, highlights potential gaps, and provides recommendations for further action. Return the report as plain text.\n\n"
            f"{report_context}"
        )
        system_msg = {"role": "system", "content": "You are a strategic behavior analyst."}
        user_msg = {"role": "user", "content": report_prompt}
        with st.spinner("Generating analysis report..."):
            report = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
        st.session_state["report_context"] = report_context
        st.session_state["analysis_report"] = report
        st.subheader("Analysis Report")
        st.text_area("Generated Report", value=report, height=300)
        st.download_button("Download Report as Text", report, file_name="behavior_analysis_report.txt", mime="text/plain")

    # Export Analysis as DOCX
    st.markdown("---")
    st.subheader("Export Analysis")
    title_doc = st.text_input("Enter export file name for behavior analysis", "behavior_analysis")
    if st.button("Export Behavior Analysis as DOCX Document"):
        if "report_context" not in st.session_state or "analysis_report" not in st.session_state:
            st.error("Please generate the analysis report before exporting.")
        else:
            sections = {
                "Action or Behavior Analysis Data": st.session_state["report_context"],
                "Analysis Questions and Answers": "\n".join(
                    f"Q{idx}: {question}\nA{idx}: {st.session_state.get(f'behavior_answer_{idx}', '')}"
                    for idx, question in enumerate(st.session_state["behavior_questions"], start=1)
                ),
                "Analysis Report": st.session_state["analysis_report"]
            }
            docx_file = create_docx_document(title_doc, sections)
            st.download_button(
                label="Download DOCX",
                data=docx_file,
                file_name=f"{title_doc}.docx",
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )

if __name__ == "__main__":
    behavior_analysis_page()