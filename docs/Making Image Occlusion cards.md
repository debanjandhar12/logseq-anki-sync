Image Occlusion lets you create cards that hide parts of an image to test your knowledge of that **hidden** information.

# Creating Image Occlusion cards
The plugin provides an in-built Image Occlusion Editor to make these cards. It can be accessed by Right Clicking the bullet of the logseq block containing a image.

<p align="center">
      <img alt="DeckTut1.gif" width="640px" src="https://github.com/debanjandhar12/logseq-anki-sync/assets/49021233/c9df02f9-3fa9-495e-9d45-131afba83721" />
</p>

In Logseq Anki Sync, Image Occlusion is like cloze but for images. Each Occlusion has an id, and occlusions having the same id will be **hidden** together.

### Common FAQ:
<details>
<summary>Where is Occlusion Information stored in Logseq?</summary>
The occlusion information is stored in the <code>occlusion</code>block property as base64 string. Deleting this will cause the Occlusion  card to be deleted.
</details>

[<div align="right">Return to Documentation Index</div>](https://github.com/debanjandhar12/logseq-anki-sync/#-documentation)