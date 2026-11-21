import io
import pytest
from PIL import Image

from app.adapters.descriptions.cactus_mirage_adapter import CactusMirageAdapter
from app.adapters.embeddings.dinov2_adapter import DINOv2Adapter
from app.adapters.embeddings.remoteclip_adapter import RemoteCLIPAdapter


def create_test_image_bytes() -> bytes:
    img = Image.new("RGB", (64, 64), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_remoteclip_adapter_availability_and_dims():
    adapter = RemoteCLIPAdapter()
    assert adapter.is_available() is True
    assert adapter.get_dimension() == 512


def test_remoteclip_adapter_text_and_image():
    adapter = RemoteCLIPAdapter()
    text_emb = adapter.embed_text("satellite imagery of runway")
    assert len(text_emb) == 512
    assert isinstance(text_emb[0], float)

    img_bytes = create_test_image_bytes()
    img_emb = adapter.embed_image(img_bytes)
    assert len(img_emb) == 512
    assert isinstance(img_emb[0], float)


def test_dinov2_adapter_availability_and_dims():
    adapter = DINOv2Adapter()
    assert adapter.is_available() is True
    assert adapter.get_dimension() == 384


def test_dinov2_adapter_image_and_text_rejection():
    adapter = DINOv2Adapter()
    img_bytes = create_test_image_bytes()
    img_emb = adapter.embed_image(img_bytes)
    assert len(img_emb) == 384
    assert isinstance(img_emb[0], float)

    with pytest.raises(NotImplementedError):
        adapter.embed_text("query text")


def test_cactus_mirage_adapter_availability():
    adapter = CactusMirageAdapter()
    assert adapter.is_available() is True
    img_bytes = create_test_image_bytes()
    desc = adapter.describe_image(img_bytes)
    assert isinstance(desc, dict)
    assert "objects" in desc
