# /pages/frameworks/DIME.py
"""
DIME Analysis Framework
"""
import streamlit as st
import re
import wikipedia
from dotenv import load_dotenv
from utilities.utils_openai import chat_gpt  # Using the same helper as SWOT and COG
from utilities.advanced_scraper import advanced_fetch_metadata  # New import for advanced scraping

load_dotenv()

def process_scenario_input(scenario):
    """
    If the scenario input is a URL, scrape its content using advanced_fetch_metadata 
    and summarize it using GPT with the "gpt-4o-mini" model.
    Otherwise, return the scenario as provided.
    """
    # Simple check to see if the scenario is a URL.
    if scenario.strip().lower().startswith("http://") or scenario.strip().lower().startswith("https://"):
        try:
            # Scrape the page for metadata.
            title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(scenario)
            # Construct a text block from the scraped metadata.
            scraped_text = (
                f"Title: {title}\n"
                f"Description: {description}\n"
                f"Author: {author}\n"
                f"Published Date: {date_published}\n"
                f"Editor: {editor}\n"
                f"Keywords: {keywords}\n"
                f"Referenced Links: {', '.join(referenced_links) if referenced_links else 'None'}"
            )
            # Create a summarization prompt.
            summary_prompt = (
                "Summarize the following content in a concise manner, "
                "highlighting the key insights and context:\n\n" + scraped_text
            )
            # Summarize using GPT with the model "gpt-4o-mini"
            summary = chat_gpt(
                [
                    {"role": "system", "content": "You are a professional summarizer."},
                    {"role": "user", "content": summary_prompt}
                ],
                model="gpt-4o-mini"
            )
            return summary
        except Exception as e:
            st.error(f"Error processing URL: {e}")
            return scenario
    else:
        return scenario

def generate_wikipedia_results(scenario):
    """
    Uses GPT-4o-mini to turn the scenario into 1-3 different queries
    focused on places, people, or events and then returns Wikipedia search results.
    For each query, the first matching article and its summary (2 sentences) are displayed.
    """
    try:
        prompt = (
            "Based on the following scenario, generate 1 to 3 search queries "
            "that would be appropriate for looking up related places, people, or events on Wikipedia. "
            "Output the queries as a semicolon-separated list.\n\n"
            f"Scenario: {scenario}"
        )
        queries_output = chat_gpt(
            [
                {"role": "system", "content": "You are an assistant that generates Wikipedia search queries."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4o-mini"
        )
        # Expecting output such as: "Query1; Query2; Query3"
        queries = [q.strip() for q in queries_output.split(";") if q.strip()]
        if not queries:
            return "No Wikipedia queries generated."

        results_text = ""
        for query in queries:
            results = wikipedia.search(query)
            if results:
                try:
                    summary = wikipedia.summary(results[0], sentences=2)
                    results_text += f"Query: {query}\nTitle: {results[0]}\nSummary: {summary}\n\n"
                except Exception as e:
                    results_text += f"Query: {query}\nError retrieving summary: {e}\n\n"
            else:
                results_text += f"Query: {query}\nNo Wikipedia results found.\n\n"
        return results_text
    except Exception as e:
        return f"Error generating Wikipedia results: {e}"

def ai_suggest_dime(phase, scenario, objective=None):
    """
    Generate 3-5 DIME analysis items for the given phase with a focus on generating intelligence
    requirements that support information forces.
    
    For the Diplomatic phase, the prompt instructs ChatGPT to consider the scenario from a diplomatic 
    perspective, and if an objective is provided, to relate the analysis to accomplishing that objective.
    
    The output should be a semicolon-separated list of items, each formatted as:
      'Question: <question text> | Search: <advanced Google search query>'
    """
    try:
        system_msg = {
            "role": "system",
            "content": (
                "You are an experienced intelligence analyst. Your task is to generate analytical questions focused on identifying "
                "critical intelligence requirements for supporting information forces (including cyber, digital, and OSINT capabilities). "
                "Avoid narrative development or persuasive messaging and instead, focus on pinpointing intelligence gaps, adversary capabilities, "
                "and vulnerabilities."
            )
        }
        # For the Diplomatic phase, include a prompt that makes the AI first consider what is important to know about the scenario diplomatically.
        if phase.lower() == "diplomatic":
            if objective and objective.strip():
                user_content = (
                    f"Scenario: {scenario}\n"
                    f"For the {phase} aspect, generate 3-5 detailed intelligence analysis questions that identify key diplomatic information requirements necessary to support information forces. "
                    f"First, consider what is important to know about this scenario from a diplomatic perspective, especially in relation to accomplishing the following objective: {objective}. "
                    "Focus on aspects such as identifying intelligence gaps, assessing adversary diplomatic strategies, international alliances, negotiation dynamics, "
                    "and vulnerabilities in diplomatic channels. Each item should include a guiding question and an associated advanced Google search query, separated by a semicolon."
                )
            else:
                user_content = (
                    f"Scenario: {scenario}\n"
                    f"For the {phase} aspect, generate 3-5 detailed intelligence analysis questions that identify key diplomatic information requirements necessary to support information forces. "
                    "First, consider what is important to know about this scenario from a diplomatic perspective. "
                    "Focus on aspects such as identifying intelligence gaps, assessing adversary diplomatic strategies, international alliances, negotiation dynamics, "
                    "and vulnerabilities in diplomatic channels. Each item should include a guiding question and an associated advanced Google search query, separated by a semicolon."
                )
        else:
            # For non-diplomatic phases, use the generic prompt.
            user_content = (
                f"Scenario: {scenario}\n"
                f"For the {phase} aspect, generate 3-5 detailed intelligence analysis questions that identify key information requirements necessary to support information forces. "
                "Focus on aspects such as identifying intelligence gaps, assessing adversary digital capabilities, and pinpointing technological vulnerabilities. "
                "Each item should include a guiding question and an associated advanced Google search query, separated by a semicolon."
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

    # Display a checkbox to optionally include Wikipedia search results.
    include_wikipedia = st.checkbox("Include Wikipedia Results to help generate questions", value=False)

    # The Process Scenario button is always visible.
    if st.button("Process Scenario"):
        if scenario_input.strip():
            processed_scenario = process_scenario_input(scenario_input)
            st.session_state["processed_scenario"] = processed_scenario
            st.session_state["objective"] = objective_input.strip()
        else:
            st.error("Please enter a valid scenario before clicking Process Scenario.")

    if "processed_scenario" in st.session_state:
        st.subheader("Analyzed Scenario Content")
        st.write(st.session_state["processed_scenario"])
        if "objective" in st.session_state and st.session_state["objective"]:
            st.write("Objective:", st.session_state["objective"])
        
        # If the user opted to include Wikipedia results, generate and display them.
        if include_wikipedia:
            st.subheader("Wikipedia Search Results")
            wiki_results = generate_wikipedia_results(st.session_state["processed_scenario"])
            st.write(wiki_results)
        
        st.write("Now conduct your DIME analysis based on the scenario above:")

        # Diplomatic Section
        st.subheader("Diplomatic")
        if "dime_diplomatic" not in st.session_state:
            st.session_state["dime_diplomatic"] = ""
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
                    st.experimental_rerun()
            st.write(st.session_state.get("dime_diplomatic", ""))
        with col_diplomatic_right:
            st.text_area(
                "Diplomatic Analysis",
                height=150,
                placeholder="Enter your insights and data related to diplomatic aspects here..."
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
                    st.experimental_rerun()
            st.write(st.session_state.get("dime_information", ""))
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
                    st.experimental_rerun()
            st.write(st.session_state.get("dime_military", ""))
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
                    st.experimental_rerun()
            st.write(st.session_state.get("dime_economic", ""))
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