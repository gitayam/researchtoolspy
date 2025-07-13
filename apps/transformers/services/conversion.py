import csv
import json

class ConversionService:
    def csv_to_json(self, csv_content: str) -> str:
        try:
            reader = csv.DictReader(csv_content.splitlines())
            return json.dumps(list(reader))
        except Exception as e:
            raise ValueError(f"Error converting CSV to JSON: {e}")
