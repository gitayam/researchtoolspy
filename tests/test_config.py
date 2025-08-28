import pytest
import os
from dotenv import load_dotenv

def test_environment_variables():
    load_dotenv()
    # Check that critical environment variables are set
    assert "OPENAI_API_KEY" in os.environ, "OPENAI_API_KEY environment variable is not set"
    
    # Test fallback values for optional variables
    openai_model = os.environ.get("OPENAI_MODEL", "gpt-4o")
    assert openai_model in ["gpt-4o", "gpt-3.5-turbo", "gpt-4"], f"Invalid model: {openai_model}"
