---
id: image-occlusion
title: Image Occlusion Cards
description: Hide regions of images to test recall
discussion: "125"
---

Image Occlusion creates flashcards that mask parts of an image.

## Creating Cards

Right-click any Logseq block containing an image to open the Image Occlusion Editor:

<GifPlayer
  gif="/logseq-anki-sync/img/image-occlusion-editor-demo.gif"
  alt="Image occlusion editor demo"
/>

By default, only the tested region is masked. This can be changed by enabling "Hide all, test one" in settings to mask all regions:

![](/img/hide-all-test-one.png)

## Testing two masked regions together

To test multiple regions together, assign them the same cloze ID:
![](/img/img_occ_same_id.png)

## FAQ

<details>
  <summary>Where is occlusion data stored?</summary>
  <div>In the <code>occlusion</code> block property as base64 on file graphs, or backtick-wrapped JSON on DB graphs. Deleting this property removes the card.</div>
</details>

<details>
  <summary>How do I hide the occlusion property in Logseq?</summary>
  <div>Enable the "Hide Occlusion Data" addon in plugin settings. On DB graphs with host access and support for Logseq's experimental property renderer API, only the occlusion property's value is replaced with <code>&lt;hidden occlusion data with 4 cards&gt; (Edit)</code>. The native property label and icon remain visible. The count represents distinct cloze IDs across all stored images; repeated IDs count as one card, even across different images. Edit opens the occlusion editor. Other block properties remain visible. File graphs, Logseq Web without host access, and unsupported hosts retain the plain hidden-data placeholder.</div>
</details>

## Tips

- Use `extra::` to add mnemonics
