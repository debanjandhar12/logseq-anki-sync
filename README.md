# Logseq Anki Sync

This is in beta test (not recomend to use in main graph and main anki profile yet). 

### What works for now:
**Example 1**
```md
The capital of Japan is {{cloze Tokyo}}.
```
**Example 2**
```md
What is the capital of Japan? #card
direction:: <->
```
- ```md
    Tokyo
    ```
**Example 3**
```md
replacecloze:: " '\sin^2 x + \cos^2 y' "
$$\sin^2 x + \cos^2 y = 1$$
```
## Features

- 🐾 Supports Logseq's original srs clozes and card syntax (+ more).
- 🖼 Rendering of markdown **Math, Code, Images etc...**, aswell as some logseq elements.
- 📘 **Adding cards to user-specified deck** on a *per-file* or *per-block* basis.
- ♻ Syncing is done by **creating, updating, deleting** from logseq to anki (one-way sync).
- 🥳 Many other features like **extra field, tags** etc...

## Installation

1. Download the logseq-anki-sync-0.0.51.zip from Releases and put it in a new folder inside your loseq plugin folder. In windows loseq plugin folder is usually at  `C:\Users\deban\.logseq\plugins`. 
   This will be available in logseq store in January.

2. Download Anki if not installed.

3. Install AnkiConnect on Anki.

   - Open Anki.

   - Select `Tools` > `Add-ons `. Now a Anki addon's dialog will open. 

   - Now click `Get Add-ons...` in addon's dialog and enter [2055492159](https://ankiweb.net/shared/info/2055492159) into the text box labeled `Code` and press the `OK` button to proceed.

   - Restart Anki.

4. Now, you can use the plugin by clicking Sync to Anki button. <br />
   NB: Always make sure the anki is running before clicking the Sync to Anki button.

5. If you receive the message bellow, click `Yes`. <br />
   <p align="center">
      <img src="https://raw.githubusercontent.com/debanjandhar12/Obsidian-Anki-Sync/main/docs/images/permission.png" />
   </p>

# Compiling Instructions
- Ensure yarn is installed. `npm install -g yarn`
- Install dependencies `yarn install`.
- Run the build `yarn run dev` or `yarn run build`. 

# FAQ

<details>
 <summary>How to restore anki deck in case of accidental deletation?</summary>
 Anki automatically stores the last 50 backup (by default) in the folder <code>C:\Users\{WindowsUserName}\AppData\Roaming\Anki2\{AnkiProfileName}\backups</code>. You can restore your deck from there.
</details>
