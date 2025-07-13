import pandas as pd
from typing import Dict, Any, List

class BaseFramework:
    def __init__(self, session_id: int):
        self.session_id = session_id
        self.name = ""
        self.components = {}

    def get_session_data(self) -> Dict[str, Any]:
        # This will be implemented to fetch data from FrameworkSession model
        pass

    def update_session_data(self, data: Dict[str, Any]):
        # This will be implemented to update data in FrameworkSession model
        pass

    def render_ui(self):
        # This will be implemented by each framework to define its UI
        raise NotImplementedError

    def process_input(self, component: str, data: Any):
        # This will be implemented by each framework to process user input
        raise NotImplementedError

    def get_export_data(self) -> pd.DataFrame:
        # This will be implemented by each framework to return data for export
        raise NotImplementedError
