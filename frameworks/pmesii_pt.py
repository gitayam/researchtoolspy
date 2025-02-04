# /frameworks/PMESII_PT.py
"""
PMESII_PT Analysis Framework
"""
import streamlit as st
from utilities.gpt import chat_gpt
from dotenv import load_dotenv

load_dotenv()

def pmesii_pt_page():
    st.title("PMESII-PT Analysis Framework")
    st.markdown("""
    To conduct a comprehensive PMESII-PT analysis for an area study supporting a U.S. military deployment at the operational or tactical level, follow these steps:

    **Step 1: Define the Operational Environment (OE)**
    - Clearly delineate the area of interest, including both the physical boundaries and the broader operational context.

    **Step 2: Gather Relevant Data**
    - Collect information in each of the PMESII-PT domains:
      - **Political:** Government structures, political stability, key actors, and policies.
      - **Military:** Local military capabilities, force dispositions, and security organizations.
      - **Economic:** Economic conditions, industries, resources, and financial systems.
      - **Social:** Demographics, cultural norms, societal groups, and public health.
      - **Information:** Media landscape, communication infrastructures, and dissemination methods.
      - **Infrastructure:** Critical facilities, transportation networks, utilities, and urbanization.
      - **Physical Environment:** Geography, climate, terrain, and environmental conditions.
      - **Time:** Temporal factors such as seasons, political cycles, and time-sensitive events.

    **Step 3: Utilize Analytical Frameworks and Identify Gaps**
    - Employ tools like the ASCOPE-PMESII matrix to systematically analyze the human terrain and identify information gaps.
    - Leverage AI to generate relevant and precise analytical questions that probe deeper into the collected data.

    **Step 4: Apply Intelligence Preparation of the Battlefield (IPB)**
    - Analyze how the operational variables affect both friendly and adversary forces by defining, describing, evaluating, and forecasting in the battlefield environment.
    """)
    
    st.markdown("---")
    # Step 1: Define the Operational Environment (OE)
    st.header("Step 1: Define the Operational Environment (OE)")
    operational_env = st.text_area(
        "Describe the Operational Environment:",
        placeholder="Enter details about the area of interest, boundaries, and operational context..."
    )
    
    st.markdown("---")
    # Step 2: Gather Relevant Data
    st.header("Step 2: Gather Relevant Data")
    st.markdown("Enter data for each PMESII-PT domain:")
    domains = [
        "Political", "Military", "Economic", "Social",
        "Information", "Infrastructure", "Physical Environment", "Time"
    ]
    domain_data = {}
    for domain in domains:
        domain_data[domain] = st.text_area(
            f"{domain} Domain Data:",
            key=domain,
            placeholder=f"Enter relevant data for the {domain} domain..."
        )
    
    st.markdown("---")
    # Optional data: allow users to paste any scraped data or additional context.
    scraped_data = st.text_area(
        "Optional: Additional Context or Scraped Data",
        placeholder="Paste any additional context or scraped data here..."
    )
    
    # Combine all gathered data into one context string.
    gathered_data = ""
    if operational_env.strip():
        gathered_data += f"Operational Environment:\n{operational_env}\n\n"
    for domain in domains:
        if domain_data[domain].strip():
            gathered_data += f"{domain}:\n{domain_data[domain]}\n\n"
    if scraped_data.strip():
        gathered_data += f"Scraped Data:\n{scraped_data}\n\n"
    
    st.markdown("---")
    # Step 3: Utilize Analytical Frameworks and Generate AI Questions
    st.header("Step 3: Generate Analytical Questions")
    st.markdown("""
    Leverage AI to generate a list of precise, relevant analytical questions that probe the gathered data and address potential gaps.  
    Each question will begin with an interrogative such as what, how, when, where, why, or who.
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
                    "potential information gaps, and critical elements of the operational environment.\n\n"
                    f"Data:\n{gathered_data}"
                )
                system_msg = {
                    "role": "system",
                    "content": (
                        "You are a strategic analyst. Summarize the provided PMESII-PT analysis data by emphasizing the critical insights and potential gaps."
                    )
                }
                user_msg = {"role": "user", "content": prompt_summary}
                summary_result = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.text_area("Analysis Summary", value=summary_result, height=200)
            except Exception as e:
                st.error(f"Error generating summary: {e}")

if __name__ == "__main__":
    pmesii_pt_page() 