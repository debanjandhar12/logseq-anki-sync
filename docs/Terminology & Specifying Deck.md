# Prerequisite: Terminology and Working
There are three important terms related to this plugin: **Logseq Blocks (or simply Blocks)**, **Anki Notes**, **Anki Cards**.
- **Logseq Blocks** are the blocks in Logseq that you want to convert to Anki Notes. Each Logseq Block can generate multiple Anki Notes.
  (For example, a single Logseq Block can generate a note for multiline card and a separate note for cloze card.)
- **Anki Notes** are the format which is understood by Anki. Each Anki Note can generate multiple Anki Cards.
- **Anki Cards** are the cards that you see in Anki during practice.

The plugin generates these Anki Notes from Logseq Blocks, and then syncs them to Anki. In case you have deleted the Logseq Block which generates the anki note, the plugin will delete the corresponding Anki Notes in the next sync.

# Setting and Changing Deck
In Logseq Anki Sync, you can specify the deck of the notes generated from a block or page in several ways:
- `deck` Block property in the block which generates the note.
- `deck` Block property in one of the parent block of the block which generates the note.
- `deck` Page property in the page containing the block which generates the note.
  When none of the above is specified, the note will be stored in a deck named after the namespace of the page containing the block which generates the note. Incase the page is in the root namespace, the note will be stored in the default deck defined in the Logseq Anki Sync settings.

For instance, if the page name is `Getting Started` and has no `deck` property, the note will be stored in the deck named `Default`. However, if the same page has the name `Tutorial/Getting Started`, the note will be stored in the deck named `Tutorial`.

**What happens when multiple decks are specified?**  
When multiple decks are specified, the note will be stored in the deck which is more specific to the note generating block.

For instance, deck property directly specified in the block will be more specific than the deck property specified in the parent block. And the deck property specified in the parent block will be more specific than the deck property specified in the page.

**For Example,**
```md
deck:: [[Tutorial]]
```
```md
deck:: Tutorial 2
The capital of Japan is {{cloze Tokyo}}.
```
<p align="center">
      <img alt="DeckTut1.gif" width="640px" src="https://user-images.githubusercontent.com/49021233/145707349-632ff6ae-4f11-43d6-a04b-3e1e35bfd18c.gif" />
</p>
In the above example, the the cloze note will be stored in the deck named `Tutorial 2` as it is more specific than the deck specified in the parent block.


# Additional Points
- You can use page references as values for the deck property as well. It is a good idea to do so as in case if you ever need to change the name of a deck, you can simply just rename that page.


[<div align="right">Return to Documentation Index</div>](https://github.com/debanjandhar12/logseq-anki-sync/#-documentation)