# /utilities/utils_openai.py

import os
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
from openai import OpenAI
from typing import Dict, List, Any, Optional, Union
import json

# Try to import OpenAI, but provide fallbacks if not available
try:
    from openai import OpenAI
    
    # Initialize OpenAI client if API key is available
    if "OPENAI_API_KEY" in os.environ:
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        OPENAI_AVAILABLE = True
    else:
        OPENAI_AVAILABLE = False
        print("Warning: OPENAI_API_KEY not set in environment variables. AI functionality will be limited.")
except ImportError:
    OPENAI_AVAILABLE = False
    print("Warning: OpenAI package not installed. AI functionality will be limited.")

# Local LLM environment configuration
LOCAL_LLM_HOST = os.getenv("LOCAL_LLM_HOST", "").strip()
LOCAL_LLM_PORT = os.getenv("LOCAL_LLM_PORT", "").strip()
LOCAL_LLM_API_KEY = os.getenv("LOCAL_LLM_API_KEY", "").strip()

# Determine if Local LLM should be used.
# If any are empty or left as the placeholder strings, USE_LOCAL_LLM will be False.
USE_LOCAL_LLM = all([
    LOCAL_LLM_HOST not in ("", "YOUR_LOCAL_LLM_HOST_HERE"),
    LOCAL_LLM_PORT not in ("", "YOUR_LOCAL_LLM_PORT_HERE"),
    LOCAL_LLM_API_KEY not in ("", "YOUR_LOCAL_LLM_API_KEY_HERE")
])

def chat_gpt(
    messages,
    model="gpt-4",
    max_tokens=512,
    temperature=0.7,
    top_p=1.0,
    n=1,
    frequency_penalty=0.0,
    presence_penalty=0.0
):
    """
    A generic helper to call the ChatCompletion endpoint from either OpenAI or a local LLM.
    
    Args:
        messages (list): A list of dicts, each having {"role": "...", "content": "..."}.
        model (str): The model name to use.
        max_tokens (int): Maximum tokens to generate in the response.
        temperature (float): Sampling temperature.
        top_p (float): Nucleus sampling.
        n (int): Number of responses to return.
        frequency_penalty (float): Penalty for repeated tokens.
        presence_penalty (float): Encourages new topics.
    
    Returns:
        str: The text content of the AI's reply.
    """
    if USE_LOCAL_LLM:
        # Call the local LLM endpoint using the provided host/port and API key.
        import requests
        url = f"http://{LOCAL_LLM_HOST}:{LOCAL_LLM_PORT}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {LOCAL_LLM_API_KEY}",
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
        return response.json().choices[0].message.content.strip()
    else:
        # Fallback to using the OpenAI API.
        response = client.chat.completions.create(model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        n=n,
        frequency_penalty=frequency_penalty,
        presence_penalty=presence_penalty)
        return response.choices[0].message.content.strip()


def generate_advanced_query(search_query, search_platform, model="gpt-4"):
    """
    Preserves your original function from chatgptService.js logic.
    Useful if you still want 'advanced query' style prompts.
    """
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

    # Initialize OpenAI client
    client = OpenAI()

    response = client.chat.completions.create(model=model,
        messages=messages,
        max_tokens=250)

    return response.choices[0].message.content


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
        return f"OpenAI package not installed. Cannot process: {prompt[:100]}..."

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
        print(f"Error in get_completion: {e}")
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