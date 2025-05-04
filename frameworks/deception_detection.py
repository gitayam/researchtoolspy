# /frameworks/deception_detection.py
"""
Deception Detection Framework based on the work of Richards J. Heuer Jr. and CIA SATs methodology.
"""
import json
import logging
import os
import sys
import urllib.parse
from typing import Dict, List, Any, Optional, Tuple

import requests
import streamlit as st
from bs4 import BeautifulSoup

# Add the parent directory to sys.path to allow imports from utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utilities.gpt import chat_gpt, get_completion, get_chat_completion
from utilities import search_generator

# Only import BaseFramework if it's available
try:
    from frameworks.base_framework import BaseFramework
    BASE_FRAMEWORK_AVAILABLE = True
except ImportError:
    BASE_FRAMEWORK_AVAILABLE = False
    logging.warning("BaseFramework not available. Using standalone implementation.")

try:
    from utilities.advanced_scraper import advanced_fetch_metadata, scrape_body_content
    ADVANCED_SCRAPER_AVAILABLE = True
except ImportError:
    ADVANCED_SCRAPER_AVAILABLE = False
    logging.warning("Advanced scraper not available. Using basic scraping functionality.")

class DeceptionDetection(BaseFramework if BASE_FRAMEWORK_AVAILABLE else object):
    """
    Deception Detection Framework based on CIA SATs methodology and Richards J. Heuer Jr.'s work.
    This framework helps analysts determine when to look for deception, discover whether 
    deception is present, and figure out what to do to avoid being deceived.
    """
    
    def __init__(self):
        """Initialize the Deception Detection framework."""
        # Call parent class constructor if available
        if BASE_FRAMEWORK_AVAILABLE:
            super().__init__("Deception Detection")
            
        self.framework_name = "Deception Detection"
        self.initialize_session_state()
        
        # Define components for BaseFramework compatibility
        if BASE_FRAMEWORK_AVAILABLE:
            self.components = ["scenario", "mom", "pop", "moses", "eve"]
    
    def generate_questions(self, component: str) -> List[str]:
        """
        Generate questions for a specific component of the framework.
        This is an abstract method from BaseFramework that must be implemented.
        
        Args:
            component: The component to generate questions for
            
        Returns:
            A list of questions for the specified component
        """
        questions = {
            "scenario": [
                "Describe the scenario or information being analyzed",
                "What are the key actors involved?",
                "What is the timeline of events?",
                "What are the suspicious patterns or anomalies?"
            ],
            "mom": [
                "What are the goals and motives of the potential deceiver?",
                "What means are available to feed information to us?",
                "What consequences would the adversary suffer if deception was revealed?",
                "Would they need to sacrifice sensitive information for credibility?",
                "Do they have a way to monitor the impact of the deception?"
            ],
            "pop": [
                "What is the history of deception by this actor or similar actors?",
                "Are there patterns or signatures in their previous deception attempts?",
                "How successful have their previous deception operations been?"
            ],
            "moses": [
                "How much control does the potential deceiver have over our sources?",
                "Do they have access to our collection methods?",
                "How vulnerable are our sources to manipulation?"
            ],
            "eve": [
                "Is the information internally consistent?",
                "Is it confirmed by multiple independent sources?",
                "Does it contradict other reliable information?",
                "Are there any anomalies or unusual patterns?"
            ]
        }
        
        return questions.get(component.lower(), [])
        
    def initialize_session_state_dict(self) -> Dict[str, Any]:
        """Return a dictionary of default session state values."""
        return {
            "mom_responses": {},
            "pop_responses": {},
            "moses_responses": {},
            "eve_responses": {},
            "scenario": "",
            "search_results": {},
            "analysis_history": [],
            "current_analysis_id": None,
            "saved_analyses": {},
            "url_input": "",
            "scraped_content": "",
            "scraped_metadata": {},
            "url_analysis_summary": ""
        }
    
    def initialize_session_state(self) -> None:
        """Initialize all required session state variables with default values."""
        defaults = self.initialize_session_state_dict()
        for key, value in defaults.items():
            if key not in st.session_state:
                st.session_state[key] = value
    
    def render(self) -> None:
        """Render the Deception Detection framework UI."""
        try:
            self._render_header()
            self._render_scenario_section()
            
            # Only show framework sections if a scenario is provided
            if st.session_state.get("scenario", ""):
                self._render_mom_section()
                self._render_pop_section()
                self._render_moses_section()
                self._render_eve_section()
                self._render_summary_section()
        except Exception as e:
            error_msg = f"Error rendering Deception Detection framework: {e}"
            logging.error(error_msg)
            st.error(error_msg)
    
    def _render_header(self) -> None:
        """Render the framework header and description."""
        st.title("Deception Detection Framework")
        
        st.write("""
        **Deception Detection** helps analysts determine when to look for deception, discover whether 
        deception is present, and figure out what to do to avoid being deceived. This framework uses 
        four key checklists: MOM, POP, MOSES, and EVE.
        
        As Richards J. Heuer Jr. noted: *"The accurate perception of deception in counterintelligence 
        analysis is extraordinarily difficult. If deception is done well, the analyst should not expect 
        to see any evidence of it. If, on the other hand, deception is expected, the analyst often 
        will find evidence of deception even when it is not there."*
        """)
    
    def _render_scenario_section(self) -> None:
        """Render the scenario description section."""
        st.markdown("---")
        st.subheader("Scenario Description")
        
        # Add tabs for text input and URL input
        input_tab, url_tab = st.tabs(["Enter Scenario Text", "Analyze URL Content"])
        
        with input_tab:
            # Initialize scenario in session state if not present
            if "scenario" not in st.session_state:
                st.session_state["scenario"] = ""
                
            scenario = st.text_area(
                "Describe the scenario or information being analyzed",
                value=st.session_state["scenario"],
                help="Provide detailed context about the situation where deception might be present. Include key actors, timeline, and any suspicious patterns or anomalies.",
                placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm. The offer seems unusually generous, and the company's background is difficult to verify.\nExample: An organizational social media account made a post claiming major policy changes that seems inconsistent with previous communications and lacks typical approval channels."
            )
            
            # Update session state if scenario changed
            if scenario != st.session_state["scenario"]:
                st.session_state["scenario"] = scenario
        
        with url_tab:
            # Initialize url_input in session state if not present
            if "url_input" not in st.session_state:
                st.session_state["url_input"] = ""
            
            # URL input field
            url_input = st.text_input(
                "Enter a URL to analyze for potential deception",
                value=st.session_state["url_input"],
                help="Enter a URL to a news article, social media post, or other web content that you want to analyze for potential deception.",
                placeholder="https://example.com/article"
            )
            
            # Update session state if URL changed
            if url_input != st.session_state["url_input"]:
                st.session_state["url_input"] = url_input
            
            col1, col2 = st.columns([1, 1])
            
            with col1:
                if st.button(" Scrape URL Content", use_container_width=True):
                    if not url_input:
                        st.warning("Please enter a URL to analyze.")
                    else:
                        with st.spinner("Scraping URL content..."):
                            # Initialize scraped_content and scraped_metadata in session state if not present
                            if "scraped_content" not in st.session_state:
                                st.session_state["scraped_content"] = ""
                            if "scraped_metadata" not in st.session_state:
                                st.session_state["scraped_metadata"] = {}
                            
                            scraped_content, metadata = self._scrape_url_content(url_input)
                            if scraped_content:
                                st.session_state["scraped_content"] = scraped_content
                                st.session_state["scraped_metadata"] = metadata
                                st.success("URL content scraped successfully!")
            
            with col2:
                if st.button(" Analyze Scraped Content", use_container_width=True):
                    if not st.session_state.get("scraped_content"):
                        st.warning("Please scrape URL content first.")
                    else:
                        with st.spinner("Analyzing content for deception..."):
                            # Initialize url_analysis_summary in session state if not present
                            if "url_analysis_summary" not in st.session_state:
                                st.session_state["url_analysis_summary"] = ""
                            
                            analysis_summary = self._analyze_scraped_content(
                                st.session_state["scraped_content"],
                                st.session_state["scraped_metadata"]
                            )
                            st.session_state["url_analysis_summary"] = analysis_summary
                            st.session_state["scenario"] = analysis_summary
                            st.success("Content analyzed and loaded into scenario!")
                            st.rerun()
            
            # Display scraped content if available
            if st.session_state.get("scraped_content"):
                with st.expander("View Scraped Content", expanded=False):
                    # Display metadata
                    if st.session_state.get("scraped_metadata"):
                        st.markdown("### Metadata")
                        for key, value in st.session_state["scraped_metadata"].items():
                            if value:
                                st.markdown(f"**{key}:** {value}")
                        st.markdown("---")
                    
                    # Display content
                    st.markdown("### Content")
                    st.markdown(st.session_state["scraped_content"][:2000] + "..." if len(st.session_state["scraped_content"]) > 2000 else st.session_state["scraped_content"])
            
            # Display analysis summary if available
            if st.session_state.get("url_analysis_summary"):
                with st.expander("View Analysis Summary", expanded=True):
                    st.markdown("### Deception Analysis Summary")
                    st.markdown(st.session_state["url_analysis_summary"])

        # Get AI recommendations for framework priority
        if st.session_state["scenario"]:
            col1, col2 = st.columns([1, 1])
            
            with col1:
                if st.button(" AI: Recommend Framework Priority", use_container_width=True):
                    try:
                        system_msg = {
                            "role": "system",
                            "content": """You are an INTL expert in deception analysis. Based on the scenario, recommend which of these frameworks should be prioritized and in what order:
                            - MOM (Motive, Opportunity, and Means)
                            - POP (Past Opposition Practices)
                            - MOSES (Manipulability of Sources)
                            - EVE (Evaluation of Evidence)
                            
                            Explain why each framework is relevant or less relevant to this specific case."""
                        }
                        user_msg = {
                            "role": "user",
                            "content": f"For this scenario: {st.session_state['scenario']}\nWhat is the recommended priority order for applying these frameworks, and why?"
                        }
                        framework_recommendations = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                        st.info(" Recommended Framework Priority:\n" + framework_recommendations)
                    except Exception as e:
                        st.error(f"Error generating framework recommendations: {e}")
            
            with col2:
                if st.button(" Search for Related Information", use_container_width=True):
                    self._perform_search(st.session_state["scenario"])
    
    def _scrape_url_content(self, url: str) -> Tuple[str, Dict[str, str]]:
        """
        Scrape content from a URL using advanced_scraper if available, or fallback to basic scraping.
        
        Args:
            url: The URL to scrape
            
        Returns:
            Tuple containing (scraped_content, metadata_dict)
        """
        try:
            if ADVANCED_SCRAPER_AVAILABLE:
                # Use advanced scraper
                title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(url)
                body_content = scrape_body_content(url)
                
                metadata = {
                    "Title": title,
                    "Description": description,
                    "Keywords": keywords,
                    "Author": author,
                    "Date Published": date_published,
                    "Editor": editor,
                    "Referenced Links": ", ".join(referenced_links) if referenced_links else "None"
                }
                
                return body_content, metadata
            else:
                # Basic scraping fallback
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, "html.parser")
                
                # Extract basic metadata
                title = soup.title.text if soup.title else "No title found"
                description = soup.find("meta", {"name": "description"})
                description = description["content"] if description else "No description found"
                
                # Extract content from article or main content
                content = ""
                article = soup.find("article")
                if article:
                    content = article.get_text(separator="\n", strip=True)
                else:
                    main = soup.find("main")
                    if main:
                        content = main.get_text(separator="\n", strip=True)
                    else:
                        # Fallback to body
                        body = soup.find("body")
                        if body:
                            content = body.get_text(separator="\n", strip=True)
                
                metadata = {
                    "Title": title,
                    "Description": description,
                    "URL": url
                }
                
                return content, metadata
        except Exception as e:
            error_msg = f"Error scraping URL: {e}"
            logging.error(error_msg)
            st.error(error_msg)
            return f"Error scraping URL: {e}", {"Error": str(e)}
    
    def _analyze_scraped_content(self, content: str, metadata: Dict[str, str]) -> str:
        """
        Analyze scraped content for potential deception using AI.
        
        Args:
            content: The scraped content text
            metadata: Dictionary of metadata about the content
            
        Returns:
            Analysis summary text
        """
        try:
            # Prepare the content for analysis
            formatted_content = f"""
            Title: {metadata.get('Title', 'Unknown')}
            URL: {metadata.get('URL', 'Unknown')}
            Author: {metadata.get('Author', 'Unknown')}
            Date Published: {metadata.get('Date Published', 'Unknown')}
            
            Content:
            {content[:3000]}  # Limit content to 3000 chars to avoid token limits
            """
            
            # Generate analysis using AI
            system_msg = {
                "role": "system",
                "content": """You are an expert in deception detection and intelligence analysis. 
                Analyze the provided content for potential deception using the SATs framework:
                
                1. MOM (Motive, Opportunity, and Means)
                2. POP (Past Opposition Practices)
                3. MOSES (Manipulability of Sources)
                4. EVE (Evaluation of Evidence)
                
                Provide a comprehensive summary that identifies potential deception indicators, 
                source reliability concerns, and key points that should be further investigated.
                Your analysis should be objective, balanced, and highlight both indicators of 
                potential deception and indicators of reliability.
                """
            }
            
            user_msg = {
                "role": "user",
                "content": f"Please analyze this content for potential deception:\n\n{formatted_content}"
            }
            
            analysis = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            return analysis
        except Exception as e:
            error_msg = f"Error analyzing content: {e}"
            logging.error(error_msg)
            st.error(error_msg)
            return f"Error analyzing content: {e}"

    def _perform_search(self, query: str) -> Dict[str, Any]:
        """
        Perform a web search for information related to the scenario.
        
        Args:
            query: The search query string
            
        Returns:
            Dictionary containing search results or empty dict if search failed
        """
        try:
            # Encode the query for search (sanitize input)
            search_query = urllib.parse.quote(query)
            
            # Create a safe URL for Google search
            google_search_url = f"https://google.com/search?q={search_query}"
            
            # Display search button that opens in new tab
            st.markdown(
                f"""
                <div style="text-align: center; margin: 10px 0;">
                    <a href="{google_search_url}" target="_blank" style="text-decoration: none;">
                        <button style="background-color: #4285F4; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                            <img src="https://www.google.com/favicon.ico" style="height: 20px; vertical-align: middle; margin-right: 10px;">
                            Search Google for more information
                        </button>
                    </a>
                </div>
                """,
                unsafe_allow_html=True
            )
            
            # Use the search_generator utility if available
            try:
                search_results = search_generator.generate_search(query)
                if search_results:
                    st.session_state["search_results"] = search_results
                    st.success("Search completed successfully")
                    
                    with st.expander("View Search Results", expanded=True):
                        for i, result in enumerate(search_results[:5]):  # Show top 5 results
                            title = result.get('title', 'No Title')
                            link = result.get('link', '#')
                            snippet = result.get('snippet', 'No description available')
                            
                            st.markdown(f"**{i+1}. [{title}]({link})**")
                            st.markdown(f"{snippet}")
                            st.markdown("---")
                    
                    return search_results
            except Exception as e:
                error_msg = f"Could not use advanced search: {e}"
                logging.warning(error_msg)
                st.warning(error_msg)
                
            return {}
        except Exception as e:
            error_msg = f"Error performing search: {e}"
            logging.error(error_msg)
            st.error(error_msg)
            return {}
    
    def _render_mom_section(self) -> None:
        """Render the Motive, Opportunity, and Means (MOM) section."""
        st.markdown("---")
        st.subheader("1. Motive, Opportunity, and Means (MOM)")
        
        # Initialize mom_responses in session state if not present
        if "mom_responses" not in st.session_state:
            st.session_state["mom_responses"] = {}
        
        mom_questions = {
            "motive": "What are the goals and motives of the potential deceiver?",
            "channels": "What means are available to feed information to us?",
            "risks": "What consequences would the adversary suffer if deception was revealed?",
            "costs": "Would they need to sacrifice sensitive information for credibility?",
            "feedback": "Do they have a way to monitor the impact of the deception?"
        }
        
        for key, question in mom_questions.items():
            if key not in st.session_state["mom_responses"]:
                st.session_state["mom_responses"][key] = ""
            
            col1, col2 = st.columns([4, 1])
            with col1:
                st.session_state["mom_responses"][key] = st.text_area(
                    question,
                    value=st.session_state["mom_responses"][key],
                    key=f"mom_{key}"
                )
            with col2:
                # Add search button for each question
                if st.button(" Search", key=f"search_mom_{key}"):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        
        # AI Suggestions for MOM
        if st.button(" AI: Suggest MOM Considerations", use_container_width=True):
            if not st.session_state["scenario"]:
                st.warning("Please provide a scenario description first.")
            else:
                try:
                    system_msg = {
                        "role": "system",
                        "content": "You are an AI expert in deception analysis. Provide specific considerations for MOM analysis."
                    }
                    user_msg = {
                        "role": "user",
                        "content": f"For this scenario: {st.session_state['scenario']}\nSuggest specific considerations for Motive, Opportunity, and Means analysis."
                    }
                    suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.info("AI Suggestions:\n" + suggestions)
                except Exception as e:
                    error_msg = f"Error generating suggestions: {e}"
                    logging.error(error_msg)
                    st.error(error_msg)

    def _render_pop_section(self) -> None:
        """Render the Past Opposition Practices (POP) section."""
        st.markdown("---")
        st.subheader("2. Past Opposition Practices (POP)")
        
        # Initialize pop_responses in session state if not present
        if "pop_responses" not in st.session_state:
            st.session_state["pop_responses"] = {}
        
        pop_questions = {
            "history": "What is the adversary's history of using deception?",
            "patterns": "What patterns or signatures have been observed in past deceptions?",
            "targets": "What types of targets have they focused on in the past?",
            "techniques": "What specific deception techniques have they employed before?",
            "success": "How successful have their past deception operations been?"
        }
        
        for key, question in pop_questions.items():
            if key not in st.session_state["pop_responses"]:
                st.session_state["pop_responses"][key] = ""
            
            col1, col2 = st.columns([4, 1])
            with col1:
                st.session_state["pop_responses"][key] = st.text_area(
                    question,
                    value=st.session_state["pop_responses"][key],
                    key=f"pop_{key}"
                )
            with col2:
                # Add search button for each question
                if st.button(" Search", key=f"search_pop_{key}"):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        
        # AI Suggestions for POP
        if st.button(" AI: Suggest POP Considerations", use_container_width=True):
            if not st.session_state["scenario"]:
                st.warning("Please provide a scenario description first.")
            else:
                try:
                    system_msg = {
                        "role": "system",
                        "content": "You are an AI expert in deception analysis. Provide specific considerations for POP analysis."
                    }
                    user_msg = {
                        "role": "user",
                        "content": f"For this scenario: {st.session_state['scenario']}\nSuggest specific considerations for Past Opposition Practices analysis."
                    }
                    suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.info("AI Suggestions:\n" + suggestions)
                except Exception as e:
                    error_msg = f"Error generating suggestions: {e}"
                    logging.error(error_msg)
                    st.error(error_msg)

    def _render_moses_section(self) -> None:
        """Render the Manipulability of Sources (MOSES) section."""
        st.markdown("---")
        st.subheader("3. Manipulability of Sources (MOSES)")
        
        # Initialize moses_responses in session state if not present
        if "moses_responses" not in st.session_state:
            st.session_state["moses_responses"] = {}
        
        moses_questions = {
            "control": "How much control does the adversary have over our sources?",
            "access": "Can they access or influence the channels we use to gather information?",
            "credibility": "Are our sources established with a track record of reliability?",
            "corroboration": "Can information be independently verified through multiple sources?",
            "technical": "Are there technical vulnerabilities in our collection methods?"
        }
        
        for key, question in moses_questions.items():
            if key not in st.session_state["moses_responses"]:
                st.session_state["moses_responses"][key] = ""
            
            col1, col2 = st.columns([4, 1])
            with col1:
                st.session_state["moses_responses"][key] = st.text_area(
                    question,
                    value=st.session_state["moses_responses"][key],
                    key=f"moses_{key}"
                )
            with col2:
                # Add search button for each question
                if st.button(" Search", key=f"search_moses_{key}"):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        
        # AI Suggestions for MOSES
        if st.button(" AI: Suggest MOSES Considerations", use_container_width=True):
            if not st.session_state["scenario"]:
                st.warning("Please provide a scenario description first.")
            else:
                try:
                    system_msg = {
                        "role": "system",
                        "content": "You are an AI expert in deception analysis. Provide specific considerations for MOSES analysis."
                    }
                    user_msg = {
                        "role": "user",
                        "content": f"For this scenario: {st.session_state['scenario']}\nSuggest specific considerations for Manipulability of Sources analysis."
                    }
                    suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.info("AI Suggestions:\n" + suggestions)
                except Exception as e:
                    error_msg = f"Error generating suggestions: {e}"
                    logging.error(error_msg)
                    st.error(error_msg)

    def _render_eve_section(self) -> None:
        """Render the Evaluation of Evidence (EVE) section."""
        st.markdown("---")
        st.subheader("4. Evaluation of Evidence (EVE)")
        
        # Initialize eve_responses in session state if not present
        if "eve_responses" not in st.session_state:
            st.session_state["eve_responses"] = {}
        
        eve_questions = {
            "consistency": "Is the information internally consistent and logical?",
            "contradictions": "Are there contradictions with other reliable information?",
            "anomalies": "What anomalies or unusual patterns are present?",
            "timing": "Is the timing of information suspicious or convenient?",
            "omissions": "What important information might be deliberately omitted?"
        }
        
        for key, question in eve_questions.items():
            if key not in st.session_state["eve_responses"]:
                st.session_state["eve_responses"][key] = ""
            
            col1, col2 = st.columns([4, 1])
            with col1:
                st.session_state["eve_responses"][key] = st.text_area(
                    question,
                    value=st.session_state["eve_responses"][key],
                    key=f"eve_{key}"
                )
            with col2:
                # Add search button for each question
                if st.button(" Search", key=f"search_eve_{key}"):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        
        # AI Suggestions for EVE
        if st.button(" AI: Suggest EVE Considerations", use_container_width=True):
            if not st.session_state["scenario"]:
                st.warning("Please provide a scenario description first.")
            else:
                try:
                    system_msg = {
                        "role": "system",
                        "content": "You are an AI expert in deception analysis. Provide specific considerations for EVE analysis."
                    }
                    user_msg = {
                        "role": "user",
                        "content": f"For this scenario: {st.session_state['scenario']}\nSuggest specific considerations for Evaluation of Evidence analysis."
                    }
                    suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.info("AI Suggestions:\n" + suggestions)
                except Exception as e:
                    error_msg = f"Error generating suggestions: {e}"
                    logging.error(error_msg)
                    st.error(error_msg)

    def _render_summary_section(self) -> None:
        """Render the summary and export section."""
        st.markdown("---")
        st.subheader("Summary and Export")

        if st.button("Generate Analysis Summary"):
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI expert in deception analysis. Provide a comprehensive summary of the deception analysis."
                }
                
                # Prepare the analysis content for the AI
                analysis_content = f"""
                Scenario: {st.session_state['scenario']}
                
                MOM Analysis:
                {dict(st.session_state['mom_responses'])}
                
                POP Analysis:
                {dict(st.session_state['pop_responses'])}
                
                MOSES Analysis:
                {dict(st.session_state['moses_responses'])}
                
                EVE Analysis:
                {dict(st.session_state['eve_responses'])}
                """
                
                user_msg = {
                    "role": "user",
                    "content": f"Please provide a comprehensive summary of this deception analysis:\n{analysis_content}"
                }
                
                summary = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.info("Analysis Summary:\n" + summary)
            except Exception as e:
                error_msg = f"Error generating summary: {e}"
                logging.error(error_msg)
                st.error(error_msg)

        # Export functionality
        if st.button("Export Analysis"):
            try:
                # Create a formatted string of the analysis
                analysis_text = (
                    f"Deception Detection Analysis\n\n"
                    f"Scenario:\n{st.session_state['scenario']}\n\n"
                    "1. Motive, Opportunity, and Means (MOM):\n"
                    + "".join(f"- {q}: {st.session_state['mom_responses'].get(k, '')}\n" for k, q in mom_questions.items()) + "\n"
                    "2. Past Opposition Practices (POP):\n"
                    + "".join(f"- {q}: {st.session_state['pop_responses'].get(k, '')}\n" for k, q in pop_questions.items()) + "\n"
                    "3. Manipulability of Sources (MOSES):\n"
                    + "".join(f"- {q}: {st.session_state['moses_responses'].get(k, '')}\n" for k, q in moses_questions.items()) + "\n"
                    "4. Evaluation of Evidence (EVE):\n"
                    + "".join(f"- {q}: {st.session_state['eve_responses'].get(k, '')}\n" for k, q in eve_questions.items())
                )
                
                # Create a download button
                st.download_button(
                    label="Download Analysis",
                    data=analysis_text,
                    file_name="deception_detection_analysis.txt",
                    mime="text/plain"
                )
            except Exception as e:
                error_msg = f"Error exporting analysis: {e}"
                logging.error(error_msg)
                st.error(error_msg)

        st.markdown("---")
        st.info("""
        **Note**: Remember that deception detection is an iterative process. Regular review and updates
        of this analysis as new information becomes available is recommended. Consider using this framework
        in conjunction with other analytical techniques such as Analysis of Competing Hypotheses (ACH).
        """)

def _legacy_deception_detection():
    """Legacy implementation as a fallback in case the class-based version fails."""
    st.title("Deception Detection Framework")
    
    st.write("""
    **Deception Detection** helps analysts determine when to look for deception, discover whether 
    deception is present, and figure out what to do to avoid being deceived. This framework uses 
    four key checklists: MOM, POP, MOSES, and EVE.
    
    As Richards J. Heuer Jr. noted: *"The accurate perception of deception in counterintelligence 
    analysis is extraordinarily difficult. If deception is done well, the analyst should not expect 
    to see any evidence of it. If, on the other hand, deception is expected, the analyst often 
    will find evidence of deception even when it is not there."*
    """)
    
    # Initialize session state
    if "mom_responses" not in st.session_state:
        st.session_state["mom_responses"] = {}
    if "pop_responses" not in st.session_state:
        st.session_state["pop_responses"] = {}
    if "moses_responses" not in st.session_state:
        st.session_state["moses_responses"] = {}
    if "eve_responses" not in st.session_state:
        st.session_state["eve_responses"] = {}
    
    # Scenario Description
    st.markdown("---")
    st.subheader("Scenario Description")
    
    scenario = st.text_area(
        "Describe the scenario or information being analyzed",
        help="Provide detailed context about the situation where deception might be present. Include key actors, timeline, and any suspicious patterns or anomalies.",
        placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm. The offer seems unusually generous, and the company's background is difficult to verify.\nExample: An organizational social media account made a post claiming major policy changes that seems inconsistent with previous communications and lacks typical approval channels."
    )
    
    # Simplified implementation with just the basic framework
    st.info("Using simplified version of the framework. For full functionality, please check system requirements.")
    
    # Basic MOM section
    st.markdown("---")
    st.subheader("1. Motive, Opportunity, and Means (MOM)")
    
    mom_questions = {
        "motive": "What are the goals and motives of the potential deceiver?",
        "channels": "What means are available to feed information to us?",
        "risks": "What consequences would the adversary suffer if deception was revealed?",
        "costs": "Would they need to sacrifice sensitive information for credibility?",
        "feedback": "Do they have a way to monitor the impact of the deception?"
    }
    
    for key, question in mom_questions.items():
        if key not in st.session_state["mom_responses"]:
            st.session_state["mom_responses"][key] = ""
        
        st.session_state["mom_responses"][key] = st.text_area(
            question,
            value=st.session_state["mom_responses"][key],
            key=f"mom_{key}"
        )
    
    # Basic POP section
    st.markdown("---")
    st.subheader("2. Past Opposition Practices (POP)")
    
    pop_questions = {
        "history": "What is the history of deception by this actor or similar actors?",
        "patterns": "Are there patterns or signatures in their previous deception attempts?",
        "success": "How successful have their previous deception operations been?"
    }
    
    for key, question in pop_questions.items():
        if key not in st.session_state["pop_responses"]:
            st.session_state["pop_responses"][key] = ""
        
        st.session_state["pop_responses"][key] = st.text_area(
            question,
            value=st.session_state["pop_responses"][key],
            key=f"pop_{key}"
        )
    
    # Basic MOSES section
    st.markdown("---")
    st.subheader("3. Manipulability of Sources (MOSES)")
    
    moses_questions = {
        "control": "How much control does the potential deceiver have over our sources?",
        "access": "Do they have access to our collection methods?",
        "vulnerability": "How vulnerable are our sources to manipulation?"
    }
    
    for key, question in moses_questions.items():
        if key not in st.session_state["moses_responses"]:
            st.session_state["moses_responses"][key] = ""
        
        st.session_state["moses_responses"][key] = st.text_area(
            question,
            value=st.session_state["moses_responses"][key],
            key=f"moses_{key}"
        )
    
    # Basic EVE section
    st.markdown("---")
    st.subheader("4. Evaluation of Evidence (EVE)")
    
    eve_questions = {
        "consistency": "Is the information internally consistent?",
        "confirmation": "Is it confirmed by multiple independent sources?",
        "contradictions": "Does it contradict other reliable information?",
        "anomalies": "Are there any anomalies or unusual patterns?"
    }
    
    for key, question in eve_questions.items():
        if key not in st.session_state["eve_responses"]:
            st.session_state["eve_responses"][key] = ""
        
        st.session_state["eve_responses"][key] = st.text_area(
            question,
            value=st.session_state["eve_responses"][key],
            key=f"eve_{key}"
        )
    
    st.markdown("---")
    st.info("""
    **Note**: This is a simplified version of the Deception Detection framework.
    """)

def deception_detection():
    """
    Main entry point for the Deception Detection framework.
    This function is called by the framework loader in Frameworks.py.
    
    Returns:
        None
    """
    try:
        # Initialize and render the framework
        framework = DeceptionDetection()
        framework.render()
    except Exception as e:
        error_msg = f"Error loading Deception Detection framework: {e}"
        logging.error(error_msg)
        st.error(error_msg)
        # Fallback to a simpler implementation if the class-based one fails
        _legacy_deception_detection()

def main():
    """Main function for direct execution of this module."""
    deception_detection()

if __name__ == "__main__":
    main()