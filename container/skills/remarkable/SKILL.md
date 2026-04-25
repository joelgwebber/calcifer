---
name: remarkable
description: reMarkable tablet integration — upload PDFs to the device, list notebooks, and download/convert handwritten notes.
allowed-tools: Bash, Read, Write, Edit, mcp__remarkable__*
env-guard: REMARKABLE_DEVICE_TOKEN
---

# reMarkable Tablet

Send PDFs to the reMarkable and pull handwritten notes back as text.

## Setup (one-time)

1. Go to [my.remarkable.com/device/browser/connect](https://my.remarkable.com/device/browser/connect) and generate an 8-character code.
2. On the host machine, run:
   ```bash
   ./scripts/setup-remarkable.sh <8-char-code>
   ```
3. Add the returned token to `.env`:
   ```
   REMARKABLE_DEVICE_TOKEN=<token>
   ```
4. Restart the service to apply.

---

## Listing notebooks

```
remarkable_list
```

Optional `folder_id` to filter to a specific folder. Returns IDs, names, and modification dates.

## Uploading a PDF or EPUB

Save a file to the container filesystem first (e.g. download with WebFetch, or copy from the library), then upload:

```
remarkable_upload_pdf(
  file_path="/tmp/book.epub",
  name="Book Title",           # optional
)
```

Supported formats: **PDF** and **EPUB** (detected from extension). MOBI is not supported by reMarkable — convert to EPUB first if needed.

The file appears on the reMarkable after the next cloud sync (usually seconds).

## Downloading and converting a notebook

### Download

```
remarkable_download(
  document_id="<id-from-remarkable_list>",
  output_path="/tmp/notebook.zip"
)
```

The ZIP contains `.rm` files (reMarkable's binary format) plus metadata.

### Convert to text/PDF

Extract and convert using `rmc` (installed in the container):

```bash
unzip /tmp/notebook.zip -d /tmp/notebook/
cd /tmp/notebook/
for f in *.rm; do
  rmc "$f" -o "/tmp/notebook/$(basename "$f" .rm).pdf"
done
```

Or convert to markdown (for notes/text):

```bash
cd /tmp/notebook/
for f in *.rm; do
  python3 -c "
import rmscene
with open('$f', 'rb') as fh:
    scene = rmscene.read_blocks(fh)
print(rmscene.SceneLineItemBlock)  # inspect structure
"
done
```

`rmc` output is a PDF per page. For OCR, use the Read tool on the PDF — Claude can read PDF page images natively.
