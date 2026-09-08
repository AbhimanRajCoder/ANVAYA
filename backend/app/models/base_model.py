import abc
import numpy as np
from typing import Any


class BaseSegmentationModel(abc.ABC):
    """
    Abstract Base Class for ANAVYA segmentation models (e.g. Model 1, Model 2).
    Enforces a consistent interface so the API and inference pipelines remain decoupled
    from the specific neural network architectures.
    """

    @abc.abstractmethod
    def load_model(self, checkpoint_path: str) -> None:
        """Load the model architecture and its checkpoint weights."""
        pass

    @abc.abstractmethod
    def preprocess(self, tile: np.ndarray) -> Any:
        """
        Preprocess a single raw numpy image tile (H, W, C)
        into the format expected by the model (e.g., normalized tensor).
        """
        pass

    @abc.abstractmethod
    def predict(self, preprocessed_tile: Any) -> np.ndarray:
        """
        Run inference on the preprocessed tile.
        Returns a probability mask (H, W) or class probability logits.
        """
        pass
