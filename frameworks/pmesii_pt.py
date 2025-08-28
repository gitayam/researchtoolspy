# /frameworks/PMESII_PT.py
"""
PMESII-PT Analysis Framework
"""
import streamlit as st
import json
from utilities.gpt import chat_gpt
from utilities.advanced_scraper import search_wikipedia
from dotenv import load_dotenv

load_dotenv()

def clean_gpt_response(response_text):
    """
    Clean GPT response by removing markdown code fences, extraneous language markers, and
    extracting the JSON content based on the first '[' and the last ']'.
    """
    response_text = response_text.strip()
    # Remove starting/ending code fences if present.
    if response_text.startswith("```"):
        response_text = response_text.strip("`")
        lines = response_text.splitlines()
        # Remove language marker if it's the first line.
        if lines and lines[0].strip().lower() in ["json", "text"]:
            response_text = "\n".join(lines[1:]).strip()
    # Extract content between the first '[' and the last ']'
    start_idx = response_text.find('[')
    end_idx = response_text.rfind(']')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        response_text = response_text[start_idx:end_idx+1].strip()
    return response_text

# Helper function to generate questions for a specific domain
def generate_domain_questions(domain):
    """Generate a list of questions for a specific PMESII-PT domain"""
    questions = {
        "political": [
            "What is the current government structure?",
            "Who are the key political leaders and decision-makers?",
            "What is the level of political stability?",
            "What are the major political parties or factions?",
            "How is power distributed between central and local authorities?",
            "What are the key political grievances in the population?",
            "What is the relationship with neighboring countries?",
            "How effective are government institutions?",
            "What is the level of corruption in government?",
            "What political reforms are underway or planned?"
        ],
        "military": [
            "What is the structure and size of the armed forces?",
            "What are their key capabilities and equipment?",
            "How professional and well-trained are the forces?",
            "What is the current military posture and readiness?",
            "Who are the key military leaders?",
            "What is the relationship between military and civilian leadership?",
            "What is the military budget and resource allocation?",
            "What are the current military operations or conflicts?",
            "What are the military's strengths and weaknesses?",
            "What foreign military presence exists in the area?"
        ],
        "economic": [
            "What is the overall economic situation?",
            "What are the key industries and sectors?",
            "What natural resources are available?",
            "What is the unemployment rate and labor situation?",
            "How stable is the currency and banking system?",
            "What is the level of foreign investment?",
            "What are the major economic challenges?",
            "How is wealth distributed across the population?",
            "What economic sanctions or restrictions are in place?",
            "What is the state of economic infrastructure?"
        ],
        "social": [
            "What is the demographic composition of the population?",
            "What are the major ethnic, religious, or tribal groups?",
            "What are the key cultural values and norms?",
            "What is the literacy rate and education level?",
            "What are the major social issues or tensions?",
            "What is the status of human rights?",
            "What is the role of women in society?",
            "What are the major health challenges?",
            "What are the patterns of internal displacement or migration?",
            "What social services are available to the population?"
        ],
        "information": [
            "What are the main media outlets and information sources?",
            "What is the level of internet and mobile phone penetration?",
            "How is information controlled or censored?",
            "What narratives dominate the information space?",
            "What is the level of media literacy?",
            "What disinformation campaigns are active?",
            "How do people typically receive and share information?",
            "What is the role of social media?",
            "What languages are used in media and communication?",
            "What information infrastructure exists?"
        ],
        "infrastructure": [
            "What is the state of transportation networks?",
            "How reliable is the power grid and energy supply?",
            "What is the quality of water and sanitation systems?",
            "What telecommunications infrastructure exists?",
            "What is the state of healthcare facilities?",
            "What critical infrastructure is vulnerable?",
            "What is the housing situation?",
            "What major infrastructure projects are underway?",
            "How has infrastructure been affected by conflict or disasters?",
            "What is the state of urban vs. rural infrastructure?"
        ],
        "physical environment": [
            "What is the geography and terrain of the area?",
            "What are the climate conditions and seasonal variations?",
            "What natural hazards or environmental risks exist?",
            "What are the major bodies of water and natural features?",
            "What is the state of environmental degradation?",
            "How does the physical environment affect movement and operations?",
            "What natural resources are present?",
            "What is the land use pattern (urban, agricultural, etc.)?",
            "What protected or sensitive environmental areas exist?",
            "How is climate change affecting the area?"
        ],
        "time": [
            "What significant historical events shape current conditions?",
            "What are important upcoming dates or events?",
            "What seasonal factors affect operations or activities?",
            "What is the pace of change in different domains?",
            "What historical grievances influence current dynamics?",
            "What are the short, medium, and long-term trends?",
            "What cyclical patterns exist (elections, festivals, etc.)?",
            "How do different groups perceive time and planning horizons?",
            "What deadlines or time constraints are relevant?",
            "What historical context is essential to understand current situations?"
        ]
    }
    
    return questions.get(domain, ["No questions available for this domain."])

# Helper function to generate data for a specific domain using AI
def generate_domain_data(domain, context):
    """Generate analysis data for a specific PMESII-PT domain using AI"""
    try:
        # Get domain-specific questions
        questions = generate_domain_questions(domain)
        
        # Create a prompt for the AI
        prompt = f"""
        Context information about the area of interest:
        {context}
        
        Please analyze the {domain.title()} domain for this area based on the following questions:
        
        {chr(10).join([f"- {q}" for q in questions])}
        
        Provide a structured analysis with headings and bullet points where appropriate.
        """
        
        # Try to use chat_gpt if available
        try:
            system_msg = {
                "role": "system",
                "content": f"You are an expert analyst specializing in the {domain.title()} domain of PMESII-PT analysis."
            }
            user_msg = {"role": "user", "content": prompt}
            response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
        except Exception as e:
            # Provide a placeholder response if AI functions are not available
            response = f"""
            # {domain.title()} Domain Analysis
            
            *AI analysis functionality is not available: {str(e)}*
            
            ## Key Questions to Consider:
            {chr(10).join([f"- {q}" for q in questions])}
            """
        
        return response
    except Exception as e:
        return f"Error generating {domain} data: {str(e)}"

def pmesii_pt_page():
    st.title("PMESII-PT Analysis Framework")
    
    st.write("""
    The PMESII-PT framework is used to analyze operational environments across multiple domains:
    
    - **Political**: Government structure, policies, stability
    - **Military**: Armed forces, capabilities, posture
    - **Economic**: Resources, infrastructure, financial systems
    - **Social**: Demographics, culture, beliefs
    - **Information**: Media, communications, information flow
    - **Infrastructure**: Critical facilities, transportation, utilities
    - **Physical Environment**: Geography, terrain, weather
    - **Time**: Timing considerations, historical context
    """)
    
    #
    # Step 1: Define the Area of Interest
    #
    st.subheader("Step 1: Define the Area of Interest")

    st.subheader("Area Details")
    country = st.text_input("Country (required):", key="country")
    state = st.text_input("State (optional):", key="state")
    city = st.text_input("City (optional):", key="city")
    neighborhood = st.text_input("Neighborhood (optional):", key="neighborhood")
    general_area = st.text_input("General Area (optional):", key="general_area")

    # Automatically generate the Wikipedia search query and perform Wikipedia search.
    if st.button("Search Wikipedia for the Area"):
        if not country.strip():
            st.error("Country is required for searching Wikipedia.")
        else:
            # Arrange location parts in the order: General Area, Neighborhood, City, State, Country.
            location_parts = []
            if general_area.strip():
                location_parts.append(general_area.strip())
            if neighborhood.strip():
                location_parts.append(neighborhood.strip())
            if city.strip():
                location_parts.append(city.strip())
            if state.strip():
                location_parts.append(state.strip())
            if country.strip():
                location_parts.append(country.strip())
            context = ", ".join(location_parts)
            
            # Improved prompt for generating a plain language Wikipedia search query.
            prompt = (
                "Based on the following location details, generate a plain language Wikipedia search query for a place. "
                "List the available details in this order: General Area, Neighborhood, City, State, Country. "
                "Include only the provided details, separated by commas, with no extra commentary.\n\n"
                f"Location: {context}"
            )
            system_msg = {
                "role": "system",
                "content": "You are a location analyst generating plain language Wikipedia search queries for places."
            }
            user_msg = {"role": "user", "content": prompt}
            try:
                generated_query = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                # Cleanup any markdown/code-fencing and remove surrounding quotes.
                cleaned_query = generated_query.strip()
                if cleaned_query.startswith("```"):
                    cleaned_query = cleaned_query.strip("`")
                    first_line, *rest = cleaned_query.splitlines()
                    if first_line.strip().lower().startswith("json") or first_line.strip().lower().startswith("text"):
                        cleaned_query = "\n".join(rest).strip()
                if (cleaned_query.startswith('"') and cleaned_query.endswith('"')) or \
                   (cleaned_query.startswith("'") and cleaned_query.endswith("'")):
                    cleaned_query = cleaned_query[1:-1].strip()
                st.session_state["wiki_query"] = cleaned_query
                st.write("Generated Wikipedia Search Query:", cleaned_query)
                wiki_summary = search_wikipedia(st.session_state["wiki_query"], sentences=5)
                st.markdown("### Wikipedia Summary")
                st.write(wiki_summary)
            except Exception as e:
                st.error(f"Error generating search query: {e}")

    st.markdown("---")
    # Define Operational Environment
    st.subheader("Define the Operational Environment")
    operational_env = st.text_area(
        "Describe the Operational Environment:",
        placeholder="Enter details about the area of interest, boundaries, and operational context..."
    )

    # Define Goals or Lines of Effort
    st.subheader("Define Goals / Lines of Effort")
    goals = st.text_area(
        "Enter Goals or Lines of Effort:",
        placeholder="List and describe the goals or lines of effort pertaining to the analysis..."
    )

    st.markdown("---")
    # --- Step 2: Gather Relevant Data ---
    st.header("Step 2: Gather Relevant Data")
    st.markdown("Generate questions for each PMESII-PT domain and provide answers or use AI assistance.")
    
    domains = [
        "Political", "Military", "Economic", "Social",
        "Information", "Infrastructure", "Physical Environment", "Time"
    ]

    # Initialize session state for questions and answers
    if "domain_questions" not in st.session_state:
        st.session_state["domain_questions"] = {}
    if "domain_answers" not in st.session_state:
        st.session_state["domain_answers"] = {}

    # Create a row with two buttons at the top
    col1, col2 = st.columns(2)
    with col1:
        # Generate Questions for All Domains button
        if st.button("Generate Questions for All Domains", key="gen_all_questions", use_container_width=True):
            # Check if we have context information to make questions more relevant
            context_info = ""
            if country.strip():
                context_info += f"Country: {country}\n"
            if state.strip():
                context_info += f"State: {state}\n"
            if city.strip():
                context_info += f"City: {city}\n"
            if neighborhood.strip():
                context_info += f"Neighborhood: {neighborhood}\n"
            if general_area.strip():
                context_info += f"General Area: {general_area}\n"
            if operational_env.strip():
                context_info += f"Operational Environment: {operational_env}\n"
            if goals.strip():
                context_info += f"Goals/Lines of Effort: {goals}\n"
            
            # If we have context, use AI to generate tailored questions
            if context_info.strip():
                with st.spinner("Generating tailored questions for all domains... This may take a moment."):
                    for domain in domains:
                        try:
                            # Create a prompt for the AI to generate domain-specific questions
                            prompt = f"""
                            Based on the following context information about an area of interest, generate 5-10 specific, 
                            relevant questions for the {domain} domain of a PMESII-PT analysis.
                            
                            Context Information:
                            {context_info}
                            
                            The questions should be tailored to this specific context and help gather important information 
                            about the {domain.lower()} aspects of this area. Format the response as a simple list of questions, 
                            one per line, with no numbering or bullet points.
                            """
                            
                            system_msg = {
                                "role": "system",
                                "content": f"You are an expert analyst specializing in the {domain} domain of PMESII-PT analysis."
                            }
                            user_msg = {"role": "user", "content": prompt}
                            
                            # Get AI-generated questions
                            response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                            
                            # Process the response into a list of questions
                            questions = []
                            for line in response.strip().split('\n'):
                                line = line.strip()
                                # Remove any bullet points or numbering
                                if line.startswith('- '):
                                    line = line[2:].strip()
                                elif line.startswith('* '):
                                    line = line[2:].strip()
                                elif len(line) > 2 and line[0].isdigit() and line[1] == '.':
                                    line = line[2:].strip()
                                
                                if line and '?' in line:  # Ensure it's a question
                                    questions.append(line)
                            
                            # Fallback to default questions if AI didn't generate any
                            if not questions:
                                questions = generate_domain_questions(domain.lower())
                            
                            st.session_state["domain_questions"][domain] = questions
                            
                            # Initialize empty answers for each question
                            if domain not in st.session_state["domain_answers"]:
                                st.session_state["domain_answers"][domain] = [""] * len(questions)
                            else:
                                # Ensure the answers list is the same length as the questions list
                                current_answers = st.session_state["domain_answers"][domain]
                                if len(current_answers) < len(questions):
                                    # Add empty answers for new questions
                                    st.session_state["domain_answers"][domain] = current_answers + [""] * (len(questions) - len(current_answers))
                                elif len(current_answers) > len(questions):
                                    # Truncate answers if we have fewer questions now
                                    st.session_state["domain_answers"][domain] = current_answers[:len(questions)]
                        
                        except Exception as e:
                            # Fallback to default questions if there's an error
                            st.warning(f"Error generating tailored questions for {domain}: {e}")
                            default_questions = generate_domain_questions(domain.lower())
                            st.session_state["domain_questions"][domain] = default_questions
                            
                            # Initialize empty answers for each question
                            if domain not in st.session_state["domain_answers"]:
                                st.session_state["domain_answers"][domain] = [""] * len(default_questions)
                
                st.success("Generated tailored questions for all domains based on your context information!")
            else:
                # Use default questions if no context is provided
                for domain in domains:
                    default_questions = generate_domain_questions(domain.lower())
                    st.session_state["domain_questions"][domain] = default_questions
                    
                    # Initialize empty answers for each question
                    if domain not in st.session_state["domain_answers"]:
                        st.session_state["domain_answers"][domain] = [""] * len(default_questions)
                
                st.success("Generated standard questions for all domains. Add context information for more tailored questions!")

    with col2:
        # Answer All Questions with AI button
        if st.button("Answer All Questions with AI", key="answer_all_questions", use_container_width=True):
            # Check if questions have been generated
            if not st.session_state["domain_questions"]:
                st.warning("Please generate questions first before using AI to answer them.")
            else:
                # Check if we have context information for AI to use
                context_info = ""
                if country.strip():
                    context_info += f"Country: {country}\n"
                if state.strip():
                    context_info += f"State: {state}\n"
                if city.strip():
                    context_info += f"City: {city}\n"
                if neighborhood.strip():
                    context_info += f"Neighborhood: {neighborhood}\n"
                if general_area.strip():
                    context_info += f"General Area: {general_area}\n"
                if operational_env.strip():
                    context_info += f"Operational Environment: {operational_env}\n"
                if goals.strip():
                    context_info += f"Goals/Lines of Effort: {goals}\n"
                
                if not context_info.strip():
                    st.warning("Please provide some context information about the area of interest for AI to generate meaningful answers.")
                else:
                    with st.spinner("Generating AI answers for all questions... This may take a moment."):
                        for domain in domains:
                            if domain in st.session_state["domain_questions"]:
                                questions = st.session_state["domain_questions"][domain]
                                
                                for i, question in enumerate(questions):
                                    try:
                                        # Create a prompt for the AI to answer the question
                                        prompt = f"""
                                        As an intelligence analyst with expertise on this region, please answer the following question 
                                        about the {domain} domain:
                                        
                                        Question: {question}
                                        
                                        Context Information:
                                        {context_info}
                                        
                                        Provide a concise, factual answer based on your knowledge of the region. If specific information 
                                        is not available, provide a reasonable assessment based on similar regions or general principles.
                                        """
                                        
                                        system_msg = {
                                            "role": "system",
                                            "content": f"You are an expert intelligence analyst specializing in the {domain} domain with deep knowledge of this region."
                                        }
                                        user_msg = {"role": "user", "content": prompt}
                                        
                                        # Get AI-generated answer
                                        response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                                        
                                        # Store the answer
                                        st.session_state["domain_answers"][domain][i] = response
                                        
                                        # Force a rerun to show the updated answer
                                        st.rerun()
                                        
                                    except Exception as e:
                                        st.error(f"Error generating AI answer: {str(e)}")
                    
                    st.success("Generated AI answers for all questions!")
                    st.rerun()

    # Create an expander for each domain
    for domain in domains:
        with st.expander(f"{domain} Domain Analysis", expanded=False):
            # Button to generate questions for this domain
            if st.button(f"Generate {domain} Questions", key=f"gen_{domain}_q"):
                # Similar logic as above but for a single domain
                context_info = ""
                if country.strip():
                    context_info += f"Country: {country}\n"
                if state.strip():
                    context_info += f"State: {state}\n"
                if city.strip():
                    context_info += f"City: {city}\n"
                if neighborhood.strip():
                    context_info += f"Neighborhood: {neighborhood}\n"
                if general_area.strip():
                    context_info += f"General Area: {general_area}\n"
                if operational_env.strip():
                    context_info += f"Operational Environment: {operational_env}\n"
                if goals.strip():
                    context_info += f"Goals/Lines of Effort: {goals}\n"
                
                # If we have context, use AI to generate tailored questions
                if context_info.strip():
                    with st.spinner(f"Generating tailored questions for {domain} domain..."):
                        try:
                            # Create a prompt for the AI
                            prompt = f"""
                            Based on the following context information about an area of interest, generate 5-10 specific, 
                            relevant questions for the {domain} domain of a PMESII-PT analysis.
                            
                            Context Information:
                            {context_info}
                            
                            The questions should be tailored to this specific context and help gather important information 
                            about the {domain.lower()} aspects of this area. Format the response as a simple list of questions, 
                            one per line, with no numbering or bullet points.
                            """
                            
                            system_msg = {
                                "role": "system",
                                "content": f"You are an expert analyst specializing in the {domain} domain of PMESII-PT analysis."
                            }
                            user_msg = {"role": "user", "content": prompt}
                            
                            # Get AI-generated questions
                            response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                            
                            # Process the response into a list of questions
                            questions = []
                            for line in response.strip().split('\n'):
                                line = line.strip()
                                # Remove any bullet points or numbering
                                if line.startswith('- '):
                                    line = line[2:].strip()
                                elif line.startswith('* '):
                                    line = line[2:].strip()
                                elif len(line) > 2 and line[0].isdigit() and line[1] == '.':
                                    line = line[2:].strip()
                                
                                if line and '?' in line:  # Ensure it's a question
                                    questions.append(line)
                            
                            # Fallback to default questions if AI didn't generate any
                            if not questions:
                                questions = generate_domain_questions(domain.lower())
                            
                            st.session_state["domain_questions"][domain] = questions
                            
                            # Initialize empty answers for each question
                            if domain not in st.session_state["domain_answers"]:
                                st.session_state["domain_answers"][domain] = [""] * len(questions)
                            else:
                                # Ensure the answers list is the same length as the questions list
                                current_answers = st.session_state["domain_answers"][domain]
                                if len(current_answers) < len(questions):
                                    # Add empty answers for new questions
                                    st.session_state["domain_answers"][domain] = current_answers + [""] * (len(questions) - len(current_answers))
                                elif len(current_answers) > len(questions):
                                    # Truncate answers if we have fewer questions now
                                    st.session_state["domain_answers"][domain] = current_answers[:len(questions)]
                        
                        except Exception as e:
                            # Fallback to default questions if there's an error
                            st.warning(f"Error generating tailored questions: {e}")
                            default_questions = generate_domain_questions(domain.lower())
                            st.session_state["domain_questions"][domain] = default_questions
                            
                            # Initialize empty answers for each question
                            if domain not in st.session_state["domain_answers"]:
                                st.session_state["domain_answers"][domain] = [""] * len(default_questions)
                else:
                    # Use default questions if no context is provided
                    default_questions = generate_domain_questions(domain.lower())
                    st.session_state["domain_questions"][domain] = default_questions
                    
                    # Initialize empty answers for each question
                    if domain not in st.session_state["domain_answers"]:
                        st.session_state["domain_answers"][domain] = [""] * len(default_questions)
            
            # Display questions and answer fields if questions exist for this domain
            if domain in st.session_state["domain_questions"] and st.session_state["domain_questions"][domain]:
                questions = st.session_state["domain_questions"][domain]
                
                # Display each question with answer field and AI assist button
                for i, question in enumerate(questions):
                    st.markdown(f"**Q{i+1}:** {question}")
                    
                    # Create columns for the answer field and AI assist button
                    answer_col, button_col = st.columns([4, 1])
                    
                    with answer_col:
                        # Get the current answer from session state
                        current_answer = ""
                        if domain in st.session_state["domain_answers"] and i < len(st.session_state["domain_answers"][domain]):
                            current_answer = st.session_state["domain_answers"][domain][i]
                        
                        # Text area for the answer
                        answer = st.text_area(
                            f"Answer to Q{i+1}",
                            value=current_answer,
                            key=f"{domain.lower()}_answer_{i}",
                            height=100,
                            label_visibility="collapsed"
                        )
                        
                        # Update the answer in session state
                        if domain in st.session_state["domain_answers"] and i < len(st.session_state["domain_answers"][domain]):
                            st.session_state["domain_answers"][domain][i] = answer
                    
                    with button_col:
                        # AI assist button for this question
                        if st.button("AI Assist", key=f"{domain.lower()}_ai_assist_{i}", help="Get AI assistance for this question"):
                            # Check if we have context information for AI to use
                            context_info = ""
                            if country.strip():
                                context_info += f"Country: {country}\n"
                            if state.strip():
                                context_info += f"State: {state}\n"
                            if city.strip():
                                context_info += f"City: {city}\n"
                            if neighborhood.strip():
                                context_info += f"Neighborhood: {neighborhood}\n"
                            if general_area.strip():
                                context_info += f"General Area: {general_area}\n"
                            if operational_env.strip():
                                context_info += f"Operational Environment: {operational_env}\n"
                            if goals.strip():
                                context_info += f"Goals/Lines of Effort: {goals}\n"
                            
                            if not context_info.strip():
                                st.warning("Please provide some context information about the area of interest for AI to generate a meaningful answer.")
                            else:
                                with st.spinner("Generating AI answer..."):
                                    try:
                                        # Create a prompt for the AI to answer the question
                                        prompt = f"""
                                        As an intelligence analyst with expertise on this region, please answer the following question 
                                        about the {domain} domain:
                                        
                                        Question: {question}
                                        
                                        Context Information:
                                        {context_info}
                                        
                                        Provide a concise, factual answer based on your knowledge of the region. If specific information 
                                        is not available, provide a reasonable assessment based on similar regions or general principles.
                                        """
                                        
                                        system_msg = {
                                            "role": "system",
                                            "content": f"You are an expert intelligence analyst specializing in the {domain} domain with deep knowledge of this region."
                                        }
                                        user_msg = {"role": "user", "content": prompt}
                                        
                                        # Get AI-generated answer
                                        response = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                                        
                                        # Store the answer
                                        st.session_state["domain_answers"][domain][i] = response
                                        
                                        # Force a rerun to show the updated answer
                                        st.rerun()
                                        
                                    except Exception as e:
                                        st.error(f"Error generating AI answer: {str(e)}")
                    
                    st.markdown("---")
            
            # Add section for manually adding or editing questions
            st.markdown("### Add or Edit Questions")
            st.write("Add a new question or edit existing ones:")
            
            # Create a text input for adding a new question
            new_question = st.text_input(
                "New question:",
                key=f"new_question_{domain.lower()}",
                placeholder="Enter a new question here..."
            )
            
            # Add button to add the new question
            if st.button("Add Question", key=f"add_question_{domain.lower()}"):
                if new_question:
                    # Add the new question
                    st.session_state["domain_questions"][domain].append(new_question)
                    
                    # Add an empty answer for this question
                    if domain not in st.session_state["domain_answers"]:
                        st.session_state["domain_answers"][domain] = [""]
                    else:
                        st.session_state["domain_answers"][domain].append("")
                    
                    # Clear the input field by rerunning
                    st.session_state[f"new_question_{domain.lower()}"] = ""
                    st.rerun()
                else:
                    st.warning("Please enter a question before adding.")
            
            # Add a section for editing existing questions
            st.markdown("### Edit Existing Questions")
            
            # Create a selectbox to choose which question to edit
            question_options = st.session_state["domain_questions"][domain]
            selected_question_index = st.selectbox(
                "Select question to edit:",
                range(len(question_options)),
                format_func=lambda i: f"Q{i+1}: {question_options[i][:50]}...",
                key=f"select_question_{domain.lower()}"
            )
            
            # Create a text input for editing the selected question
            edited_question = st.text_input(
                "Edit question:",
                value=question_options[selected_question_index],
                key=f"edit_question_{domain.lower()}"
            )
            
            # Add buttons for saving the edit or deleting the question
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("Save Edit", key=f"save_edit_{domain.lower()}"):
                    if edited_question:
                        # Update the question
                        st.session_state["domain_questions"][domain][selected_question_index] = edited_question
                        st.success("Question updated!")
                        st.rerun()
                    else:
                        st.warning("Question cannot be empty.")
            
            with col2:
                if st.button("Delete Question", key=f"delete_question_{domain.lower()}"):
                    # Remove the question
                    st.session_state["domain_questions"][domain].pop(selected_question_index)
                    
                    # Remove the corresponding answer if it exists
                    if domain in st.session_state["domain_answers"] and len(st.session_state["domain_answers"][domain]) > selected_question_index:
                        st.session_state["domain_answers"][domain].pop(selected_question_index)
                    
                    st.success("Question deleted!")
                    st.rerun()
                else:  # This else belongs to the if statement that checks for domain questions
                    st.info(f"No questions generated yet for the {domain} domain. Click the 'Generate {domain} Questions' button above to get started.")
                    
                    # Allow adding questions even if none exist yet
                    st.markdown("### Add Questions Manually")
                    
                    # Create a text input for adding a new question
                    new_question = st.text_input(
                        "New question:",
                        key=f"new_question_empty_{domain.lower()}",
                        placeholder="Enter a new question here..."
                    )
                
                # Add button to add the new question
                if st.button("Add Question", key=f"add_question_empty_{domain.lower()}"):
                    if new_question:
                        # Initialize the questions list if it doesn't exist
                        if domain not in st.session_state["domain_questions"]:
                            st.session_state["domain_questions"][domain] = []
                        
                        # Add the new question
                        st.session_state["domain_questions"][domain].append(new_question)
                        
                        # Add an empty answer for this question
                        if domain not in st.session_state["domain_answers"]:
                            st.session_state["domain_answers"][domain] = [""]
                        else:
                            st.session_state["domain_answers"][domain].append("")
                        
                        # Clear the input field by rerunning
                        st.session_state[f"new_question_empty_{domain.lower()}"] = ""
                        st.rerun()
                    else:
                        st.warning("Please enter a question before adding.")

    st.markdown("---")
    # Export all questions and answers into a CSV file.
    st.subheader("Export Data")
    if st.button("Export Questions & Answers to CSV"):
        import csv
        from io import StringIO
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["Domain", "Question", "Answer"])
        
        # Export AI-generated questions and answers
        for domain in domains:
            if domain in st.session_state["domain_answers"]:
                answers = st.session_state["domain_answers"].get(domain, [])
                for qa in answers:
                    writer.writerow([domain, qa["question"], qa["answer"]])
        
        # Export manual data
        for domain in domains:
            domain_key = f"{domain.lower()}_manual_data"
            if domain_key in st.session_state and st.session_state[domain_key]:
                writer.writerow([domain, "Manual Entry", st.session_state[domain_key]])
        
        # Export AI-generated data
        for domain in domains:
            domain_key = f"{domain.lower()}_data"
            if domain_key in st.session_state:
                writer.writerow([domain, "AI-Generated Analysis", st.session_state[domain_key]])
        
        csv_data = output.getvalue()
        st.download_button("Download CSV", csv_data, "PMESII_PT_Analysis.csv", "text/csv")
    
    st.markdown("---")
    # --- Step 3: Generate Analytical Questions ---
    st.header("Step 3: Generate Analytical Questions")
    st.markdown("""
    Leverage AI to generate a list of clear and actionable analytical questions that help you probe deeper into your analysis and identify any information gaps.
    Each question will begin with one of: what, how, when, where, why, or who.
    """)
    
    if st.button("AI: Suggest Analytical Questions"):
        # Assemble gathered data from previous steps.
        gathered_data = ""
        if country.strip():
            gathered_data += f"Country: {country}\n"
        if state.strip():
            gathered_data += f"State: {state}\n"
        if city.strip():
            gathered_data += f"City: {city}\n"
        if neighborhood.strip():
            gathered_data += f"Neighborhood: {neighborhood}\n"
        if general_area.strip():
            gathered_data += f"General Area: {general_area}\n\n"
        if operational_env.strip():
            gathered_data += f"Operational Environment:\n{operational_env}\n\n"
        if goals.strip():
            gathered_data += f"Goals/Lines of Effort:\n{goals}\n\n"
        
        # Add data from all three tabs
        for domain in domains:
            # Add questions from Question-Based tab
            if f"{domain.lower()}_questions" in st.session_state:
                gathered_data += f"\n{domain} Domain Questions:\n"
                for q in st.session_state[f"{domain.lower()}_questions"]:
                    gathered_data += f"- {q}\n"
            
            # Add data from AI-Assisted tab
            if f"{domain.lower()}_data" in st.session_state:
                gathered_data += f"\n{domain} Domain AI Analysis:\n"
                gathered_data += st.session_state[f"{domain.lower()}_data"] + "\n\n"
            
            # Add data from Manual Entry tab
            domain_key = f"{domain.lower()}_manual_data"
            if domain_key in st.session_state and st.session_state[domain_key]:
                gathered_data += f"\n{domain} Domain Manual Data:\n"
                gathered_data += st.session_state[domain_key] + "\n\n"
            
            # Include answered AI-generated questions for each domain.
            if domain in st.session_state["domain_answers"]:
                for qa in st.session_state["domain_answers"][domain]:
                    if qa["answer"].strip():
                        gathered_data += f"{domain} - {qa['question']}:\n{qa['answer']}\n\n"
        
        if not gathered_data.strip():
            st.warning("Please provide some data in the previous sections before generating analytical questions.")
        else:
            try:
                prompt = (
                    "Based on the following PMESII-PT analysis data, generate a list of clear and actionable analytical questions "
                    "that probe deeper into the analysis and identify any information gaps. "
                    "Ensure that each question begins with what, how, when, where, why, or who.\n\n"
                    f"Data:\n{gathered_data}"
                )
                system_msg = {
                    "role": "system",
                    "content": (
                        "You are an experienced analyst proficient in PMESII-PT analysis. "
                        "Provide a list of thoughtful, precise analytical questions based on the provided data."
                    )
                }
                user_msg = {"role": "user", "content": prompt}
                analytical_questions = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.text_area("Generated Analytical Questions", value=analytical_questions, height=200)
            except Exception as e:
                st.error(f"Error generating analytical questions: {e}")
    
    st.markdown("---")
    # --- Step 4: Summarize Analysis ---
    st.header("Step 4: Summarize Analysis")
    st.markdown("Leverage AI to synthesize and summarize the overall PMESII-PT analysis.")
    
    if st.button("AI: Summarize Analysis"):
        # Reuse the gathered data from previous steps.
        if not gathered_data.strip():
            st.warning("Please provide data in the previous sections before generating a summary.")
        else:
            try:
                prompt_summary = (
                    "Using the comprehensive PMESII-PT analysis data provided below, generate a concise summary that highlights the key insights, "
                    "potential information gaps, and critical aspects of the operational environment.\n\n"
                    f"Data:\n{gathered_data}"
                )
                system_msg = {
                    "role": "system",
                    "content": "You are a strategic analyst. Summarize the provided PMESII-PT analysis data clearly and concisely."
                }
                user_msg = {"role": "user", "content": prompt_summary}
                summary_result = chat_gpt([system_msg, user_msg], model="gpt-4o-mini")
                st.text_area("Analysis Summary", value=summary_result, height=200)
            except Exception as e:
                st.error(f"Error generating summary: {e}")

    # Add a clear button
    if st.button(f"Clear All Data", key="clear_all"):
        st.session_state.clear()
        st.rerun()

if __name__ == "__main__":
    pmesii_pt_page() 