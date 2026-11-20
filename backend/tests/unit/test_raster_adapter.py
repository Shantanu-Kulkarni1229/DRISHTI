import hashlib
from app.adapters.raster.rasterio_adapter import RasterioAdapter


def test_sha256_checksum_calculation(synthetic_raster):
    adapter = RasterioAdapter()
    calc_hash = adapter.compute_sha256(synthetic_raster)

    # Compute expected hash directly
    with open(synthetic_raster, "rb") as f:
        expected = hashlib.sha256(f.read()).hexdigest()

    assert calc_hash == expected
    assert len(calc_hash) == 64


def test_raster_metadata_extraction(synthetic_raster):
    adapter = RasterioAdapter()
    meta = adapter.read_metadata(synthetic_raster)

    assert meta.checksum == adapter.compute_sha256(synthetic_raster)
    assert meta.size_mb >= 0.0
    assert meta.crs is not None
    assert len(meta.bbox) == 4


def test_windowed_tiling_generator(synthetic_raster):
    adapter = RasterioAdapter()
    chips = list(adapter.extract_tiles(synthetic_raster, tile_size=256, stride=128))

    assert len(chips) > 0
    chip = chips[0]
    assert chip.grid_index is not None
    assert "col_off" in chip.pixel_window
    assert len(chip.bbox) == 4
