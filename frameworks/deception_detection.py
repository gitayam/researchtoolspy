# /frameworks/DeceptionDetection.py
"""
Deception Detection Framework based on the work of Richards J. Heuer Jr.
"""
import streamlit as st
from utilities.gpt import chat_gpt

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
        help="Provide detailed context about the situation where deception might be present. Include key actors, timeline, and any suspicious patterns or anomalies.",
        placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm. The offer seems unusually generous, and the company's background is difficult to verify.\nExample: An organizational social media account made a post claiming major policy changes that seems inconsistent with previous communications and lacks typical approval channels."
    )

    # Get AI recommendations for framework priority
    if scenario:
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
                "content": f"For this scenario: {scenario}\nWhat is the recommended priority order for applying these frameworks, and why?"
            }
            framework_recommendations = chat_gpt([system_msg, user_msg], model="gpt-4-mini")
            st.info("📋 Recommended Framework Priority:\n" + framework_recommendations)
        except Exception as e:
            st.error(f"Error generating framework recommendations: {e}")

    # MOM Checklist
    st.markdown("---")
    st.subheader("1. Motive, Opportunity, and Means (MOM)")
    
    mom_questions = {
        "motive": {
            "question": "What are the goals and motives of the potential deceiver?",
            "help": "Consider both stated and potential hidden motives. What would they gain from successful deception?",
            "placeholder": "Example: Access to proprietary technology, market manipulation, intelligence gathering"
        },
        "channels": {
            "question": "What means are available to feed information to us?",
            "help": "Identify all possible channels through which deceptive information could be transmitted",
            "placeholder": "Example: Official communications, third-party intermediaries, social media campaigns"
        },
        "risks": {
            "question": "What consequences would the adversary suffer if deception was revealed?",
            "help": "Consider reputational, financial, legal, and strategic consequences of exposure",
            "placeholder": "Example: Loss of credibility in future negotiations, legal sanctions, damaged business relationships"
        },
        "costs": {
            "question": "Would they need to sacrifice sensitive information for credibility?",
            "help": "Evaluate what genuine information or resources the deceiver might need to sacrifice to make the deception believable",
            "placeholder": "Example: Sharing legitimate financial records, revealing actual business connections"
        },
        "feedback": {
            "question": "Do they have a way to monitor the impact of the deception?",
            "help": "Consider how the deceiver might track whether their deception is working",
            "placeholder": "Example: Media monitoring, insider contacts, visible changes in target behavior"
        }
    }

    for key, info in mom_questions.items():
        if key not in st.session_state["mom_responses"]:
            st.session_state["mom_responses"][key] = ""
        
        st.session_state["mom_responses"][key] = st.text_area(
            info["question"],
            value=st.session_state["mom_responses"][key],
            help=info["help"],
            placeholder=info["placeholder"],
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
        "history": {
            "question": "Does the adversary have a history of engaging in deception?",
            "help": "Research and document any known instances of past deceptive behavior",
            "placeholder": "Example: Previous instances of corporate espionage, documented cases of market manipulation"
        },
        "pattern": {
            "question": "Does the current circumstance fit the pattern of past deceptions?",
            "help": "Compare current tactics and methods with known historical patterns",
            "placeholder": "Example: Similar approach to previous cases, using same intermediaries or methods"
        },
        "precedents": {
            "question": "If not, are there other historical precedents?",
            "help": "Look for similar cases in the broader industry or context",
            "placeholder": "Example: Similar deception tactics used by other actors in the industry"
        },
        "changes": {
            "question": "Are there changed circumstances that would explain using this form of deception now?",
            "help": "Consider recent changes in technology, regulations, or context that might enable new deception tactics",
            "placeholder": "Example: New technology making certain deceptions more feasible, changes in regulatory environment"
        }
    }

    for key, info in pop_questions.items():
        if key not in st.session_state["pop_responses"]:
            st.session_state["pop_responses"][key] = ""
        
        st.session_state["pop_responses"][key] = st.text_area(
            info["question"],
            value=st.session_state["pop_responses"][key],
            help=info["help"],
            placeholder=info["placeholder"],
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
        "vulnerability": {
            "question": "Is the source vulnerable to control or manipulation by the potential deceiver?",
            "help": "Assess the independence and integrity of information sources",
            "placeholder": "Example: Source has financial ties to the deceiver, source lacks independent verification capabilities"
        },
        "reliability": {
            "question": "What is the basis for judging the source to be reliable?",
            "help": "Evaluate the source's credentials, track record, and verification methods",
            "placeholder": "Example: Professional reputation, past accuracy, verification processes"
        },
        "access": {
            "question": "Does the source have direct access or only indirect access to the information?",
            "help": "Consider how many steps removed the source is from the original information",
            "placeholder": "Example: Direct witness vs third-hand information, primary vs secondary sources"
        },
        "track_record": {
            "question": "How good is the source's track record of reporting?",
            "help": "Review the source's history of accuracy and reliability",
            "placeholder": "Example: Previous accurate reports, history of corrections or retractions"
        }
    }

    for key, info in moses_questions.items():
        if key not in st.session_state["moses_responses"]:
            st.session_state["moses_responses"][key] = ""
        
        st.session_state["moses_responses"][key] = st.text_area(
            info["question"],
            value=st.session_state["moses_responses"][key],
            help=info["help"],
            placeholder=info["placeholder"],
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
        "accuracy": {
            "question": "How accurate is the source's reporting? Has the whole chain of evidence been checked?",
            "help": "Evaluate the completeness and accuracy of the information chain",
            "placeholder": "Example: All documents independently verified, translations double-checked"
        },
        "critical_evidence": {
            "question": "Does the critical evidence check out? Remember to check subsources.",
            "help": "Focus on the most important pieces of evidence and their verification",
            "placeholder": "Example: Key financial documents verified with multiple sources, critical claims independently confirmed"
        },
        "conflicts": {
            "question": "Does evidence from one source conflict with other sources?",
            "help": "Identify and analyze any contradictions between different sources",
            "placeholder": "Example: Discrepancies between official statements and observed actions"
        },
        "corroboration": {
            "question": "Do other sources provide corroborating evidence?",
            "help": "Look for independent confirmation from multiple sources",
            "placeholder": "Example: Similar findings from independent investigations, matching patterns from different sources"
        },
        "missing_evidence": {
            "question": "Is the absence of evidence one would expect to see noteworthy?",
            "help": "Consider what evidence should exist but is missing",
            "placeholder": "Example: Lack of expected documentation, missing standard business records"
        }
    }

    for key, info in eve_questions.items():
        if key not in st.session_state["eve_responses"]:
            st.session_state["eve_responses"][key] = ""
        
        st.session_state["eve_responses"][key] = st.text_area(
            info["question"],
            value=st.session_state["eve_responses"][key],
            help=info["help"],
            placeholder=info["placeholder"],
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