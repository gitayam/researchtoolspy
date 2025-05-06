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
from datetime import datetime

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
            self.components = ["scenario", "mom", "pop", "moses", "eve"]
            for component in self.components:
                self.questions[component] = self.generate_questions(component)
        else:
            self.framework_name = "Deception Detection"
        self.initialize_session_state_dict()

    def initialize_session_state_dict(self) -> None:
        """Ensure all required session state variables are initialized."""
        defaults = {
            "scenario": "",
            "url_input": "",
            "scraped_content": "",
            "scraped_metadata": {},
            "mom_responses": {k: "" for k in ["motive", "channels", "risks", "costs", "feedback"]},
            "pop_responses": {},
            "moses_responses": {},
            "eve_responses": {},
        }
        for k, v in defaults.items():
            if k not in st.session_state:
                st.session_state[k] = v
    
    def _card_container(self, content: str, color: str = "#ffffff", border: str = "#ddd") -> None:
        st.markdown(f'<div style="background-color:{color}; padding:15px; border-radius:5px; border:1px solid {border}; margin-bottom:20px;">{content}</div>', unsafe_allow_html=True)

    def _section_header(self, number: int, title: str, color: str = "#FF4B4B") -> None:
        st.markdown(f"""
        <div style="display:flex; align-items:center; margin:30px 0 10px 0;">
            <div style="background-color:{color}; color:white; width:30px; height:30px; border-radius:50%; 
                    display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
                {number}
            </div>
            <h2 style="margin:0; color:#1E1E1E;">{title}</h2>
        </div>
        """, unsafe_allow_html=True)

    def render(self) -> None:
        """Render the Deception Detection framework UI with improved UX."""
        try:
            # Sidebar navigation and progress summary
            with st.sidebar:
                st.title(" Deception Detection")
                st.markdown("""
                <div style='font-size:15px; margin-bottom:20px;'>
                This tool guides you through a structured analysis to detect possible deception in intelligence scenarios.
                </div>
                """, unsafe_allow_html=True)
                progress = 0.0
                if st.session_state.get("scenario"): progress += 0.2
                if any(st.session_state.get("mom_responses", {}).values()): progress += 0.2
                if any(st.session_state.get("pop_responses", {}).values()): progress += 0.2
                if any(st.session_state.get("moses_responses", {}).values()): progress += 0.2
                if any(st.session_state.get("eve_responses", {}).values()): progress += 0.2
                st.progress(progress)
                st.markdown(f"**Progress:** {int(progress*100)}% Complete")
                st.markdown("---")
                if st.button(" Reset Analysis"):
                    for k in list(st.session_state.keys()):
                        if k in ["scenario", "url_input", "scraped_content", "scraped_metadata", "mom_responses", "pop_responses", "moses_responses", "eve_responses"]:
                            del st.session_state[k]
                    st.experimental_rerun()
                st.markdown("---")
                st.markdown("<small>Framework by Richards J. Heuer Jr. / CIA SATs</small>", unsafe_allow_html=True)

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
        
    def _render_header(self) -> None:
        """Render the framework header and description."""
        st.markdown("""
        <div style="background-color:#f0f2f6; padding:20px; border-radius:10px; margin-bottom:20px; border-left:5px solid #FF4B4B;">
            <h1 style="color:#1E1E1E; margin-top:0;">Deception Detection Framework</h1>
            <p style="font-size:16px; color:#424242;">
                <strong>Deception Detection</strong> helps analysts determine when to look for deception, discover whether 
                deception is present, and figure out what to do to avoid being deceived. This framework uses 
                four key checklists: <span style="color:#FF4B4B;">MOM</span>, <span style="color:#FF4B4B;">POP</span>, 
                <span style="color:#FF4B4B;">MOSES</span>, and <span style="color:#FF4B4B;">EVE</span>.
            </p>
            <blockquote style="border-left:3px solid #FF4B4B; padding-left:15px; margin:15px 0; font-style:italic; color:#555;">
                "The accurate perception of deception in counterintelligence 
                analysis is extraordinarily difficult. If deception is done well, the analyst should not expect 
                to see any evidence of it. If, on the other hand, deception is expected, the analyst often 
                will find evidence of deception even when it is not there."<br>
                <span style="font-weight:bold; font-size:14px;">— Richards J. Heuer Jr.</span>
            </blockquote>
        </div>
        """, unsafe_allow_html=True)
    
    def _render_scenario_section(self) -> None:
        """Render the scenario description section."""
        st.markdown("""
        <div style="display:flex; align-items:center; margin-bottom:10px;">
            <div style="background-color:#FF4B4B; color:white; width:30px; height:30px; border-radius:50%; 
                    display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
                1
            </div>
            <h2 style="margin:0; color:#1E1E1E;">Scenario Description</h2>
        </div>
        """, unsafe_allow_html=True)
        
        # Create a card-like container for the scenario input
        st.markdown('<div style="background-color:white; padding:15px; border-radius:5px; border:1px solid #ddd; margin-bottom:20px;">', unsafe_allow_html=True)
        
        scenario = st.text_area(
            "Describe the scenario or information being analyzed",
            value=st.session_state.get("scenario", ""),
            height=150,
            help="Provide detailed context about the situation where deception might be present. Include key actors, timeline, and any suspicious patterns or anomalies.",
            placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm. The offer seems unusually generous, and the company's background is difficult to verify.\nExample: An organizational social media account made a post claiming major policy changes that seems inconsistent with previous communications and lacks typical approval channels."
        )
        
        st.session_state["scenario"] = scenario
        
        # Close the card container
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Progress indicator
        if scenario:
            progress_value = 0.2  # 20% complete with scenario filled
            st.progress(progress_value)
            st.markdown(f"""
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:14px;">
                <span>Progress</span>
                <span style="font-weight:bold;">{int(progress_value * 100)}% Complete</span>
            </div>
            """, unsafe_allow_html=True)
        
        # Only show the additional options if a scenario is provided
        if scenario:
            st.markdown("""
            <div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0; border-left:3px solid #4CAF50;">
                <h3 style="margin-top:0; color:#1E1E1E; font-size:18px;">
                    <span style="color:#4CAF50;">✓</span> Scenario Provided
                </h3>
                <p style="margin-bottom:0;">You can now explore additional tools to help with your analysis.</p>
            </div>
            """, unsafe_allow_html=True)
            
            # Create tabs for different actions
            tab1, tab2, tab3 = st.tabs([" URL Analysis", " Search", " AI Recommendations"])
            
            with tab1:
                st.subheader("URL Content Analysis")
                url_input = st.text_input(
                    "Enter a URL to analyze for potential deception",
                    value=st.session_state.get("url_input", ""),
                    placeholder="https://example.com/article-to-analyze"
                )
                st.session_state["url_input"] = url_input
                
                col1, col2 = st.columns([1, 1])
                
                with col1:
                    if st.button(" Scrape URL Content", use_container_width=True, type="primary"):
                        if not url_input:
                            st.warning("Please enter a URL to analyze.")
                        else:
                            with st.spinner("Scraping content from URL..."):
                                try:
                                    content, metadata = self._scrape_url_content(url_input)
                                    st.session_state["scraped_content"] = content
                                    st.session_state["scraped_metadata"] = metadata
                                    
                                    # Show a preview of the scraped content
                                    with st.expander("Content Preview", expanded=True):
                                        st.markdown("### Metadata")
                                        for key, value in metadata.items():
                                            st.markdown(f"**{key}:** {value}")
                                        
                                        st.markdown("### Content Preview")
                                        preview = content[:500] + "..." if len(content) > 500 else content
                                        st.markdown(preview)
                                    
                                    st.success("URL content scraped successfully!")
                                except Exception as e:
                                    st.error(f"Error scraping URL: {e}")
                
                with col2:
                    if st.button(" Analyze Scraped Content", use_container_width=True, type="primary"):
                        if not st.session_state.get("scraped_content"):
                            st.warning("Please scrape URL content first.")
                        else:
                            with st.spinner("Analyzing content for deception indicators..."):
                                try:
                                    analysis = self._analyze_scraped_content(
                                        st.session_state["scraped_content"],
                                        st.session_state["scraped_metadata"]
                                    )
                                    st.session_state["url_analysis_summary"] = analysis
                                    
                                    # Display the analysis in a nice format
                                    st.markdown("""
                                    <div style="background-color:#f0f8ff; padding:15px; border-radius:5px; border:1px solid #b3d1ff;">
                                        <h3 style="color:#0066cc; margin-top:0;">Analysis Results</h3>
                                    """, unsafe_allow_html=True)
                                    
                                    st.markdown(analysis)
                                    
                                    st.markdown("</div>", unsafe_allow_html=True)
                                except Exception as e:
                                    st.error(f"Error analyzing content: {e}")
            
            with tab2:
                st.subheader("Search for Related Information")
                st.markdown("""
                <p style="color:#555; font-size:14px;">
                    Search for additional information related to your scenario to enhance your analysis.
                </p>
                """, unsafe_allow_html=True)
                
                search_query = st.text_input(
                    "Search query",
                    value=scenario[:100] if len(scenario) > 100 else scenario,
                    help="Enter keywords to search for information related to your scenario"
                )
                
                if st.button(" Search", type="primary", use_container_width=True):
                    self._perform_search(search_query)
            
            with tab3:
                st.subheader("AI Framework Recommendations")
                st.markdown("""
                <p style="color:#555; font-size:14px;">
                    Get AI-powered recommendations on which analytical frameworks might be most useful for your scenario.
                </p>
                """, unsafe_allow_html=True)
                
                if st.button(" Get Framework Recommendations", type="primary", use_container_width=True):
                    try:
                        system_msg = {
                            "role": "system",
                            "content": (
                                "You are an expert in intelligence analysis frameworks. "
                                "Your task is to recommend which analytical frameworks would be most useful "
                                "for the given scenario, and in what order they should be applied."
                            )
                        }
                        user_msg = {
                            "role": "user",
                            "content": f"For this scenario: {st.session_state['scenario']}\nWhat is the recommended priority order for applying these frameworks, and why?"
                        }
                        with st.spinner("Generating recommendations..."):
                            framework_recommendations = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                            
                            st.markdown("""
                            <div style="background-color:#f5f5f5; padding:20px; border-radius:5px; border-left:4px solid #9c27b0;">
                                <h3 style="color:#9c27b0; margin-top:0;">
                                    <span style="font-size:24px;"></span> Recommended Framework Priority
                                </h3>
                            """, unsafe_allow_html=True)
                            
                            st.markdown(framework_recommendations)
                            
                            st.markdown("</div>", unsafe_allow_html=True)
                    except Exception as e:
                        st.error(f"Error generating framework recommendations: {e}")
        else:
            st.info("Please provide a scenario description to continue with the analysis.")
    
    def _render_mom_section(self) -> None:
        """Render the Motive, Opportunity, and Means (MOM) section."""
        self._section_header(2, "Motive, Opportunity, and Means (MOM)")
        
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>MOM</strong> analysis helps identify whether a potential deceiver has the <strong style="color:#FF4B4B;">motive</strong>, 
                <strong style="color:#FF4B4B;">opportunity</strong>, and <strong style="color:#FF4B4B;">means</strong> to carry out deception.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        # Create a card-like container for each question
        mom_questions = {
            "motive": "What are the goals and motives of the potential deceiver?",
            "channels": "What means are available to feed information to us?",
            "risks": "What consequences would the adversary suffer if deception was revealed?",
            "costs": "Would they need to sacrifice sensitive information for credibility?",
            "feedback": "Do they have a way to monitor the impact of the deception?"
        }
        
        # Track if any responses have been provided
        has_responses = False
        
        for key, question in mom_questions.items():
            # Initialize in session state if not present
            if key not in st.session_state.get("mom_responses", {}):
                if "mom_responses" not in st.session_state:
                    st.session_state["mom_responses"] = {}
                st.session_state["mom_responses"][key] = ""
            
            self._card_container(question)
            
            col1, col2 = st.columns([3, 1])
            
            with col1:
                response = st.text_area(
                    f"Answer for: {question}",
                    value=st.session_state["mom_responses"].get(key, ""),
                    label_visibility="collapsed",
                    key=f"mom_{key}",
                    height=100
                )
                st.session_state["mom_responses"][key] = response
                
                if response:
                    has_responses = True
            
            with col2:
                # Add search button for each question with improved styling
                if st.button(" Search", key=f"search_mom_{key}", use_container_width=True):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        
        # AI suggestions button with improved styling
        st.markdown("""
        <div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0; border:1px solid #ddd;">
            <h4 style="margin-top:0; color:#1E1E1E;">Need help? Get AI-powered suggestions</h4>
        """, unsafe_allow_html=True)
        
        if st.button(" AI: Suggest MOM Considerations", use_container_width=True, type="primary"):
            if not st.session_state["scenario"]:
                st.warning("Please provide a scenario description first.")
            else:
                with st.spinner("Generating suggestions..."):
                    try:
                        system_msg = {"role": "system", "content": "You are an expert in deception analysis using the MOM framework (Motive, Opportunity, and Means)."}
                        user_msg = {"role": "user", "content": f"For this scenario: {st.session_state['scenario']}\n\nProvide specific considerations for MOM analysis. Format your response with clear headings and bullet points."}
                        
                        suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                        
                        st.markdown("""
                        <div style="background-color:#f0f8ff; padding:20px; border-radius:5px; border-left:4px solid #4CAF50;">
                            <h3 style="color:#4CAF50; margin-top:0;">AI Suggestions</h3>
                        """, unsafe_allow_html=True)
                        
                        st.markdown(suggestions)
                        
                        st.markdown("</div>", unsafe_allow_html=True)
                    except Exception as e:
                        error_msg = f"Error generating suggestions: {e}"
                        logging.error(error_msg)
                        st.error(error_msg)
        
        st.markdown("</div>", unsafe_allow_html=True)
        
        # Progress indicator update if responses provided
        if has_responses:
            progress_value = 0.4  # 40% complete with MOM section filled
            st.progress(progress_value)
            st.markdown(f"""
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:14px;">
                <span>Progress</span>
                <span style="font-weight:bold;">{int(progress_value * 100)}% Complete</span>
            </div>
            """, unsafe_allow_html=True)

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

    def _render_pop_section(self) -> None:
        """Render the Past Opposition Practices (POP) section."""
        self._section_header(3, "Past Opposition Practices (POP)")
        
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
            
            self._card_container(question)
            
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
                        "content": f"For this scenario: {st.session_state['scenario']}\n\nProvide specific considerations for Past Opposition Practices analysis."
                    }
                    suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.info("AI Suggestions:\n" + suggestions)
                except Exception as e:
                    error_msg = f"Error generating suggestions: {e}"
                    logging.error(error_msg)
                    st.error(error_msg)

    def _render_moses_section(self) -> None:
        """Render the Manipulability of Sources (MOSES) section."""
        self._section_header(4, "Manipulability of Sources (MOSES)")
        
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
            
            self._card_container(question)
            
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
                        "content": f"For this scenario: {st.session_state['scenario']}\n\nProvide specific considerations for Manipulability of Sources analysis."
                    }
                    suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.info("AI Suggestions:\n" + suggestions)
                except Exception as e:
                    error_msg = f"Error generating suggestions: {e}"
                    logging.error(error_msg)
                    st.error(error_msg)

    def _render_eve_section(self) -> None:
        """Render the Evaluation of Evidence (EVE) section."""
        self._section_header(5, "Evaluation of Evidence (EVE)")
        
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
            
            self._card_container(question)
            
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
                        "content": f"For this scenario: {st.session_state['scenario']}\n\nProvide specific considerations for Evaluation of Evidence analysis."
                    }
                    suggestions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                    st.info("AI Suggestions:\n" + suggestions)
                except Exception as e:
                    error_msg = f"Error generating suggestions: {e}"
                    logging.error(error_msg)
                    st.error(error_msg)

    def _render_summary_section(self) -> None:
        """Render the summary and export section."""
        self._section_header(6, "Summary and Export")

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
    # Header with improved styling
    st.markdown("""
    <div style="background-color:#f0f2f6; padding:20px; border-radius:10px; margin-bottom:20px; border-left:5px solid #FF4B4B;">
        <h1 style="color:#1E1E1E; margin-top:0;">Deception Detection Framework</h1>
        <p style="font-size:16px; color:#424242;">
            <strong>Deception Detection</strong> helps analysts determine when to look for deception, discover whether 
            deception is present, and figure out what to do to avoid being deceived. This framework uses 
            four key checklists: <span style="color:#FF4B4B;">MOM</span>, <span style="color:#FF4B4B;">POP</span>, 
            <span style="color:#FF4B4B;">MOSES</span>, and <span style="color:#FF4B4B;">EVE</span>.
        </p>
        <blockquote style="border-left:3px solid #FF4B4B; padding-left:15px; margin:15px 0; font-style:italic; color:#555;">
            "The accurate perception of deception in counterintelligence 
            analysis is extraordinarily difficult. If deception is done well, the analyst should not expect 
            to see any evidence of it. If, on the other hand, deception is expected, the analyst often 
            will find evidence of deception even when it is not there."<br>
            <span style="font-weight:bold; font-size:14px;">— Richards J. Heuer Jr.</span>
        </blockquote>
    </div>
    """, unsafe_allow_html=True)
    
    # Initialize session state
    if "mom_responses" not in st.session_state:
        st.session_state["mom_responses"] = {}
    if "pop_responses" not in st.session_state:
        st.session_state["pop_responses"] = {}
    if "moses_responses" not in st.session_state:
        st.session_state["moses_responses"] = {}
    if "eve_responses" not in st.session_state:
        st.session_state["eve_responses"] = {}
    if "scenario" not in st.session_state:
        st.session_state["scenario"] = ""
    
    # Scenario Description with improved styling
    st.markdown("""
    <div style="display:flex; align-items:center; margin-bottom:10px;">
        <div style="background-color:#FF4B4B; color:white; width:30px; height:30px; border-radius:50%; 
                display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
            1
        </div>
        <h2 style="margin:0; color:#1E1E1E;">Scenario Description</h2>
    </div>
    """, unsafe_allow_html=True)
    
    # Create a card-like container for the scenario input
    st.markdown('<div style="background-color:white; padding:15px; border-radius:5px; border:1px solid #ddd; margin-bottom:20px;">', unsafe_allow_html=True)
    
    scenario = st.text_area(
        "Describe the scenario or information being analyzed",
        value=st.session_state.get("scenario", ""),
        height=150,
        help="Provide detailed context about the situation where deception might be present. Include key actors, timeline, and any suspicious patterns or anomalies.",
        placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm. The offer seems unusually generous, and the company's background is difficult to verify.\nExample: An organizational social media account made a post claiming major policy changes that seems inconsistent with previous communications and lacks typical approval channels."
    )
    
    st.session_state["scenario"] = scenario
    
    # Close the card container
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Progress indicator
    if scenario:
        progress_value = 0.2  # 20% complete with scenario filled
        st.progress(progress_value)
        st.markdown(f"""
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:14px;">
            <span>Progress</span>
            <span style="font-weight:bold;">{int(progress_value * 100)}% Complete</span>
        </div>
        """, unsafe_allow_html=True)
    
    # Simplified implementation with improved styling
    st.markdown("""
    <div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0; border-left:3px solid #4CAF50;">
        <h3 style="margin-top:0; color:#1E1E1E; font-size:18px;">
            <span style="color:#4CAF50;">ℹ️</span> Framework Information
        </h3>
        <p style="margin-bottom:0;">Using simplified version of the framework. For full functionality, please check system requirements.</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Only show the framework sections if a scenario is provided
    if scenario:
        # Basic MOM section with improved styling
        st.markdown("""
        <div style="display:flex; align-items:center; margin:30px 0 10px 0;">
            <div style="background-color:#FF4B4B; color:white; width:30px; height:30px; border-radius:50%; 
                    display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
                2
            </div>
            <h2 style="margin:0; color:#1E1E1E;">Motive, Opportunity, and Means (MOM)</h2>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>MOM</strong> analysis helps identify whether a potential deceiver has the <strong style="color:#FF4B4B;">motive</strong>, 
                <strong style="color:#FF4B4B;">opportunity</strong>, and <strong style="color:#FF4B4B;">means</strong> to carry out deception.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        mom_questions = {
            "motive": "What are the goals and motives of the potential deceiver?",
            "channels": "What means are available to feed information to us?",
            "risks": "What consequences would the adversary suffer if deception was revealed?",
            "costs": "Would they need to sacrifice sensitive information for credibility?",
            "feedback": "Do they have a way to monitor the impact of the deception?"
        }
        
        # Track if any responses have been provided
        has_mom_responses = False
        
        for key, question in mom_questions.items():
            if key not in st.session_state["mom_responses"]:
                st.session_state["mom_responses"][key] = ""
            
            st.markdown(f"""
            <div style="background-color:white; padding:15px; border-radius:5px; border:1px solid #ddd; margin-bottom:15px;">
                <h4 style="margin-top:0; color:#FF4B4B; font-size:16px;">{question}</h4>
            """, unsafe_allow_html=True)
            
            response = st.text_area(
                question,
                value=st.session_state["mom_responses"][key],
                key=f"mom_{key}",
                label_visibility="collapsed",
                height=100
            )
            
            st.session_state["mom_responses"][key] = response
            
            if response:
                has_mom_responses = True
                
            st.markdown("</div>", unsafe_allow_html=True)
        
        # Basic POP section with improved styling
        st.markdown("""
        <div style="display:flex; align-items:center; margin:30px 0 10px 0;">
            <div style="background-color:#FF4B4B; color:white; width:30px; height:30px; border-radius:50%; 
                    display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
                3
            </div>
            <h2 style="margin:0; color:#1E1E1E;">Past Opposition Practices (POP)</h2>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>POP</strong> analysis examines the history and patterns of deception by the actor or similar actors.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        pop_questions = {
            "history": "What is the history of deception by this actor or similar actors?",
            "patterns": "Are there patterns or signatures in their previous deception attempts?",
            "success": "How successful have their previous deception operations been?"
        }
        
        # Track if any responses have been provided
        has_pop_responses = False
        
        for key, question in pop_questions.items():
            if key not in st.session_state["pop_responses"]:
                st.session_state["pop_responses"][key] = ""
            
            st.markdown(f"""
            <div style="background-color:white; padding:15px; border-radius:5px; border:1px solid #ddd; margin-bottom:15px;">
                <h4 style="margin-top:0; color:#FF4B4B; font-size:16px;">{question}</h4>
            """, unsafe_allow_html=True)
            
            response = st.text_area(
                question,
                value=st.session_state["pop_responses"][key],
                key=f"pop_{key}",
                label_visibility="collapsed",
                height=100
            )
            
            st.session_state["pop_responses"][key] = response
            
            if response:
                has_pop_responses = True
                
            st.markdown("</div>", unsafe_allow_html=True)
        
        # Basic MOSES section with improved styling
        st.markdown("""
        <div style="display:flex; align-items:center; margin:30px 0 10px 0;">
            <div style="background-color:#FF4B4B; color:white; width:30px; height:30px; border-radius:50%; 
                    display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
                4
            </div>
            <h2 style="margin:0; color:#1E1E1E;">Manipulability of Sources (MOSES)</h2>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>MOSES</strong> analysis evaluates how vulnerable our information sources are to manipulation.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        moses_questions = {
            "control": "How much control does the potential deceiver have over our sources?",
            "access": "Do they have access to our collection methods?",
            "vulnerability": "How vulnerable are our sources to manipulation?"
        }
        
        # Track if any responses have been provided
        has_moses_responses = False
        
        for key, question in moses_questions.items():
            if key not in st.session_state["moses_responses"]:
                st.session_state["moses_responses"][key] = ""
            
            st.markdown(f"""
            <div style="background-color:white; padding:15px; border-radius:5px; border:1px solid #ddd; margin-bottom:15px;">
                <h4 style="margin-top:0; color:#FF4B4B; font-size:16px;">{question}</h4>
            """, unsafe_allow_html=True)
            
            response = st.text_area(
                question,
                value=st.session_state["moses_responses"][key],
                key=f"moses_{key}",
                label_visibility="collapsed",
                height=100
            )
            
            st.session_state["moses_responses"][key] = response
            
            if response:
                has_moses_responses = True
                
            st.markdown("</div>", unsafe_allow_html=True)
        
        # Basic EVE section with improved styling
        st.markdown("""
        <div style="display:flex; align-items:center; margin:30px 0 10px 0;">
            <div style="background-color:#FF4B4B; color:white; width:30px; height:30px; border-radius:50%; 
                    display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
                5
            </div>
            <h2 style="margin:0; color:#1E1E1E;">Evaluation of Evidence (EVE)</h2>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>EVE</strong> analysis evaluates the consistency, confirmation, and contradictions in the evidence.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        eve_questions = {
            "consistency": "Is the information internally consistent?",
            "confirmation": "Is it confirmed by multiple independent sources?",
            "contradictions": "Does it contradict other reliable information?",
            "anomalies": "Are there any anomalies or unusual patterns?"
        }
        
        # Track if any responses have been provided
        has_eve_responses = False
        
        for key, question in eve_questions.items():
            if key not in st.session_state["eve_responses"]:
                st.session_state["eve_responses"][key] = ""
            
            st.markdown(f"""
            <div style="background-color:white; padding:15px; border-radius:5px; border:1px solid #ddd; margin-bottom:15px;">
                <h4 style="margin-top:0; color:#FF4B4B; font-size:16px;">{question}</h4>
            """, unsafe_allow_html=True)
            
            response = st.text_area(
                question,
                value=st.session_state["eve_responses"][key],
                key=f"eve_{key}",
                label_visibility="collapsed",
                height=100
            )
            
            st.session_state["eve_responses"][key] = response
            
            if response:
                has_eve_responses = True
                
            st.markdown("</div>", unsafe_allow_html=True)
        
        # Update progress indicator based on responses
        progress_value = 0.2  # Start with scenario filled
        if has_mom_responses:
            progress_value += 0.2
        if has_pop_responses:
            progress_value += 0.2
        if has_moses_responses:
            progress_value += 0.2
        if has_eve_responses:
            progress_value += 0.2
            
        st.progress(progress_value)
        st.markdown(f"""
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:14px;">
            <span>Progress</span>
            <span style="font-weight:bold;">{int(progress_value * 100)}% Complete</span>
        </div>
        """, unsafe_allow_html=True)
        
        # Summary section
        if progress_value > 0.2:
            st.markdown("""
            <div style="display:flex; align-items:center; margin:30px 0 10px 0;">
                <div style="background-color:#4CAF50; color:white; width:30px; height:30px; border-radius:50%; 
                        display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold;">
                    ✓
                </div>
                <h2 style="margin:0; color:#1E1E1E;">Summary and Export</h2>
            </div>
            """, unsafe_allow_html=True)
            
            st.markdown("""
            <div style="background-color:#f0f8ff; padding:20px; border-radius:5px; border:1px solid #b3d1ff; margin-bottom:20px;">
                <h3 style="color:#0066cc; margin-top:0;">Analysis Summary</h3>
                <p>You've completed portions of the Deception Detection framework analysis. Use the information you've gathered to form a conclusion about the likelihood of deception in your scenario.</p>
            </div>
            """, unsafe_allow_html=True)
            
            # Export button
            if st.button(" Export Analysis", type="primary"):
                # Create export data
                export_data = {
                    "framework": "Deception Detection",
                    "timestamp": datetime.now().isoformat(),
                    "scenario": scenario,
                    "mom_responses": st.session_state["mom_responses"],
                    "pop_responses": st.session_state["pop_responses"],
                    "moses_responses": st.session_state["moses_responses"],
                    "eve_responses": st.session_state["eve_responses"]
                }
                
                # Convert to JSON
                export_json = json.dumps(export_data, indent=2)
                
                # Offer download
                st.download_button(
                    label="Download JSON",
                    data=export_json,
                    file_name=f"deception_detection_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                    mime="application/json"
                )

def deception_detection():
    """
    Main entry point for the Deception Detection framework.
    This function is called by the framework loader in Frameworks.py.
    
    Returns:
        None
    """
    # Use the legacy implementation directly to avoid BaseFramework inheritance issues
    _legacy_deception_detection()

def main():
    """Main function for direct execution of this module."""
    deception_detection()

if __name__ == "__main__":
    main()