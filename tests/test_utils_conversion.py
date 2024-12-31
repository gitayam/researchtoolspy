# /researchtools_streamlit/tests/test_utils_conversion.py
import pytest
from utils_conversion import convert_input

def test_convert_input_comma_separated():
    input_data = "value1\nvalue2\nvalue2\nvalue3"
    result = convert_input(
        input_data=input_data,
        format_type="Comma Separated",
        json_option="Custom",
        json_attribute="",
        remove_quotes=True,
        remove_hashtags=False,
        remove_top_row=False,
        process_limit=0
    )
    # Should remove duplicates => "value1, value2, value3"
    assert result == "value1, value2, value3"

def test_convert_input_json_custom():
    input_data = '"hello"\n"world"'
    result = convert_input(
        input_data=input_data,
        format_type="JSON",
        json_option="Custom",
        json_attribute="custom_field",
        remove_quotes=True,
        remove_hashtags=False,
        remove_top_row=False,
        process_limit=0
    )
    # Expect JSON structure with "match_phrase": {"custom_field": "hello"}, etc.
    assert '"custom_field": "hello"' in result
    assert '"custom_field": "world"' in result

def test_convert_input_location():
    input_data = "USA\nCanada\n#UK"
    result = convert_input(
        input_data=input_data,
        format_type="JSON",
        json_option="Location",
        json_attribute="",
        remove_quotes=False,
        remove_hashtags=False,
        remove_top_row=False,
        process_limit=0
    )
    # Should produce wildcard fields for each location
    # "#UK" is included as-is if remove_hashtags=False
    assert '"author_place": "USA*"' in result
    assert '"author_place": "Canada*"' in result
    assert '"author_place": "#UK*"' in result