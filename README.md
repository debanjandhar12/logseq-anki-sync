# Logseq Anki Sync

This is an port of my [Obsidian-Anki-Sync](https://github.com/debanjandhar12/Obsidian-Anki-Sync) for Logseq (with much simplier syntax).

Right now its very messy (it works but i wont recomend using it). This is something I plan to work on in January (refactor, more syntax to do stuff?) so if you have any suggestions feel free to create issue or something.

What works for now:
```md
The capital of Japan is {{cloze Tokyo}}.
```
```md
ankicloze:: " '\sin^2 x + \cos^2 y' "
$$\sin^2 x + \cos^2 y = 1$$
```

# Compiling Instructions
- Ensure yarn is installed. `npm install -g yarn`
- Install dependencies `yarn install`.
- Run the build `yarn run dev` or `yarn run build`. 
