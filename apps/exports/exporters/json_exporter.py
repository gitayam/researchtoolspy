import json

class JsonExporter:
    def export(self, data):
        return json.dumps(data, indent=4)
