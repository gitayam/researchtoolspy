# /frameworks/behavior_analysis.py
import streamlit as st
import json
from utilities.gpt import chat_gpt
from utilities.helpers import create_docx_document

def behavior_analysis_page():
    # Initialize session state keys to avoid KeyErrors.
    if "behavior_questions" not in st.session_state:
        st.session_state["behavior_questions"] = []
    
    st.markdown(
        """
        This template builds upon the latest doctrine **TM 3-53.11 Influence Process Activity: Target Audience Analysis**.
        
        Provide an in-depth analysis of a specific behavior, map out its timeline, and identify gaps or required skills/opportunities.
        """
    )

    # Sidebar help
    st.sidebar.title("Quick Help")
    st.sidebar.info(
        "Complete each section by entering data or clicking the 'Recommend' buttons for GPT suggestions. "
        "The form is organized into sections to help you build a timeline, analyze behavior details, and identify supporting elements."
    )

    with st.expander("Template Instructions", expanded=False):
        st.markdown(
            """
            **Purpose:**  
            Provide a detailed analysis and timeline of a behavior—including supporting actions, gaps in capabilities, and opportunities for intervention.
            
            **How To Use:**  
            1. Replace placeholders with your specific information.
            2. Enter data in each section. Use the recommendation buttons to auto-populate fields with expert suggestions.
            3. Generate analytical questions, draft answers, and produce a comprehensive report.
            """
        )

    # Define field metadata (label, GPT prompt, input type).
    field_info = {
        "action_behavior": {
            "label": "Action or Behavior",
            "prompt": "Describe the action or behavior to be analyzed. Provide context and clear examples in a concise summary.",
            "type": "text"
        },
        "location": {
            "label": "Location where the behavior occurs",
            "prompt": "Specify the location (city, region, or country) where the behavior is observed.",
            "type": "text"
        },
        "supporting_behaviors": {
            "label": "Supporting Behaviors Required",
            "prompt": "Identify the supporting behaviors that enable the main action. Return as a numbered list. Format each line as: '#. [behavior]' with no additional commentary.",
            "type": "textarea"
        },
        "behavior_breakdown": {
            "label": "Behavior Breakdown and Analysis",
            "prompt": "Return a numbered list of supporting behaviors required to achieve the main behavior. Format each line as: '#. [behavior]' with no additional commentary.",
            "type": "textarea"
        },
        "behavior_timeline": {
            "label": "Behavior Timeline (Initial Timeline)",
            "prompt": "Generate a detailed timeline of events for the behavior as a numbered list. Format each line as: '#. [event]' with no additional commentary.",
            "type": "textarea"
        },
        "instances": {
            "label": "Historical Examples (Who, When, Where, Why)",
            "prompt": "Provide historical examples of the behavior. Return as numbered list. Format each line as: '#. [example]' with no additional commentary.",
            "type": "textarea"
        },
        "obstacles": {
            "label": "Obstacles and Challenges",
            "prompt": "List potential obstacles and challenges as a numbered list. Format each line as: '#. [obstacle]' with no additional commentary.",
            "type": "textarea"
        },
        "associated_symbols": {
            "label": "Associated Symbols and Signals",
            "prompt": "List the symbols and signals related to the behavior as a numbered list. Format each line as: '#. [symbol]' with no additional commentary.",
            "type": "textarea"
        },
        "required_capabilities": {
            "label": "Required Capabilities (Physical, Cognitive, Social, Economic)",
            "prompt": "List and describe the capabilities needed to perform the behavior. Format each line as: '#. [capability]' with no additional commentary.",
            "type": "textarea"
        },
        "social_norms": {
            "label": "Social Norms and Pressures",
            "prompt": "Describe the societal norms and pressures related to this behavior. Format each line as: '#. [norm]' with no additional commentary.",
            "type": "textarea"
        },
        "motivations": {
            "label": "Motivations and Drivers",
            "prompt": "Outline the motivations behind the behavior, including psychological, social, and economic factors. Format each line as: '#. [motivation]' with no additional commentary.",
            "type": "textarea"
        },
        "consequences": {
            "label": "Consequences and Outcomes",
            "prompt": "Discuss the outcomes (both positive and negative) of the behavior. Format each line as: '#. [outcome]' with no additional commentary.",
            "type": "textarea"
        },
        "environmental_factors": {
            "label": "Environmental and Situational Factors",
            "prompt": "Identify environmental or situational factors (political, cultural, etc.) that influence the behavior. Format each line as: '#. [factor]' with no additional commentary.",
            "type": "textarea"
        },
        "impact_strategies": {
            "label": "Strategies That Impacted the Behavior",
            "prompt": "List strategies or interventions that have increased or decreased the behavior. Format each line as: '#. [strategy]' with no additional commentary.",
            "type": "textarea"
        },
        "primary_ta": {
            "label": "Potential Primary Target Audiences",
            "prompt": "Identify the primary target audiences most affected by this behavior.",
            "type": "textarea"
        },
        "secondary_ta": {
            "label": "Potential Secondary Target Audiences",
            "prompt": "Identify secondary audiences that may be influenced or engaged by the behavior.",
            "type": "textarea"
        },
        "engaging_actors": {
            "label": "Engaging Actors",
            "prompt": "List the individuals or groups engaging in the behavior.",
            "type": "textarea"
        },
        "beneficiaries": {
            "label": "Beneficiaries",
            "prompt": "Describe who benefits from the behavior, directly or indirectly.",
            "type": "textarea"
        },
        "harmed_parties": {
            "label": "Harmed Parties",
            "prompt": "List the parties that are negatively impacted by the behavior.",
            "type": "textarea"
        },
        "influencers": {
            "label": "Influencers and Stakeholders",
            "prompt": "Identify key influencers or stakeholders related to the behavior.",
            "type": "textarea"
        },
        "enablers": {
            "label": "Enablers and Supporters",
            "prompt": "Discuss the enablers that facilitate the behavior.",
            "type": "textarea"
        },
        "opposers": {
            "label": "Opposers and Detractors",
            "prompt": "Identify those who oppose or detract from the behavior.",
            "type": "textarea"
        },
        "additional_notes": {
            "label": "Additional Notes",
            "prompt": "Provide any extra observations or context.",
            "type": "textarea"
        },
        "cultural_considerations": {
            "label": "Cultural Considerations",
            "prompt": "Discuss cultural factors that influence the behavior.",
            "type": "textarea"
        },
        "legal_ethics": {
            "label": "Legal and Ethical Implications",
            "prompt": "Outline the legal and ethical implications relevant to the behavior.",
            "type": "textarea"
        }
    }

    # Organize fields into logical sections.
    sections = {
        "Basic Info": ["action_behavior", "location"],
        "Behavior Details": ["behavior_breakdown", "supporting_behaviors", "behavior_timeline", "instances", "obstacles", "associated_symbols"],
        "Capabilities & Context": ["required_capabilities", "social_norms", "motivations", "consequences", "environmental_factors", "impact_strategies"],
        "Stakeholders": ["primary_ta", "secondary_ta", "engaging_actors", "beneficiaries", "harmed_parties", "influencers", "enablers", "opposers"],
        "Additional Considerations": ["additional_notes", "cultural_considerations", "legal_ethics"]
    }

    analysis_details = {}

    # Render each section in an expander for a cleaner, form-like UI.
    for section, keys in sections.items():
        with st.expander(section, expanded=True):
            for key in keys:
                info = field_info[key]
                # Show the GPT recommendation button above each field.
                if st.button(f"Recommend for '{info['label']}'", key=f"btn_{key}"):
                    # Check that the mandatory "action_behavior" field has been defined.
                    if not st.session_state.get("action_behavior", "").strip():
                        st.warning("Please provide the Action or Behavior detail before generating recommendations.")
                    else:
                        with st.spinner(f"Generating recommendation for {info['label']}..."):
                            # Build a context string including the most important fields.
                            context_parts = []
                            # Mandatory: add 'action_behavior'.
                            if st.session_state.get("action_behavior", "").strip():
                                context_parts.append(
                                    f"{field_info['action_behavior']['label']}: {st.session_state.get('action_behavior')}"
                                )
                            # If 'location' is defined, include it.
                            if st.session_state.get("location", "").strip():
                                context_parts.append(
                                    f"{field_info['location']['label']}: {st.session_state.get('location')}"
                                )
                            # Optionally add any other field that has been defined (non-empty)
                            for cf, value in st.session_state.items():
                                if (
                                    cf in field_info
                                    and cf not in ["action_behavior", "location", key]
                                    and isinstance(value, str)
                                    and value.strip() != ""
                                ):
                                    context_parts.append(f"{field_info[cf]['label']}: {value}")
                            context_str = "\n".join(context_parts) if context_parts else "No additional context provided."

                            # Compose a full prompt including the gathered context.
                            full_prompt = (
                                f"Using the context below:\n{context_str}\n\n"
                                f"Now, please provide a suggestion for the '{info['label']}' field. {info['prompt']}"
                            )
                            system_msg = {
                                "role": "system",
                                "content": "You are an expert analyst in behavior analysis."
                            }
                            user_msg = {"role": "user", "content": full_prompt}
                            suggestion = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                            st.session_state[key] = suggestion.strip()
                            st.success(f"'{info['label']}' auto-populated.")
                            st.rerun()
                # Render the input widget.
                if info["type"] == "text":
                    analysis_details[key] = st.text_input(
                        info["label"],
                        key=key,
                        value=st.session_state.get(key, ""),
                        help=info["prompt"]
                    )
                else:
                    analysis_details[key] = st.text_area(
                        info["label"],
                        key=key,
                        height=100,
                        value=st.session_state.get(key, ""),
                        help=info["prompt"]
                    )

    st.markdown("---")
    st.header("Step 1: Generate Analytical Questions")
    if st.button("Generate Analysis Questions"):
        if not analysis_details["action_behavior"] or not analysis_details["location"]:
            st.warning("Please provide at least the Action/Behavior and Location details before generating questions.")
        else:
            context = "\n".join(
                f"{field_info[key]['label']}: {analysis_details.get(key, '').strip()}"
                for key in field_info if analysis_details.get(key, "").strip()
            )
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
                            f"{field_info[key]['label']}: {analysis_details.get(key, '').strip()}"
                            for key in field_info if analysis_details.get(key, "").strip()
                        ) +
                        f"\n\nQuestion: {question}"
                    )
                    system_msg = {"role": "system", "content": "You are an expert analyst in behavior analysis."}
                    user_msg = {"role": "user", "content": suggestion_prompt}
                    suggestion = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.session_state[f"behavior_answer_{idx}"] = suggestion.strip()
                    st.success(f"Answer for Question {idx} auto-populated.")
                    st.rerun

    st.markdown("---")
    st.header("Step 2: Generate Comprehensive Analysis Report")
    if st.button("Generate Analysis Report"):
        report_context = "Action or Behavior Analysis Data:\n"
        for key in field_info:
            value = analysis_details.get(key, "").strip()
            if value:
                report_context += f"{field_info[key]['label']}: {value}\n"
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