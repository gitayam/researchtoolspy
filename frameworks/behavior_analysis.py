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
        
        Provide an in-depth analysis of a specific behavior, map out its timeline, and identify gaps, requirements, and implications using the COM‑B framework.
        """
    )

    # Sidebar help
    st.sidebar.title("Quick Help")
    st.sidebar.info(
        "Complete each section by entering data or clicking the 'Recommend' buttons for GPT suggestions. "
        "The form is organized into sections to help you capture basic details, analyze COM‑B determinants, "
        "build a timeline, and consider stakeholders and implications."
    )

    with st.expander("Template Instructions", expanded=False):
        st.markdown(
            """
            **Purpose:**  
            Provide a detailed analysis of a behavior – focusing on its requirements (capability, opportunity, motivation) and implications – and map out a timeline to identify gaps and opportunities for intervention.
            
            **How To Use:**  
            1. Replace placeholders with your specific information.
            2. Enter data in each section. Use the recommendation buttons to auto-populate fields with expert COM‑B–informed suggestions.
            3. Generate analytical questions, draft answers, and produce a comprehensive report.
            """
        )

    # Define field metadata (label, GPT prompt, input type)
    field_info = {
        # Basic Info
        "objective_effect": {
            "label": "Objective or Effect",
            "prompt": "Describe the overall objective and effect. A behavior is an action or set of actions that are intended to impact partially or fully a specific objective. The effect is the outcome of one or many behaviors.",
            "type": "text"
        },
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
        # Behavior Details
        "behavior_breakdown": {
            "label": "Behavior Breakdown and Analysis",
            "prompt": "Describe how the behavior unfolds and list supporting steps as a numbered list.",
            "type": "textarea"
        },
        "supporting_behaviors": {
            "label": "Supporting Behaviors Required",
            "prompt": "List the supporting behaviors that enable the main action as a numbered list.",
            "type": "textarea"
        },
        "behavior_timeline": {
            "label": "Behavior Timeline (Initial Timeline)",
            "prompt": "Generate a detailed timeline of events for the behavior as a numbered list. Use COM‑B language to note when capability, opportunity, and motivation factors come into play.",
            "type": "textarea"
        },
        "instances": {
            "label": "Historical Examples (Who, When, Where, Why)",
            "prompt": "Provide historical examples of the behavior as a numbered list.",
            "type": "textarea"
        },
        "obstacles": {
            "label": "Obstacles and Challenges",
            "prompt": "List potential obstacles and challenges as a numbered list.",
            "type": "textarea"
        },
        "associated_symbols": {
            "label": "Associated Symbols and Signals",
            "prompt": "Provide a numbered list of the symbolic objects—such as banners, placards, icons, or other visual cues—that not only represent the behavior but also carry deeper material and semiotic significance. Consider how these objects function as targets, components, or stimuli in contentious politics, reflecting both their tangible and symbolic roles. Provide a numbered list where each entry includes the symbol’s name and a brief description of its symbolic relevance.",
            "type": "textarea"
        },
        # COM‑B Analysis
        "physical_capability": {
            "label": "Physical Capability",
            "prompt": "Describe the physical skills, strength, or endurance required to perform the behavior in a numbered list. Format each line as: '#. [capability]' with no additional commentary.",
            "type": "textarea"
        },
        "psychological_capability": {
            "label": "Psychological Capability",
            "prompt": "Describe the knowledge, cognitive skills, or mental capacity needed to perform the behavior in a numbered list. Format each line as: '#. [capability]' with no additional commentary.",
            "type": "textarea"
        },
        "physical_opportunity": {
            "label": "Physical Opportunity",
            "prompt": "List the physical environmental factors (resources, time, location) that facilitate or hinder the behavior in a numbered list. Format each line as: '#. [opportunity]' with no additional commentary.",
            "type": "textarea"
        },
        "social_opportunity": {
            "label": "Social Opportunity",
            "prompt": "Describe the social and cultural factors that influence the behavior, such as norms or interpersonal cues in a numbered list. Format each line as: '#. [opportunity]' with no additional commentary.",
            "type": "textarea"
        },
        "reflective_motivation": {
            "label": "Reflective Motivation",
            "prompt": "Describe the conscious motivations, goals, and plans that drive the behavior in a numbered list. Format each line as: '#. [motivation]' with no additional commentary.",
            "type": "textarea"
        },
        "automatic_motivation": {
            "label": "Automatic Motivation",
            "prompt": "List the habitual, emotional, or impulse-based drivers that affect the behavior in a numbered list. Format each line as: '#. [motivation]' with no additional commentary.",
            "type": "textarea"
        },
        # Implications & Outcomes
        "consequences": {
            "label": "Consequences and Outcomes",
            "prompt": "Discuss the outcomes (both positive and negative) of the behavior as a numbered list.",
            "type": "textarea"
        },
        "environmental_factors": {
            "label": "Environmental and Contextual Factors",
            "prompt": "Identify additional environmental or situational factors that influence the behavior, as a numbered list.",
            "type": "textarea"
        },
        "impact_strategies": {
            "label": "Strategies That Impacted the Behavior",
            "prompt": "List strategies or interventions that have increased or decreased the behavior, as a numbered list.",
            "type": "textarea"
        },
        # Stakeholders
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
            "prompt": "List the individuals or groups actively engaging in the behavior.",
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
        # Additional Considerations
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
        "COM-B Analysis": ["physical_capability", "psychological_capability", "physical_opportunity", "social_opportunity", "reflective_motivation", "automatic_motivation"],
        "Implications & Outcomes": ["consequences", "environmental_factors", "impact_strategies"],
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
                    # Ensure mandatory "action_behavior" is provided for context.
                    if not st.session_state.get("action_behavior", "").strip():
                        st.warning("Please provide the Action or Behavior detail before generating recommendations.")
                    else:
                        with st.spinner(f"Generating recommendation for {info['label']}..."):
                            # Build a context string using key fields
                            context_parts = []
                            if st.session_state.get("action_behavior", "").strip():
                                context_parts.append(f"{field_info['action_behavior']['label']}: {st.session_state.get('action_behavior')}")
                            if st.session_state.get("location", "").strip():
                                context_parts.append(f"{field_info['location']['label']}: {st.session_state.get('location')}")
                            # Optionally add any other non-empty field (except the current one)
                            for cf, val in st.session_state.items():
                                if cf in field_info and cf not in ["action_behavior", "location", key]:
                                    if isinstance(val, str) and val.strip():
                                        context_parts.append(f"{field_info[cf]['label']}: {val}")
                            context_str = "\n".join(context_parts) if context_parts else "No additional context provided."
                            full_prompt = (
                                f"Using the context below:\n{context_str}\n\n"
                                f"Now, please provide a suggestion for the '{info['label']}' field. {info['prompt']}"
                            )
                            system_msg = {"role": "system", "content": "You are an expert analyst in behavior analysis using the COM‑B framework."}
                            user_msg = {"role": "user", "content": full_prompt}
                            suggestion = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                            st.session_state[key] = suggestion.strip()
                            st.success(f"'{info['label']}' auto-populated.")
                            st.rerun
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
    """
    The purpose of this step is to generate a list of analytical questions that help refine the understanding of the behavior, identify potential gaps (including in capability, opportunity, and motivation), and explore challenges.
    The questions should be specific to the behavior and the context in which it occurs.
    The questions should be in the format of INTEL RFIs (Request for Information) that are specific to the behavior, location, and the context in which it occurs.
    """
    if st.button("Generate Analysis Questions"):
        if not analysis_details["action_behavior"] or not analysis_details["location"]:
            st.warning("Please provide at least the Action/Behavior and Location details before generating questions.")
        else:
            context = "\n".join(
                f"{field_info[key]['label']}: {analysis_details.get(key, '').strip()}"
                for key in field_info if analysis_details.get(key, "").strip()
            )
            prompt = (
                "Based on the Action or Behavior Analysis data provided below, please formulate exactly five analytical questions that deepen our understanding of the behavior, identify potential gaps (including those related to capability, opportunity, and motivation), and explore challenges and possible interventions.\n\n"
                "Requirements:\n"
                "1. Each question must begin with an interrogative word (e.g., 'what', 'how', 'why', etc.).\n"
                "2. The questions should be clear, concise, and directly related to the data.\n"
                "3. Do not include any additional commentary, explanations, or formatting.\n"
                "4. Return your answer strictly as a JSON array of strings (e.g., [\"Question 1\", \"Question 2\", ...]).\n\n"
                f"Data:\n{context}"
            )
            system_msg = {"role": "system", "content": "You are a strategic analyst specializing in behavior analysis using COM‑B."}
            user_msg = {"role": "user", "content": prompt}
            response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            
            # Clean and validate the response.
            cleaned_response = response.strip()
            if not cleaned_response:
                st.error("Received empty response from GPT.")
            else:
                # Optionally remove markdown formatting if present.
                if cleaned_response.startswith("```") and cleaned_response.endswith("```"):
                    cleaned_response = cleaned_response.strip("```").strip()
                try:
                    questions = json.loads(cleaned_response)
                    st.session_state["behavior_questions"] = questions
                    st.success("Analytical questions generated successfully!")
                except Exception as e:
                    st.error(f"Error parsing questions from AI response: {e}")
                    st.write("Raw GPT Response:", cleaned_response)  # Debug the raw response.

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
            "the key insights, highlights potential gaps (including in capability, opportunity, and motivation), and provides recommendations for further action. "
            "Return the report as plain text.\n\n"
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