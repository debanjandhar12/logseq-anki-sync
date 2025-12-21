AnkiConnect: https://git.sr.ht/~foosoft/anki-connect https://ankiweb.net/shared/download/2055492159?v=2.1 (v is anki version)
Anki: https://github.com/ankitects/anki
Logseq: https://github.com/logseq/logseq


Please update TESTING.md instructions with following:
- I changed the structure of test files a little bit. Please read that and update docs.
- Download anki connect from https://ankiweb.net/shared/download/2055492159?v=2.1 (this will give AnkiConnect.ankiaddon file)
- Download anki from https://github.com/ankitects/anki/releases/download/25.09/anki-launcher-25.09-linux.tar.zst
- Download logseq from https://github.com/debanjandhar12/logseq/releases/download/test1/Logseq-linux-x64-0.11.0.AppImage
- The downloaded file name can be different for logseq and anki. Please ensure to handle accordingly. For example, one time it may be Logseq-v1.AppImage and another time Logseq.AppImage. Download links should be easily customizable in script. Basically, it should be a 1 line change in script and everthing else should work.
- Should be triggerable similar to publish.yml
- We also need a flag called logseqAvailable and all tests requiring actual logic instance will check that. (before isDB check)