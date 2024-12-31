# /researchtools_streamlit/utils_conversion.py

import json

def convert_input(input_data, format_type, json_option, json_attribute, remove_quotes, remove_hashtags, remove_top_row, process_limit):
    """
    Replicates your conversionUtils.js logic in Python.
    Takes input (csv lines), cleans, dedups, returns string or JSON.
    """
    # Split lines
    lines = input_data.strip().split("\n")
    # Just use the first column
    values = [line.split(",")[0].strip() for line in lines if line.strip() != ""]

    # Remove top row if requested
    if remove_top_row and len(values) > 1:
        values = values[1:]

    # Remove duplicates
    unique_values = list(dict.fromkeys(values))

    # Optional data cleaning
    if remove_quotes:
        unique_values = [v.replace('"', "") for v in unique_values]
    if remove_hashtags:
        unique_values = [v.replace("#", "") for v in unique_values]

    # Process limit
    if process_limit > 0 and process_limit < len(unique_values):
        unique_values = unique_values[:process_limit]

    # Format output
    if format_type == "Comma Separated":
        return ", ".join(unique_values)
    elif format_type == "JSON":
        json_array = []
        if json_option == "Custom" and json_attribute:
            # Generate JSON using custom attribute
            for val in unique_values:
                json_array.append({"match_phrase": {json_attribute: val}})
        elif json_option == "Location":
            # location-based
            for loc in unique_values:
                json_array.append({"wildcard": {"author_place": f"{loc}*"}})
                json_array.append({"wildcard": {"meta.geo_place.results.value": f"{loc}*"}})
                json_array.append({"wildcard": {"meta.author_geo_place.results.value": f"{loc}*"}})
        else:
            # default
            for val in unique_values:
                json_array.append({"match_phrase": {"doc.user.description": val}})
                json_array.append({"match_phrase": {"meta.title.results": val}})

        result_dict = {
            "bool": {
                "minimum_should_match": 1,
                "should": json_array
            }
        }
        return json.dumps(result_dict, indent=2)
    else:
        return ""  # or handle other formats