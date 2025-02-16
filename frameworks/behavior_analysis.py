import streamlit as st
import json
from utilities.gpt import chat_gpt
from utilities.helpers import create_docx_document

def behavior_analysis_page():
    # Initialize session state keys to avoid KeyErrors.
    if "behavior_questions" not in st.session_state:
        st.session_state["behavior_questions"] = []
    
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
        "Use the recommendation buttons to auto-populate input fields with GPT suggestions."
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

    st.header("Enter Behavior Analysis Details")
    # Define the fields in order and with updated labels.
    fields = {
        "action_behavior": "Action or Behavior",
        "location": "Location where the behavior occurs",
        "supporting_behaviors": "Supporting Behaviors Required",
        "behavior_breakdown": "Behavior Breakdown and Analysis",
        "behavior_timeline": "Behavior Timeline (Generate initial timeline)",
        "instances": "Historical Examples of Behavior (who, when, where, why)",
        "obstacles": "Obstacles and Challenges to Achieving the Action",
        "associated_symbols": "Associated Symbols and Signals Associated with the Behavior",
        "required_capabilities": "Required Capabilities (Physical, Cognitive, Social, Economic)",
        "social_norms": "Social Norms and Pressures",
        "motivations": "Motivations and Drivers",
        "consequences": "Consequences and Outcomes",
        "environmental_factors": "Environmental and Situational Factors",
        "impact_strategies": "Strategies That Have Impacted the Behavior",
        "primary_ta": "Potential Primary Target Audiences",
        "secondary_ta": "Potential Secondary Target Audiences",
        "engaging_actors": "Engaging Actors",
        "beneficiaries": "Beneficiaries",
        "harmed_parties": "Harmed Parties",
        "influencers": "Influencers and Stakeholders",
        "enablers": "Enablers and Supporters",
        "opposers": "Opposers and Detractors",
        "additional_notes": "Additional Notes",
        "cultural_considerations": "Cultural Considerations",
        "legal_ethics": "Legal and Ethical Implications"
    }

    # Define tailored GPT prompts for each field.
    field_prompts = {
        "action_behavior": "Describe the action or behavior to be analyzed. Provide context and clear examples in a concise summary.",
        "location": "Specify the location or region where the behavior occurs. Include details such as city, region, or country.",
        "supporting_behaviors": "Identify the supporting behaviors required to achieve the main action. Return the list as a numbered list without additional narrative.",
        "behavior_breakdown": "Provide a detailed breakdown of the behavior, including its components, phases, and influencing factors.",
        "behavior_timeline": "Generate a detailed initial timeline of events for the behavior as a numbered list.",
        "instances": "Provide historical examples of the behavior, detailing who, when, where, and why. Return as bullet points.",
        "obstacles": "List potential obstacles and challenges to achieving the action as a numbered list.",
        "associated_symbols": "List the symbols and signals associated with the behavior as a numbered list.",
        "required_capabilities": "List and describe the required capabilities (physical, cognitive, social, economic) needed to perform the behavior, with examples if possible.",
        "social_norms": "Describe the social norms and pressures associated with this behavior, including any societal influences.",
        "motivations": "Outline the motivations and drivers behind the behavior, including psychological, social, and economic factors.",
        "consequences": "Discuss the potential consequences and outcomes of the behavior, highlighting both positive and negative impacts.",
        "environmental_factors": "Identify any environmental and situational factors that influence the behavior, such as political, economic, or cultural aspects.",
        "impact_strategies": "List strategies that have impacted the behavior, providing examples of interventions that increased or decreased it.",
        "primary_ta": "Identify potential primary target audiences related to this behavior. Provide specific details about the most affected groups.",
        "secondary_ta": "Identify potential secondary target audiences that may be influenced by or engage with the behavior.",
        "engaging_actors": "List the actors engaging in the behavior, including individuals, groups, or organizations involved.",
        "beneficiaries": "Describe the beneficiaries of the behavior, noting who gains advantage from it either directly or indirectly.",
        "harmed_parties": "List the parties that are harmed or negatively impacted by the behavior, with brief context if needed.",
        "influencers": "Identify key influencers and stakeholders associated with the behavior. Specify who holds sway over opinions or actions.",
        "enablers": "Discuss the enablers and supporters that facilitate the behavior. Identify who or what contributes to its occurrence.",
        "opposers": "Identify the opposers and detractors of the behavior. Specify who or what resists or challenges it.",
        "additional_notes": "Provide any additional notes, observations, or context relevant to a comprehensive analysis of the behavior.",
        "cultural_considerations": "Discuss any cultural considerations relevant to the behavior. Explain how cultural factors influence its perception and execution.",
        "legal_ethics": "Outline the legal and ethical implications related to the behavior, including relevant laws, regulations, and ethical considerations."
    }

    analysis_details = {}

    # Render GPT recommendation button above each input field, then render the input widget.
    for key, label in fields.items():
        # Show the GPT recommendation button above the input field.
        if st.button(f"Recommend data for '{label}'", key=f"btn_{key}"):
            with st.spinner(f"Generating recommendation for {label}..."):
                prompt = f"Please provide a suggestion for the '{label}' field. {field_prompts.get(key, '')}"
                system_msg = {"role": "system", "content": "You are an expert analyst in behavior analysis."}
                user_msg = {"role": "user", "content": prompt}
                suggestion = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.session_state[key] = suggestion.strip()
                st.success(f"Input field '{label}' auto-populated.")
                st.rerun()

        # Render the input widget with the current value.
        if key in ["action_behavior", "location"]:
            analysis_details[key] = st.text_input(
                label,
                key=key,
                value=st.session_state.get(key, ""),
                help=field_prompts.get(key, "")
            )
        else:
            analysis_details[key] = st.text_area(
                label,
                key=key,
                height=100,
                value=st.session_state.get(key, ""),
                help=field_prompts.get(key, "")
            )

    st.markdown("---")
    st.header("Step 1: Generate Analytical Questions")
    if st.button("Generate Analysis Questions"):
        if not analysis_details["action_behavior"] or not analysis_details["location"]:
            st.warning("Please provide at least the Action/Behavior and Location details before generating questions.")
        else:
            context = ""
            for key, label in fields.items():
                value = analysis_details.get(key, "").strip()
                if value:
                    context += f"{label}: {value}\n"
            prompt = (
                "Based on the following Action or Behavior Analysis data, generate a list of 5 analytical questions that help refine "
                "the understanding of the behavior, identify potential gaps, and explore challenges. Each question should start with an interrogative word (what, how, why, etc.). "
                "Return the list as a JSON array.\n\n"
                f"Data:\n{context}"
            )
            system_msg = {"role": "system", "content": "You are a strategic analyst specialized in behavior analysis."}
            user_msg = {"role": "user", "content": prompt}
            response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            try:
                questions = json.loads(response)
                st.session_state["behavior_questions"] = questions
                st.success("Analytical questions generated successfully!")
            except Exception as e:
                st.error(f"Error parsing questions from AI response: {e}")

    questions_list = st.session_state.get("behavior_questions", [])
    if questions_list:
        st.header("Analysis Questions and Answers")
        for idx, question in enumerate(questions_list, start=1):
            st.subheader(f"Question {idx}:")
            st.write(question)
            answer_key = f"behavior_answer_{idx}"
            st.text_area(
                f"Your answer for Question {idx}:",
                key=answer_key,
                height=100,
                value=st.session_state.get(answer_key, "")
            )
            if st.button(f"Suggest Answer for Question {idx}", key=f"suggest_btn_{idx}"):
                with st.spinner(f"Generating answer suggestion for Question {idx}..."):
                    suggestion_prompt = (
                        "Based on the following Action or Behavior Analysis data and the question provided, generate a draft answer that is clear and actionable. "
                        "Return only the answer with no additional commentary.\n\n"
                        "Data:\n" +
                        "\n".join(
                            f"{label}: {analysis_details.get(key, '').strip()}"
                            for key, label in fields.items() if analysis_details.get(key, "").strip()
                        ) +
                        f"\n\nQuestion: {question}"
                    )
                    system_msg = {"role": "system", "content": "You are an expert analyst in behavior analysis."}
                    user_msg = {"role": "user", "content": suggestion_prompt}
                    suggestion = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.session_state[f"behavior_answer_{idx}"] = suggestion.strip()
                    st.success(f"Answer for Question {idx} auto-populated.")
                    st.rerun()

    st.markdown("---")
    st.header("Step 2: Generate Comprehensive Analysis Report")
    if st.button("Generate Analysis Report"):
        report_context = "Action or Behavior Analysis Data:\n"
        for key, label in fields.items():
            value = analysis_details.get(key, "").strip()
            if value:
                report_context += f"{label}: {value}\n"
        if questions_list:
            report_context += "\nAnalysis Q&A:\n"
            for idx, question in enumerate(questions_list, start=1):
                answer = st.session_state.get(f"behavior_answer_{idx}", "")
                report_context += f"Q{idx}: {question}\nA{idx}: {answer}\n"
        
        report_prompt = (
            "Based on the following Action or Behavior Analysis data and the corresponding Q&A, generate a comprehensive report that summarizes "
            "the key insights, highlights potential gaps, and provides recommendations for further action. Return the report as plain text.\n\n"
            f"{report_context}"
        )
        system_msg = {"role": "system", "content": "You are a strategic behavior analyst."}
        user_msg = {"role": "user", "content": report_prompt}
        report = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
        st.subheader("Analysis Report")
        st.text_area("Generated Report", value=report, height=300)
        st.download_button("Download Report as Text", report, file_name="behavior_analysis_report.txt", mime="text/plain")
        st.session_state["report_context"] = report_context  # Save for export

    st.markdown("---")
    st.subheader("Export Analysis")
    title_doc = st.text_input("Enter export file name for behavior analysis", "behavior_analysis")
    if st.button("Export Behavior Analysis as DOCX Document"):
        if "report_context" not in st.session_state or "behavior_questions" not in st.session_state:
            st.error("Please generate the analysis report before exporting.")
        else:
            sections = {
                "Action or Behavior Analysis Data": st.session_state["report_context"],
                "Analysis Questions and Answers": "\n".join(
                    f"Q{idx}: {question}\nA{idx}: {st.session_state.get(f'behavior_answer_{idx}', '')}"
                    for idx, question in enumerate(st.session_state["behavior_questions"], start=1)
                ),
                "Analysis Report": st.session_state["report_context"]
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