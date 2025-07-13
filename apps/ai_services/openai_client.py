import openai
from django.conf import settings

class OpenAIClient:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        openai.api_key = self.api_key

    def generate_text(self, prompt: str, max_tokens: int = 150) -> str:
        try:
            response = openai.Completion.create(
                engine="text-davinci-003",
                prompt=prompt,
                max_tokens=max_tokens
            )
            return response.choices[0].text.strip()
        except Exception as e:
            # Handle API errors
            print(f"OpenAI API error: {e}")
            return ""
