import streamlit as st
import json
from utilities.gpt import chat_gpt

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
    # Define the fields for the analysis
    fields = {
        "action_behavior": "Action or Behavior",
        "location": "Location",
        "behavior_breakdown": "Behavior Breakdown and Analysis",
        "behavior_timeline": "Behavior Timeline",
        "instances": "Instances of the Behavior",
        "supporting_behaviors": "Supporting Behaviors Required",
        "supporting_timeline": "Timeline of Supporting Behaviors",
        "obstacles": "Obstacles and Challenges Encountered",
        "associated_symbols": "Associated Symbols and Signals",
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
    # Use text_input for shorter entries and text_area for longer observations.
    for key, label in fields.items():
        if key in ["action_behavior", "location"]:
            analysis_details[key] = st.text_input(label)
        else:
            analysis_details[key] = st.text_area(label, height=100)

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

if __name__ == "__main__":
    behavior_analysis_page()
