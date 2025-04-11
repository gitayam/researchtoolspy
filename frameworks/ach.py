# /frameworks/ACH.py
import streamlit as st
from dotenv import load_dotenv
from utilities.gpt import chat_gpt
import pandas as pd
from io import BytesIO
import openpyxl
from utilities.helpers import export_ach_matrix_to_excel
from typing import Dict, Any, Union, List, Optional
import json
from datetime import datetime
from frameworks.base_framework import BaseFramework

load_dotenv()

class ACH(BaseFramework):
    """Analysis of Competing Hypotheses (ACH) Framework"""
    
    def __init__(self):
        super().__init__(name="ACH")
        self.components = ["hypotheses", "evidence", "matrix"]
        self.scenario = ""
        self.title = ""
        self.hypotheses = []
        self.evidence = []
        self.evidence_weights = {}
        self.matrix = {}
        
    def generate_questions(self, component: str) -> List[str]:
        """Generate questions for a specific component"""
        if component == "hypotheses":
            return [
                "What are the possible explanations or scenarios?",
                "What alternative hypotheses should be considered?",
                "What are the key assumptions underlying each hypothesis?"
            ]
        elif component == "evidence":
            return [
                "What evidence supports or contradicts each hypothesis?",
                "What are the key facts or observations?",
                "What information would help distinguish between hypotheses?"
            ]
        elif component == "matrix":
            return [
                "How consistent is each piece of evidence with each hypothesis?",
                "Which hypothesis has the fewest inconsistencies?",
                "What additional evidence would help refine the analysis?"
            ]
        else:
            return []
    
    def set_scenario(self, scenario: str, title: str = "") -> None:
        """Set the scenario for the ACH analysis"""
        self.scenario = scenario
        self.title = title
        self.metadata["scenario"] = scenario
        self.metadata["title"] = title
    
    def set_hypotheses(self, hypotheses: List[str]) -> None:
        """Set the hypotheses for the ACH analysis"""
        self.hypotheses = hypotheses
        self.responses["hypotheses"] = hypotheses
    
    def set_evidence(self, evidence: List[str]) -> None:
        """Set the evidence for the ACH analysis"""
        self.evidence = evidence
        self.responses["evidence"] = evidence
    
    def set_evidence_weights(self, weights: Dict[str, int]) -> None:
        """Set the weights for each piece of evidence"""
        self.evidence_weights = weights
        self.responses["evidence_weights"] = weights
    
    def set_matrix_value(self, evidence: str, hypothesis: str, value: str) -> None:
        """Set a value in the consistency matrix"""
        self.matrix[(evidence, hypothesis)] = value
        
        # Ensure the matrix is stored in responses
        if "matrix" not in self.responses:
            self.responses["matrix"] = {}
        
        self.responses["matrix"][(evidence, hypothesis)] = value
    
    def get_matrix_value(self, evidence: str, hypothesis: str, default: str = "Neutral") -> str:
        """Get a value from the consistency matrix"""
        return self.matrix.get((evidence, hypothesis), default)
    
    def calculate_scores(self) -> Dict[str, Dict[str, Any]]:
        """Calculate consistency scores for each hypothesis"""
        # Define weights for each rating
        rating_weights = {
            "Consistent": 1.0,
            "Inconsistent": -1.0,
            "Neutral": 0.0
        }
        
        # Initialize scores and counts
        weighted_scores = {}
        consistency_counts = {}
        
        for hypothesis in self.hypotheses:
            weighted_scores[hypothesis] = 0.0
            consistency_counts[hypothesis] = {
                "Consistent": 0,
                "Inconsistent": 0,
                "Neutral": 0
            }
        
        # Calculate scores
        for evidence in self.evidence:
            weight = self.evidence_weights.get(evidence, 1)
            
            for hypothesis in self.hypotheses:
                value = self.get_matrix_value(evidence, hypothesis)
                consistency_counts[hypothesis][value] += 1
                
                if value in rating_weights:
                    weighted_scores[hypothesis] += weight * rating_weights[value]
        
        # Sort hypotheses by score
        sorted_hypotheses = sorted(
            weighted_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return {
            "weighted_scores": weighted_scores,
            "consistency_counts": consistency_counts,
            "sorted_hypotheses": sorted_hypotheses
        }
    
    def export_to_json(self, filepath: Optional[str] = None) -> str:
        """Export ACH analysis data to JSON"""
        data = {
            "framework": self.name,
            "scenario": self.scenario,
            "title": self.title,
            "hypotheses": self.hypotheses,
            "evidence": self.evidence,
            "evidence_weights": self.evidence_weights,
            "matrix": {f"{e}|{h}": v for (e, h), v in self.matrix.items()},
            "metadata": self.metadata
        }
        
        if filepath:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
                
        return json.dumps(data, indent=2)
    
    def import_from_json(self, json_data: str) -> bool:
        """Import ACH analysis data from JSON"""
        try:
            data = json.loads(json_data)
            
            # Validate that this is an ACH analysis
            if data.get("framework") != self.name:
                return False
                
            # Import data
            self.scenario = data.get("scenario", "")
            self.title = data.get("title", "")
            self.hypotheses = data.get("hypotheses", [])
            self.evidence = data.get("evidence", [])
            self.evidence_weights = data.get("evidence_weights", {})
            
            # Import matrix
            matrix_data = data.get("matrix", {})
            self.matrix = {}
            for key, value in matrix_data.items():
                if "|" in key:
                    evidence, hypothesis = key.split("|", 1)
                    self.matrix[(evidence, hypothesis)] = value
            
            # Update responses
            self.responses["hypotheses"] = self.hypotheses
            self.responses["evidence"] = self.evidence
            self.responses["evidence_weights"] = self.evidence_weights
            self.responses["matrix"] = self.matrix
            
            # Update metadata
            self.metadata = data.get("metadata", self.metadata)
            self.metadata["last_modified"] = datetime.now().isoformat()
            
            return True
        except Exception as e:
            print(f"Error importing ACH data: {e}")
            return False
    
    def export_to_excel(self) -> Optional[bytes]:
        """Export ACH analysis to Excel"""
        try:
            from utilities.helpers import export_ach_matrix_to_excel
            return export_ach_matrix_to_excel(
                self.hypotheses,
                self.evidence,
                self.matrix,
                self.evidence_weights
            )
        except ImportError:
            st.warning("Excel export is not available. Please install openpyxl.")
            return None
        except Exception as e:
            st.error(f"Error exporting to Excel: {e}")
            return None
    
    def export_to_docx(self) -> Optional[bytes]:
        """Export ACH analysis to a Word document"""
        # Calculate scores
        scores = self.calculate_scores()
        
        # Create sections
        sections = [
            {"heading": "Analysis of Competing Hypotheses", "content": f"Scenario: {self.scenario}", "level": 1},
            {"heading": "Hypotheses", "content": "\n".join([f"- {h}" for h in self.hypotheses]), "level": 2},
            {"heading": "Evidence", "content": "\n".join([f"- {e} (Weight: {self.evidence_weights.get(e, 1)})" for e in self.evidence]), "level": 2},
            {"heading": "Results", "content": "Hypotheses ranked by consistency score:", "level": 2}
        ]
        
        # Add results for each hypothesis
        for hypothesis, score in scores["sorted_hypotheses"]:
            counts = scores["consistency_counts"][hypothesis]
            section_content = f"Score: {score:.2f}\n"
            section_content += f"Consistent: {counts['Consistent']}\n"
            section_content += f"Inconsistent: {counts['Inconsistent']}\n"
            section_content += f"Neutral: {counts['Neutral']}"
            
            sections.append({
                "heading": hypothesis,
                "content": section_content,
                "level": 3
            })
        
        return super().export_to_docx("ACH Analysis", sections)

def ach_page():
    from utilities.form_handling import create_ai_assisted_input
    
    st.title("Analysis of Competing Hypotheses (ACH)")
    
    # Initialize ACH framework
    ach = ACH()
    
    # Check if we have data from URL processor
    scenario_from_url = st.session_state.get("ach_scenario", "")
    title_from_url = st.session_state.get("ach_title", "")
    
    st.write("""
    **Analysis of Competing Hypotheses** (ACH) helps evaluate multiple competing explanations
    or hypotheses for the observed data. This approach was popularized by Richards Heuer at the CIA.
    
    **Steps**:
    1. List possible Hypotheses.
    2. List key Pieces of Evidence or Arguments.
    3. For each piece of evidence, evaluate how Consistent, Inconsistent, or Neutral it is with each hypothesis.
    4. Identify which hypothesis has the fewest inconsistencies.
    5. Refine or add evidence as needed to challenge your initial assumptions.
    """)

    if scenario_from_url:
        st.info(f"Analyzing content from URL: {title_from_url}")
        # Store the scenario for AI-assisted hypothesis generation
        if "ach_context" not in st.session_state:
            st.session_state["ach_context"] = scenario_from_url
        # Set the scenario in the ACH framework
        ach.set_scenario(scenario_from_url, title_from_url)
        # Clear the session state to avoid reusing the data
        st.session_state.pop("ach_scenario", None)
        st.session_state.pop("ach_title", None)

    st.markdown("---")

    #
    # Step 1: Hypotheses
    #
    st.subheader("Step 1: List Hypotheses")

    def ai_suggest_hypotheses():
        """
        Call AI to propose 3–5 example hypotheses from a senior intelligence analyst perspective.
        Returns semicolon-separated text for each hypothesis.
        """
        try:
            existing_hypotheses = st.session_state.get("ach_hypotheses", "")

            system_msg = {
                "role": "system",
                "content": (
                    "You are an AI with expertise in intelligence analysis, using the Analysis of Competing Hypotheses (ACH) approach. "
                    "You will propose a brief set of well-reasoned hypotheses, returning them as semicolon-limited text. "
                    "Be concise, yet ensure each hypothesis distinctly addresses possible underlying causes, scenarios, or factors."
                )
            }

            user_msg = {
                "role": "user",
                "content": (
                    f"Current hypotheses: {existing_hypotheses}\n\n"
                    "As a senior analyst applying ACH, propose 3–5 new or refined hypotheses (semicolon separated) that could explain or address "
                    "this scenario. Consider different angles, assumptions, and any gaps in the existing hypotheses. "
                    "Focus on plausible scenarios, mention potential uncertainties, and ensure each proposed hypothesis is distinct."
                )
            }

            resp = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            
            # Split the response by semicolons and format into new lines
            formatted_resp = "\n".join(resp.split(';'))
            return formatted_resp
        except Exception as e:
            st.error(f"AI error: {e}")
            return ""

    hypotheses = create_ai_assisted_input(
        label="Hypotheses (semicolon or newline separated)",
        key="ach_hypotheses",
        ai_button_label="AI: Generate Options for Hypotheses",
        ai_function=ai_suggest_hypotheses,
        placeholder="Hypothesis A\nHypothesis B\nHypothesis C",
        help_text="Enter each hypothesis on a new line or separate with semicolons",
        height=100
    )
    
    # Parse hypotheses and store in ACH framework
    def parse_list(input_text):
        # Split by semicolon, then newline
        parts = input_text.split(';')
        result = []
        for part in parts:
            result.extend([x.strip() for x in part.split('\n') if x.strip()])
        return result
    
    hypotheses_list = parse_list(hypotheses)
    ach.set_hypotheses(hypotheses_list)

    st.markdown("---")

    #
    # Step 2: Evidence / Arguments
    #
    st.subheader("Step 2: List Key Pieces of Evidence or Arguments (Assign Weights)")

    def ai_suggest_evidence():
        """Call AI to propose 3–5 example pieces of evidence or arguments for the scenario."""
        try:
            existing_hypotheses = st.session_state.get("ach_hypotheses", "")
            system_msg = {"role": "system", "content": "You are an AI that suggests evidence for ACH."}
            user_msg = {
                "role": "user",
                "content": (
                    f"Based on the current hypotheses: {existing_hypotheses}, "
                    "suggest 3 to 5 pieces of evidence or arguments (semicolon separated) that are relevant to these hypotheses."
                )
            }
            resp = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
            
            # Split the response by semicolons and format into new lines
            formatted_resp = "\n".join(resp.split(';'))
            return formatted_resp
        except Exception as e:
            st.error(f"AI error: {e}")
            return ""

    evidence = create_ai_assisted_input(
        label="Evidence / Arguments",
        key="ach_evidence",
        ai_button_label="AI: Generate Options for Evidence to Consider",
        ai_function=ai_suggest_evidence,
        placeholder="Evidence #1\nEvidence #2\netc.",
        help_text="Enter each piece of evidence on a new line or separate with semicolons",
        height=100
    )
    
    # Parse evidence and store in ACH framework
    evidence_list = parse_list(evidence)
    ach.set_evidence(evidence_list)

    st.markdown("---")

    #
    # Step 2b: Assign Weights
    #
    st.write("Assign a weight for each piece of evidence (e.g., 1 = least significant / Opinion, 12 = extremely significant/ Fact).")

    # Define the logarithmic scale
    weight_options = [1, 3, 5, 8, 12]

    def format_weight_option(weight):
        if weight == 1:
            return "1 (Least significant, opinion-based)"
        elif weight == 12:
            return "12 (Extremely significant, factual)"
        else:
            return str(weight)

    # Initialize evidence weights if not already in session state
    if "ach_evidence_weights" not in st.session_state:
        st.session_state["ach_evidence_weights"] = {}

    # Set default weights for new evidence
    for ev in evidence_list:
        if ev not in st.session_state["ach_evidence_weights"]:
            st.session_state["ach_evidence_weights"][ev] = 1

    # Display weight selectors for each piece of evidence
    for ev in evidence_list:
        st.session_state["ach_evidence_weights"][ev] = st.selectbox(
            label=f"Select weight for: {ev}",
            options=weight_options,
            index=weight_options.index(st.session_state["ach_evidence_weights"][ev]),
            format_func=format_weight_option,
            key=f"{ev}_weight_selectbox"
        )
    
    # Store evidence weights in ACH framework
    ach.set_evidence_weights(st.session_state["ach_evidence_weights"])

    st.markdown("---")

    #
    # Step 3: Evaluate Consistency of Each Piece of Evidence with Each Hypothesis
    #
    st.subheader("Step 3: Evaluate Consistency")

    # Initialize matrix if not already in session state
    if "ach_matrix" not in st.session_state:
        st.session_state["ach_matrix"] = {}

    # Ensure session_state has a record for each (evid, hyp) pair
    for e in evidence_list:
        for h in hypotheses_list:
            key_ = (e, h)
            if key_ not in st.session_state["ach_matrix"]:
                st.session_state["ach_matrix"][key_] = "Neutral"

    if hypotheses_list and evidence_list:
        for ev in evidence_list:
            st.markdown(f"**Evidence**: {ev}")
            columns = st.columns(len(hypotheses_list))
            for i, hyp in enumerate(hypotheses_list):
                old_val = st.session_state["ach_matrix"][(ev, hyp)]
                new_val = columns[i].selectbox(
                    label=f"{hyp}",
                    options=["Consistent", "Inconsistent", "Neutral"],
                    index=["Consistent", "Inconsistent", "Neutral"].index(old_val),
                    key=f"{ev}_{hyp}_selectbox"
                )
                st.session_state["ach_matrix"][(ev, hyp)] = new_val
                
                # Store matrix value in ACH framework
                ach.set_matrix_value(ev, hyp, new_val)
            
            st.write("---")
    else:
        st.info("Add at least one hypothesis and one piece of evidence to compare them.")

    st.markdown("---")

    #
    # Step 4: Weighted Inconsistency Counts
    #
    st.subheader("Step 4: Assess Weighted Inconsistencies / Conflicts")
    st.write("""
    In this weighted approach, each piece of evidence you marked "Inconsistent" applies its assigned weight
    negatively, "Consistent" positively, and "Neutral" as zero to the hypothesis' total score.
    """)

    if hypotheses_list and evidence_list:
        # Calculate scores using ACH framework
        scores = ach.calculate_scores()
        weighted_score = scores["weighted_scores"]
        consistency_counts = scores["consistency_counts"]
        sorted_hyps = scores["sorted_hypotheses"]
        
        # Display the tentative conclusion first
        best_hyp = sorted_hyps[0][0] if sorted_hyps else None
        st.success(f"Tentative Conclusion: Hypothesis with the highest weighted score is: **{best_hyp}**")
        
        st.write("**Weighted Scores and Counts** (higher is better):")
        
        for hyp, score in sorted_hyps:
            counts = consistency_counts[hyp]
            
            st.markdown(f"### {hyp}")
            st.markdown(f"- **Score**: {score:.2f}")
            st.markdown(f"- **Consistent**: {counts['Consistent']}")
            st.markdown(f"- **Inconsistent**: {counts['Inconsistent']}")
            st.markdown(f"- **Neutral**: {counts['Neutral']}")
            st.markdown("---")

        # Create two columns for the buttons
        col1, col2 = st.columns(2)

        # Devil's Advocate button
        with col1:
            if st.button("Devil's Advocate: Challenge Hypotheses"):
                devils_advocate_response = ai_devils_advocate(
                    hypotheses_list, 
                    evidence_list, 
                    weighted_score, 
                    consistency_counts
                )
                st.write(devils_advocate_response)

        # Export button
        with col2:
            if st.button('Export to Excel'):
                try:
                    excel_data = ach.export_to_excel()
                    if excel_data:
                        st.download_button(
                            label="📥 Download Excel file",
                            data=excel_data,
                            file_name='ACH_matrix.xlsx',
                            mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        )
                except Exception as e:
                    st.error(f"Export failed: {str(e)}")
        
        # Add Word export option
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button('Export to Word'):
                try:
                    docx_data = ach.export_to_docx()
                    if docx_data:
                        st.download_button(
                            label="📥 Download Word file",
                            data=docx_data,
                            file_name='ACH_analysis.docx',
                            mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        )
                except Exception as e:
                    st.error(f"Word export failed: {str(e)}")
        
        with col2:
            if st.button('Export to JSON'):
                try:
                    json_data = ach.export_to_json()
                    st.download_button(
                        label="📥 Download JSON file",
                        data=json_data,
                        file_name='ACH_analysis.json',
                        mime='application/json'
                    )
                except Exception as e:
                    st.error(f"JSON export failed: {str(e)}")

    else:
        st.info("No matrix to analyze. Add Hypotheses and Evidence first.")

    st.markdown("---")
    
    # Import functionality
    with st.expander("Import Analysis", expanded=False):
        uploaded_file = st.file_uploader("Upload ACH Analysis", type=["json"])
        if uploaded_file is not None:
            json_data = uploaded_file.getvalue().decode("utf-8")
            if st.button("Load Analysis"):
                if ach.import_from_json(json_data):
                    st.success("ACH Analysis loaded successfully!")
                    
                    # Update session state
                    st.session_state["ach_hypotheses"] = "\n".join(ach.hypotheses)
                    st.session_state["ach_evidence"] = "\n".join(ach.evidence)
                    st.session_state["ach_evidence_weights"] = ach.evidence_weights
                    st.session_state["ach_matrix"] = ach.matrix
                    
                    st.rerun()
                else:
                    st.error("Failed to load ACH Analysis. Please check the file format.")
    
    st.info("""
**Done!**  
Use these steps to refine or add new evidence. Weighting helps you see which evidence
has the most impact on your analysis, offering a more nuanced view of each hypothesis.
""")

def ai_devils_advocate(hypotheses, evidence, weighted_score, consistency_counts):
    """Call AI to provide counterarguments and perspectives."""
    try:
        # Prepare a detailed string of inconsistencies
        inconsistencies_detail = "\n".join(
            f"- {h}: {', '.join([e for e in evidence if consistency_counts[h]['Inconsistent'] > 0])}"
            for h in hypotheses
        )

        system_msg = {
            "role": "system",
            "content": (
                "You are an AI tasked with providing a devil's advocate perspective on hypotheses. "
                "Offer professional counterarguments, questions to consider, and alternative perspectives. "
                "Don't go out of your way to be a contrarian; the feedback should be helpful."
            )
        }
        user_msg = {
            "role": "user",
            "content": (
                f"Hypotheses: {hypotheses}\n"
                f"Evidence: {evidence}\n"
                f"Weighted Scores: {weighted_score}\n"
                f"Inconsistencies:\n{inconsistencies_detail}\n\n"
                "Provide counterarguments, questions, and perspectives to challenge the current hypothesis selection."
            )
        }
        resp = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
        return resp
    except Exception as e:
        st.error(f"AI error: {e}")
        return ""

def calculate_consistency_score(evidence_ratings: Dict[str, str]) -> float:
    """
    Calculate a consistency score based on evidence ratings.
    
    Args:
        evidence_ratings: Dictionary mapping evidence IDs to consistency ratings (CC, C, N, I, II)
        
    Returns:
        A score where positive values indicate consistency and negative values indicate inconsistency
    """
    # Define weights for each rating
    rating_weights = {
        "CC": 2.0,   # Strongly consistent
        "C": 1.0,    # Consistent
        "N": 0.0,    # Neutral
        "I": -1.0,   # Inconsistent
        "II": -2.0   # Strongly inconsistent
    }
    
    # Calculate the total score
    total_score = 0.0
    for evidence_id, rating in evidence_ratings.items():
        if rating in rating_weights:
            total_score += rating_weights[rating]
    
    return total_score

def main():
    ach_page()

if __name__ == "__main__":
    main()