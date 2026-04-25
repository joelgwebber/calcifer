---
name: library
description: Personal book library in Seafile — add books from Anna's Archive, organize metadata, send to/remove from reMarkable, and link books to wiki notes.
allowed-tools: Bash, Read, Write, Edit, WebFetch, mcp__seafile__*, mcp__remarkable__*, mcp__annas__*
env-guard: SEAFILE_TOKEN
---

# Personal Book Library

Books live in the Seafile library named **"books"**. Get its ID first:

```
mcp__seafile__seafile_list_libraries()
# → find the entry named "books", note its id
```

## Folder structure

One folder per book, named `Author - Title/` (author last name first if known):

```
Le Guin, Ursula K. - The Left Hand of Darkness/
  book.epub
  metadata.yaml

Weir, Andy - Project Hail Mary/
  book.epub
  metadata.yaml
```

Multiple formats can coexist (`book.epub`, `book.pdf`). Keep the same base name `book.*`.

## metadata.yaml format

```yaml
title: The Left Hand of Darkness
author: Le Guin, Ursula K.
year: 1969
format:
  - epub
added: 2026-04-21
source: annas_archive   # or: purchase, gift, etc.
hardcover_id: 12345     # optional — from hardcover_search_books
tags:
  - fiction
  - sci-fi
wiki_note: joel-wiki/books/Le Guin, Ursula K. - The Left Hand of Darkness.md  # optional
```

---

## Workflows

### Add a book from Anna's Archive

**Step 1: Search**

Prefer EPUB over PDF when available:

```
mcp__annas__annas_search_books(query="Title Author", format="epub")
```

Present results to the user (title, author, format, size, year, MD5). Wait for the user to pick one.

**Step 2: Download**

```
mcp__annas__annas_download_book(md5="<md5-from-search>", filename="book.epub")
```

The file is saved to `/tmp/book.epub` (or the filename you specify).

**Step 4: Upload to Seafile**

The Seafile MCP `seafile_upload_file` only handles text. Use curl directly for binary files:

```bash
# Replace BOOKS_LIB_ID and adjust path as needed
UPLOAD_LINK=$(curl -s \
  -H "Authorization: Token $SEAFILE_TOKEN" \
  "https://files.j15r.com/api2/repos/BOOKS_LIB_ID/upload-link/?p=%2FAuthor%20-%20Title" \
  | tr -d '"')

curl -s \
  -H "Authorization: Token $SEAFILE_TOKEN" \
  -F "file=@/tmp/book.epub;filename=book.epub" \
  -F "parent_dir=/Author - Title" \
  "$UPLOAD_LINK"
```

**Step 5: Write metadata.yaml**

```
mcp__seafile__seafile_upload_file(
  library_id="BOOKS_LIB_ID",
  path="/Author - Title/metadata.yaml",
  content="title: ...\nauthor: ...\n..."
)
```

---

### Send a book to reMarkable

Look up the book folder, get a local copy, then upload:

```bash
# Download from Seafile to container temp dir
curl -s \
  -H "Authorization: Token $SEAFILE_TOKEN" \
  "https://files.j15r.com/api2/repos/BOOKS_LIB_ID/file/?p=%2FAuthor%20-%20Title%2Fbook.epub" \
  -o /tmp/book.epub
```

Then upload:

```
mcp__remarkable__remarkable_upload_pdf(
  file_path="/tmp/book.epub",
  name="Title"
)
```

Supported formats: **EPUB** and **PDF**. The book appears on the device after the next cloud sync (usually seconds).

---

### Remove a book from reMarkable

```
mcp__remarkable__remarkable_list()
# → find the document ID

mcp__remarkable__remarkable_delete(document_id="...")
```

The book file stays in Seafile — this only removes it from the reMarkable.

---

### Create a wiki note for a book

When adding a book the user may want to keep reading notes, create a stub:

```markdown
---
title: The Left Hand of Darkness
author: Le Guin, Ursula K.
year: 1969
hardcover_id: 12345
seafile_library: books
seafile_path: /Le Guin, Ursula K. - The Left Hand of Darkness/book.epub
tags:
  - fiction
  - sci-fi
---

# The Left Hand of Darkness — Le Guin

## Notes

<!-- reading notes here -->
```

Save to `joel-wiki/books/Author - Title.md` (or `alicia-wiki/books/` for Alicia). Then update `wiki_note` in the book's `metadata.yaml`.

---

### Cross-reference with Hardcover

To link a library book with a Hardcover entry:

```
mcp__hardcover__hardcover_search_books(query="Left Hand of Darkness")
# → get book_id

# Update metadata.yaml with hardcover_id
mcp__seafile__seafile_upload_file(
  library_id="BOOKS_LIB_ID",
  path="/Le Guin, Ursula K. - The Left Hand of Darkness/metadata.yaml",
  content="...",
  replace=true
)
```

---

### Browse the library

```
mcp__seafile__seafile_list_dir(library_id="BOOKS_LIB_ID", path="/")
```

To read a book's metadata:

```
mcp__seafile__seafile_read_file(
  library_id="BOOKS_LIB_ID",
  path="/Author - Title/metadata.yaml"
)
```

To get a shareable link (e.g. to paste into a wiki page or send somewhere):

```
mcp__seafile__seafile_create_share_link(
  library_id="BOOKS_LIB_ID",
  path="/Author - Title/book.epub"
)
```
