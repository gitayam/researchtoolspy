# /researchtools_streamlit/utils_openai.py

import openai
import os
from dotenv import load_dotenv

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")


def chat_gpt(
    messages,
    model="gpt-4o",
    max_tokens=512,
    temperature=0.7,
    top_p=1.0,
    n=1,
    frequency_penalty=0.0,
    presence_penalty=0.0
):
    """
    A generic helper to call the OpenAI ChatCompletion endpoint.
    
    Args:
        messages (list): A list of dicts, each having {"role": "...", "content": "..."}.
        model (str): The model name to use, e.g. "gpt-3.5-turbo" or "gpt-4".
        max_tokens (int): Maximum tokens to generate in the response.
        temperature (float): Sampling temperature for creativity (0.0 - 1.0+).
        top_p (float): Nucleus sampling.
        n (int): Number of response generations to return (usually 1).
        frequency_penalty (float): Penalty for repeated tokens.
        presence_penalty (float): Encourages new topics by penalizing repeated tokens.
    
    Returns:
        str: The text content of the AI's reply.
    """
    response = openai.ChatCompletion.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        n=n,
        frequency_penalty=frequency_penalty,
        presence_penalty=presence_penalty
    )
    return response["choices"][0]["message"]["content"].strip()


def generate_advanced_query(search_query, search_platform, model="gpt-4o"):
    """
    Preserves your original function from chatgptService.js logic.
    Useful if you still want 'advanced query' style prompts.
    """
    base_prompt = f"Analyze the intention of this search and create an advanced query to be used on {search_platform}. "
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

    response = openai.ChatCompletion.create(
        model=model,
        messages=messages,
        max_tokens=250
    )
    return response["choices"][0]["message"]["content"].strip().replace("`", "")


def generate_cog_questions(user_details, desired_end_state, custom_prompt="", model="gpt-4"):
    """
    Example specialized function to prompt for 'COG questions.'
    You can expand the system message or user message to shape the results.
    
    Args:
        user_details (str): Info about the user/org context.
        desired_end_state (str): The user’s overarching goal or end state.
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
        desired_end_state (str): The user’s overarching goal or end state.
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