# /frameworks/DIME.py
"""
DIME Analysis Framework
"""
import streamlit as st
import re
import requests
import wikipedia
import logging
from dotenv import load_dotenv
from utilities.gpt import chat_gpt  # Using the same helper as SWOT and COG
from utilities.advanced_scraper import advanced_fetch_metadata, google_search_summary, generate_google_results, generate_wikipedia_results  # New import for advanced scraping

load_dotenv()


def process_scenario_input(scenario):
    """
    If the scenario input is a URL, scrape its content using advanced_fetch_metadata 
    and summarize it using GPT with the "gpt-4o-mini" model.
    Otherwise, return the scenario as provided.
    """
    if scenario.strip().lower().startswith("http://") or scenario.strip().lower().startswith("https://"):
        try:
            logging.info(f"Fetching metadata for URL: {scenario}")
            meta = advanced_fetch_metadata(scenario)
            
            # If meta is a tuple, assume the first element is the metadata we want.
            if isinstance(meta, tuple):
                meta = meta[0]
            
            if isinstance(meta, dict):
                title = meta.get("title", "No Title")
                description = meta.get("description", "No Description")
                keywords = meta.get("keywords", "No Keywords")
                author = meta.get("author", "No Author")
                date_published = meta.get("date_published", "No Date Published")
                editor = meta.get("editor", "No Editor")
                referenced_links = meta.get("referenced_links", [])
                referenced_links_str = (
                    ", ".join(referenced_links)
                    if isinstance(referenced_links, list) and referenced_links
                    else "None"
                )
                scraped_text = (
                    f"Title: {title}\n"
                    f"Description: {description}\n"
                    f"Author: {author}\n"
                    f"Published Date: {date_published}\n"
                    f"Editor: {editor}\n"
                    f"Keywords: {keywords}\n"
                    f"Referenced Links: {referenced_links_str}"
                )
            elif isinstance(meta, str):
                # If meta is already a text string, just use it.
                scraped_text = meta
            else:
                # Fallback if meta is neither dict nor str.
                scraped_text = scenario

            summary_prompt = (
                "Summarize the following content in a concise manner, "
                "highlighting the key insights and context:\n\n" + scraped_text
            )
            summary = chat_gpt(
                [
                    {"role": "system", "content": "You are a professional summarizer."},
                    {"role": "user", "content": summary_prompt}
                ],
                model="gpt-4o-mini"
            )
            return summary
        except Exception as e:
            logging.error(f"Error processing URL: {e}")
            st.error(f"Error processing URL: {e}")
            return scenario
    else:
        return scenario

def ai_suggest_dime(phase, scenario, objective=None):
    """
    Generate 3-5 DIME analysis items for the given phase with a focus on generating intelligence
    requirements that support information forces.
    
    For the Diplomatic phase, the prompt instructs ChatGPT to consider the scenario from a diplomatic 
    perspective, and if an objective is provided, to relate the analysis to accomplishing that objective.
    
    The output must be a semicolon-separated list of items. 
    Each item must be written EXACTLY in the following format:
      Question: <question text> | Search: <advanced Google search query>
    Do not include any extraneous text, line breaks, or commentary.
    """
    try:
        system_msg = {
            "role": "system",
            "content": (
                "You are an experienced intelligence analyst. Your task is to generate analytical questions that focus on identifying "
                "critical intelligence requirements to support information forces (including cyber, digital, and OSINT capabilities). "
                "Do not provide narrative development or persuasive messaging; instead, focus on pinpointing intelligence gaps, adversary capabilities, "
                "and vulnerabilities."
            )
        }
        if phase.lower() == "diplomatic":
            if objective and objective.strip():
                user_content = (
                    f"Scenario: {scenario}\n"
                    f"Objective: {objective}\n"
                    f"For the '{phase}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key diplomatic information requirements "
                    "required to support information forces. First, consider what is important to know from a diplomatic perspective, especially in relation to accomplishing the objective provided. "
                    "Output only a semicolon-separated list of items. Each item must be on one line, EXACTLY as follows:\n\n"
                    "Question: <question text> | Search: <advanced Google search query>\n\n"
                    "Do not include any additional words or lines."
                )
            else:
                user_content = (
                    f"Scenario: {scenario}\n"
                    f"For the '{phase}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key diplomatic information requirements "
                    "required to support information forces. First, consider what is important to know from a diplomatic perspective. "
                    "Output only a semicolon-separated list of items. Each item must be on one line, EXACTLY as follows:\n\n"
                    "Question: <question text> | Search: <advanced Google search query>\n\n"
                    "Do not include any additional words or lines."
                )
        else:
            user_content = (
                f"Scenario: {scenario}\n"
                f"For the '{phase}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key information requirements "
                "required to support information forces. Output only a semicolon-separated list of items. Each item must be on one line, EXACTLY as follows:\n\n"
                "Question: <question text> | Search: <advanced Google search query>\n\n"
                "Do not include any additional words or lines."
            )
        user_msg = {"role": "user", "content": user_content}
        response = chat_gpt([system_msg, user_msg], model="gpt-4o")
        return response
    except Exception as e:
        st.error(f"AI Error: {e}")
        return ""

def dime_page():
    st.title("DIME Analysis Flow")
    # Inject custom CSS to make the page wider
    st.markdown(
        """
        <style>
        .reportview-container .main .block-container {
            max-width: 100% !important;
            padding-left: 2rem;
            padding-right: 2rem;
        }
        </style>
        """,
        unsafe_allow_html=True
    )

    st.write("""
        This guided flow helps you conduct a comprehensive DIME analysis (Diplomatic, Information, Military, Economic).
        Start by providing a detailed overview of the context. You can describe a situation, person, place, or goal, or simply drop in a news article (via URL or pasted text) that outlines the scenario.
    """)

    # Display the text area for scenario input.
    scenario_input = st.text_area(
        label="Detailed Context Description (Situation, Person, Place, or Goal)",
        value="",
        placeholder="Provide a detailed overview or paste in a news article (URL or text) outlining the scenario. Include relevant background, context, key details, and objectives..."
    )

    # Display an optional objective field below the scenario input.
    objective_input = st.text_input(
        label="Optional Objective",
        value="",
        placeholder="Optional: Specify an objective (e.g., counter, enable, support, delay, deny) as an action verb..."
    )

    # Checkbox to include Wikipedia results.
    include_wikipedia = st.checkbox("Include Wikipedia Results to help generate questions", value=False)
    # Checkbox to include Google search results.
    include_google_search = st.checkbox("Include Google Search Results", value=False)
    st.session_state["include_google_search"] = include_google_search

    # The Process Scenario button is always visible.
    if st.button("Process Scenario"):
        if scenario_input.strip():
            processed_scenario = process_scenario_input(scenario_input)
            # If Wikipedia results are desired, retrieve and append their summary.
            if include_wikipedia:
                wiki_results_summary = generate_wikipedia_results(processed_scenario)
                processed_scenario += "\n\nWikipedia Summary:\n" + wiki_results_summary
            # If an objective is provided, append it to the processed scenario.
            if objective_input.strip():
                processed_scenario += "\n\nObjective:\n" + objective_input.strip()
            st.session_state["processed_scenario"] = processed_scenario
            st.session_state["objective"] = objective_input.strip()
        else:
            st.error("Please enter a valid scenario before clicking Process Scenario.")

    if "processed_scenario" in st.session_state:
        st.subheader("Analyzed Scenario Content")
        st.write(st.session_state["processed_scenario"])
        if "objective" in st.session_state and st.session_state["objective"]:
            st.write("Objective:", st.session_state["objective"])
        
        # Wikipedia Results (if selected)
        if include_wikipedia:
            st.subheader("Wikipedia Search Results")
            wiki_results = generate_wikipedia_results(st.session_state["processed_scenario"])
            st.write(wiki_results)
        
        st.write("Now conduct your DIME analysis based on the scenario above:")

        # Diplomatic Section
        st.subheader("Diplomatic")
        if "dime_diplomatic" not in st.session_state:
            st.session_state["dime_diplomatic"] = ""
        if "diplomatic_analysis" not in st.session_state:
            st.session_state["diplomatic_analysis"] = ""

        col_diplomatic_left, col_diplomatic_right = st.columns([1, 2])
        with col_diplomatic_left:
            if st.button("AI: Suggest Diplomatic Questions"):
                ai_text = ai_suggest_dime(
                    "Diplomatic", 
                    st.session_state["processed_scenario"],
                    st.session_state.get("objective", "")
                )
                if ai_text:
                    st.session_state["dime_diplomatic"] = ai_text
                    st.rerun()
            st.write(st.session_state.get("dime_diplomatic", ""))
            
            if st.session_state.get("dime_diplomatic", ""):
                if st.session_state.get("include_google_search"):
                    if st.button("Google: Search & Summarize Diplomatic", key="google_diplomatic"):
                        google_results = generate_google_results(st.session_state["dime_diplomatic"])
                        st.session_state["google_diplomatic_result"] = google_results
                        st.rerun()
                    if "google_diplomatic_result" in st.session_state:
                        st.write(st.session_state["google_diplomatic_result"])
                
                # The Recommend button is here.
                if st.button("AI: Recommend Diplomatic Data", key="recommend_diplomatic_btn"):
                    recommendation = recommend_dime_category(
                        "Diplomatic",
                        st.session_state.get("google_diplomatic_result", st.session_state["dime_diplomatic"])
                    )
                    # Append the recommendation to the current text of the analysis box.
                    existing_text = st.session_state.get("diplomatic_analysis", "")
                    appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                    st.session_state["diplomatic_analysis"] = appended_text
                    st.session_state["recommend_diplomatic_result"] = recommendation
                    st.rerun()

        with col_diplomatic_right:
            # Use st.session_state to hold and display any previously entered and/or appended recommended text.
            current_text = st.session_state.get("diplomatic_analysis", "")
            st.text_area(
                 "Diplomatic Analysis",
                 value=current_text,
                 height=150,
                 placeholder="Enter your insights and data related to diplomatic aspects here...",
                 key="diplomatic_analysis"
            )

        # Information Section
        st.subheader("Information")
        if "dime_information" not in st.session_state:
            st.session_state["dime_information"] = ""
        col_information_left, col_information_right = st.columns([1, 2])
        with col_information_left:
            if st.button("AI: Suggest Information Questions"):
                ai_text = ai_suggest_dime("Information", st.session_state["processed_scenario"])
                if ai_text:
                    st.session_state["dime_information"] = ai_text
                    st.rerun()
            st.write(st.session_state.get("dime_information", ""))
            if st.session_state.get("dime_information", "") and st.session_state.get("include_google_search"):
                if st.button("Google: Search & Summarize Information", key="google_information"):
                    google_results = generate_google_results(st.session_state["dime_information"])
                    st.session_state["google_information_result"] = google_results
                    st.rerun()
                if "google_information_result" in st.session_state:
                    st.write(st.session_state["google_information_result"])
        with col_information_right:
            st.text_area(
                "Information Analysis",
                height=150,
                placeholder="Enter your insights and data related to information aspects here..."
            )

        # Military Section
        st.subheader("Military")
        if "dime_military" not in st.session_state:
            st.session_state["dime_military"] = ""
        col_military_left, col_military_right = st.columns([1, 2])
        with col_military_left:
            if st.button("AI: Suggest Military Questions"):
                ai_text = ai_suggest_dime("Military", st.session_state["processed_scenario"])
                if ai_text:
                    st.session_state["dime_military"] = ai_text
                    st.rerun()
            st.write(st.session_state.get("dime_military", ""))
            if st.session_state.get("dime_military", "") and st.session_state.get("include_google_search"):
                if st.button("Google: Search & Summarize Military", key="google_military"):
                    google_results = generate_google_results(st.session_state["dime_military"])
                    st.session_state["google_military_result"] = google_results
                    st.rerun()
                if "google_military_result" in st.session_state:
                    st.write(st.session_state["google_military_result"])
        with col_military_right:
            st.text_area(
                "Military Analysis",
                height=150,
                placeholder="Enter your insights and data related to military aspects here..."
            )

        # Economic Section
        st.subheader("Economic")
        if "dime_economic" not in st.session_state:
            st.session_state["dime_economic"] = ""
        col_economic_left, col_economic_right = st.columns([1, 2])
        with col_economic_left:
            if st.button("AI: Suggest Economic Questions"):
                ai_text = ai_suggest_dime("Economic", st.session_state["processed_scenario"])
                if ai_text:
                    st.session_state["dime_economic"] = ai_text
                    st.rerun()
            st.write(st.session_state.get("dime_economic", ""))
            if st.session_state.get("dime_economic", "") and st.session_state.get("include_google_search"):
                if st.button("Google: Search & Summarize Economic", key="google_economic"):
                    google_results = generate_google_results(st.session_state["dime_economic"])
                    st.session_state["google_economic_result"] = google_results
                    st.rerun()
                if "google_economic_result" in st.session_state:
                    st.write(st.session_state["google_economic_result"])
        with col_economic_right:
            st.text_area(
                "Economic Analysis",
                height=150,
                placeholder="Enter your insights and data related to economic aspects here..."
            )

        # Export Option
        st.markdown("---")
        st.subheader("Export Analysis")
        file_name = st.text_input("Enter export file name", "dime_analysis.txt")
        if st.button("Export DIME Analysis"):
            file_content = (
                "Situation / Goal:\n" + st.session_state["processed_scenario"] + "\n\n" +
                "Objective:\n" + st.session_state.get("objective", "None") + "\n\n" +
                "Diplomatic:\n" + st.session_state.get("dime_diplomatic", "") + "\n\n" +
                "Information:\n" + st.session_state.get("dime_information", "") + "\n\n" +
                "Military:\n" + st.session_state.get("dime_military", "") + "\n\n" +
                "Economic:\n" + st.session_state.get("dime_economic", "") + "\n\n"
            )
            with open(file_name, "w") as f:
                f.write(file_content)
            st.success(f"Exported DIME analysis to {file_name}")

# Note: When using Streamlit, this module will be loaded as a page.
if __name__ == "__main__":
    dime_page() 