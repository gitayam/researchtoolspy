# /frameworks/starbursting.py
"""
Starbursting Analysis Framework starting with a point of information and continuously asking questions to expand on it.
At the end programatically categorize the information provided and create a summary
use ai to convert into a diagram or chart
"""
import streamlit as st
from utilities.gpt import chat_gpt

def starbursting_page():
    st.title("Starbursting Analysis Framework")
    st.markdown("""
    The Starbursting Analysis Framework begins with a central point of information that is expanded by posing a series of probing questions.
    This approach helps uncover hidden insights and deepen your analysis.
    
    As you work through the analysis:
    - Enter an initial idea or information.
    - Generate expansion questions using AI.
    - Provide detailed responses for each question.
    - Finally, generate a summary and a suggested diagram/chart to visually represent your analysis.
    """)

    # Step 1: Initial Point of Information
    st.subheader("Step 1: Initial Point of Information")
    initial_point = st.text_area(
        "Enter your central point or idea:",
        placeholder="e.g., Company X is developing a new technology that could disrupt the market..."
    )

    st.markdown("---")

    # Step 2: Expansion Questions
    st.subheader("Step 2: Expansion Questions")
    st.markdown("List your expansion questions (one per line) to probe deeper into the initial idea.")

    if 'starbursting_questions' not in st.session_state:
        st.session_state['starbursting_questions'] = ""
    
    questions_input = st.text_area(
        "Expansion Questions:",
        value=st.session_state['starbursting_questions'],
        placeholder="e.g., What potential advantages does this technology offer?\nWhat challenges might arise?\nHow could competitors react?"
    )
    st.session_state['starbursting_questions'] = questions_input

    # AI suggestion for expansion questions
    if st.button("AI: Suggest Expansion Questions"):
        if not initial_point:
            st.warning("Please enter the initial point of information to generate questions.")
        else:
            try:
                system_msg = {
                    "role": "system",
                    "content": (
                        "You are an expert strategist skilled in the starbursting technique. "
                        "Given a central idea, generate a list of 5 probing questions to help expand on that idea. "
                        "Return each question on a new line without numbering."
                    )
                }
                user_msg = {
                    "role": "user",
                    "content": f"Central idea: {initial_point}\nGenerate 5 expansion questions to explore this idea."
                }
                ai_questions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.session_state['starbursting_questions'] = ai_questions
                st.experimental_rerun()
            except Exception as e:
                st.error(f"Error generating AI questions: {e}")

    st.markdown("---")

    # Step 3: Detailed Responses to Expansion Questions
    st.subheader("Step 3: Detailed Responses")
    st.markdown("For each expansion question above, provide your detailed responses below.")
    
    if 'starbursting_responses' not in st.session_state:
        st.session_state['starbursting_responses'] = {}

    # Split the questions into a list
    questions_list = [q.strip() for q in st.session_state['starbursting_questions'].split("\n") if q.strip()]
    for i, question in enumerate(questions_list, start=1):
        key = f"response_{i}"
        response = st.text_area(
            f"Response to Question {i}: {question}",
            value=st.session_state['starbursting_responses'].get(key, ""),
            key=key,
            placeholder="Enter your analysis here..."
        )
        st.session_state['starbursting_responses'][key] = response

    st.markdown("---")

    # Step 4: Generate Summary
    st.subheader("Step 4: Generate Summary")
    st.markdown("Click the button below to generate a concise summary that categorizes your analysis.")
    if st.button("AI: Generate Summary"):
        try:
            responses_text = ""
            for i, question in enumerate(questions_list, start=1):
                key = f"response_{i}"
                answer = st.session_state['starbursting_responses'].get(key, "")
                responses_text += f"Q{i}: {question}\nA{i}: {answer}\n\n"
                
            prompt_text = (
                f"Using the following central idea and responses, create a concise summary that categorizes the insights from the analysis.\n\n"
                f"Central idea: {initial_point}\n\n"
                f"Responses:\n{responses_text}"
            )
            system_msg = {
                "role": "system",
                "content": "You are a strategic analyst. Provide a clear and concise summary of the analysis, categorizing the insights."
            }
            user_msg = {
                "role": "user",
                "content": prompt_text
            }
            summary_result = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            st.text_area("Summary", value=summary_result, height=200)
        except Exception as e:
            st.error(f"Error generating summary: {e}")

    st.markdown("---")
    
    # Step 5: Generate Network Diagram
    st.subheader("Step 5: Generate Network Diagram")
    st.markdown("Click the button below to generate a network diagram representing the relationships in your analysis. The diagram will be rendered using Graphviz DOT format.")
    if st.button("AI: Generate Network Diagram"):
        try:
            responses_text = ""
            for i, question in enumerate(questions_list, start=1):
                key = f"response_{i}"
                answer = st.session_state['starbursting_responses'].get(key, "")
                responses_text += f"Q{i}: {question}\nA{i}: {answer}\n\n"
                
            prompt_text = (
                f"Using the following central idea and responses, generate a network diagram represented in Graphviz DOT format. "
                f"Represent the central idea as the main node. Connect each expansion question as a node to the central idea, "
                f"and attach the corresponding response as a sub-node to the question. Only output valid DOT format code.\n\n"
                f"Central idea: {initial_point}\n\n"
                f"Responses:\n{responses_text}"
            )
            system_msg = {
                "role": "system",
                "content": "You are a strategic analyst. Provide a network diagram in Graphviz DOT format that visually represents the relationships between the central idea, expansion questions, and their answers."
            }
            user_msg = {
                "role": "user",
                "content": prompt_text
            }
            diagram_result = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            
            # Display the diagram using Graphviz
            st.graphviz_chart(diagram_result)
            st.text_area("Diagram (DOT format)", value=diagram_result, height=200)
        except Exception as e:
            st.error(f"Error generating network diagram: {e}")

if __name__ == "__main__":
    starbursting_page()

