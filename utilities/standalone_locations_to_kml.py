# standalone_locations_to_kml.py

import pandas as pd
import geopandas as gpd
import shapely.geometry as geom
import geopy
import pykml
import os
import argparse

# function to detect the type of input data and update a variable with the type
def detect_file_or_string(input_data):
    if isinstance(input_data, str):
        # Check if the string is a path to a file or directory
        if os.path.isdir(input_data):
            return 'directory'
        elif os.path.isfile(input_data):
            # Check for file extension if it's a file
            if input_data.endswith('.csv'):
                detected_type = 'csv'
            elif input_data.endswith('.xlsx') or input_data.endswith('.xls'):
                detected_type = 'excel'
            elif input_data.endswith('.pdf'):
                detected_type = 'pdf'
            elif input_data.endswith('.docx') or input_data.endswith('.doc'):
                detected_type = 'word'
            elif input_data.endswith('.txt'):
                try:
                    # Attempt to read the .txt file as a CSV
                    pd.read_csv(input_data)
                    detected_type = 'csv'
                except Exception:
                    detected_type = 'text'
            else:
                # if the file extension is not recognized, return the string
                detected_type = 'string'
        else:
            # if the string is not a path to a file or directory, return the string
            detected_type = 'string'
    elif isinstance(input_data, pd.ExcelFile):
        detected_type = 'excel'
    else:
        detected_type = 'unknown'
    
    return detected_type

def read_data(input_data):
    if isinstance(input_data, str):
        if os.path.isfile(input_data):
            return pd.read_csv(input_data)
        elif os.path.isdir(input_data):
            return pd.read_csv(os.path.join(input_data, 'locations.csv'))
    else:
        return input_data

def find_locations(input_data):
    if isinstance(input_data, str):
        if os.path.isfile(input_data):
            df = pd.read_csv(input_data)
        elif os.path.isdir(input_data):
            df = pd.read_csv(os.path.join(input_data, 'locations.csv'))
    else:
        df = input_data

    # Check if 'City' and 'State' columns are present
    if 'City' not in df.columns or 'State' not in df.columns:
        city = input("Enter the city: ")
        state = input("Enter the state: ")
        df['City'] = city
        df['State'] = state

    # Combine address components if necessary
    if 'Location' in df.columns:
        df['FullAddress'] = df['Location'] + ', ' + df['City'] + ', ' + df['State']

    return df

def locations_to_kml(locations_df, output_file):
    # Convert locations to GeoDataFrame
    gdf = gpd.GeoDataFrame(
        locations_df, 
        geometry=gpd.points_from_xy(locations_df['longitude'], locations_df['latitude'])
    )
    gdf.to_file(output_file, driver='KML')

def main():
    parser = argparse.ArgumentParser(description='Convert location data to KML format.')
    parser.add_argument('input_data', nargs='?', help='The input data file or directory')
    parser.add_argument('output_file', nargs='?', help='The output KML file')
    args = parser.parse_args()

    if args.input_data and args.output_file:
        input_data = args.input_data
        output_file = args.output_file
    else:
        input_data = input("Enter the input data: ")
        output_file = input("Enter the output file: ")

    locations_df = find_locations(input_data)
    locations_to_kml(locations_df, output_file)

main()