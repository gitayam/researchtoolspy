# /researchtools_streamlit/utils_openai.py
import openai
import os

# If needed, you can store your key in an environment variable or as a separate config.
# For now, we replicate the logic from chatgptService.js:

openai.api_key = os.getenv("OPENAI_API_KEY", "sk-proj-VCiH32p9myb1832...")

def generate_advanced_query(search_query, search_platform, model="gpt-3.5-turbo"):
    base_prompt = f"Analyze the intention of this search and create an advanced query to be used on {search_platform}. "
    additional_prompt = ""
    if search_platform == "Windows CMD Search":
        additional_prompt = f"Take into account the limits and syntax of {search_platform} and use only commands that do not require installation on the terminal.\n"
        additional_prompt += "Output the exact command to run, do not output any additional explanation, do not use markdown codeblocks."
    else:
        additional_prompt = f"Start by considering what the data would look like... Only output the advanced query, no additional explanation."

    messages = [
        {"role": "user", "content": base_prompt + additional_prompt + search_query}
    ]
    response = openai.ChatCompletion.create(
        model=model,
        messages=messages,
        max_tokens=250
    )
    return response["choices"][0]["message"]["content"].strip()

