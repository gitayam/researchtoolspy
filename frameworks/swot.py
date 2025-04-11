# /frameworks/SWOT.py

import streamlit as st
from dotenv import load_dotenv
from utilities.gpt import chat_gpt  # or any AI helper function
from xhtml2pdf import pisa  # The pure-Python PDF converter
import io
from typing import Dict, List, Any, Optional, Union
import os
import json
from datetime import datetime
from frameworks.base_framework import BaseFramework

# Try to import get_completion, but provide a fallback if it's not available
try:
    from utilities.gpt import get_completion
except ImportError:
    # Fallback function if get_completion is not available
    def get_completion(prompt, **kwargs):
        print("Warning: get_completion function not available. Using fallback.")
        return f"AI analysis not available. Please implement the get_completion function.\n\nPrompt: {prompt[:100]}..."

def process_swot_analysis() -> Dict[str, List[str]]:
    """
    Process the SWOT analysis data from session state.
    
    Returns:
        A dictionary containing the SWOT components (strengths, weaknesses, opportunities, threats)
    """
    # Get SWOT components from session state
    strengths = st.session_state.get("swot_strengths", [])
    weaknesses = st.session_state.get("swot_weaknesses", [])
    opportunities = st.session_state.get("swot_opportunities", [])
    threats = st.session_state.get("swot_threats", [])
    
    # Return the SWOT analysis as a dictionary
    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "opportunities": opportunities,
        "threats": threats
    }

class SWOT(BaseFramework):
    """SWOT (Strengths, Weaknesses, Opportunities, Threats) Analysis Framework"""
    
    def __init__(self):
        super().__init__(name="SWOT")
        self.components = ["strengths", "weaknesses", "opportunities", "threats"]
        self.objective = ""
        self.strategies = ""
        
        # Initialize question templates
        self._initialize_question_templates()
    
    def _initialize_question_templates(self) -> None:
        """Initialize question templates for each component"""
        self.questions = {
            "strengths": [
                "What are the internal positive attributes or resources that can help achieve objectives?",
                "What advantages does the subject have over others?",
                "What unique resources can be drawn upon?",
                "What do others see as strengths of the subject?",
                "What factors enable success?"
            ],
            "weaknesses": [
                "What are the internal negative attributes or limitations that might hinder objectives?",
                "What could be improved?",
                "What should be avoided?",
                "What factors detract from the ability to achieve objectives?",
                "What do others perceive as weaknesses?"
            ],
            "opportunities": [
                "What are the external positive factors that could be exploited?",
                "What trends or conditions may positively impact progress?",
                "What opportunities exist in the environment that can be beneficial?",
                "How can strengths be turned into opportunities?",
                "What potential partnerships or alliances might be formed?"
            ],
            "threats": [
                "What are the external negative factors that could cause trouble?",
                "What obstacles are currently faced?",
                "What trends or conditions may negatively impact progress?",
                "What threats do the weaknesses expose?",
                "What external factors could create challenges?"
            ]
        }
    
    def generate_questions(self, component: str) -> List[str]:
        """Generate questions for a specific SWOT component"""
        component = component.lower()
        if component not in self.components:
            raise ValueError(f"Component must be one of {self.components}")
            
        return self.questions.get(component, [])
    
    def analyze(self, component: str, context: str, use_gpt: bool = True) -> Dict[str, Any]:
        """Analyze a specific component with provided context"""
        component = component.lower()
        if component not in self.components:
            raise ValueError(f"Component must be one of {self.components}")
            
        questions = self.generate_questions(component)
        
        if use_gpt:
            # Use GPT to analyze
            prompt = f"Context:\n{context}\n\nObjective: {self.objective}\n\nAnalyze the following {component.title()} for a SWOT analysis:\n"
            for i, q in enumerate(questions, 1):
                prompt += f"{i}. {q}\n"
            
            response = self.generate_ai_suggestion(prompt)
            self.set_response(component, response)
            return {"component": component, "response": response}
        else:
            # Return questions for manual analysis
            return {"component": component, "questions": questions}
    
    def analyze_all(self, context: str, use_gpt: bool = True) -> Dict[str, Any]:
        """Analyze all SWOT components with provided context"""
        results = {}
        for component in self.components:
            results[component] = self.analyze(component, context, use_gpt)
        return results
    
    def set_objective(self, objective: str) -> None:
        """Set the objective for the SWOT analysis"""
        self.objective = objective
        self.metadata["objective"] = objective
    
    def set_strategies(self, strategies: str) -> None:
        """Set the strategies for the SWOT analysis"""
        self.strategies = strategies
        self.metadata["strategies"] = strategies
    
    def export_to_json(self, filepath: Optional[str] = None) -> str:
        """Export SWOT analysis data to JSON"""
        data = {
            "framework": self.name,
            "objective": self.objective,
            "components": self.components,
            "responses": self.responses,
            "strategies": self.strategies,
            "metadata": self.metadata
        }
        
        if filepath:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
                
        return json.dumps(data, indent=2)
    
    def import_from_json(self, json_data: str) -> bool:
        """Import SWOT analysis data from JSON"""
        try:
            data = json.loads(json_data)
            
            # Validate that this is a SWOT analysis
            if data.get("framework") != self.name:
                return False
                
            # Import data
            self.objective = data.get("objective", "")
            self.components = data.get("components", self.components)
            self.responses = data.get("responses", {})
            self.strategies = data.get("strategies", "")
            self.metadata = data.get("metadata", self.metadata)
            
            # Update last modified timestamp
            self.metadata["last_modified"] = datetime.now().isoformat()
            
            return True
        except Exception as e:
            print(f"Error importing SWOT data: {e}")
            return False
    
    def export_to_docx(self) -> Optional[bytes]:
        """Export SWOT analysis to a Word document"""
        sections = [
            {"heading": "SWOT Analysis", "content": f"Objective: {self.objective}", "level": 1},
            {"heading": "Strengths", "content": self.get_response("strengths") or "None specified", "level": 2},
            {"heading": "Weaknesses", "content": self.get_response("weaknesses") or "None specified", "level": 2},
            {"heading": "Opportunities", "content": self.get_response("opportunities") or "None specified", "level": 2},
            {"heading": "Threats", "content": self.get_response("threats") or "None specified", "level": 2},
            {"heading": "Strategies", "content": self.strategies or "None specified", "level": 2}
        ]
        
        return super().export_to_docx("SWOT Analysis", sections)

# Function to perform SWOT analysis (for backward compatibility)
def swot_analysis(context, component=None, use_gpt=True):
    """Function to perform SWOT analysis"""
    swot = SWOT()
    if component:
        return swot.analyze(component, context, use_gpt)
    else:
        return swot.analyze_all(context, use_gpt)

load_dotenv()

def create_swot_html_report(objective, strengths, weaknesses, opportunities, threats, strategies):
    """Generate an HTML snippet showing the SWOT analysis in a report format."""
    def to_list(text):
        if ";" in text:
            items = [x.strip() for x in text.split(";") if x.strip()]
        else:
            items = [x.strip() for x in text.split("\n") if x.strip()]
        bullet_html = "".join(f"<li>{item}</li>" for item in items)
        return bullet_html or "<li>(None)</li>"

    strengths_html = to_list(strengths)
    weaknesses_html = to_list(weaknesses)
    opportunities_html = to_list(opportunities)
    threats_html = to_list(threats)
    strategies_html = to_list(strategies)

    html = f"""
    <html>
    <head>
      <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h2   {{ text-align: center; }}
        table{{ width: 100%; border-collapse: collapse; }}
        td   {{ border: 1px solid #ddd; vertical-align: top; padding: 10px; }}
        th   {{ border: 1px solid #ddd; background: #f2f2f2; padding: 10px; }}
        ul   {{ margin: 0; padding: 0 0 0 20px; }}
      </style>
    </head>
    <body>
      <h2>SWOT Analysis Report</h2>
      <h3>Objective</h3>
      <p>{objective}</p>
      <table>
        <tr>
          <th>Strengths</th>
          <th>Weaknesses</th>
        </tr>
        <tr>
          <td><ul>{strengths_html}</ul></td>
          <td><ul>{weaknesses_html}</ul></td>
        </tr>
        <tr>
          <th>Opportunities</th>
          <th>Threats</th>
        </tr>
        <tr>
          <td><ul>{opportunities_html}</ul></td>
          <td><ul>{threats_html}</ul></td>
        </tr>
      </table>
      <h3>Strategies for Action</h3>
      <ul>{strategies_html}</ul>
    </body>
    </html>
    """
    return html

def convert_html_to_pdf(source_html):
    """Convert HTML to PDF using xhtml2pdf."""
    output = io.BytesIO()
    pisa_status = pisa.CreatePDF(io.StringIO(source_html), dest=output)
    return output.getvalue() if not pisa_status.err else None

def swot_page():
    from utilities.form_handling import create_ai_assisted_input, create_import_export_section
    
    st.title("SWOT Analysis")
    
    # Initialize SWOT framework
    swot = SWOT()
    
    # Check if we have data from URL processor
    objective_from_url = st.session_state.get("swot_objective", "")
    description_from_url = st.session_state.get("swot_description", "")

    st.write("""
    **Summary**  
    SWOT (Strengths, Weaknesses, Opportunities, Threats) is a decision-making technique 
    that identifies internal and external factors that can help or hinder an organization or project.  
    It's typically used in the preliminary stages of strategic planning or problem-solving.

    **Internal Factors**: Strengths & Weaknesses (e.g. human resources, financial situation, processes).  
    **External Factors**: Opportunities & Threats (e.g. trends, market conditions, legislation).

    Use the steps below to define your objective, list SWOT items, and identify strategies.
    """)

    st.markdown("---")

    #
    # Step 1: Define Objective
    #
    st.subheader("Step 1: Define the Objective")
    objective = st.text_input(
        label="Objective",
        value=objective_from_url if objective_from_url else "",
        placeholder="Ex: 'Increase market share in Region X' or 'Enhance collaboration within the team.'",
        help="Clearly state the goal or purpose of this SWOT analysis. E.g., a project or business objective."
    )
    
    # Set the objective in the SWOT framework
    swot.set_objective(objective)

    if objective_from_url:
        st.info(f"Analyzing content from URL: {objective_from_url}")
        # Store the description for AI-assisted analysis
        if "swot_context" not in st.session_state:
            st.session_state["swot_context"] = description_from_url
        # Clear the session state to avoid reusing the data
        st.session_state.pop("swot_objective", None)
        st.session_state.pop("swot_description", None)

    st.markdown("---")

    #
    # Step 2: List Strengths, Weaknesses, Opportunities, Threats
    #
    st.subheader("Step 2: List Strengths, Weaknesses, Opportunities, and Threats")

    # Generic AI call for each category
    def ai_suggest_swot(category):
        """Ask AI for suggestions in a given SWOT category, referencing the user's objective."""
        try:
            system_msg = {
                "role": "system",
                "content": (
                    "You are an AI that helps generate items for a SWOT analysis. "
                    "Your output should be semicolon-separated, with no bullet points."
                )
            }
            user_msg = {
                "role": "user",
                "content": (
                    f"SWOT Objective: {objective}\n"
                    f"Generate 3-5 {category} in semicolon-separated format, no bullet points."
                )
            }
            response = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            return response
        except Exception as e:
            st.error(f"AI Error: {e}")
            return ""

    # Strengths
    st.write("**Strengths** (internal advantages): characteristics or resources that give you an edge.")
    strengths = create_ai_assisted_input(
        label="Strengths",
        key="swot_strengths",
        ai_button_label="AI: Suggest Strengths",
        ai_function=ai_suggest_swot,
        ai_params={"category": "Strengths"},
        placeholder="e.g. Strong brand recognition; Skilled workforce; Innovative tech stack",
        help_text="List or separate by semicolons. These are internal positives."
    )
    swot.set_response("strengths", strengths)

    st.markdown("---")

    # Weaknesses
    st.write("**Weaknesses** (internal disadvantages): internal issues or limitations holding you back.")
    weaknesses = create_ai_assisted_input(
        label="Weaknesses",
        key="swot_weaknesses",
        ai_button_label="AI: Suggest Weaknesses",
        ai_function=ai_suggest_swot,
        ai_params={"category": "Weaknesses"},
        placeholder="e.g. Limited funding; High staff turnover; Outdated processes",
        help_text="List or separate by semicolons. These are internal negatives."
    )
    swot.set_response("weaknesses", weaknesses)

    st.markdown("---")

    # Opportunities
    st.write("**Opportunities** (external positives): external trends or circumstances you can leverage.")
    opportunities = create_ai_assisted_input(
        label="Opportunities",
        key="swot_opportunities",
        ai_button_label="AI: Suggest Opportunities",
        ai_function=ai_suggest_swot,
        ai_params={"category": "Opportunities"},
        placeholder="e.g. Emerging market; Partnerships; New tech solutions",
        help_text="List or separate by semicolons. External conditions you can exploit."
    )
    swot.set_response("opportunities", opportunities)

    st.markdown("---")

    # Threats
    st.write("**Threats** (external negatives): external risks, challenges, or obstacles.")
    threats = create_ai_assisted_input(
        label="Threats",
        key="swot_threats",
        ai_button_label="AI: Suggest Threats",
        ai_function=ai_suggest_swot,
        ai_params={"category": "Threats"},
        placeholder="e.g. Competitive rivalry; Regulatory changes; Economic downturn",
        help_text="List or separate by semicolons. External conditions that could cause trouble."
    )
    swot.set_response("threats", threats)

    st.markdown("---")

    #
    # Step 3: Identify Strategies
    #
    st.subheader("Step 3: Strategies for Action")

    st.write("""
    **Exploiting Strengths & Opportunities**: e.g. Use Strength 1 to maximize Opportunity 1  
    **Mitigating Weaknesses & Threats**: e.g. Address Weakness 2 to avoid Threat 1  
    """)

    def ai_suggest_strategies():
        """Propose strategies for exploiting S & O, and mitigating W & T, based on user input."""
        try:
            combined_input = (
                f"Objective: {objective}\n"
                "Strengths:\n" + st.session_state["swot_strengths"] + "\n\n"
                "Weaknesses:\n" + st.session_state["swot_weaknesses"] + "\n\n"
                "Opportunities:\n" + st.session_state["swot_opportunities"] + "\n\n"
                "Threats:\n" + st.session_state["swot_threats"] + "\n\n"
                "Propose strategies for exploiting Strengths & Opportunities and mitigating Weaknesses & Threats. "
                "Semicolon-separated, no bullet points."
            )
            system_msg = {
                "role": "system",
                "content": (
                    "You are an AI that drafts recommended strategies from a SWOT analysis, focusing on S-O, W-T, etc."
                )
            }
            user_msg = {"role": "user", "content": combined_input}
            resp = chat_gpt([system_msg, user_msg], model="gpt-3.5-turbo")
            return resp
        except Exception as e:
            st.error(f"AI Error: {e}")
            return ""

    strategies = create_ai_assisted_input(
        label="Proposed Strategies",
        key="swot_strategies",
        ai_button_label="AI: Suggest Strategies",
        ai_function=ai_suggest_strategies,
        placeholder="e.g.\n1) Use Strength A to leverage Opportunity X\n2) Address Weakness B to avoid Threat Y",
        help_text="Write or paste your strategies here. S/O strategies, W/T strategies, etc.",
        height=150
    )
    swot.set_strategies(strategies)

    st.markdown("---")

    # Export options
    st.subheader("Export SWOT Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("Export as PDF"):
            # Generate HTML from current SWOT data
            swot_html = create_swot_html_report(
                objective=objective,
                strengths=swot.get_response("strengths") or "",
                weaknesses=swot.get_response("weaknesses") or "",
                opportunities=swot.get_response("opportunities") or "",
                threats=swot.get_response("threats") or "",
                strategies=swot.strategies or ""
            )

            # Convert HTML to PDF
            pdf_bytes = convert_html_to_pdf(swot_html)
            if pdf_bytes:
                # Provide download
                st.download_button(
                    label="Download SWOT Analysis PDF",
                    data=pdf_bytes,
                    file_name="SWOT-Analysis.pdf",
                    mime="application/pdf"
                )
            else:
                st.error("Error generating PDF.")
    
    with col2:
        if st.button("Export as Word Document"):
            docx_bytes = swot.export_to_docx()
            if docx_bytes:
                st.download_button(
                    label="Download SWOT Analysis DOCX",
                    data=docx_bytes,
                    file_name="SWOT-Analysis.docx",
                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                )
            else:
                st.error("Error generating Word document.")
    
    # Import/Export JSON
    with st.expander("Advanced: Import/Export JSON Data", expanded=False):
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("Export as JSON"):
                json_data = swot.export_to_json()
                st.download_button(
                    label="Download SWOT Analysis JSON",
                    data=json_data,
                    file_name="SWOT-Analysis.json",
                    mime="application/json"
                )
        
        with col2:
            uploaded_file = st.file_uploader("Import SWOT Analysis", type=["json"])
            if uploaded_file is not None:
                json_data = uploaded_file.getvalue().decode("utf-8")
                if st.button("Load Analysis"):
                    if swot.import_from_json(json_data):
                        st.success("SWOT Analysis loaded successfully!")
                        st.rerun()
                    else:
                        st.error("Failed to load SWOT Analysis. Please check the file format.")

    st.info("""
**Done!**  
Use this analysis as a starting point for deeper strategic planning or integration with other frameworks.
You can further refine strategies or transfer them into actionable plans.
""")

def main():
    swot_page()

if __name__ == "__main__":
    main()