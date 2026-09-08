from typing import Dict, Type
from app.models.base_model import BaseSegmentationModel
from app.models.model1_building import BuildingSegmentationModel
from app.core.logging import logger


class ModelRegistry:
    """
    Registry for managing machine learning models.
    Supports registration and lazy initialization of models.
    """

    def __init__(self):
        self._registered_classes: Dict[str, Type[BaseSegmentationModel]] = {
            "model1_building": BuildingSegmentationModel
        }
        self._loaded_instances: Dict[str, BaseSegmentationModel] = {}

    def get_model(self, model_id: str) -> BaseSegmentationModel:
        """Get or load the model instance by its identifier."""
        if model_id not in self._loaded_instances:
            if model_id not in self._registered_classes:
                raise ValueError(f"Model '{model_id}' is not registered in the ANAVYA model registry.")
            
            logger.info(f"Registry: Instantiating model '{model_id}'...")
            model_class = self._registered_classes[model_id]
            self._loaded_instances[model_id] = model_class()

        return self._loaded_instances[model_id]

    def register_model(self, model_id: str, model_class: Type[BaseSegmentationModel]) -> None:
        """Register a new model class dynamically (for future Model 2 parcel boundary mapping)."""
        if model_id in self._registered_classes:
            logger.warning(f"Registry: Overwriting registration of model '{model_id}'.")
        self._registered_classes[model_id] = model_class
        logger.info(f"Registry: Registered model class '{model_id}' successfully.")


# Global registry instance
model_registry = ModelRegistry()
