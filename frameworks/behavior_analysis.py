import streamlit as st
import json
from utilities.gpt import chat_gpt
from utilities.helpers import create_docx_document

def behavior_analysis_page():
    st.title("Action or Behavior Analysis")
    st.markdown(
        "This template builds upon the latest doctrine TM 3-53.11 Influence Process Activity: Target Audience Analysis. "
        "Provide an in-depth analysis of a specific behavior in a particular area. "
        "The process generates analytical questions, suggests draft answers, and finally produces a comprehensive report."
    )

    with st.expander("Template Instructions"):
        st.markdown(
            """
            **Purpose**  
            To build upon the latest doctrine TM 3-53.11 Influence Process Activity: Target Audience Analysis Chapter 2 by providing a more in-depth analysis of a specific behavior in a particular area.  
            This analysis produces a shared understanding of the behavior and the relevant actors, locations, obstacles, symbols, etc.  
            It is not limited to a MISO analysis only—it may include insights that benefit other units operating in the area.

            **How To Use Template**  
            1. Replace all placeholders (e.g., BEHAVIOR_HERE, COUNTRY_HERE) with your specific information.  
            2. Fill in the fields below with your observations and data.  
            3. Use the provided buttons to generate questions, get answer suggestions, and finally generate a report.

            **Additional Considerations**"""
        )

    st.header("Enter Behavior Analysis Details")
    # Define the fields with the desired order and updated labels.
    fields = {
        "action_behavior": "Action or Behavior",
        "supporting_behaviors": "Supporting Behaviors Required",
        "location": "Location",
        "behavior_breakdown": "Behavior Breakdown and Analysis",
        "behavior_timeline": "Behavior Timeline (Generate initial timeline)",
        "instances": "Historical Examples of Behavior (who, when, where, why)",
        "supporting_timeline": "Timeline of Supporting Behaviors",
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

    analysis_details = {}

    # Render input fields and add a GPT recommendation button where appropriate.
    for key, label in fields.items():
        if key in ["action_behavior", "location"]:
            analysis_details[key] = st.text_input(label, key=key)
        else:
            analysis_details[key] = st.text_area(label, key=key, height=100)

        # Add GPT-enabled recommendation buttons for specific fields
        if key in ["behavior_timeline", "supporting_behaviors", "supporting_timeline", "instances", "obstacles", "associated_symbols"]:
            if st.button(f"Recommend data for '{label}'", key=f"btn_{key}"):
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
                st.info(f"GPT Recommendation for '{label}':\n{suggestion}")

    st.markdown("---")
    st.header("Step 1: Generate Analytical Questions")
    if st.button("Generate Analysis Questions"):
        # Ensure mandatory fields are provided
        if not analysis_details["action_behavior"] or not analysis_details["location"]:
            st.warning("Please provide at least the Action/Behavior and Location details before generating questions.")
        else:
            # Build context from the provided analysis details
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
            system_msg = {
                "role": "system",
                "content": "You are a strategic analyst specialized in behavior analysis."
            }
            user_msg = {"role": "user", "content": prompt}
            response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            try:
                questions = json.loads(response)
                st.session_state["behavior_questions"] = questions
                st.success("Analytical questions generated successfully!")
            except Exception as e:
                st.error(f"Error parsing questions from AI response: {e}")

    # Display generated questions and allow the user to provide answers
    if "behavior_questions" in st.session_state:
        st.header("Analysis Questions and Answers")
        for idx, question in enumerate(st.session_state["behavior_questions"], start=1):
            st.subheader(f"Question {idx}:")
            st.write(question)
            answer_key = f"behavior_answer_{idx}"
            st.text_area(f"Your answer for Question {idx}:", key=answer_key, height=100)
            # Provide a suggestion button for each question
            if st.button(f"Suggest Answer for Question {idx}", key=f"suggest_btn_{idx}"):
                suggestion_prompt = (
                    "Based on the following Action or Behavior Analysis data and the question provided, generate a draft answer or template that can guide the analysis. "
                    "Ensure the answer is clear and actionable.\n\n"
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
                st.info(f"Suggested Answer for Question {idx}:\n{suggestion}")

    st.markdown("---")
    st.header("Step 2: Generate Comprehensive Analysis Report")
    if st.button("Generate Analysis Report"):
        # Compile all analysis details into a context string
        report_context = "Action or Behavior Analysis Data:\n"
        for key, label in fields.items():
            value = analysis_details.get(key, "").strip()
            if value:
                report_context += f"{label}: {value}\n"
        # Append Q&A if available
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
        report = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
        st.subheader("Analysis Report")
        st.text_area("Generated Report", value=report, height=300)
        st.download_button("Download Report as Text", report, file_name="behavior_analysis_report.txt", mime="text/plain")

    st.subheader("Export Analysis")
    title_doc = st.text_input("Enter export file name for behavior analysis", "behavior_analysis")
    if st.button("Export Behavior Analysis as DOCX Document"):
        sections = {
            "Action or Behavior Analysis Data": report_context,
            "Analysis Questions and Answers": "\n".join(
                f"Q{idx}: {question}\nA{idx}: {answer}"
                for idx, question in enumerate(st.session_state["behavior_questions"], start=1)
            ),
            "Analysis Report": report
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
