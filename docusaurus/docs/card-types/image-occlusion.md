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
  <div>In the <code>occlusion</code> block property as base64. Deleting this property removes the card.</div>
  <summary>How do I hide the occlusion property in Logseq?</summary>
  <div>Enable the "Hide Occlusion Data" addon in plugin settings.</div>
</details>

<details>
  <summary>How do I hide the occlusion property in Logseq?</summary>
  <div>Enable the "Hide Occlusion Data" addon in plugin settings.</div>
</details>

## Tips

- Use `extra::` to add mnemonics