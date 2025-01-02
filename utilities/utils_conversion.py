# /researchtools_streamlit/utils_conversion.py

import json

def convert_input(
    input_data, 
    format_type="Advanced Query", 
    json_option=None, 
    json_attribute=None, 
    remove_quotes=False, 
    remove_hashtags=False, 
    remove_top_row=False, 
    process_limit=0
):
    """
    Python conversion logic, extended to support 'List to JSON' and 'JSON to List'
    as well as existing 'Comma Separated' and 'JSON'.
    """

    # Split input into lines and extract the first value from each line assuming CSV structure
    lines = input_data.strip().split("\n")
    values = [line.split(",")[0].strip() for line in lines if line.strip() != ""]

    # Remove duplicates
    unique_values = list(dict.fromkeys(values))

    # Optional data cleaning
    if remove_quotes:
        unique_values = [v.replace('"', "") for v in unique_values]
    if remove_hashtags:
        unique_values = [v.replace("#", "") for v in unique_values]
    if remove_top_row and len(unique_values) > 1:
        unique_values = unique_values[1:]
    if process_limit > 0:
        unique_values = unique_values[:process_limit]

    # Format output based on selected format
    if format_type == "List to JSON":
        json_array = []
        if json_option == "Custom" and json_attribute:
            # Generate JSON using the custom JSON attribute provided by the user
            json_array = [{"match_phrase": {json_attribute: value}} for value in unique_values]
        elif json_option == "Location":
            # Generate JSON for location-based queries
            json_array = [{"wildcard": {"author_place": f"{location}*"}} for location in unique_values]
            json_array += [{"wildcard": {"meta.geo_place.results.value": f"{location}*"}} for location in unique_values]
            json_array += [{"wildcard": {"meta.author_geo_place.results.value": f"{location}*"}} for location in unique_values]
        else:
            # Default JSON output for other options
            json_array = [{"match_phrase": {"doc.user.description": value}} for value in unique_values]
            json_array += [{"match_phrase": {"meta.title.results": value}} for value in unique_values]

        result_dict = {
            "bool": {
                "minimum_should_match": 1,
                "should": json_array
            }
        }
        return json.dumps(result_dict, indent=2)

    elif format_type == "JSON to List":
        try:
            data = json.loads(input_data)
            if isinstance(data, dict) and "bool" in data and "should" in data["bool"]:
                # Extract state names from JSON
                states = []
                for item in data["bool"]["should"]:
                    for key, value in item.get("match_phrase", {}).items():
                        states.append(value)
                return ", ".join(states)
            else:
                return "Error: Invalid JSON structure."
        except json.JSONDecodeError:
            return "Error: Invalid JSON input."

    else:
        # Default to "Advanced Query" if no other format_type matches
        return "Advanced Query output"  # Replace with actual logic for "Advanced Query"