from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Union


class BaseDescriptionAdapter(ABC):
    """Abstract interface for image description and vision-language services."""

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if the description engine or weights are ready."""
        pass

    @abstractmethod
    def describe_image(self, image_input: Union[str, Path, bytes]) -> Dict[str, Any]:
        """Generates structured description for an image."""
        pass
