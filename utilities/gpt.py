# /utilities/utils_openai.py

import os
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

# Global variables for client and availability
client = None
OPENAI_AVAILABLE = False
USE_LOCAL_LLM = False

def initialize_ai_client():
    """Initialize the OpenAI client and set global availability flags.
    
    Returns:
        tuple: (client, is_openai_available, use_local_llm)
    """
    global client, OPENAI_AVAILABLE, USE_LOCAL_LLM
    
    # Load environment variables
    load_dotenv()
    
    # Try to initialize OpenAI client
    try:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if api_key and api_key not in ("", "YOUR_OPENAI_API_KEY_HERE"):
            client = OpenAI(api_key=api_key)
            OPENAI_AVAILABLE = True
            logging.info("OpenAI client initialized successfully")
        else:
            logging.warning("OPENAI_API_KEY not set or invalid. AI functionality will be limited.")
    except ImportError:
        logging.warning("OpenAI package not installed. AI functionality will be limited.")
    except Exception as e:
        logging.error(f"Error initializing OpenAI client: {e}")
    
    # Check Local LLM configuration
    local_llm_host = os.getenv("LOCAL_LLM_HOST", "").strip()
    local_llm_port = os.getenv("LOCAL_LLM_PORT", "").strip()
    local_llm_api_key = os.getenv("LOCAL_LLM_API_KEY", "").strip()
    
    USE_LOCAL_LLM = all([
        local_llm_host not in ("", "YOUR_LOCAL_LLM_HOST_HERE"),
        local_llm_port not in ("", "YOUR_LOCAL_LLM_PORT_HERE"),
        local_llm_api_key not in ("", "YOUR_LOCAL_LLM_API_KEY_HERE")
    ])
    
    if USE_LOCAL_LLM:
        logging.info("Local LLM configuration detected")
    
    return client, OPENAI_AVAILABLE, USE_LOCAL_LLM

# Initialize the client and availability flags
initialize_ai_client()

def get_fallback_response(error_type: str = "general") -> str:
    """Get a appropriate fallback response based on the error type.
    
    Args:
        error_type: The type of error encountered
        
    Returns:
        A suitable fallback response message
    """
    fallbacks = {
        "openai_not_available": (
            "OpenAI services are not available. Please check your API key configuration "
            "in the .env file and ensure the openai package is installed."
        ),
        "local_llm_error": (
            "Local LLM services are not available. Please check your local LLM configuration "
            "in the .env file and ensure the service is running."
        ),
        "general": (
            "AI services are not available. Please check your configuration and ensure "
            "either OpenAI API key is set or Local LLM is properly configured."
        )
    }
    return fallbacks.get(error_type, fallbacks["general"])

def chat_gpt(
    messages: List[Dict[str, str]],
    model: str = "gpt-4",
    max_tokens: int = 512,
    temperature: float = 0.7,
    top_p: float = 1.0,
    n: int = 1,
    frequency_penalty: float = 0.0,
    presence_penalty: float = 0.0
) -> str:
    """A generic helper to call the ChatCompletion endpoint from either OpenAI or a local LLM.
    
    Args:
        messages: A list of dicts, each having {"role": "...", "content": "..."}.
        model: The model name to use.
        max_tokens: Maximum tokens to generate in the response.
        temperature: Sampling temperature.
        top_p: Nucleus sampling.
        n: Number of responses to return.
        frequency_penalty: Penalty for repeated tokens.
        presence_penalty: Encourages new topics.
    
    Returns:
        The text content of the AI's reply or a fallback message.
    """
    if not OPENAI_AVAILABLE and not USE_LOCAL_LLM:
        return get_fallback_response()
        
    try:
        if USE_LOCAL_LLM:
            # Call the local LLM endpoint
            import requests
            url = f"http://{os.getenv('LOCAL_LLM_HOST')}:{os.getenv('LOCAL_LLM_PORT')}/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {os.getenv('LOCAL_LLM_API_KEY')}",
                "Content-Type": "application/json"
            }
            json_data = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "n": n,
                "frequency_penalty": frequency_penalty,
                "presence_penalty": presence_penalty
            }
            response = requests.post(url, headers=headers, json=json_data)
            response.raise_for_status()
            response_json = response.json()
            return response_json["choices"][0]["message"]["content"].strip()
        else:
            # Use OpenAI API
            if not client:
                return get_fallback_response("openai_not_available")
                
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                n=n,
                frequency_penalty=frequency_penalty,
                presence_penalty=presence_penalty
            )
            return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error in chat_gpt: {e}")
        return f"Error generating response: {str(e)}"


def generate_advanced_query(search_query, search_platform, model="gpt-4"):
    """
    Generates an advanced search query for the specified platform.
    
    Args:
        search_query (str): The basic search query to enhance
        search_platform (str): The platform to generate the query for
        model (str): The model to use
        
    Returns:
        str: The enhanced search query
    """
    if not OPENAI_AVAILABLE:
        return f"Cannot generate advanced query: OpenAI API not available"
        
    try:
        # Get today's date
        today = datetime.now()
        date_context = f"\nToday's date is {today.strftime('%Y-%m-%d')}. "

        base_prompt = f"Analyze the intention of this search and create an advanced query to be used on {search_platform}. {date_context}"

        if search_platform == "Windows CMD Search":
            additional_prompt = (
                "Take into account the limits and syntax of Windows CMD Search and "
                "use only commands that do not require installation on the terminal.\n"
                "Output the exact command to run, do not output any additional explanation, "
                "do not use markdown codeblocks or backticks."
            )
        else:
            additional_prompt = (
                "Start by considering what the data would look like... "
                "Only output the advanced query, no additional explanation, "
                "do not use markdown codeblocks or backticks."
            )

        messages = [
            {"role": "user", "content": base_prompt + additional_prompt + search_query}
        ]

        # Use the existing client instead of creating a new one
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=250
        )

        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"Error generating advanced query: {e}")
        return f"Error generating advanced query: {str(e)}"


def generate_cog_questions(user_details, desired_end_state, custom_prompt="", model="gpt-4"):
    """
    Example specialized function to prompt for 'COG questions.'
    You can expand the system message or user message to shape the results.
    
    Args:
        user_details (str): Info about the user/org context.
        desired_end_state (str): The user's overarching goal or end state.
        custom_prompt (str): Any custom instructions for the AI about the questions.
        model (str): Which GPT model to use.
    
    Returns:
        str: AI-generated text (likely a set of questions).
    """
    system_message = {
        "role": "system",
        "content": (
            "You are an advanced AI specialized in Center of Gravity (COG) analysis, "
            "helping users identify critical vulnerabilities, capabilities, and CoGs."
        )
    }
    user_message = {
        "role": "user",
        "content": (
            f"{custom_prompt}\n\n"
            f"User/Org details: {user_details}\n"
            f"Desired End State: {desired_end_state}\n\n"
            "Provide a set of questions (or prompts) that the user should consider "
            "to refine their COG analysis or identify critical factors. Avoid extra commentary."
        )
    }

    messages = [system_message, user_message]
    return chat_gpt(messages, model=model, max_tokens=400, temperature=0.7)


def generate_cog_options(user_details, desired_end_state, entity_type, custom_prompt="", model="gpt-4"):
    """
    Another specialized function that generates possible CoG options or ideas.
    
    Args:
        user_details (str): Info about the user/org context.
        desired_end_state (str): The user's overarching goal or end state.
        entity_type (str): e.g. 'Friendly', 'Adversary', 'Competitor', 'Customer'
        custom_prompt (str): Additional instructions or context for the AI.
        model (str): GPT model to use.
    
    Returns:
        str: AI-generated text listing potential CoG ideas or aspects.
    """
    system_message = {
        "role": "system",
        "content": (
            "You are an advanced AI specialized in identifying potential Centers of Gravity "
            "for different entity types (friendly, adversary, competitor, etc.)."
        )
    }
    user_message = {
        "role": "user",
        "content": (
            f"{custom_prompt}\n\n"
            f"User/Org details: {user_details}\n"
            f"Desired End State: {desired_end_state}\n"
            f"Entity Type: {entity_type}\n\n"
            "Suggest multiple potential Centers of Gravity relevant for this entity, "
            "aligned with the user's desired end state. "
            "No bullet points or numbered lists, separate each CoG with a semicolon."
            "Do not output any additional commentary."
        )
    }

    messages = [system_message, user_message]
    return chat_gpt(messages, model=model, max_tokens=500, temperature=0.7)

def get_completion(
    prompt: str,
    model: str = "gpt-4",
    temperature: float = 0.7,
    max_tokens: int = 1000,
    top_p: float = 1.0,
    frequency_penalty: float = 0.0,
    presence_penalty: float = 0.0
) -> str:
    """
    Get a completion from OpenAI's GPT models.
    
    Args:
        prompt: The text prompt to send to the model
        model: The model to use (default: gpt-4)
        temperature: Controls randomness (0-1)
        max_tokens: Maximum number of tokens to generate
        top_p: Controls diversity via nucleus sampling
        frequency_penalty: Penalizes repeated tokens
        presence_penalty: Penalizes repeated topics
        
    Returns:
        The generated text as a string
    """
    if not OPENAI_AVAILABLE:
        logging.warning("OpenAI package not installed or API key not set")
        return f"OpenAI services not available. Cannot process: {prompt[:100]}..."

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            frequency_penalty=frequency_penalty,
            presence_penalty=presence_penalty
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error in get_completion: {e}")
        return f"Error generating completion: {str(e)}"

def get_chat_completion(
    messages: List[Dict[str, str]],
    model: str = "gpt-4",
    temperature: float = 0.7,
    max_tokens: int = 1000
) -> str:
    """
    Get a completion from OpenAI's chat models using a conversation format.
    
    Args:
        messages: List of message dictionaries with 'role' and 'content'
        model: The model to use (default: gpt-4)
        temperature: Controls randomness (0-1)
        max_tokens: Maximum number of tokens to generate
        
    Returns:
        The generated text as a string
    """
    if not OPENAI_AVAILABLE:
        return "OpenAI package not installed. Cannot process chat messages."

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error in get_chat_completion: {e}")
        return f"Error generating chat completion: {str(e)}"