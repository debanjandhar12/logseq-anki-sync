# Live Logseq tests

Live tests require a running Logseq DB graph and its HTTP API server. The test
setup uses `LOGSEQ_API_SERVER` (default: `http://127.0.0.1:12315`).

## Graph data lifecycle

- Use deterministic, suite-specific kebab-case names, such as
  `test-create-page-command` or `test-ai-chat-composer-scroll`.
- Call `deletePagePermanently` from `tests/helpers/logseq/deletePagePermanently.ts`
  before creating test data and in teardown. It handles active and recycled
  pages, tags, and property definitions. Deleting a page also removes its children.
- Create reusable attachment pages and blocks once in `beforeAll`, then remove
  them in `afterAll`. When each case creates or rolls back the same pages, reset
  those names in `beforeEach` and clean up the final case in `afterAll`.
- Keep intentional soft deletion inside tests that verify restore/revert behavior;
  permanent deletion belongs in resource setup and teardown.
- Use distinct names and journal dates across files so file parallelism stays enabled.

The proxy wrapper throttles Logseq requests. Do not add command-spacing sleeps.
The permanent cleanup helper uses a one-second delay after recycling and purging;
it does not poll. UI rendering, persistence assertions, and stream coordination
still use their own condition-based synchronization.

## Chat scenarios

The seven suites in `tests/scenario/ai-chat-modal/` use the shared chat fixture for
per-test model, UI, settings, and in-memory conversation isolation. Graph setup is
explicit in each suite; UI-only suites incur no graph-fixture initialization.

## Running checks

```sh
pnpm run test:e2e
pnpm run test:prompts internal-queries.test.e2e.ts example-queries.test.ts
pnpm run test:unit LogseqAttachmentAdapter.test.ts
npx tsc --noEmit
```

Run live suites twice to verify that fixed names work across repeated runs and
that teardown removes their data from the recycle bin as well as the active graph.
