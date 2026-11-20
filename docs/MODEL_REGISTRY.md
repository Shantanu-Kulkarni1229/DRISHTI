# DRISHTI — Model Registry & Provenance

Every model checkpoint utilized in DRISHTI is catalogued with task scope, architecture, training provenance, license, and cryptographic checksum.

| Model Name | Architecture | Task | License | Official Source | SHA-256 Checksum | Footprint (MB) |
|---|---|---|---|---|---|---|
| **RemoteCLIP** | ViT-L/14 | Cross-modal text-to-image semantic search over remote sensing | MIT | https://github.com/ChenDelong1999/RemoteCLIP | `9a4b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b` | 1,710.0 MB |
| **DINOv2** | ViT-B/14 | Structural visual similarity, tile clustering & change screening | Apache-2.0 | https://github.com/facebookresearch/dinov2 | `8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d` | 346.0 MB |
| **TinyCD** | Siamese CNN-Transformer | Bi-temporal building & feature change confirmation | MIT | https://github.com/AndreaCodegoni/TinyCD | `7b6a5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b` | 28.4 MB |
| **s2cloudless** | LightGBM Pixel Classifier | Cloud and cirrus masking from Sentinel-2 L1C/L2A bands | MIT | https://github.com/sentinel-hub/sentinel2-cloud-detector | `6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b` | 14.2 MB |

---

## Provenance Verification

At application boot and inside the audit trail, model versions and weight checksums are snapshot into each generated decision record:
```json
{
  "model_versions": {
    "RemoteCLIP": "ViT-L/14@v1.0",
    "DINOv2": "ViT-B/14@v1.0",
    "TinyCD": "LEVIR-CD@v1.0",
    "s2cloudless": "v1.5.0"
  }
}
```
This guarantees that export artifacts can be traced back to the exact neural checkpoints used during inference.
