import importlib
import pkgutil
from typing import Dict, Type
from apps.core.base_framework import BaseFramework

class FrameworkRegistry:
    def __init__(self):
        self.frameworks: Dict[str, Type[BaseFramework]] = {}

    def discover_frameworks(self):
        """
        Dynamically discovers and registers frameworks from the 'implementations' directory.
        """
        implementations_path = "apps.frameworks.implementations"
        module = importlib.import_module(implementations_path)

        for _, name, _ in pkgutil.iter_modules(module.__path__):
            try:
                framework_module = importlib.import_module(f".{name}", implementations_path)
                for item_name in dir(framework_module):
                    item = getattr(framework_module, item_name)
                    if isinstance(item, type) and issubclass(item, BaseFramework) and item is not BaseFramework:
                        # The key will be the framework's name attribute, converted to lowercase
                        self.frameworks[item.name.lower()] = item
            except Exception as e:
                print(f"Error loading framework {name}: {e}")

    def get_framework(self, name: str) -> Type[BaseFramework]:
        """
        Retrieves a framework class from the registry.
        """
        framework = self.frameworks.get(name.lower())
        if not framework:
            raise ValueError(f"Framework '{name}' not found.")
        return framework

# Global instance of the registry
framework_registry = FrameworkRegistry()
framework_registry.discover_frameworks()
