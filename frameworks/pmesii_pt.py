# /frameworks/PMESII_PT.py
"""
PMESII_PT Analysis Framework
"""
import streamlit as st
from utilities.gpt import chat_gpt
from utilities.advanced_scraper import search_wikipedia
from dotenv import load_dotenv
import json

load_dotenv()

def pmesii_pt_page():
    st.title("PMESII-PT Analysis Framework")
    st.markdown("""
    To conduct a comprehensive PMESII-PT analysis for an area study supporting a U.S. military deployment at the operational or tactical level, follow these steps:

    **Step 1: Define the Operational Environment (OE)**
    - Clearly delineate the area of interest, including both the physical boundaries and the broader operational context.

    **Step 2: Gather Relevant Data**
    - You can use AI to generate targeted data gathering questions for each PMESII-PT domain. Answer only the questions that are relevant — only those answered will be included in the final analysis.
    - Additionally, you can enter manual data for each domain.

    **Step 3: Utilize Analytical Frameworks**
    - Leverage AI to generate precise analytical questions that probe the gathered data.

    **Step 4: Apply Intelligence Preparation of the Battlefield (IPB)**
    - Synthesize how the operational variables affect both friendly and adversary forces by evaluating the battlefield environment.
    """)

    st.markdown("---")
    # Step 1: Define the Operational Environment (OE)
    st.header("Step 1: Define the Operational Environment (OE)")
    area_name = st.text_input("Enter the Area Name:", placeholder="e.g., Kabul, Afghanistan")
    operational_env = st.text_area(
        "Describe the Operational Environment:",
        placeholder="Enter details about the area of interest, boundaries, and operational context..."
    )
    
    # Wikipedia Search for the Area using advanced scraper utility
    if st.button("Search Wikipedia for the Area"):
        if not area_name.strip():
            st.warning("Please enter the Area Name to search Wikipedia.")
        else:
            wiki_summary = search_wikipedia(area_name, sentences=5)
            st.markdown("### Wikipedia Summary")
            st.write(wiki_summary)
    
    st.markdown("---")
    # Step 2: Gather Relevant Data
    st.header("Step 2: Gather Relevant Data")
    st.markdown("""
    First, you may have AI generate targeted questions to guide data collection for each PMESII-PT domain.  
    Provide answers only for those questions that are relevant — only answered questions will be carried forward.
    """)

    # --- AI-Generated Data Gathering Questions ---
    if st.button("AI: Generate Data Gathering Questions"):
        # Build context for prompt
        context = ""
        if area_name.strip():
            context += f"Area Name: {area_name}\n\n"
        if operational_env.strip():
            context += f"Operational Environment: {operational_env}\n\n"
        
        prompt = (
            "Using the context provided, generate a JSON object containing data gathering questions for each of the PMESII-PT domains "
            "(Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time). "
            "Return the output as a JSON object where keys are the domain names and values are lists of questions. "
            "Ensure each question begins with one of the following interrogatives: what, how, when, where, why, or who."
        )
        system_msg = {
            "role": "system",
            "content": "You are a strategic analyst generating data collection questions for PMESII-PT analysis."
        }
        user_msg = {"role": "user", "content": context + "\n" + prompt}
        try:
            generated_response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            questions_dict = json.loads(generated_response)
            st.session_state["data_gathering_questions"] = questions_dict
        except Exception as e:
            st.error(f"Error generating questions: {e}")
    
    if "data_gathering_questions" in st.session_state and st.session_state["data_gathering_questions"]:
        st.subheader("Answer the AI-Generated Questions")
        domain_question_answers = {}
        for domain, questions in st.session_state["data_gathering_questions"].items():
            st.markdown(f"**{domain} Domain Questions:**")
            domain_answers = []
            if isinstance(questions, list):
                for i, question in enumerate(questions, start=1):
                    answer = st.text_area(
                        f"Answer for: {question}",
                        key=f"{domain}_qa_{i}",
                        placeholder="Enter your answer here..."
                    )
                    domain_answers.append({"question": question, "answer": answer})
            else:
                # If only a single question is returned (not in a list)
                answer = st.text_area(
                    f"Answer for: {questions}",
                    key=f"{domain}_qa_1",
                    placeholder="Enter your answer here..."
                )
                domain_answers.append({"question": questions, "answer": answer})
            domain_question_answers[domain] = domain_answers
        st.session_state["domain_question_answers"] = domain_question_answers

    st.markdown("---")
    # --- Manual Data Entry for Each Domain ---
    st.subheader("Manual Data Entry for Each PMESII-PT Domain")
    st.markdown("You may also manually enter additional data for each domain. This data is supplemental to your responses to the AI-generated questions.")
    domains = [
        "Political", "Military", "Economic", "Social",
        "Information", "Infrastructure", "Physical Environment", "Time"
    ]
    if "domain_data" not in st.session_state:
        st.session_state["domain_data"] = {}
    for domain in domains:
        manual_input = st.text_area(
            f"{domain} Domain Data:",
            key=f"{domain}_manual",
            placeholder=f"Enter additional data for the {domain} domain..."
        )
        st.session_state["domain_data"][domain] = manual_input

    st.markdown("---")
    # Optional additional context or scraped data
    scraped_data = st.text_area(
        "Optional: Additional Context or Scraped Data",
        placeholder="Paste any additional context or scraped data here..."
    )
    
    # Assemble all gathered data — only include answered AI questions
    gathered_data = ""
    if area_name.strip():
        gathered_data += f"Area Name: {area_name}\n\n"
    if operational_env.strip():
        gathered_data += f"Operational Environment:\n{operational_env}\n\n"
    for domain in domains:
        # Include manual domain data
        manual_text = st.session_state["domain_data"].get(domain, "")
        if manual_text.strip():
            gathered_data += f"{domain} Domain Manual Data:\n{manual_text}\n\n"
        # Include answered AI-generated questions for that domain
        if "domain_question_answers" in st.session_state and domain in st.session_state["domain_question_answers"]:
            for qa in st.session_state["domain_question_answers"][domain]:
                if qa["answer"].strip():
                    gathered_data += f"{domain} - {qa['question']}:\n{qa['answer']}\n\n"
    if scraped_data.strip():
        gathered_data += f"Scraped Data:\n{scraped_data}\n\n"
    
    # Save the gathered data for later steps (e.g., Analytical Questions and Summary)
    st.session_state["gathered_data"] = gathered_data

    st.markdown("---")
    # Step 3: Generate Analytical Questions
    st.header("Step 3: Generate Analytical Questions")
    st.markdown("""
    Leverage AI to generate a list of clear and actionable analytical questions that help you probe deeper into your analysis and identify any information gaps.
    Each question will begin with one of: what, how, when, where, why, or who.
    """)
    
    if st.button("AI: Suggest Analytical Questions"):
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
    # Step 4: Summarize Analysis
    st.header("Step 4: Summarize Analysis")
    st.markdown("Leverage AI to synthesize and summarize the overall PMESII-PT analysis.")
    
    if st.button("AI: Summarize Analysis"):
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