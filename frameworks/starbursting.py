# /frameworks/starbursting.py
"""
Starbursting Analysis Framework starting with a point of information and continuously asking questions to expand on it.
At the end programatically categorize the information provided and create a summary
use ai to convert into a diagram or chart
"""
import streamlit as st
from utilities.gpt import chat_gpt
from utilities.advanced_scraper import advanced_fetch_metadata  # New import for URL scraping

def process_initial_input(input_text):
    """
    If the input_text is a URL, scrape its content using advanced_fetch_metadata,
    then summarize the content and extract key details answering:
    Who, What, Where, Why, and When.
    
    Returns a concise summary with an additional details section.
    """
    if input_text.strip().lower().startswith("http://") or input_text.strip().lower().startswith("https://"):
        try:
            title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(input_text)
            scraped_text = (
                f"Title: {title}\n"
                f"Description: {description}\n"
                f"Author: {author}\n"
                f"Published Date: {date_published}\n"
                f"Editor: {editor}\n"
                f"Keywords: {keywords}\n"
                f"Referenced Links: {', '.join(referenced_links) if referenced_links else 'None'}"
            )
            prompt = (
                "Summarize the following content in a concise manner and extract the key details by answering the following questions: "
                "Who, What, Where, Why, and When. Provide the summary followed by a section with the extracted details in the format:\n"
                "'Who: ...', 'What: ...', 'Where: ...', 'Why: ...', 'When: ...'\n\n"
                f"{scraped_text}"
            )
            system_msg = {"role": "system", "content": "You are a professional summarizer and analyst."}
            user_msg = {"role": "user", "content": prompt}
            summary_with_details = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            return summary_with_details
        except Exception as e:
            st.error(f"Error processing URL: {e}")
            return input_text
    else:
        return input_text

def starbursting_page():
    st.title("Starbursting Analysis Framework")
    st.markdown("""
    The Starbursting Analysis Framework begins with a central point of information that is expanded by posing a series of probing questions.
    This approach helps uncover hidden insights and deepen your analysis.
    
    As you work through the analysis:
    - Enter an initial idea, information, or URL.
    - (If a URL is provided, process it to scrape, summarize, and extract who/what/where/why/when details.)
    - Generate expansion questions using AI.
    - Provide detailed responses for each question.
    - Finally, generate a summary and a suggested diagram/chart to visually represent your analysis.
    """)

    # Step 1: Initial Point of Information
    st.subheader("Step 1: Initial Point of Information")
    initial_point = st.text_area(
        "Enter your central point or idea (or a URL):",
        placeholder="e.g., Company X is developing a new technology that could disrupt the market... or paste a URL."
    )

    # If the input looks like a URL, offer to process it.
    if initial_point.strip().lower().startswith("http://") or initial_point.strip().lower().startswith("https://"):
        st.info("It looks like you've entered a URL. Click the button below to scrape and summarize the content, including extraction of who, what, where, why, and when.")
        if st.button("Process URL"):
            processed = process_initial_input(initial_point)
            st.session_state["processed_initial"] = processed
            st.experimental_rerun()

    # Determine the central idea: use processed version if available.
    central_idea = st.session_state.get("processed_initial", initial_point)

    # Optionally display the processed information.
    if "processed_initial" in st.session_state:
        st.subheader("Analyzed Central Information")
        st.write(st.session_state["processed_initial"])

    st.markdown("---")

    # Step 2: Expansion Questions
    st.subheader("Step 2: Expansion Questions")
    st.markdown(
        "List or generate expansion questions to probe deeper into the central idea. "
        "The questions should begin with one of these words: what, how, when, where, why, or who."
    )
    
    # Initialize the questions in session state if not already present.
    if 'starbursting_questions' not in st.session_state:
        st.session_state['starbursting_questions'] = ""
    
    # Display an editable text area for expansion questions (one per line)
    questions_input = st.text_area(
        "Expansion Questions (one per line):",
        value=st.session_state['starbursting_questions'],
        placeholder="e.g., What potential advantages does this technology offer?\nHow might competitors respond?"
    )
    st.session_state['starbursting_questions'] = questions_input

    # AI suggestion for expansion questions that use context from previous answers (if available)
    if st.button("AI: Suggest Expansion Questions"):
        if not central_idea:
            st.warning("Please enter your central point of information to generate questions.")
        else:
            try:
                # Gather context from any previous answers.
                responses_context = ""
                if 'starbursting_responses' in st.session_state:
                    for key, answer in st.session_state['starbursting_responses'].items():
                        if answer.strip():
                            responses_context += f"{key}: {answer}\n"
                
                prompt = f"Central idea: {central_idea}\n"
                if responses_context:
                    prompt += f"Context from previous responses:\n{responses_context}\n"
                prompt += (
                    "Generate a list of 5 expansion questions that probe deeper into the analysis. "
                    "Each question must start with one of the following words: what, how, when, where, why, who. "
                    "Return each question on a new line without numbering."
                )
                
                system_msg = {
                    "role": "system",
                    "content": (
                        "You are an expert strategist skilled in the starbursting technique. "
                        "Considering the central idea and any provided context, generate expansion questions "
                        "that begin with a 5W (what, how, when, where, why, who) element."
                    )
                }
                user_msg = {
                    "role": "user",
                    "content": prompt
                }
                ai_questions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.session_state['starbursting_questions'] = ai_questions
                st.experimental_rerun()
            except Exception as e:
                st.error(f"Error generating AI questions: {e}")

    st.markdown("---")

    # Step 3: Detailed Responses to Expansion Questions
    st.subheader("Step 3: Detailed Responses")
    st.markdown("For each expansion question above, provide your detailed responses below. Each input field is tied to its respective question.")
    
    # Initialize responses dictionary if not already present.
    if 'starbursting_responses' not in st.session_state:
        st.session_state['starbursting_responses'] = {}

    # Split the expansion questions into a list (ignoring blank lines)
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
                f"Central idea: {central_idea}\n\n"
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
                f"Central idea: {central_idea}\n\n"
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
            
            # Import Graphviz and render the diagram as an image.
            import graphviz
            diagram = graphviz.Source(diagram_result, format="png")
            st.image(diagram.pipe(), caption="Network Diagram", use_column_width=True)
            
            # Also show the raw DOT code for reference.
            st.text_area("Diagram (DOT format)", value=diagram_result, height=200)
        except Exception as e:
            st.error(f"Error generating network diagram: {e}")

    # Step 6: Further Starbursting (Optional)
    st.markdown("---")
    st.subheader("Step 6: Further Starbursting")
    st.markdown(
        "For any of your responses above, you can generate additional expansion questions to dive deeper. "
        "Click the button below for a specific response to generate follow-up questions (starting with who, what, where, when, why). "
        "You can continue this process as long or as little as you want."
    )
    
    # Initialize further starbursting storage if not already present.
    if "further_starbursting" not in st.session_state:
        st.session_state["further_starbursting"] = {}
    
    for i, question in enumerate(questions_list, start=1):
        key_response = f"response_{i}"
        answer = st.session_state['starbursting_responses'].get(key_response, "").strip()
        if answer:
            st.markdown(f"**Response {i}:** {answer}")
            if st.button(f"AI: Further Starbursting for Response {i}", key=f"further_btn_{i}"):
                further_prompt = (
                    f"Using the following answer as the focal point, generate a list of 5 follow-up expansion questions. "
                    f"Each question should start with one of these words: who, what, where, when, why. \n\nAnswer: {answer}"
                )
                further_system_msg = {
                    "role": "system",
                    "content": "You are a strategic analyst skilled in iterative starbursting. Generate follow-up expansion questions based on the provided answer."
                }
                further_user_msg = {
                    "role": "user",
                    "content": further_prompt
                }
                additional_questions = chat_gpt([further_system_msg, further_user_msg], model="gpt-4o-mini")
                st.session_state["further_starbursting"][key_response] = additional_questions
                st.experimental_rerun()
            
            if key_response in st.session_state["further_starbursting"]:
                st.markdown("**Additional Expansion Questions:**")
                st.text_area(f"Further expansion questions for response {i}",
                             value=st.session_state["further_starbursting"][key_response],
                             height=150)

if __name__ == "__main__":
    starbursting_page()

