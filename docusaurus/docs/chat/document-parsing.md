---
sidebar_position: 9
title: Document Parsing
---

The `parse_document` tool converts PDF and EPUB assets in the current Logseq graph to Markdown. Its argument is `documentPath`, for example:

```json
{"documentPath": "../assets/book.epub"}
```

For an attached PDF, the assistant can use the attachment's **PDF Path**. EPUB support is path-based only: EPUB attachment creation, icons, and previews are not included.

## Pages and sections

- **PDF:** each physical page becomes a separate Markdown file.
- **EPUB:** each unique content document in spine reading order becomes a logical page, usually a chapter or section. These numbers are not printed or reader-dependent page numbers. Nonlinear spine entries are included; repeated entries are converted once.

Each EPUB unit remains a valid EPUB package with its original resource paths, allowing AnyDoc to resolve styles and images. Cross-chapter links may remain relative rather than pointing to the generated Markdown files. Embedded assets are not exported separately. Password-protected/encrypted documents are not supported, and image-only PDF pages may not yield text.

## Cached output and resuming

Markdown is stored in `/home/user/anydoc-parse-results` using the original file's SHA-256 hash:

```text
<file-sha256>-page-1.md
<file-sha256>-page-2.md
```

The assistant uses Bash to list, search, and read these read-only files. Completed units are saved immediately, so another call resumes missing units after cancellation or a storage error. Changing the source file produces a new hash and cache identity.

Conversion failures are also cached as Markdown with an error explanation. They are reused rather than automatically retried. Parsing continues through individual conversion failures, but the tool reports an error when more than 50% of units fail, including previously cached failures. WASM initialization, archive validation, and storage failures stop the operation rather than becoming cached conversion failures.

Cancellation is checked during splitting and between conversions; an individual synchronous WASM conversion cannot be interrupted mid-call.

## EPUB archive limits

Before conversion, ZIP expansion is limited to 10,000 entries (including directories), 16 MiB per expanded entry, and 128 MiB total expanded content. Declared sizes are checked before extraction; actual decompressed bytes are also bounded while extracting. Unsafe or duplicate decoded paths, malformed XML, DTD/entity declarations, encrypted ZIP entries, compression other than store/deflate, and missing or unsupported spine documents are rejected. External resources and additional archive volumes are not fetched by the splitter.

ZIP reading and writing use zip.js with strict validation, CRC verification, and overlap checking. ZIP64 input is allowed within the same resource limits; generated chapter packages use ordinary ZIP. Filename decoding follows the library's supported encodings and Unicode path metadata, with path validation applied afterwards. ZIP validation no longer requires exact contiguous coverage of all source bytes by listed entries or rejects otherwise-valid entries solely for zeroed local CRC/size fields. Only listed, verified resources are copied into generated packages; unlisted source bytes are not preserved.

Archive extraction and asynchronous chapter repackaging support cancellation and periodically yield to the event loop. ZIP processing runs locally without additional workers or WASM assets. Resource limits bound retained content, not every temporary allocation made inside a decompressor.

## Tool rename

`parse_document({documentPath})` replaces `parse_pdf({pdfPath})`; no legacy alias is registered. Existing PDF cache filenames and cached failure markers remain supported, and completed historical tool results are unchanged. Old pending `parse_pdf` calls can no longer execute and should be replaced with a new `parse_document` call.
