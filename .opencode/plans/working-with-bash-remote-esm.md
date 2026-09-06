# Working with Bash, Remote ESM, and Utility Removal

## Goal

- Add a bundled `Working with Bash` skill under `src/chat-app/prompts` and register it through `initBuiltInSkillFiles`.
- Support secure HTTPS ES module imports in `qjs`, including jsDelivr examples for mathjs and YouTube transcripts.
- Replace the built-in transcript utility with skill examples and remove utility-script storage, initialization, mounts, and build machinery.
- Keep existing persisted utility data untouched because the plugin has not been released.

## Implementation

1. Replace the synchronous QuickJS WASM variant with the asyncify variant, install an async module loader and URL normalizer, and evaluate user input as a module with top-level await.
2. Route every module request through the existing allowlisted secure fetch and enforce module-count and aggregate-source limits.
3. Add and register `SKILL_WORKING_WITH_BASH.md` with basic `qjs -e`, mathjs, YouTube transcript, and direct Bilibili API examples.
4. Delete the incorrectly placed `.agents` skill and the utility-script store/init implementation.
5. Remove the utility mount, startup initialization, tests, and dependencies specific to utility scripts. Preserve the generic Vite string-bundling infrastructure.
6. Update the video skill and Bash sandbox documentation.
7. Add module-loader and built-in-skill tests, then run linting, tests, typecheck, and production build.
