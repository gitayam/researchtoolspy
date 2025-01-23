# DeceptionDetection.py
"""
Deception Detection Framework based on the work of Richards J. Heuer Jr.
"""
import streamlit as st
from utilities.utils_openai import chat_gpt

def deception_detection():
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
        help="Provide context about the situation where deception might be present."
    )

    # MOM Checklist
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

    # AI Suggestions for MOM
    if st.button("AI: Suggest MOM Considerations"):
        if not scenario:
            st.warning("Please provide a scenario description first.")
        else:
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI expert in deception analysis. Provide specific considerations for MOM analysis."
                }
                user_msg = {
                    "role": "user",
                    "content": f"For this scenario: {scenario}\nSuggest specific considerations for Motive, Opportunity, and Means analysis."
                }
                suggestions = chat_gpt([system_msg, user_msg], model="gpt-4-mini")
                st.info("AI Suggestions:\n" + suggestions)
            except Exception as e:
                st.error(f"Error generating suggestions: {e}")

    # POP (Past Opposition Practices)
    st.markdown("---")
    st.subheader("2. Past Opposition Practices (POP)")
    
    pop_questions = {
        "history": "Does the adversary have a history of engaging in deception?",
        "pattern": "Does the current circumstance fit the pattern of past deceptions?",
        "precedents": "If not, are there other historical precedents?",
        "changes": "Are there changed circumstances that would explain using this form of deception now?"
    }

    for key, question in pop_questions.items():
        if key not in st.session_state["pop_responses"]:
            st.session_state["pop_responses"][key] = ""
        
        st.session_state["pop_responses"][key] = st.text_area(
            question,
            value=st.session_state["pop_responses"][key],
            key=f"pop_{key}"
        )

    # AI Suggestions for POP
    if st.button("AI: Suggest POP Considerations"):
        if not scenario:
            st.warning("Please provide a scenario description first.")
        else:
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI expert in deception analysis. Provide specific considerations for POP analysis."
                }
                user_msg = {
                    "role": "user",
                    "content": f"For this scenario: {scenario}\nSuggest specific considerations for Past Opposition Practices analysis."
                }
                suggestions = chat_gpt([system_msg, user_msg], model="gpt-4-mini")
                st.info("AI Suggestions:\n" + suggestions)
            except Exception as e:
                st.error(f"Error generating suggestions: {e}")

    # MOSES (Manipulability of Sources)
    st.markdown("---")
    st.subheader("3. Manipulability of Sources (MOSES)")
    
    moses_questions = {
        "vulnerability": "Is the source vulnerable to control or manipulation by the potential deceiver?",
        "reliability": "What is the basis for judging the source to be reliable?",
        "access": "Does the source have direct access or only indirect access to the information?",
        "track_record": "How good is the source's track record of reporting?"
    }

    for key, question in moses_questions.items():
        if key not in st.session_state["moses_responses"]:
            st.session_state["moses_responses"][key] = ""
        
        st.session_state["moses_responses"][key] = st.text_area(
            question,
            value=st.session_state["moses_responses"][key],
            key=f"moses_{key}"
        )

    # AI Suggestions for MOSES
    if st.button("AI: Suggest MOSES Considerations"):
        if not scenario:
            st.warning("Please provide a scenario description first.")
        else:
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI expert in deception analysis. Provide specific considerations for MOSES analysis."
                }
                user_msg = {
                    "role": "user",
                    "content": f"For this scenario: {scenario}\nSuggest specific considerations for Manipulability of Sources analysis."
                }
                suggestions = chat_gpt([system_msg, user_msg], model="gpt-4-mini")
                st.info("AI Suggestions:\n" + suggestions)
            except Exception as e:
                st.error(f"Error generating suggestions: {e}")

    # EVE (Evaluation of Evidence)
    st.markdown("---")
    st.subheader("4. Evaluation of Evidence (EVE)")
    
    eve_questions = {
        "accuracy": "How accurate is the source's reporting? Has the whole chain of evidence been checked?",
        "critical_evidence": "Does the critical evidence check out? Remember to check subsources.",
        "conflicts": "Does evidence from one source conflict with other sources?",
        "corroboration": "Do other sources provide corroborating evidence?",
        "missing_evidence": "Is the absence of evidence one would expect to see noteworthy?"
    }

    for key, question in eve_questions.items():
        if key not in st.session_state["eve_responses"]:
            st.session_state["eve_responses"][key] = ""
        
        st.session_state["eve_responses"][key] = st.text_area(
            question,
            value=st.session_state["eve_responses"][key],
            key=f"eve_{key}"
        )

    # AI Suggestions for EVE
    if st.button("AI: Suggest EVE Considerations"):
        if not scenario:
            st.warning("Please provide a scenario description first.")
        else:
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI expert in deception analysis. Provide specific considerations for EVE analysis."
                }
                user_msg = {
                    "role": "user",
                    "content": f"For this scenario: {scenario}\nSuggest specific considerations for Evaluation of Evidence analysis."
                }
                suggestions = chat_gpt([system_msg, user_msg], model="gpt-4-mini")
                st.info("AI Suggestions:\n" + suggestions)
            except Exception as e:
                st.error(f"Error generating suggestions: {e}")

    # Summary and Export Section
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
            Scenario: {scenario}
            
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
            
            summary = chat_gpt([system_msg, user_msg], model="gpt-4-mini")
            st.info("Analysis Summary:\n" + summary)
        except Exception as e:
            st.error(f"Error generating summary: {e}")

    # Export functionality
    if st.button("Export Analysis"):
        try:
            # Create a formatted string of the analysis
            analysis_text = (
                f"Deception Detection Analysis\n\n"
                f"Scenario:\n{scenario}\n\n"
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
            st.error(f"Error exporting analysis: {e}")

    st.markdown("---")
    st.info("""
    **Note**: Remember that deception detection is an iterative process. Regular review and updates
    of this analysis as new information becomes available is recommended. Consider using this framework
    in conjunction with other analytical techniques such as Analysis of Competing Hypotheses (ACH).
    """)

def main():
    deception_detection()

if __name__ == "__main__":
    main() 