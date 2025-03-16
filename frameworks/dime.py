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
from utilities.helpers import create_docx_document
from typing import Dict, List, Any, Optional, Union
import os
import json
from frameworks.base_framework import BaseFramework
from utilities.gpt import get_completion
from utilities.helpers import clean_text


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

def ai_suggest_dime(category, scenario, objective=None):
    """
    Generate 3-5 DIME analysis items for the given phase with a focus on generating intelligence
    requirements that support information forces.

    The prompt now includes both the scenario overview and the extracted scenario details (summary) as context.
    The output must be a semicolon-separated list of items, where each item is formatted EXACTLY as follows:
      Question: <question text> | Search: <advanced Google search query using advanced operators and boolean logic>
    Do not include any extraneous text, line breaks, or commentary.
    """
    try:
        # Combine scenario text and details to provide rich context.
        scenario_info = f"Scenario Overview:\n{scenario}\n"
        scenario_details = st.session_state.get("scenario_details", "")
        if scenario_details:
            scenario_info += f"\nScenario Details:\n{scenario_details}\n"

        system_msg = {
            "role": "system",
            "content": (
                "You are an experienced intelligence analyst. Your task is to generate analytical questions that focus on identifying "
                "critical intelligence requirements to support information forces (including cyber, digital, and OSINT capabilities). "
                "Do not provide narrative development or persuasive messaging; instead, focus on pinpointing intelligence gaps, adversary capabilities, "
                "and vulnerabilities."
            )
        }
        if category.lower() == "diplomatic":
            if objective and objective.strip():
                user_content = (
                    f"{scenario_info}"
                    f"Objective: {objective}\n\n"
                    f"For the '{category}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key diplomatic information requirements "
                    "required to support information forces. First, consider what is important to know from a diplomatic perspective, especially in relation to accomplishing the objective provided. "
                    "Output only a semicolon-separated list of items. Each item must be on one line, EXACTLY as follows:\n\n"
                    "Question: <question text> | Search: <advanced Google search query using advanced operators and boolean logic>\n\n"
                    "Do not include any additional words or lines."
                )
            else:
                user_content = (
                    f"{scenario_info}"
                    f"For the '{category}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key diplomatic information requirements "
                    "required to support information forces. First, consider what is important to know from a diplomatic perspective. "
                    "Output only a semicolon-separated list of items. Each item must be on one line, EXACTLY as follows:\n\n"
                    "Question: <question text> | Search: <advanced Google search query using advanced operators and boolean logic>\n\n"
                    "Do not include any additional words or lines."
                )
        else:
            user_content = (
                f"{scenario_info}"
                f"For the '{category}' aspect, generate exactly 3 to 5 detailed intelligence analysis questions that identify key information requirements "
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


def recommend_dime_category(category, base_text, scenario, objective=None):
    """
    Generate a comprehensive intelligence analysis for the specified DIME category based on the provided text.
    The function now integrates the processed scenario, extracted scenario details, any answered questions, and URL body content.
    It instructs GPT to deliver a self-contained analysis that uses its own extensive domain expertise.

    Args:
        category (str): The DIME category (e.g., "Diplomatic", "Information", "Military", "Economic").
        base_text (str): Input text (which may include AI-suggested questions and/or Google search results) to analyze.
        scenario (str): The scenario to analyze.
        objective (str): The objective to analyze.

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

        # Prepend the processed scenario and scenario details to the analysis prompt.
        combined_text = (
            f"Scenario Overview:\n{st.session_state.get('processed_scenario', scenario)}\n\n"
            f"Scenario Details:\n{st.session_state.get('scenario_details', '')}\n\n"
            f"Questions/Search Data for {category}:\n{base_text}"
        )
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
        # Include objective if provided.
        if objective and objective.strip():
            user_prompt = f"Objective: {objective}\n\n" + user_prompt
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

def extract_scenario_details(scenario_text):
    """
    Extracts detailed information from the scenario text by identifying:
    - Actions: What actions are taking place.
    - Actors: Who are the actors performing these actions.
    - Locations of Actions: Where are the actions occurring (country, state, city, neighborhood).
    - Origin of Actors: Where are the actors from.
    - Timing: When are these actions occurring.
    
    The answer is formatted as a concise, bullet-point list with labeled categories.
    """
    prompt = (
        "Based on the following scenario text, extract and list the following pieces of information:\n\n"
        "1. Actions: What actions are taking place.\n"
        "2. Actors: Who are the actors performing these actions.\n"
        "3. Locations of Actions: Where are the actions occurring (specifically, country, state, city, neighborhood if available).\n"
        "4. Origin of Actors: Where are the actors from.\n"
        "5. Timing: When are these actions occurring.\n\n"
        "Please present your answer in a clearly formatted bullet-point list with labels for each category."
    )
    messages = [
        {"role": "system", "content": "You are a detail extractor specialized in scenario analysis."},
        {"role": "user", "content": f"{prompt}\n\nScenario Text:\n{scenario_text}"}
    ]
    response = chat_gpt(messages, model="gpt-4o")
    return response

def dime_page():
    st.title("DIME Analysis Flow")
    
    # Check if we have data from URL processor
    scenario_from_url = st.session_state.get("dime_input_scenario", "")
    title_from_url = st.session_state.get("dime_input_title", "")
    
    st.write("""
        This guided flow helps you conduct a comprehensive DIME analysis (Diplomatic, Information, Military, Economic).
        Start by providing a detailed overview of the context. You can describe a situation, person, place, or goal, or simply drop in a news article (via URL or pasted text) that outlines the scenario.
    """)

    # Display the text area for scenario input with pre-filled data if available
    scenario_input = st.text_area(
        label="Detailed Context Description (Situation, Person, Place, or Goal)",
        value=scenario_from_url if scenario_from_url else "",
        height=200,
        placeholder="Provide a detailed overview or paste in a news article (URL or text) outlining the scenario. Include relevant background, context, key details, and objectives..."
    )

    if scenario_from_url:
        st.info(f"Analyzing content from URL: {title_from_url}")
        # Clear the session state to avoid reusing the data
        st.session_state.pop("dime_input_scenario", None)
        st.session_state.pop("dime_input_title", None)

    # Display an optional objective field below the scenario input.
    objective_input = st.text_input(
        label="Optional Objective",
        value="",
        placeholder="Optional: Specify an objective (e.g., counter, enable, support, delay, deny) as an action verb..."
    )

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
        
        # Display and store additional AI-extracted scenario details.
        scenario_details = extract_scenario_details(st.session_state["processed_scenario"])
        st.subheader("Scenario Details")
        st.write(scenario_details)
        st.session_state["scenario_details"] = scenario_details
        
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
        # Diplomatic Category Section
        ##############################
        st.subheader("Diplomatic")

        if "dime_diplomatic" not in st.session_state:
            st.session_state["dime_diplomatic"] = ""
        if "diplomatic_analysis" not in st.session_state:
            st.session_state["diplomatic_analysis"] = ""
        if "recommend_diplomatic_result" not in st.session_state:
            st.session_state["recommend_diplomatic_result"] = "Click button to generate recommendations."

        if st.button("AI: Suggest Diplomatic Questions", key="suggest_diplomatic"):
            ai_text = ai_suggest_dime(
                "Diplomatic", 
                st.session_state["processed_scenario"],
                st.session_state.get("objective", "")
            )
            if ai_text:
                st.session_state["dime_diplomatic"] = ai_text

        # Display Diplomatic questions (if generated)
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

        # Two-column layout for AI: Recommend Data
        cols_diplomatic = st.columns([1, 3])
        with cols_diplomatic[0]:
            if st.button("AI: Recommend Diplomatic Data", key="recommend_diplomatic_btn"):
                recommendation = recommend_dime_category(
                    "Diplomatic",
                    st.session_state.get("google_diplomatic_result", st.session_state["dime_diplomatic"]),
                    st.session_state["processed_scenario"],
                    st.session_state.get("objective", "")
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
        if "recommend_information_result" not in st.session_state:
            st.session_state["recommend_information_result"] = "Click button to generate recommendations."

        if st.button("AI: Suggest Information Questions", key="suggest_information"):
            ai_text = ai_suggest_dime(
                "Information", 
                st.session_state["processed_scenario"],
                st.session_state.get("objective", "")
            )
            if ai_text:
                st.session_state["dime_information"] = ai_text

        # Display Information questions (if generated)
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
                    st.session_state.get("google_information_result", st.session_state["dime_information"]),
                    st.session_state["processed_scenario"],
                    st.session_state.get("objective", "")
                )
                existing_text = st.session_state.get("information_analysis", "")
                appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                st.session_state["information_analysis"] = appended_text
                st.session_state["recommend_information_result"] = recommendation
        with cols_information[1]:
            st.markdown("**Information Recommendations:**")
            recommendation_display = st.session_state.get("recommend_information_result", "Click button to generate recommendations.")
            st.write(recommendation_display)

        if st.session_state.get("include_google_search"):
            if st.button("Google: Search & Summarize Information", key="google_information"):
                google_results = generate_google_results(st.session_state["dime_information"])
                st.session_state["google_information_result"] = google_results
            if "google_information_result" in st.session_state:
                st.write(st.session_state["google_information_result"])

        st.text_area(
            "Information Analysis",
            key="information_analysis",
            height=150,
            placeholder="Enter your insights and data related to information aspects here..."
        )

        ##############################
        # Military Category Section
        ##############################
        st.subheader("Military")

        if "dime_military" not in st.session_state:
            st.session_state["dime_military"] = ""
        if "military_analysis" not in st.session_state:
            st.session_state["military_analysis"] = ""
        if "recommend_military_result" not in st.session_state:
            st.session_state["recommend_military_result"] = "Click button to generate recommendations."

        if st.button("AI: Suggest Military Questions", key="suggest_military"):
            ai_text = ai_suggest_dime(
                "Military", 
                st.session_state["processed_scenario"],
                st.session_state.get("objective", "")
            )
            if ai_text:
                st.session_state["dime_military"] = ai_text

        # Display Military questions (if generated)
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
                    st.session_state.get("google_military_result", st.session_state["dime_military"]),
                    st.session_state["processed_scenario"],
                    st.session_state.get("objective", "")
                )
                existing_text = st.session_state.get("military_analysis", "")
                appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                st.session_state["military_analysis"] = appended_text
                st.session_state["recommend_military_result"] = recommendation
        with cols_military[1]:
            st.markdown("**Military Recommendations:**")
            recommendation_display = st.session_state.get("recommend_military_result", "Click button to generate recommendations.")
            st.write(recommendation_display)

        if st.session_state.get("include_google_search"):
            if st.button("Google: Search & Summarize Military", key="google_military"):
                google_results = generate_google_results(st.session_state["dime_military"])
                st.session_state["google_military_result"] = google_results
            if "google_military_result" in st.session_state:
                st.write(st.session_state["google_military_result"])

        st.text_area(
            "Military Analysis",
            key="military_analysis",
            height=150,
            placeholder="Enter your insights and data related to military aspects here..."
        )

        ##############################
        # Economic Category Section
        ##############################
        st.subheader("Economic")

        if "dime_economic" not in st.session_state:
            st.session_state["dime_economic"] = ""
        if "economic_analysis" not in st.session_state:
            st.session_state["economic_analysis"] = ""
        if "recommend_economic_result" not in st.session_state:
            st.session_state["recommend_economic_result"] = "Click button to generate recommendations."

        if st.button("AI: Suggest Economic Questions", key="suggest_economic"):
            ai_text = ai_suggest_dime(
                "Economic", 
                st.session_state["processed_scenario"],
                st.session_state.get("objective", "")
            )
            if ai_text:
                st.session_state["dime_economic"] = ai_text

        # Display Economic questions (if generated)
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
                    st.session_state.get("google_economic_result", st.session_state["dime_economic"]),
                    st.session_state["processed_scenario"],
                    st.session_state.get("objective", "")
                )
                existing_text = st.session_state.get("economic_analysis", "")
                appended_text = (existing_text + "\n\n" + recommendation).strip() if existing_text else recommendation
                st.session_state["economic_analysis"] = appended_text
                st.session_state["recommend_economic_result"] = recommendation
        with cols_economic[1]:
            st.markdown("**Economic Recommendations:**")
            recommendation_display = st.session_state.get("recommend_economic_result", "Click button to generate recommendations.")
            st.write(recommendation_display)

        if st.session_state.get("include_google_search"):
            if st.button("Google: Search & Summarize Economic", key="google_economic"):
                google_results = generate_google_results(st.session_state["dime_economic"])
                st.session_state["google_economic_result"] = google_results
            if "google_economic_result" in st.session_state:
                st.write(st.session_state["google_economic_result"])

        st.text_area(
            "Economic Analysis",
            key="economic_analysis",
            height=150,
            placeholder="Enter your insights and data related to economic aspects here..."
        )

        ##############################
        # Export Option
        ##############################
        st.markdown("---")
        st.subheader("Export DIME Analysis")
        title_doc = st.text_input("Enter export file name for DIME analysis", "dime_analysis")
        if st.button("Export DIME Analysis as DOCX Document"):
            sections = {
                "Scenario Overview": st.session_state.get("processed_scenario", "No scenario provided."),
                "Scenario Details": st.session_state.get("scenario_details", "No scenario details available."),
                "Objective": st.session_state.get("objective", "").strip(),  # Include Objective if defined; blank if not
                "Diplomatic Questions": st.session_state.get("dime_diplomatic", ""),  # Diplomatic questions (blank if not answered)
                "Information Questions": st.session_state.get("dime_information", ""),  # Information questions (blank if not answered)
                "Military Questions": st.session_state.get("dime_military", ""),  # Military questions (blank if not answered)
                "Economic Questions": st.session_state.get("dime_economic", ""),  # Economic questions (blank if not answered)
                "Diplomatic Analysis": st.session_state.get("diplomatic_analysis", ""),
                "Information Analysis": st.session_state.get("information_analysis", ""),
                "Military Analysis": st.session_state.get("military_analysis", ""),
                "Economic Analysis": st.session_state.get("economic_analysis", "")
            }
    
            # Create DOCX file (ensure that create_docx_document is defined elsewhere in your codebase).
            docx_file = create_docx_document(title_doc, sections)
            st.download_button(
                label="Download DOCX",
                data=docx_file,
                file_name=f"{title_doc}.docx",
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )

# Note: When using Streamlit, this module will be loaded as a page.
if __name__ == "__main__":
    dime_page()

class DIME(BaseFramework):
    """DIME (Diplomatic, Information, Military, Economic) Analysis Framework"""
    
    def __init__(self):
        super().__init__(name="DIME")
        self.components = ["diplomatic", "information", "military", "economic"]
        
        # Initialize question templates
        self._initialize_question_templates()
    
    def _initialize_question_templates(self) -> None:
        """Initialize question templates for each component"""
        # ... existing question templates ...
        
    def generate_questions(self, component: str) -> List[str]:
        """Generate questions for a specific DIME component"""
        if component.lower() not in self.components:
            raise ValueError(f"Component must be one of {self.components}")
            
        # ... existing question generation logic ...
        return questions
    
    def analyze(self, component: str, context: str, use_gpt: bool = True) -> Dict[str, Any]:
        """Analyze a specific component with provided context"""
        questions = self.generate_questions(component)
        
        if use_gpt:
            # Use GPT to analyze
            prompt = f"Context:\n{context}\n\nQuestions about {component.title()} aspects:\n"
            for i, q in enumerate(questions, 1):
                prompt += f"{i}. {q}\n"
            
            response = get_completion(prompt)
            self.set_response(component, response)
            return {"component": component, "response": response}
        else:
            # Return questions for manual analysis
            return {"component": component, "questions": questions}
    
    def analyze_all(self, context: str, use_gpt: bool = True) -> Dict[str, Any]:
        """Analyze all DIME components with provided context"""
        results = {}
        for component in self.components:
            results[component] = self.analyze(component, context, use_gpt)
        return results 