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
from utilities.advanced_scraper import advanced_fetch_metadata, google_search_summary, generate_google_results, generate_wikipedia_results, scrape_body_content  # New import for advanced scraping

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
            title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(scenario)
            body_content = scrape_body_content(scenario)
            
            scraped_text = (
                f"Title: {title}\n"
                f"Description: {description}\n"
                f"Author: {author}\n"
                f"Published Date: {date_published}\n"
                f"Editor: {editor}\n"
                f"Keywords: {keywords}\n"
                f"Referenced Links: {', '.join(referenced_links) if referenced_links else 'None'}\n"
                f"Body Content: {body_content}"
            )
            
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
      Question: <question text> | Search: <advanced Google search query using advanced operators and boolean logic>
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
                    "Question: <question text> | Search: <advanced Google search query using advanced operators and boolean logic>\n\n"
                    "Do not include any additional words or lines."
                )
            else:
                user_content = (
                    f"Scenario: {scenario}\n"
                    f"For the '{phase}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key diplomatic information requirements "
                    "required to support information forces. First, consider what is important to know from a diplomatic perspective. "
                    "Output only a semicolon-separated list of items. Each item must be on one line, EXACTLY as follows:\n\n"
                    "Question: <question text> | Search: <advanced Google search query using advanced operators and boolean logic>\n\n"
                    "Do not include any additional words or lines."
                )
        else:
            user_content = (
                f"Scenario: {scenario}\n"
                f"For the '{phase}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key information requirements "
                "required to support information forces. Output only a semicolon-separated list of items. Each item must be on one line, EXACTLY as follows:\n\n"
                "Question: <question text> | Search: <advanced Google search query using advanced operators and boolean logic>\n\n"
                "Do not include any additional words or lines."
            )
        user_msg = {"role": "user", "content": user_content}
        response = chat_gpt([system_msg, user_msg], model="gpt-4o")
        return response
    except Exception as e:
        st.error(f"AI Error: {e}")
        return ""

def recommend_dime_category(category, base_text):
    """
    Generate a comprehensive intelligence analysis for the specified DIME category based on the provided text.
    The function now integrates any answered questions and URL body content along with the provided base text,
    and instructs GPT to deliver a self-contained analysis that uses its own extensive domain expertise.

    Args:
        category (str): The DIME category (e.g., "Diplomatic", "Information", "Military", "Economic").
        base_text (str): Input text (which may include AI-suggested questions and/or Google search results) to analyze.

    Returns:
        str: A self-contained intelligence analysis for the specified category.
    """
    try:
        # Extract answered questions for the given category from st.session_state.
        answered_texts = []
        answer_prefix = f"{category.lower()}_answer_"
        for key, value in st.session_state.items():
            if key.startswith(answer_prefix) and value and value.strip():
                answered_texts.append(value.strip())
        answered_content = "\n".join(answered_texts) if answered_texts else ""
    
        # Extract URL body content from processed scenario if available.
        url_body = ""
        if "processed_scenario" in st.session_state:
            processed_text = st.session_state["processed_scenario"]
            if "Body Content:" in processed_text:
                url_body = processed_text.split("Body Content:", 1)[1].strip()
    
        # Combine the base text with any answered questions and URL body content.
        combined_text = base_text
        if answered_content:
            combined_text += "\n\nUser Provided Insights:\n" + answered_content
        if url_body:
            combined_text += "\n\nURL Body Content:\n" + url_body
    
        system_msg = {
            "role": "system",
            "content": (
                "You are a highly experienced intelligence analyst with deep expertise in global geopolitical and strategic analysis. "
                "Using your subject matter expertise, provide a comprehensive assessment of the topic from a {} perspective. "
                "Synthesize the provided textual information with your extensive knowledge, and deliver a detailed, self-contained analysis "
                "that outlines key insights, historical context, and actionable recommendations. "
                "Do not ask follow-up questions or direct further data collection—simply produce your best answer."
            ).format(category)
        }
        user_prompt = (
            f"Based on the following information, provide your best comprehensive analysis and actionable insights on the topic from a {category} perspective. "
            "Rely on your extensive domain knowledge and ensure your response is self-contained and detailed:\n\n"
            f"{combined_text}"
        )
        recommendation = chat_gpt(
            [
                system_msg,
                {"role": "user", "content": user_prompt}
            ],
            model="gpt-4o"
        )
        return recommendation
    except Exception as e:
        logging.error(f"Error in recommend_dime_category: {e}")
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

    # Process Scenario button is always visible.
    if st.button("Process Scenario"):
        if scenario_input.strip():
            processed_scenario = process_scenario_input(scenario_input)
            st.session_state["processed_scenario"] = processed_scenario
            
            # Instead of merging with the scraped summary, store separately.
            if include_wikipedia:
                st.session_state["wikipedia_summary"] = generate_wikipedia_results(processed_scenario)
            else:
                st.session_state["wikipedia_summary"] = ""
            
            if st.session_state.get("include_google_search"):
                st.session_state["google_summary"] = generate_google_results(processed_scenario)
            else:
                st.session_state["google_summary"] = ""
            
            if objective_input.strip():
                st.session_state["objective"] = objective_input.strip()
            else:
                st.session_state["objective"] = ""
        else:
            st.error("Please enter a valid scenario before clicking Process Scenario.")

    if "processed_scenario" in st.session_state:
        st.subheader("Analyzed Scenario Content")
        st.write(st.session_state["processed_scenario"])
        
        if "objective" in st.session_state and st.session_state["objective"]:
            st.write("Objective:", st.session_state["objective"])
        
        # Display Wikipedia summary as a separate section (if available)
        if st.session_state.get("wikipedia_summary"):
            st.subheader("Wikipedia Summary")
            st.write(st.session_state["wikipedia_summary"])
        
        # Display Google Search summary as a separate section (if available)
        if st.session_state.get("google_summary"):
            st.subheader("Google Search Summary")
            st.write(st.session_state["google_summary"])
        
        st.write("Now conduct your DIME analysis based on the scenario above:")

        ##############################
        # Diplomatic Category Section (Updated UI to always display Recommend Data button)
        ##############################
        st.subheader("Diplomatic")
        if "dime_diplomatic" not in st.session_state:
            st.session_state["dime_diplomatic"] = ""
        if "diplomatic_analysis" not in st.session_state:
            st.session_state["diplomatic_analysis"] = ""
        if "recommend_diplomatic_result" not in st.session_state:
            st.session_state["recommend_diplomatic_result"] = "Click button to generate recommendations."

        # Button to generate AI-suggested Diplomatic Questions
        if st.button("AI: Suggest Diplomatic Questions"):
            ai_text = ai_suggest_dime(
                "Diplomatic", 
                st.session_state["processed_scenario"],
                st.session_state.get("objective", "")
            )
            if ai_text:
                st.session_state["dime_diplomatic"] = ai_text

        # Display Diplomatic Questions if they exist
        diplomatic_questions = st.session_state.get("dime_diplomatic", "")
        if diplomatic_questions:
            for idx, line in enumerate(diplomatic_questions.splitlines()):
                line = line.strip().rstrip(";")
                if not line:
                    continue
                if "|" in line:
                    parts = line.split("|")
                    if len(parts) == 2:
                        question_part, search_part = parts
                        question_text = question_part.strip()
                        search_query = search_part.strip()
                        if question_text.lower().startswith("question:"):
                            question_text = question_text[len("question:"):].strip()
                        if search_query.lower().startswith("search:"):
                            search_query = search_query[len("search:"):].strip()
                            if search_query.startswith('"') and search_query.endswith('"'):
                                search_query = search_query[1:-1]
                        st.markdown(f"**Diplomatic: {question_text}**")
                        st.code(search_query, language="plaintext")
                        st.text_area("Your Answer:", key=f"diplomatic_answer_{idx}", height=80)
                    else:
                        st.write(line)
                else:
                    st.write(line)

        # Always display Recommend Data button and recommendation output
        cols_diplomatic = st.columns([1, 3])
        with cols_diplomatic[0]:
            if st.button("AI: Recommend Diplomatic Data", key="recommend_diplomatic_btn"):
                recommendation = recommend_dime_category(
                    "Diplomatic",
                    st.session_state.get("google_diplomatic_result", st.session_state["dime_diplomatic"])
                )
                existing_text = st.session_state.get("diplomatic_analysis", "")
                appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                st.session_state["diplomatic_analysis"] = appended_text
                st.session_state["recommend_diplomatic_result"] = recommendation
        with cols_diplomatic[1]:
            st.markdown("**Diplomatic Recommendations:**")
            recommendation_display = st.session_state.get("recommend_diplomatic_result", "Click button to generate recommendations.")
            st.write(recommendation_display)

        if st.session_state.get("include_google_search"):
            if st.button("Google: Search & Summarize Diplomatic", key="google_diplomatic"):
                google_results = generate_google_results(st.session_state["dime_diplomatic"])
                st.session_state["google_diplomatic_result"] = google_results
            if "google_diplomatic_result" in st.session_state:
                st.write(st.session_state["google_diplomatic_result"])

        # Analysis Text Area (user input is preserved by not setting a value)
        st.text_area(
            "Diplomatic Analysis",
            key="diplomatic_analysis",
            height=150,
            placeholder="Enter your insights and data related to diplomatic aspects here..."
        )

        ##############################
        # Information Category Section
        ##############################
        st.subheader("Information")
        if "dime_information" not in st.session_state:
            st.session_state["dime_information"] = ""
        if "information_analysis" not in st.session_state:
            st.session_state["information_analysis"] = ""

        if st.button("AI: Suggest Information Questions"):
            ai_text = ai_suggest_dime("Information", st.session_state["processed_scenario"])
            if ai_text:
                st.session_state["dime_information"] = ai_text
                st.rerun()

        information_questions = st.session_state.get("dime_information", "")
        if information_questions:
            for idx, line in enumerate(information_questions.splitlines()):
                line = line.strip().rstrip(";")
                if not line:
                    continue
                if "|" in line:
                    parts = line.split("|")
                    if len(parts) == 2:
                        question_part, search_part = parts
                        question_text = question_part.strip()
                        search_query = search_part.strip()
                        if question_text.lower().startswith("question:"):
                            question_text = question_text[len("question:"):].strip()
                        if search_query.lower().startswith("search:"):
                            search_query = search_query[len("search:"):].strip()
                            if search_query.startswith('"') and search_query.endswith('"'):
                                search_query = search_query[1:-1]
                        st.markdown(f"**Information: {question_text}**")
                        st.code(search_query, language="plaintext")
                        st.text_area("Your Answer:", key=f"information_answer_{idx}", height=80)
                    else:
                        st.write(line)
                else:
                    st.write(line)
            
            cols_information = st.columns([1, 3])
            with cols_information[0]:
                if st.button("AI: Recommend Information Data", key="recommend_information_btn"):
                    recommendation = recommend_dime_category(
                        "Information",
                        st.session_state.get("google_information_result", st.session_state["dime_information"])
                    )
                    existing_text = st.session_state.get("information_analysis", "")
                    appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                    st.session_state["information_analysis"] = appended_text
                    st.session_state["recommend_information_result"] = recommendation
                    st.rerun()
            with cols_information[1]:
                st.markdown("**Information Recommendations:**")
                recommendation_display = st.session_state.get("recommend_information_result", "Click button to generate recommendations.")
                st.write(recommendation_display)
            
            if st.session_state.get("include_google_search"):
                if st.button("Google: Search & Summarize Information", key="google_information"):
                    google_results = generate_google_results(st.session_state["dime_information"])
                    st.session_state["google_information_result"] = google_results
                    st.rerun()
                if "google_information_result" in st.session_state:
                    st.write(st.session_state["google_information_result"])

        current_text = st.session_state.get("information_analysis", "")
        st.text_area(
             "Information Analysis",
             value=current_text,
             height=150,
             placeholder="Enter your insights and data related to information aspects here...",
             key="information_analysis"
        )

        ##############################
        # Military Category Section
        ##############################
        st.subheader("Military")
        if "dime_military" not in st.session_state:
            st.session_state["dime_military"] = ""
        if "military_analysis" not in st.session_state:
            st.session_state["military_analysis"] = ""
    
        if st.button("AI: Suggest Military Questions"):
            ai_text = ai_suggest_dime("Military", st.session_state["processed_scenario"])
            if ai_text:
                st.session_state["dime_military"] = ai_text
                st.rerun()

        military_questions = st.session_state.get("dime_military", "")
        if military_questions:
            for idx, line in enumerate(military_questions.splitlines()):
                line = line.strip().rstrip(";")
                if not line:
                    continue
                if "|" in line:
                    parts = line.split("|")
                    if len(parts) == 2:
                        question_part, search_part = parts
                        question_text = question_part.strip()
                        search_query = search_part.strip()
                        if question_text.lower().startswith("question:"):
                            question_text = question_text[len("question:"):].strip()
                        if search_query.lower().startswith("search:"):
                            search_query = search_query[len("search:"):].strip()
                            if search_query.startswith('"') and search_query.endswith('"'):
                                search_query = search_query[1:-1]
                        st.markdown(f"**Military: {question_text}**")
                        st.code(search_query, language="plaintext")
                        st.text_area("Your Answer:", key=f"military_answer_{idx}", height=80)
                    else:
                        st.write(line)
                else:
                    st.write(line)
            
            cols_military = st.columns([1, 3])
            with cols_military[0]:
                if st.button("AI: Recommend Military Data", key="recommend_military_btn"):
                    recommendation = recommend_dime_category(
                        "Military",
                        st.session_state.get("google_military_result", st.session_state["dime_military"])
                    )
                    existing_text = st.session_state.get("military_analysis", "")
                    appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                    st.session_state["military_analysis"] = appended_text
                    st.session_state["recommend_military_result"] = recommendation
                    st.rerun()
            with cols_military[1]:
                st.markdown("**Military Recommendations:**")
                recommendation_display = st.session_state.get("recommend_military_result", "Click button to generate recommendations.")
                st.write(recommendation_display)
            
            if st.session_state.get("include_google_search"):
                if st.button("Google: Search & Summarize Military", key="google_military"):
                    google_results = generate_google_results(st.session_state["dime_military"])
                    st.session_state["google_military_result"] = google_results
                    st.rerun()
                if "google_military_result" in st.session_state:
                    st.write(st.session_state["google_military_result"])

        current_text = st.session_state.get("military_analysis", "")
        st.text_area(
             "Military Analysis",
             value=current_text,
             height=150,
             placeholder="Enter your insights and data related to military aspects here...",
             key="military_analysis"
        )

        ##############################
        # Economic Category Section
        ##############################
        st.subheader("Economic")
        if "dime_economic" not in st.session_state:
            st.session_state["dime_economic"] = ""
        if "economic_analysis" not in st.session_state:
            st.session_state["economic_analysis"] = ""
    
        if st.button("AI: Suggest Economic Questions"):
            ai_text = ai_suggest_dime("Economic", st.session_state["processed_scenario"])
            if ai_text:
                st.session_state["dime_economic"] = ai_text
                st.rerun()

        economic_questions = st.session_state.get("dime_economic", "")
        if economic_questions:
            for idx, line in enumerate(economic_questions.splitlines()):
                line = line.strip().rstrip(";")
                if not line:
                    continue
                if "|" in line:
                    parts = line.split("|")
                    if len(parts) == 2:
                        question_part, search_part = parts
                        question_text = question_part.strip()
                        search_query = search_part.strip()
                        if question_text.lower().startswith("question:"):
                            question_text = question_text[len("question:"):].strip()
                        if search_query.lower().startswith("search:"):
                            search_query = search_query[len("search:"):].strip()
                            if search_query.startswith('"') and search_query.endswith('"'):
                                search_query = search_query[1:-1]
                        st.markdown(f"**Economic: {question_text}**")
                        st.code(search_query, language="plaintext")
                        st.text_area("Your Answer:", key=f"economic_answer_{idx}", height=80)
                    else:
                        st.write(line)
                else:
                    st.write(line)
            
            cols_economic = st.columns([1, 3])
            with cols_economic[0]:
                if st.button("AI: Recommend Economic Data", key="recommend_economic_btn"):
                    recommendation = recommend_dime_category(
                        "Economic",
                        st.session_state.get("google_economic_result", st.session_state["dime_economic"])
                    )
                    existing_text = st.session_state.get("economic_analysis", "")
                    appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                    st.session_state["economic_analysis"] = appended_text
                    st.session_state["recommend_economic_result"] = recommendation
                    st.rerun()
            with cols_economic[1]:
                st.markdown("**Economic Recommendations:**")
                recommendation_display = st.session_state.get("recommend_economic_result", "Click button to generate recommendations.")
                st.write(recommendation_display)
            
            if st.session_state.get("include_google_search"):
                if st.button("Google: Search & Summarize Economic", key="google_economic"):
                    google_results = generate_google_results(st.session_state["dime_economic"])
                    st.session_state["google_economic_result"] = google_results
                    st.rerun()
                if "google_economic_result" in st.session_state:
                    st.write(st.session_state["google_economic_result"])

        current_text = st.session_state.get("economic_analysis", "")
        st.text_area(
             "Economic Analysis",
             value=current_text,
             height=150,
             placeholder="Enter your insights and data related to economic aspects here...",
             key="economic_analysis"
        )

        ##############################
        # Export Option
        ##############################
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