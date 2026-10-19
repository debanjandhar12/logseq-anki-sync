import base64
import io
import sys
import micropip

await micropip.install("Pillow==12.2.0")
from PIL import Image
import logseq_lib

asset_path = sys.argv[1] if len(sys.argv) > 1 else "assets/example.png"
asset = await logseq_lib.read_asset({"assetPath": asset_path})
if not asset["exists"]:
    raise FileNotFoundError(asset_path)

with Image.open(io.BytesIO(base64.b64decode(asset["contentBase64"]))) as image:
    if image.format != "PNG":
        raise ValueError("Choose an existing PNG asset to overwrite with PNG data")
    original_size = image.size
    with image.convert("L") as grayscale:
        if "A" in image.getbands() or "transparency" in image.info:
            with image.convert("RGBA") as rgba:
                grayscale.putalpha(rgba.getchannel("A"))
        expected_mode = grayscale.mode
        output = io.BytesIO()
        grayscale.save(output, format="PNG")

print("Saved:", await logseq_lib.save_asset({
    "assetPath": asset_path,
    "contentBase64": base64.b64encode(output.getvalue()).decode(),
}))
saved_asset = await logseq_lib.read_asset({"assetPath": asset_path})
if not saved_asset["exists"]:
    raise FileNotFoundError(asset_path)
with Image.open(io.BytesIO(base64.b64decode(saved_asset["contentBase64"]))) as verified:
    verified.load()
    if verified.size != original_size or verified.mode != expected_mode:
        raise ValueError("Saved image dimensions or grayscale mode do not match")
    print("Verified existing image:", asset_path, verified.size, verified.mode)
