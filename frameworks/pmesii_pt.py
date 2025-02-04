# /frameworks/PMESII_PT.py
"""
PMESII_PT Analysis Framework
"""
import streamlit as st
import json
from utilities.gpt import chat_gpt
from utilities.advanced_scraper import search_wikipedia
from dotenv import load_dotenv

load_dotenv()

def clean_gpt_response(response_text):
    """
    Clean GPT response by removing markdown code fences, extraneous language markers, and
    extracting the JSON content based on the first '[' and the last ']'.
    """
    response_text = response_text.strip()
    # Remove starting/ending code fences if present.
    if response_text.startswith("```"):
        response_text = response_text.strip("`")
        lines = response_text.splitlines()
        # Remove language marker if it's the first line.
        if lines and lines[0].strip().lower() in ["json", "text"]:
            response_text = "\n".join(lines[1:]).strip()
    # Extract content between the first '[' and the last ']'
    start_idx = response_text.find('[')
    end_idx = response_text.rfind(']')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        response_text = response_text[start_idx:end_idx+1].strip()
    return response_text

def pmesii_pt_page():
    st.title("PMESII-PT Analysis Framework")
    st.markdown("""
    To conduct a comprehensive PMESII-PT analysis for an area study supporting a U.S. military deployment at the operational or tactical level, follow these steps:

    **Step 1: Define Location and Environment**
    - Provide the details of the area. Country is required; state, city, neighborhood, and general area are optional.
    - When you click the button below, AI will automatically generate a detailed Wikipedia search query based on the details.
    - The generated query will be used to fetch a Wikipedia summary.
    - Then, define your Operational Environment and Goals/Lines of Effort.

    **Step 2: Gather Relevant Data (One Domain at a Time)**
    - For each PMESII-PT domain, generate targeted data gathering questions.
    - Each question is paired with an answer input field. Only answered questions will be included in the final analysis.
    - You can also enter manual data for each domain.

    **Step 3: Utilize Analytical Frameworks**
    - Leverage AI to generate clear analytical questions that probe the gathered data.

    **Step 4: Apply Intelligence Preparation of the Battlefield (IPB)**
    - Synthesize the operational variables to assess their impact on friendly and adversary forces.
    """)

    st.markdown("---")
    # --- Step 1: Define Location and Environment ---
    st.header("Step 1: Define Location and Environment")

    st.subheader("Area Details")
    country = st.text_input("Country (required):", key="country")
    state = st.text_input("State (optional):", key="state")
    city = st.text_input("City (optional):", key="city")
    neighborhood = st.text_input("Neighborhood (optional):", key="neighborhood")
    general_area = st.text_input("General Area (optional):", key="general_area")

    # Automatically generate the Wikipedia search query and perform Wikipedia search.
    if st.button("Search Wikipedia for the Area"):
        if not country.strip():
            st.error("Country is required for searching Wikipedia.")
        else:
            # Arrange location parts in the order: General Area, Neighborhood, City, State, Country.
            location_parts = []
            if general_area.strip():
                location_parts.append(general_area.strip())
            if neighborhood.strip():
                location_parts.append(neighborhood.strip())
            if city.strip():
                location_parts.append(city.strip())
            if state.strip():
                location_parts.append(state.strip())
            if country.strip():
                location_parts.append(country.strip())
            context = ", ".join(location_parts)
            
            # Improved prompt for generating a plain language Wikipedia search query.
            prompt = (
                "Based on the following location details, generate a plain language Wikipedia search query for a place. "
                "List the available details in this order: General Area, Neighborhood, City, State, Country. "
                "Include only the provided details, separated by commas, with no extra commentary.\n\n"
                f"Location: {context}"
            )
            system_msg = {
                "role": "system",
                "content": "You are a location analyst generating plain language Wikipedia search queries for places."
            }
            user_msg = {"role": "user", "content": prompt}
            try:
                generated_query = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                # Cleanup any markdown/code-fencing and remove surrounding quotes.
                cleaned_query = generated_query.strip()
                if cleaned_query.startswith("```"):
                    cleaned_query = cleaned_query.strip("`")
                    first_line, *rest = cleaned_query.splitlines()
                    if first_line.strip().lower().startswith("json") or first_line.strip().lower().startswith("text"):
                        cleaned_query = "\n".join(rest).strip()
                if (cleaned_query.startswith('"') and cleaned_query.endswith('"')) or \
                   (cleaned_query.startswith("'") and cleaned_query.endswith("'")):
                    cleaned_query = cleaned_query[1:-1].strip()
                st.session_state["wiki_query"] = cleaned_query
                st.write("Generated Wikipedia Search Query:", cleaned_query)
                wiki_summary = search_wikipedia(st.session_state["wiki_query"], sentences=5)
                st.markdown("### Wikipedia Summary")
                st.write(wiki_summary)
            except Exception as e:
                st.error(f"Error generating search query: {e}")

    st.markdown("---")
    # Define Operational Environment
    st.subheader("Define the Operational Environment")
    operational_env = st.text_area(
        "Describe the Operational Environment:",
        placeholder="Enter details about the area of interest, boundaries, and operational context..."
    )

    # Define Goals or Lines of Effort
    st.subheader("Define Goals / Lines of Effort")
    goals = st.text_area(
        "Enter Goals or Lines of Effort:",
        placeholder="List and describe the goals or lines of effort pertaining to the analysis..."
    )

    st.markdown("---")
    # --- Step 2: Gather Relevant Data (One Domain at a Time) ---
    st.header("Step 2: Gather Relevant Data")
    st.markdown("For each PMESII-PT domain, generate AI-based data gathering questions and provide your answers below.")
    
    domains = [
        "Political", "Military", "Economic", "Social",
        "Information", "Infrastructure", "Physical Environment", "Time"
    ]
    # Initialize session state keys for generated questions and user answers if not already present.
    if "domain_generated_questions" not in st.session_state:
        st.session_state["domain_generated_questions"] = {}
    if "domain_question_answers" not in st.session_state:
        st.session_state["domain_question_answers"] = {}
    
    for domain in domains:
        with st.expander(f"{domain} Domain Questions", expanded=False):
            # Button to generate questions for current domain.
            if st.button(f"Generate {domain} Questions", key=f"gen_{domain}"):
                # Build context from provided location and environment details.
                context = ""
                if country.strip():
                    context += f"Country: {country}\n"
                if state.strip():
                    context += f"State: {state}\n"
                if city.strip():
                    context += f"City: {city}\n"
                if neighborhood.strip():
                    context += f"Neighborhood: {neighborhood}\n"
                if general_area.strip():
                    context += f"General Area: {general_area}\n"
                if operational_env.strip():
                    context += f"Operational Environment: {operational_env}\n"
                if goals.strip():
                    context += f"Goals/Lines of Effort: {goals}\n"
                    
                prompt = (
                    f"Using the following context:\n{context}\n"
                    f"Generate a JSON array of data gathering questions for the {domain} domain "
                    "of a PMESII-PT analysis. Ensure that each question starts with one of the interrogatives: what, how, when, where, why, or who. "
                    "Return only the JSON array."
                )
                system_msg = {
                    "role": "system",
                    "content": f"You are a strategic analyst generating data collection questions for the {domain} domain in PMESII-PT analysis."
                }
                user_msg = {"role": "user", "content": prompt}
                try:
                    raw_response = chat_gpt([system_msg, user_msg], model="gpt-4o")
                    cleaned_response = clean_gpt_response(raw_response)
                    questions_list = json.loads(cleaned_response)
                    st.session_state["domain_generated_questions"][domain] = questions_list
                except Exception as e:
                    st.error(f"Error generating questions for {domain}: {e}")

            # If questions have been generated, display each with an answer input.
            if domain in st.session_state["domain_generated_questions"]:
                questions = st.session_state["domain_generated_questions"][domain]
                domain_answers = []
                for idx, question_obj in enumerate(questions, start=1):
                    # Expecting question objects; if it's a dict, extract the text.
                    if isinstance(question_obj, dict) and "question" in question_obj:
                        question_text = question_obj["question"]
                    else:
                        question_text = question_obj
                    answer = st.text_area(
                        f"Answer for: {question_text}",
                        key=f"{domain}_qa_{idx}",
                        placeholder="Enter your answer here..."
                    )
                    domain_answers.append({"question": question_text, "answer": answer})
                st.session_state["domain_question_answers"][domain] = domain_answers

    st.markdown("---")
    # Export all questions and answers into a CSV file.
    st.subheader("Export Data")
    if st.button("Export Questions & Answers to CSV"):
        import csv
        from io import StringIO
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["Domain", "Question", "Answer"])
        for domain in domains:
            if domain in st.session_state["domain_generated_questions"]:
                answers = st.session_state["domain_question_answers"].get(domain, [])
                for qa in answers:
                    writer.writerow([domain, qa["question"], qa["answer"]])
        csv_data = output.getvalue()
        st.download_button("Download CSV", csv_data, "PMESII_PT_Questions_Answers.csv", "text/csv")
    
    st.markdown("---")
    # --- Step 3: Generate Analytical Questions ---
    st.header("Step 3: Generate Analytical Questions")
    st.markdown("""
    Leverage AI to generate a list of clear and actionable analytical questions that help you probe deeper into your analysis and identify any information gaps.
    Each question will begin with one of: what, how, when, where, why, or who.
    """)
    
    if st.button("AI: Suggest Analytical Questions"):
        # Assemble gathered data from previous steps.
        gathered_data = ""
        if country.strip():
            gathered_data += f"Country: {country}\n"
        if state.strip():
            gathered_data += f"State: {state}\n"
        if city.strip():
            gathered_data += f"City: {city}\n"
        if neighborhood.strip():
            gathered_data += f"Neighborhood: {neighborhood}\n"
        if general_area.strip():
            gathered_data += f"General Area: {general_area}\n\n"
        if operational_env.strip():
            gathered_data += f"Operational Environment:\n{operational_env}\n\n"
        if goals.strip():
            gathered_data += f"Goals/Lines of Effort:\n{goals}\n\n"
        for domain in domains:
            # Include answered AI-generated questions for each domain.
            if domain in st.session_state["domain_question_answers"]:
                for qa in st.session_state["domain_question_answers"][domain]:
                    if qa["answer"].strip():
                        gathered_data += f"{domain} - {qa['question']}:\n{qa['answer']}\n\n"
        if not gathered_data.strip():
            st.warning("Please provide some data in the previous sections before generating analytical questions.")
        else:
            try:
                prompt = (
                    "Based on the following PMESII-PT analysis data, generate a list of clear and actionable analytical questions "
                    "that probe deeper into the analysis and identify any information gaps. "
                    "Ensure that each question begins with what, how, when, where, why, or who.\n\n"
                    f"Data:\n{gathered_data}"
                )
                system_msg = {
                    "role": "system",
                    "content": (
                        "You are an experienced analyst proficient in PMESII-PT analysis. "
                        "Provide a list of thoughtful, precise analytical questions based on the provided data."
                    )
                }
                user_msg = {"role": "user", "content": prompt}
                analytical_questions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.text_area("Generated Analytical Questions", value=analytical_questions, height=200)
            except Exception as e:
                st.error(f"Error generating analytical questions: {e}")
    
    st.markdown("---")
    # --- Step 4: Summarize Analysis ---
    st.header("Step 4: Summarize Analysis")
    st.markdown("Leverage AI to synthesize and summarize the overall PMESII-PT analysis.")
    
    if st.button("AI: Summarize Analysis"):
        # Reuse the gathered data from previous steps.
        if not gathered_data.strip():
            st.warning("Please provide data in the previous sections before generating a summary.")
        else:
            try:
                prompt_summary = (
                    "Using the comprehensive PMESII-PT analysis data provided below, generate a concise summary that highlights the key insights, "
                    "potential information gaps, and critical aspects of the operational environment.\n\n"
                    f"Data:\n{gathered_data}"
                )
                system_msg = {
                    "role": "system",
                    "content": "You are a strategic analyst. Summarize the provided PMESII-PT analysis data clearly and concisely."
                }
                user_msg = {"role": "user", "content": prompt_summary}
                summary_result = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.text_area("Analysis Summary", value=summary_result, height=200)
            except Exception as e:
                st.error(f"Error generating summary: {e}")

if __name__ == "__main__":
    pmesii_pt_page() 