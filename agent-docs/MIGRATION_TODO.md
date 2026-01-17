- [ ] Improve testing for anki ops, parsers in sync, caching
- [x] Improve asset handling - 0.2
- [ ] Rewrite Feature explorer - 1
- [x] Find points and fix renderer - 1
- [ ] Fix queries based on properties
- [x] Complete writing docs

Notes:
- Need to remove hide Occlusion Data in db version or maybe upgrade?

Known issues:
- Focus trap in uis dont work...

Good Links:
- https://discuss.logseq.com/t/logseq-db-unofficial-faq/32508/11?u=danzu
- https://discuss.logseq.com/t/logseq-db-changelog/30013/31?u=danzu
- https://github.com/logseq/docs/blob/master/db-version-changes.md

Breaking changes:
- .replaceclose property is no longer supported. Use replacecloze instead.
- Removed LogseqAnkiFeatureExplorer temporarily.
- Removed #no-anki-sync (was marked for removal in v6.3.1), please use disable-anki-sync prop instead.

/home/debanjand/logseq/graphs/ <- use for db graphs setup?

Write a document for new testing method in agent-docs. ONLY WRITE DOCUMENT AND IMPROVE AND JUDGE FEASIBILITY, DO NOT WRITE CODE.

Decided approach:
- tests/graphs -> will contain two logseq graphs: TestDB and TestMD
- First pull logseq appimage from https://github.com/logseq/logseq/releases/download/0.10.15/Logseq-linux-x64-0.10.15.AppImage
- We will create file at very start in ~/.config/Logseq/configs.edn with following content:
  {:server/autostart true
  :server/host "127.0.0.1"
  :server/port 12315
  :server/tokens [{:value "<process env logseq api token>"}]}
  [Note: I actually don't know how to set process env logseq api token in github workflow]
- We will use xvfb-run to run logseq. xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" ./Logseq --no-sandbox seemed to have worked and starts http server which is required in tests/setup.ts. [Note: Do we need --no-sandbox for ubuntu?  Currently i am on kde and hence this is required.].
- We need to wait for "Server listening" (inside some string) from above process.
- We will run our vitest suite for md graph first and then cloze logseq.
- We will use xvfb-run again to run logseq and repeat for db graph.

How to select graph:
- 

Regarding tests:
- Workflow will run tests on both md and db graphs one after another.
- Most of the tests will run first on md graph and then db graph.
- Some tests are supposed to be run specifically on either md or db. We can check whether current is db or not inside the tests itself and skip.

Please improve above approach as you like and write a document.

Also, add a suggestion section which should mention:
- Use https://github.com/nektos/act to test github workflow
- Workflow should use lts ubuntu image with node 22


----------------
Write a document for new testing method in agent-docs. ONLY WRITE DOCUMENT AND IMPROVE AND JUDGE FEASIBILITY, DO NOT WRITE CODE.

Decided approach:
- tests/graphs -> will contain two logseq graphs: TestDB and TestMD
- First pull logseq appimage from https://github.com/logseq/logseq/releases/download/0.10.15/Logseq-linux-x64-0.10.15.AppImage
- We will create file at very start in ~/.config/Logseq/configs.edn with following content:
  {:server/autostart true
  :server/host "127.0.0.1"
  :server/port 12315
  :server/tokens [{:value "<process env logseq api token>"}]}
  [Note: This will auto start http server on boot up - used by tests/setup.ts]
  [Note: I actually don't know how to set process env logseq api token in github workflow]
- We will copy and place TestDB in /home/<user>/logseq/graphs/ (create if it does not exist)
- We will use xvfb-run to run logseq. xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" ./Logseq --no-sandbox seemed to have worked and starts http server which is required in tests/setup.ts. [Note: Do we need --no-sandbox for ubuntu?  Currently i am on kde and hence this is required.].
- We need to wait for "Server listening" (inside some string) from above process.
- We will run our vitest suite for db graph.


Regarding tests:
- Workflow will run tests on db graphs only.
- Some tests are supposed to be run specifically on either md or db. We can check whether current is db or not inside the tests itself and skip.
  [Tests meant for MD graph will be run manually since unlike db graphs, they need to be registered manually from logseq]

Please improve above approach as you like, try to adress limitations and write a document. Include all the details I gave u.

Also, add a suggestion section which should mention:
- Use https://github.com/nektos/act to test github workflow
  [Currently, since i am using act as github extension and the fact that i am using docker desktop. hence we need to first run sudo ln -sf /home/debanjand/.docker/desktop/docker.sock /var/run/docker.sock and then gh act <rest of command>]
- Workflow should use lts ubuntu image with node 22

Also, analze current tests and mention actionables for above approach and any differences in ideology.
-------------------------------
Please implement agent-docs/TESTING.md workflow and test your implementation with gh act.

For this, I have prepared a sample-test.test.ts and setup.ts is already modified by me. I have also comment out rest of test files as our main purpose is to get sample-test to pass. Rest of files will be uncommented and modified later by ME.

Please focus on creating the testing workflow and getting it to work.