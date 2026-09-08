import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision.models.segmentation import deeplabv3_resnet50
from app.models.base_model import BaseSegmentationModel
from app.core.logging import logger


class SegmentationModel(nn.Module):
    """
    Standard torchvision DeepLabV3 ResNet50 wrapper to match checkpoint state_dict keys.
    The checkpoint has the weights inside an attribute 'model'.
    """
    def __init__(self, num_classes: int = 2):
        super().__init__()
        # Initialize standard deeplabv3_resnet50
        self.model = deeplabv3_resnet50(weights=None)
        # Replace final classifier layer
        self.model.classifier[4] = nn.Conv2d(256, num_classes, kernel_size=1)
        # Disable auxiliary classifier as it's not present in the checkpoint
        self.model.aux_classifier = None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)["out"]


class BuildingSegmentationModel(BaseSegmentationModel):
    def __init__(self):
        self.device = torch.device("cpu")
        self.model = None

    def load_model(self, checkpoint_path: str) -> None:
        # Determine the best device available
        if torch.cuda.is_available():
            self.device = torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            try:
                # Test MPS liveness
                torch.ones(1).to("mps")
                self.device = torch.device("mps")
            except Exception:
                self.device = torch.device("cpu")
        else:
            self.device = torch.device("cpu")

        logger.info(f"Model 1 loader: Using device: {self.device}")
        logger.info(f"Loading Model 1 checkpoint from: {checkpoint_path}")

        try:
            # Instantiate model architecture
            self.model = SegmentationModel(num_classes=2)

            # Load checkpoint state dict
            checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
            
            if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            else:
                state_dict = checkpoint

            self.model.load_state_dict(state_dict)
            self.model.to(self.device)
            self.model.eval()
            logger.info("Model 1 loaded and set to evaluation mode successfully.")
            
        except Exception as e:
            logger.error(f"Failed to load Model 1 checkpoint from {checkpoint_path}: {e}")
            raise RuntimeError(f"Could not load building footprint detection checkpoint: {e}")

    def preprocess(self, tile: np.ndarray) -> torch.Tensor:
        """
        Preprocess single raw tile of shape (H, W, C) or (H, W).
        Standard ImageNet normalization and size of 512x512.
        """
        # Ensure 3-channel RGB image
        if len(tile.shape) == 2:
            tile = np.stack([tile, tile, tile], axis=-1)
        elif len(tile.shape) == 3 and tile.shape[2] == 4:
            tile = tile[:, :, :3]
        elif len(tile.shape) == 3 and tile.shape[2] == 1:
            tile = np.concatenate([tile, tile, tile], axis=-1)

        # Resize to training dimensions
        if tile.shape[0] != 512 or tile.shape[1] != 512:
            tile = cv2.resize(tile, (512, 512), interpolation=cv2.INTER_LINEAR)

        # Convert uint8 to float32 [0.0, 1.0]
        tile = tile.astype(np.float32) / 255.0

        # Standard ImageNet Mean and Std deviation
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        tile = (tile - mean) / std

        # Transpose HWC -> CHW
        tile = np.transpose(tile, (2, 0, 1))

        # Add batch dimension and upload to device
        tensor = torch.from_numpy(tile).unsqueeze(0).to(self.device)
        return tensor

    def predict(self, preprocessed_batch: torch.Tensor) -> np.ndarray:
        """
        Run forward pass on the preprocessed batch.
        Returns probability mask of shape (N, 512, 512) for building class (class 1).
        """
        if self.model is None:
            raise RuntimeError("Model is not loaded. Call load_model() first.")

        with torch.no_grad():
            # Get logits
            logits = self.model(preprocessed_batch)  # shape: (N, 2, 512, 512)
            # Apply softmax to retrieve probabilities
            probs = torch.softmax(logits, dim=1)  # shape: (N, 2, 512, 512)
            # Building is class 1 (index 1)
            building_probs = probs[:, 1].cpu().numpy()  # shape: (N, 512, 512)

        return building_probs
