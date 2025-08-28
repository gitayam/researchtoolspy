# /frameworks/deception_detection.py
"""
Deception Detection Framework based on the work of Richards J. Heuer Jr. and CIA SATs methodology.
"""
import json
import logging
import os
import re
import sys
import urllib.parse
from typing import Dict, List, Any
from datetime import datetime
import requests
import streamlit as st
from bs4 import BeautifulSoup
from utilities.gpt import chat_gpt
from utilities import search_generator

# Add the parent directory to sys.path to allow imports from utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    
    # Class-level question dictionaries for use in all sections
    MOM_QUESTIONS = {
        "motive": "What are the goals and motives of the potential deceiver?",
        "channels": "What means are available to feed information to us?",
        "risks": "What consequences would the adversary suffer if deception was revealed?",
        "costs": "Would they need to sacrifice sensitive information for credibility?",
        "feedback": "Do they have a way to monitor the impact of the deception?"
    }
    POP_QUESTIONS = {
        "history": "What is the history of deception by this actor or similar actors?",
        "patterns": "Are there patterns or signatures in their previous deception attempts?",
        "success": "How successful have their previous deception operations been?"
    }
    MOSES_QUESTIONS = {
        "control": "How much control does the potential deceiver have over our sources?",
        "access": "Do they have access to our collection methods?",
        "vulnerability": "How vulnerable are our sources to manipulation?"
    }
    EVE_QUESTIONS = {
        "consistency": "Is the information internally consistent?",
        "corroboration": "Is it confirmed by multiple independent sources?",
        "gaps": "Are there gaps or missing information in the evidence?"
    }
    
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
            "mom_responses": {k: "" for k in self.MOM_QUESTIONS.keys()},
            "pop_responses": {k: "" for k in self.POP_QUESTIONS.keys()},
            "moses_responses": {k: "" for k in self.MOSES_QUESTIONS.keys()},
            "eve_responses": {k: "" for k in self.EVE_QUESTIONS.keys()},
            "selected_framework": "ALL",
            "auto_scraped_url": "",
            "scenario_5w_summary": ""
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
                        if k in ["scenario", "url_input", "scraped_content", "scraped_metadata", "mom_responses", "pop_responses", "moses_responses", "eve_responses", "selected_framework", "auto_scraped_url", "scenario_5w_summary"]:
                            del st.session_state[k]
                    st.experimental_rerun()
                st.markdown("---")
                st.markdown("<small>Framework by Richards J. Heuer Jr. / CIA SATs</small>", unsafe_allow_html=True)

            self._render_header()
            selected = self.framework_selector()
            self._render_scenario_section()
            # Only show framework sections if a scenario is provided
            if st.session_state.get("scenario", ""):
                if selected == "ALL":
                    self._render_mom_section()
                    self._render_pop_section()
                    self._render_moses_section()
                    self._render_eve_section()
                    self._render_summary_section()
                elif selected == "MOM":
                    self._render_mom_section()
                elif selected == "POP":
                    self._render_pop_section()
                elif selected == "MOSES":
                    self._render_moses_section()
                elif selected == "EVE":
                    self._render_eve_section()
        except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
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
        """Render the scenario description section with auto-scrape and 5W analysis if a URL is present."""
        self._section_header(1, "Scenario Description")
        st.markdown('<div style="background-color:white; padding:15px; border-radius:5px; border:1px solid #ddd; margin-bottom:20px;">', unsafe_allow_html=True)
        scenario = st.text_area(
            "Describe the scenario or information being analyzed",
            value=st.session_state.get("scenario", ""),
            height=150,
            help="Provide detailed context about the situation where deception might be present. Include key actors, timeline, and any suspicious patterns or anomalies. If you paste a URL, the content will be automatically analyzed.",
            placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm... or paste a news article URL."
        )
        st.session_state["scenario"] = scenario
        url = self._extract_url(scenario)
        fivew_summary = None
        if url:
            st.info(f"Detected URL in scenario: {url}")
            if st.button("Scrape and Summarize", key="scrape_summarize_btn"):
                with st.spinner("Scraping content from URL and generating 5W summary..."):
                    if ADVANCED_SCRAPER_AVAILABLE:
                        try:
                            title, description, keywords, author, date_published, editor, referenced_links = advanced_fetch_metadata(url)
                            body_content = scrape_body_content(url)
                            context_block = (
                                f"Title: {title}\n"
                                f"Description: {description}\n"
                                f"Author: {author}\n"
                                f"Published Date: {date_published}\n"
                                f"Editor: {editor}\n"
                                f"Keywords: {keywords}\n"
                                f"Referenced Links: {', '.join(referenced_links) if referenced_links else 'None'}\n"
                                f"Body Content: {body_content}"
                            )
                            fivew_summary = self._objective_5w_summary(context_block)
                            st.session_state["scenario_5w_summary"] = fivew_summary
                        except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
                            logging.error(f"Advanced scraping failed: {e}")
                            st.warning("Advanced scraping failed. Falling back to basic extraction.")
                            fivew_summary = self._objective_5w_summary(body_content if 'body_content' in locals() else scenario)
                            st.session_state["scenario_5w_summary"] = fivew_summary
                    else:
                        st.warning("Advanced scraper not available. Using basic extraction.")
                        fivew_summary = self._objective_5w_summary(scenario)
                        st.session_state["scenario_5w_summary"] = fivew_summary
        else:
            st.session_state["scenario_5w_summary"] = ""

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
        if scenario and not url:
            st.info("Tip: Paste a URL in your scenario to auto-extract actors and actions using 5W analysis.")

        # Show the 5W summary if available
        if st.session_state.get("scenario_5w_summary"):
            with st.expander("5W Analysis (Who, What, When, Where, Why)", expanded=False):
                st.markdown(st.session_state["scenario_5w_summary"])
        st.markdown('</div>', unsafe_allow_html=True)

    def _extract_url(self, text: str) -> Optional[str]:
        """Extract the first URL found in a string, if any."""
        url_pattern = re.compile(r'(https?://\S+)')
        match = url_pattern.search(text)
        if match:
            return match.group(1)
        return None

    def _objective_5w_summary(self, content: str) -> str:
        """
        Use GPT to extract 5W (Who, What, When, Where, Why) analysis from provided content.
        Content should include metadata and body for best results.
        """
        prompt = (
            "Extract the following from the provided text using the 5W framework. "
            "Return your answer in markdown with clear sections for each W.\n"
            "Who: List all actors, organizations, or key people involved.\n"
            "What: Summarize the main actions or events.\n"
            "When: Identify the timeline or key dates.\n"
            "Where: Note locations or settings.\n"
            "Why: Explain the motivations or context.\n"
            "Text: " + content[:3000]  # Limit for prompt size
        )
        try:
            return chat_gpt([{"role": "system", "content": "You are an AI expert in 5W analysis."}, {"role": "user", "content": prompt}], model="gpt-4o-mini")
        except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
            logging.error(f"5W GPT extraction failed: {e}")
            return "Could not extract 5W summary."

    def framework_selector(self) -> str:
        """
        Render a framework selection UI and return the selected framework key.
        """
        frameworks = {
            "MOM": {
                "label": "Motive, Opportunity & Means",
                "desc": "Does the subject have a reason, a chance, and the ability to deceive?",
                "hint": (
                    "- Motive: Who benefits?\n"
                    "- Opportunity: Did they have the chance?\n"
                    "- Means: Do they have the resources?\n"
                    "If all three are present, the risk of deception is higher."
                )
            },
            "POP": {
                "label": "Past Opposition Practices",
                "desc": "What’s their track record? Have they deceived before?",
                "hint": (
                    "- Look for patterns or repeated deception.\n"
                    "- Past behavior predicts future behavior."
                )
            },
            "MOSES": {
                "label": "Manipulability of Sources",
                "desc": "Can the information be trusted? Who controls the sources?",
                "hint": (
                    "- Who controls the info?\n"
                    "- Is it independently verified?\n"
                    "- Easily manipulated sources = higher risk."
                )
            },
            "EVE": {
                "label": "Evaluation of Evidence",
                "desc": "Is the evidence reliable, consistent, and corroborated?",
                "hint": (
                    "- Is it consistent?\n"
                    "- Multiple sources?\n"
                    "- Any missing or unverifiable info?"
                )
            },
            "ALL": {
                "label": "Show All",
                "desc": "View and complete the entire deception detection workflow.",
                "hint": "Go through all frameworks in sequence for a comprehensive analysis."
            }
        }
        st.markdown("""
        <div style='margin-bottom:10px;'><h3 style='margin-bottom:5px;'>Choose a Deception Detection Framework</h3></div>
        """, unsafe_allow_html=True)
        cols = st.columns(len(frameworks))
        selected = st.session_state.get("selected_framework", "ALL")
        for i, (fw_key, fw) in enumerate(frameworks.items()):
            with cols[i]:
                if st.button(fw["label"], key=f"fw_btn_{fw_key}", use_container_width=True):
                    st.session_state["selected_framework"] = fw_key
                    selected = fw_key
                st.markdown(f"<div style='font-size:12px; color:#444;'>{fw['desc']}</div>", unsafe_allow_html=True)
                with st.expander("How to use", expanded=False):
                    st.markdown(fw["hint"])
        return selected

    def _ai_suggested_answer(self, question: str, scenario: str, fivew: Optional[str] = None, cache_key: Optional[str] = None) -> str:
        """
        Generate an AI-suggested answer for a given question and scenario context.
        Uses the 5W summary if available, otherwise the scenario text.
        Results are cached in session state for efficiency.
        """
        if not scenario:
            return "(Provide a scenario above for AI suggestions.)"
        cache_key = cache_key or f"ai_suggestion_{hash(question + scenario + str(fivew))}"
        if cache_key in st.session_state:
            return st.session_state[cache_key]
        context = fivew if fivew else scenario
        prompt = (
            f"Given the following scenario/context, suggest a likely answer or insight for the question below. "
            f"Context:\n{context}\n"
            f"Question: {question}\n"
            f"Respond with a concise, objective, and actionable suggestion."
        )
        try:
            answer = chat_gpt([{"role": "system", "content": "You are an AI expert in deception analysis."}, {"role": "user", "content": prompt}], model="gpt-4o-mini")
        except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
            logging.error(f"AI suggestion failed: {e}")
            answer = "(AI suggestion unavailable.)"
        st.session_state[cache_key] = answer
        return answer

    def _render_mom_section(self) -> None:
        """Render the Motive, Opportunity, and Means (MOM) section with AI suggestions."""
        self._section_header(2, "Motive, Opportunity, and Means (MOM)")
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>MOM</strong> analysis helps identify whether a potential deceiver has the <strong style="color:#FF4B4B;">motive</strong>, 
                <strong style="color:#FF4B4B;">opportunity</strong>, and <strong style="color:#FF4B4B;">means</strong> to carry out deception.
            </p>
        </div>
        """, unsafe_allow_html=True)
        has_responses = False
        scenario = st.session_state.get("scenario", "")
        fivew = st.session_state.get("scenario_5w_summary", None)
        for key, question in self.MOM_QUESTIONS.items():
            if key not in st.session_state.get("mom_responses", {}):
                if "mom_responses" not in st.session_state:
                    st.session_state["mom_responses"] = {}
                st.session_state["mom_responses"][key] = ""
            self._card_container(question)
            col1, col2 = st.columns([3, 2])
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
                with st.expander("AI-Suggested Insight", expanded=False):
                    suggestion = self._ai_suggested_answer(question, scenario, fivew, cache_key=f"ai_mom_{key}")
                    st.markdown(suggestion)
                if st.button(" Search", key=f"search_mom_{key}", use_container_width=True):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
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
                    except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
                        error_msg = f"Error generating suggestions: {e}"
                        logging.error(error_msg)
                        st.error(error_msg)
        st.markdown("</div>", unsafe_allow_html=True)

    def _render_pop_section(self) -> None:
        """Render the Past Opposition Practices (POP) section with AI suggestions."""
        self._section_header(3, "Past Opposition Practices (POP)")
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>POP</strong> analysis examines the track record of the potential deceiver or their organization.
            </p>
        </div>
        """, unsafe_allow_html=True)
        has_responses = False
        scenario = st.session_state.get("scenario", "")
        fivew = st.session_state.get("scenario_5w_summary", None)
        for key, question in self.POP_QUESTIONS.items():
            if key not in st.session_state.get("pop_responses", {}):
                if "pop_responses" not in st.session_state:
                    st.session_state["pop_responses"] = {}
                st.session_state["pop_responses"][key] = ""
            self._card_container(question)
            col1, col2 = st.columns([3, 2])
            with col1:
                response = st.text_area(
                    f"Answer for: {question}",
                    value=st.session_state["pop_responses"].get(key, ""),
                    label_visibility="collapsed",
                    key=f"pop_{key}",
                    height=100
                )
                st.session_state["pop_responses"][key] = response
                if response:
                    has_responses = True
            with col2:
                with st.expander("AI-Suggested Insight", expanded=False):
                    suggestion = self._ai_suggested_answer(question, scenario, fivew, cache_key=f"ai_pop_{key}")
                    st.markdown(suggestion)
                if st.button(" Search", key=f"search_pop_{key}", use_container_width=True):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        st.markdown("""
        <div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0; border:1px solid #ddd;">
            <h4 style="margin-top:0; color:#1E1E1E;">Need help? Get AI-powered suggestions</h4>
        """, unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    def _render_moses_section(self) -> None:
        """Render the Manipulability of Sources (MOSES) section with AI suggestions."""
        self._section_header(4, "Manipulability of Sources (MOSES)")
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>MOSES</strong> analysis looks at the reliability and control of information sources.
            </p>
        </div>
        """, unsafe_allow_html=True)
        has_responses = False
        scenario = st.session_state.get("scenario", "")
        fivew = st.session_state.get("scenario_5w_summary", None)
        for key, question in self.MOSES_QUESTIONS.items():
            if key not in st.session_state.get("moses_responses", {}):
                if "moses_responses" not in st.session_state:
                    st.session_state["moses_responses"] = {}
                st.session_state["moses_responses"][key] = ""
            self._card_container(question)
            col1, col2 = st.columns([3, 2])
            with col1:
                response = st.text_area(
                    f"Answer for: {question}",
                    value=st.session_state["moses_responses"].get(key, ""),
                    label_visibility="collapsed",
                    key=f"moses_{key}",
                    height=100
                )
                st.session_state["moses_responses"][key] = response
                if response:
                    has_responses = True
            with col2:
                with st.expander("AI-Suggested Insight", expanded=False):
                    suggestion = self._ai_suggested_answer(question, scenario, fivew, cache_key=f"ai_moses_{key}")
                    st.markdown(suggestion)
                if st.button(" Search", key=f"search_moses_{key}", use_container_width=True):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        st.markdown("""
        <div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0; border:1px solid #ddd;">
            <h4 style="margin-top:0; color:#1E1E1E;">Need help? Get AI-powered suggestions</h4>
        """, unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    def _render_eve_section(self) -> None:
        """Render the Evaluation of Evidence (EVE) section with AI suggestions."""
        self._section_header(5, "Evaluation of Evidence (EVE)")
        st.markdown("""
        <div style="background-color:#fff3f3; padding:15px; border-radius:5px; margin-bottom:20px; font-size:15px;">
            <p style="margin:0;">
                <strong>EVE</strong> analysis critically assesses the evidence itself.
            </p>
        </div>
        """, unsafe_allow_html=True)
        has_responses = False
        scenario = st.session_state.get("scenario", "")
        fivew = st.session_state.get("scenario_5w_summary", None)
        for key, question in self.EVE_QUESTIONS.items():
            if key not in st.session_state.get("eve_responses", {}):
                if "eve_responses" not in st.session_state:
                    st.session_state["eve_responses"] = {}
                st.session_state["eve_responses"][key] = ""
            self._card_container(question)
            col1, col2 = st.columns([3, 2])
            with col1:
                response = st.text_area(
                    f"Answer for: {question}",
                    value=st.session_state["eve_responses"].get(key, ""),
                    label_visibility="collapsed",
                    key=f"eve_{key}",
                    height=100
                )
                st.session_state["eve_responses"][key] = response
                if response:
                    has_responses = True
            with col2:
                with st.expander("AI-Suggested Insight", expanded=False):
                    suggestion = self._ai_suggested_answer(question, scenario, fivew, cache_key=f"ai_eve_{key}")
                    st.markdown(suggestion)
                if st.button(" Search", key=f"search_eve_{key}", use_container_width=True):
                    search_query = f"{question} {st.session_state['scenario']}"
                    self._perform_search(search_query)
        st.markdown("""
        <div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0; border:1px solid #ddd;">
            <h4 style="margin-top:0; color:#1E1E1E;">Need help? Get AI-powered suggestions</h4>
        """, unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

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
            except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
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
                    + "".join(f"- {q}: {st.session_state['mom_responses'].get(k, '')}\n" for k, q in self.MOM_QUESTIONS.items()) + "\n"
                    "2. Past Opposition Practices (POP):\n"
                    + "".join(f"- {q}: {st.session_state['pop_responses'].get(k, '')}\n" for k, q in self.POP_QUESTIONS.items()) + "\n"
                    "3. Manipulability of Sources (MOSES):\n"
                    + "".join(f"- {q}: {st.session_state['moses_responses'].get(k, '')}\n" for k, q in self.MOSES_QUESTIONS.items()) + "\n"
                    "4. Evaluation of Evidence (EVE):\n"
                    + "".join(f"- {q}: {st.session_state['eve_responses'].get(k, '')}\n" for k, q in self.EVE_QUESTIONS.items())
                )
                
                # Create a download button
                st.download_button(
                    label="Download Analysis",
                    data=analysis_text,
                    file_name="deception_detection_analysis.txt",
                    mime="text/plain"
                )
            except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
                error_msg = f"Error exporting analysis: {e}"
                logging.error(error_msg)
                st.error(error_msg)

        st.markdown("---")
        st.info("""
        **Note**: Remember that deception detection is an iterative process. Regular review and updates
        of this analysis as new information becomes available is recommended. Consider using this framework
        in conjunction with other analytical techniques such as Analysis of Competing Hypotheses (ACH).
        """)

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
            # Use the search_generator utility if available and has the function
            if hasattr(search_generator, "generate_search"):
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
                except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
                    error_msg = f"Could not use advanced search: {e}"
                    logging.warning(error_msg)
                    st.warning(error_msg)
            else:
                st.warning("Search functionality is not implemented in search_generator.")
                return {}
            return {}
        except (ValueError, KeyError, RuntimeError, requests.RequestException) as e:
            error_msg = f"Error performing search: {e}"
            logging.error(error_msg)
            st.error(error_msg)
            return {}

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
        placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm. The offer seems unusually generous, and the company's background is difficult to verify."
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
            "control": "How much control does the adversary have over our sources?",
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