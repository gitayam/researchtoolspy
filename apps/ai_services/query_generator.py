from .openai_client import OpenAIClient

class QueryGenerator:
    def __init__(self):
        self.client = OpenAIClient()

    def generate_query(self, topic: str, framework: str) -> str:
        prompt = f"Generate a set of questions for a {framework} analysis on the topic of '{topic}'."
        return self.client.generate_text(prompt)

    def get_suggestions(self, context: str) -> str:
        prompt = f"Based on the following context, provide suggestions for the next step in the analysis:\n\n{context}"
        return self.client.generate_text(prompt)
