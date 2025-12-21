# Automated Testing with Logseq Graphs

## Overview

This document describes the automated testing approach for logseq-anki-sync using real Logseq graphs in CI/CD environments. The approach enables running integration tests against actual Logseq instances with DB and Markdown graphs.

## Current Testing Approach

### Existing Setup
- **Test Framework:** Vitest with jsdom environment
- **Logseq Integration:** Uses `logseq-proxy` package to proxy @logseq/libs calls to HTTP requests
- **API Server:** Tests connect to `http://127.0.0.1:12315` (configurable via `LOGSEQ_API_SERVER` env var)
- **Authentication:** Optional API token via `LOGSEQ_API_TOKEN` env var
- **Test Structure:**
  - `test/setup.ts` - Configures logseq-proxy before all tests
  - `test/src/converter/` - HTML conversion tests with snapshots
  - `test/src/logseq/` - LogseqPropertiesHelper tests
  - `test/src/compareAnswer/` - Answer comparison logic tests
  - `test/src/anki-template/` - Anki card template tests
  - `test/bin/` - Test binaries and utilities
  - `test/graphs/` - Test graph data

### Current Limitations
- **Manual Setup Required:** Developers must manually start Logseq with API server enabled
- **No CI/CD Integration:** Tests cannot run in GitHub Actions without manual intervention
- **Graph Dependency:** Tests require specific graph content but no standardized test graphs exist
- **MD vs DB Graph Testing:** No mechanism to differentiate or skip tests based on graph type

## Proposed Automated Testing Approach

### Architecture

```
test/
├── graphs/
│   ├── LAS_TEST_DB/          # DB-format test graph (auto-opened in CI)
│   └── LAS_TEST_MD/          # Markdown-format test graph (manual testing only)
├── setup.ts             # Existing logseq-proxy configuration
├── bin/                 # Test binaries and utilities
└── src/                 # Test files matching src structure
    ├── logseq/
    ├── converter/
    ├── compareAnswer/
    └── anki-template/
```

### Workflow Steps

#### 1. Download Logseq AppImage

```bash
wget https://github.com/debanjandhar12/logseq/releases/download/test1/Logseq-linux-x64-0.11.0.AppImage -O logseq.AppImage
chmod +x logseq.AppImage
```

#### 2. Configure Logseq API Server

Create `~/.config/Logseq/configs.edn` before first launch:
```clojure
{:server/autostart true
 :server/host "127.0.0.1"
 :server/port 12315
 :server/tokens [{:value "<LOGSEQ_API_TOKEN>"}]}
```

**Notes:**
- This config auto-starts the HTTP server on Logseq boot (required by `tests/setup.ts`)
- Token value comes from environment variable (see GitHub workflow section)
- If token is empty string, tests run without authentication

#### 3. Setup Test Graph

Copy test graph to Logseq's graphs directory:
```bash
mkdir -p ~/logseq/graphs
cp -r test/graphs/LAS_TEST_DB ~/logseq/graphs/
```

**Graph Registration:**
- DB graphs are automatically registered when placed in `~/logseq/graphs/`
- MD graphs require manual UI registration (not automated in CI)

#### 4. Start Logseq with Xvfb

```bash
xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" \
  ./logseq.AppImage --no-sandbox > logseq.log 2>&1 &
LOGSEQ_PID=$!
```

**Parameters:**
- `xvfb-run` - Virtual framebuffer for headless GUI execution
- `--auto-servernum` - Automatically find available display number
- `--server-args="-screen 0 1024x768x24"` - Virtual screen configuration
- `--no-sandbox` - Required in containerized environments (GitHub Actions)

#### 5. Wait for Logseq Server

```bash
timeout 60 bash -c 'until grep -q "Server listening" logseq.log; do sleep 1; done'

if [ $? -ne 0 ]; then
  echo "Logseq server failed to start"
  cat logseq.log
  kill $LOGSEQ_PID
  exit 1
fi
```

#### 6. Setup Anki and AnkiConnect

**Install Anki:**
```bash
wget https://github.com/ankitects/anki/releases/download/25.09/anki-launcher-25.09-linux.tar.zst -O anki.tar.zst
tar xaf anki.tar.zst
cd anki-launcher-25.09-linux
sudo ./install.sh
cd ..
```

**Note:** The downloaded filename may vary. Update the filename in subsequent commands accordingly.

**Install AnkiConnect Addon:**
```bash
mkdir -p ~/.local/share/Anki2/addons21/2055492159
wget https://ankiweb.net/shared/download/2055492159?v=2.1 -O AnkiConnect.ankiaddon
unzip AnkiConnect.ankiaddon -d ~/.local/share/Anki2/addons21/2055492159/

# Configure for CI (allow all connections)
cat > ~/.local/share/Anki2/addons21/2055492159/config.json << 'EOF'
{
    "apiKey": null,
    "webBindAddress": "0.0.0.0",
    "webBindPort": 8765,
    "webCorsOriginList": ["*"]
}
EOF

# Create meta.json
cat > ~/.local/share/Anki2/addons21/2055492159/meta.json << 'EOF'
{
  "name": "AnkiConnect",
  "disabled": false
}
EOF
```

**Start Anki:**
```bash
xvfb-run --auto-servernum anki &
ANKI_PID=$!

# Wait for AnkiConnect
timeout 30 bash -c 'until curl -s http://localhost:8765 > /dev/null; do sleep 1; done'

# Verify AnkiConnect is responding
curl -X POST http://localhost:8765 -d '{"action":"version","version":6}'
```

#### 7. Run Tests

#### 7. Run Tests

```bash
pnpm test --run
```

**Environment Variables:**
- `LOGSEQ_API_SERVER` - Set to `http://127.0.0.1:12315`
- `LOGSEQ_API_TOKEN` - Set from GitHub secret or environment variable
- Tests read these from `process.env` via `test/setup.ts`
- Availability flags (`globalThis.isLogseqAvailable`, `globalThis.isAnkiAvailable`) are set by runtime detection

#### 8. Cleanup

```bash
# Kill processes
kill $LOGSEQ_PID || true
kill $ANKI_PID || true

# Archive logs (for CI artifacts)
# Logs: logseq.log
```

### Test Graph Strategy

#### DB Graph (LAS_TEST_DB)
- **Purpose:** Primary testing target for CI/CD
- **Location:** `test/graphs/LAS_TEST_DB`
- **Auto-Registration:** Yes (when placed in `~/logseq/graphs/`)
- **CI Execution:** Automated in GitHub Actions

#### Markdown Graph (LAS_TEST_MD)
- **Purpose:** Manual testing for MD-specific features
- **Location:** `test/graphs/LAS_TEST_MD`
- **Auto-Registration:** No (requires manual UI registration)
- **CI Execution:** Not automated (manual testing only)

### Graph-Specific Test Filtering

Tests can detect current graph type and skip if incompatible:

```typescript
import { describe, it, expect, test } from 'vitest';

describe('DB-specific feature', () => {
  test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)('should work on DB graphs', async () => {
    // Test implementation
  });
});
```

### GitHub Actions Workflow

**Workflow File:** `.github/workflows/test.yml`

**Complete Workflow:**
```yaml
name: Run Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-22.04  # LTS Ubuntu
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: '9'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Download Logseq
        run: |
          wget https://github.com/debanjandhar12/logseq/releases/download/test1/Logseq-linux-x64-0.11.0.AppImage -O logseq.AppImage
          chmod +x logseq.AppImage
      
      - name: Setup Logseq API Server Config
        run: |
          mkdir -p ~/.config/Logseq
          cat > ~/.config/Logseq/configs.edn << EOF
          {:server/autostart true
           :server/host "127.0.0.1"
           :server/port 12315
           :server/tokens [{:value "${{ secrets.LOGSEQ_API_TOKEN }}"}]}
          EOF
      
      - name: Setup Test Graph
        run: |
          mkdir -p ~/logseq/graphs
          cp -r test/graphs/LAS_TEST_DB ~/logseq/graphs/
      
      - name: Install Xvfb
        run: sudo apt-get update && sudo apt-get install -y xvfb
      
      - name: Start Logseq
        run: |
          xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" \
            ./logseq.AppImage --no-sandbox > logseq.log 2>&1 &
          echo $! > logseq.pid
          
          # Wait for server to start
          timeout 60 bash -c 'until grep -q "Server listening" logseq.log; do sleep 1; done' || {
            echo "Logseq failed to start. Log contents:"
            cat logseq.log
            exit 1
          }
      
      - name: Setup Anki
        run: |
          # Download and install Anki
          wget https://github.com/ankitects/anki/releases/download/25.09/anki-launcher-25.09-linux.tar.zst -O anki.tar.zst
          tar xaf anki.tar.zst
          cd anki-launcher-25.09-linux
          sudo ./install.sh
          cd ..
          
          # Install AnkiConnect addon
          mkdir -p ~/.local/share/Anki2/addons21/2055492159
          wget https://ankiweb.net/shared/download/2055492159?v=2.1 -O AnkiConnect.ankiaddon
          unzip AnkiConnect.ankiaddon -d ~/.local/share/Anki2/addons21/2055492159/
          
          # Configure AnkiConnect
          cat > ~/.local/share/Anki2/addons21/2055492159/config.json << 'EOFANKI'
          {
              "apiKey": null,
              "webBindAddress": "0.0.0.0",
              "webBindPort": 8765,
              "webCorsOriginList": ["*"]
          }
          EOFANKI
          
          # Create meta.json
          cat > ~/.local/share/Anki2/addons21/2055492159/meta.json << 'EOFANKI'
          {
            "name": "AnkiConnect",
            "disabled": false
          }
          EOFANKI
      
      - name: Start Anki
        run: |
          xvfb-run --auto-servernum anki > anki.log 2>&1 &
          echo $! > anki.pid
          
          # Wait for AnkiConnect
          timeout 30 bash -c 'until curl -s http://localhost:8765 > /dev/null; do sleep 1; done' || {
            echo "Anki/AnkiConnect failed to start. Log contents:"
            cat anki.log
            exit 1
          }
          
          # Verify AnkiConnect
          curl -X POST http://localhost:8765 -d '{"action":"version","version":6}'
      
      - name: Run Tests
        run: pnpm test --run
        env:
          LOGSEQ_API_SERVER: http://127.0.0.1:12315
          LOGSEQ_API_TOKEN: ${{ secrets.LOGSEQ_API_TOKEN }}
      
      - name: Cleanup
        if: always()
        run: |
          if [ -f logseq.pid ]; then
            kill $(cat logseq.pid) || true
          fi
          if [ -f anki.pid ]; then
            kill $(cat anki.pid) || true
          fi
      
      - name: Upload Logs
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-logs
          path: |
            logseq.log
            anki.log
```

**Required GitHub Secrets:**
- `LOGSEQ_API_TOKEN` - API authentication token (can be any string, or empty for no auth)

**Note on LOGSEQ_API_TOKEN:**
- Set in GitHub repository settings: Settings > Secrets and variables > Actions > New repository secret
- Value can be any string (e.g., `"test-token-123"`) or empty string `""`
- Must match the token used in local development if you want consistency
- The token is passed to `configs.edn` and then to tests via `LOGSEQ_API_TOKEN` env var

## Feasibility Analysis

### Strengths

1. **Real Integration Testing:** Tests run against actual Logseq instance, not mocks
2. **CI/CD Ready:** Fully automated workflow for DB graphs
3. **Reproducible:** Standardized test graphs ensure consistent test environment
4. **Debugging Support:** Logs captured as artifacts for failure analysis
5. **Backward Compatible:** Existing tests continue to work without modification
6. **Graph Type Awareness:** Tests can conditionally execute based on graph format

### Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **Logseq Startup Time** | Cache AppImage in CI, use fast SSD runners |
| **API Token Management** | Use GitHub Secrets, fallback to no-auth for local dev |
| **Xvfb Overhead** | Minimal performance impact, necessary for headless GUI |
| **MD Graph Testing** | Accept manual testing limitation, focus CI on DB graphs |
| **Test Graph Maintenance** | Version control test graphs, document required content |
| **Flaky Tests** | Implement proper wait strategies, increase timeouts if needed |

### Risks

1. **Logseq Version Dependency:** Tests tied to specific Logseq version (0.10.15)
   - **Mitigation:** Parameterize version, test against multiple versions
   
2. **Graph Format Changes:** Future Logseq updates may break test graphs
   - **Mitigation:** Version test graphs alongside Logseq versions
   
3. **CI Resource Usage:** Running full Logseq instance increases CI time/cost
   - **Mitigation:** Optimize graph size, cache dependencies, parallel test execution
   
4. **Sandbox Requirement:** `--no-sandbox` reduces security in CI
   - **Mitigation:** Acceptable for isolated CI environments, avoid on production systems

### Performance Estimates

- **Logseq Download:** ~2-3 minutes (first run), ~10 seconds (cached)
- **Anki Download:** ~1-2 minutes (first run), ~5 seconds (cached)
- **Logseq Startup:** ~10-20 seconds
- **Anki Startup:** ~5-10 seconds
- **Test Execution:** ~30-60 seconds (current test suite)
- **Total CI Time:** ~10-15 minutes per run

## Testing Best Practices

### Test Graph Content Guidelines

1. **Minimal but Comprehensive:** Include only necessary content for test coverage
2. **Documented Structure:** README in each test graph explaining content organization
3. **Stable References:** Use predictable block UUIDs for reference-based tests
4. **Property Examples:** Cover all property formats (namespaced, legacy, system)
5. **Edge Cases:** Include problematic syntax that has caused bugs historically

### Test Implementation Guidelines

1. **Graph Type Detection:** Always check graph type before running format-specific tests
2. **Async Handling:** Properly await all Logseq API calls
3. **Cleanup:** Reset state between tests to avoid interdependencies
4. **Snapshots:** Use snapshot testing for HTML output validation
5. **Error Messages:** Provide clear failure messages indicating expected vs actual state

### Local Development Workflow

1. **Manual Logseq Launch:** Start Logseq with API server enabled
2. **Open Test Graph:** Load TestDB or TestMD graph
3. **Run Tests:** `pnpm test` (watches for changes)
4. **Iterate:** Modify code/tests, auto-rerun on save

### CI Development Workflow

1. **Local Validation:** Test workflow locally using `act` (see Suggestions section)
2. **Push to Branch:** Trigger CI on push/PR
3. **Monitor Logs:** Check GitHub Actions output for failures
4. **Debug Artifacts:** Download Logseq logs if tests fail

## Suggestions & Recommendations

### Local CI Testing with Act

**Tool:** [nektos/act](https://github.com/nektos/act) - Run GitHub Actions locally

**Installation:**
```bash
# Via GitHub CLI extension
gh extension install https://github.com/nektos/gh-act

# Or standalone
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**Docker Desktop Compatibility:**
If using Docker Desktop (non-root Docker socket):
```bash
# Create symlink to Docker Desktop socket
sudo ln -sf /home/debanjand/.docker/desktop/docker.sock /var/run/docker.sock

# Run act via GitHub CLI
gh act push --container-architecture linux/amd64
```
> This knowledge should be added to development docs during implementation

**Usage Examples:**
```bash
# Run all workflows
gh act

# Run specific workflow
gh act -W .github/workflows/test.yml

# Run specific job
gh act -j test

# Dry run (list jobs without executing)
gh act -l

# Use specific runner image
gh act --container-architecture linux/amd64 -P ubuntu-22.04=catthehacker/ubuntu:act-22.04
```

**Benefits:**
- Catch CI issues before pushing
- Faster iteration on workflow changes
- No GitHub Actions minutes consumed
- Identical environment to CI

### Workflow Configuration Recommendations

1. **Use LTS Ubuntu:** `ubuntu-22.04` for stability and long-term support
2. **Node.js Version:** Node 22 (current LTS) for latest features and performance
3. **Caching Strategy:**
   - Cache pnpm dependencies: `~/.pnpm-store`
   - Cache Logseq AppImage: `~/.cache/logseq-appimage`
   - Cache test graph indexes: `~/logseq/graphs/TestDB/.logseq/`
4. **Parallel Testing:** Split tests into multiple jobs if suite grows large
5. **Matrix Testing:** Test against multiple Logseq versions (0.10.x, 0.11.x)

### Future Enhancements

1. **Anki Integration:** Mock AnkiConnect or run Anki in CI for full E2E tests
2. **Visual Regression Testing:** Screenshot comparison for UI components
3. **Performance Benchmarks:** Track sync performance over time
4. **Test Coverage Reports:** Integrate with Codecov or Coveralls
5. **Automated Graph Updates:** Script to regenerate test graphs from templates

### Differences from Current Approach

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Logseq Launch** | Manual | Automated in CI |
| **Graph Management** | Ad-hoc | Standardized test graphs |
| **CI Integration** | None | Full GitHub Actions workflow |
| **Graph Type Handling** | Implicit | Explicit detection and skipping |
| **Environment** | Developer machine | Headless Ubuntu container |
| **Reproducibility** | Variable | Consistent across runs |
| **Debugging** | Local only | Logs captured as artifacts |

### Key Ideological Shifts

1. **Infrastructure as Code:** Test environment fully defined in workflow YAML
2. **Reproducible Testing:** Same test graph used by all developers and CI
3. **Fail Fast:** Automated tests catch regressions before merge
4. **Transparency:** CI logs provide visibility into test execution
5. **Scalability:** Foundation for expanding test coverage without manual overhead

## Anki and AnkiConnect Setup

Anki and AnkiConnect are set up as part of the main CI workflow (see step 6 in Workflow Steps above).

### Configuration Details

**AnkiConnect Default Config:**
```json
{
    "apiKey": null,
    "apiLogPath": null,
    "webBindAddress": "127.0.0.1",
    "webBindPort": 8765,
    "webCorsOriginList": ["http://localhost"],
    "ignoreOriginList": []
}
```

**CI Configuration (Modified):**
- `webBindAddress`: `"0.0.0.0"` - Accept connections from any interface
- `webCorsOriginList`: `["*"]` - Allow CORS from all origins
- `apiKey`: `null` - No authentication required

**Security Note:** Using `"0.0.0.0"` and `"*"` is acceptable in isolated CI environments but should NOT be used in production or on developer machines exposed to networks.

### Testing with Anki

Tests can check if Anki is available and skip if not:

```typescript
test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isAnkiAvailable)('should sync to Anki', async () => {
  // Test implementation
});
```

**Note:** Both `globalThis.isLogseqAvailable` and `globalThis.isAnkiAvailable` are set in `test/setup.ts` using runtime detection.

## logseqAvailable Flag Usage

### Purpose

The `logseqAvailable` flag allows tests to conditionally execute based on whether a Logseq instance is running and accessible. This enables:
- **CI/CD Integration:** Tests run with full Logseq integration in automated environments
- **Local Development:** Tests can run without Logseq for basic unit testing
- **Graceful Degradation:** Tests skip Logseq-dependent functionality when unavailable

### Configuration

**Runtime Detection in test/setup.ts:**
- `globalThis.isLogseqAvailable` - Set by calling `logseq.App.getUserInfo()` 
- `globalThis.isAnkiAvailable` - Set by testing AnkiConnect API endpoint

**Setup in test/setup.ts:**
```typescript
// Configure logseq-proxy and availability flag
import proxyLogseq from 'logseq-proxy';

proxyLogseq({
  settings: {},
  config: {
    apiServer: process.env.LOGSEQ_API_SERVER || 'http://127.0.0.1:12315',
    apiToken: process.env.LOGSEQ_API_TOKEN || '',
  },
});

// Check Logseq availability by calling getUserInfo()
try {
  await logseq.App.getUserInfo();
  globalThis.isLogseqAvailable = true;
} catch {
  globalThis.isLogseqAvailable = false;
  console.log('Logseq not available - some tests will be skipped');
}

// Check Anki availability
try {
  const response = await fetch('http://localhost:8765', {
    method: 'POST',
    body: JSON.stringify({ action: 'version', version: 6 })
  });
  globalThis.isAnkiAvailable = response.ok;
} catch {
  globalThis.isAnkiAvailable = false;
}
```

### Test Implementation Pattern

**Test Implementation Pattern:**
```typescript
import { describe, test, expect } from 'vitest';

describe('Logseq integration tests', () => {
  test.skipIf(!globalThis.isLogseqAvailable)('should process blocks', async () => {
    // Test implementation using Logseq API
    const blocks = await logseq.Editor.getAllBlocks();
    expect(blocks).toBeDefined();
  });
  
  test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)('should work on DB graphs only', async () => {
    // DB-specific test implementation
  });
});
```
Note: Remember to add type in globalThis for isLogseqAvailable, isAnkiAvailable, and isLogseqCurrentIsDBGraph

### Workflow Integration

**GitHub Actions:**
```yaml
- name: Run Tests
  run: pnpm test --run
  env:
    LOGSEQ_AVAILABLE: true  # Set when Logseq is running in CI
```

**Local Development:**
```bash
# Start Logseq with API server, then run tests
pnpm test  # globalThis.isLogseqAvailable set by getUserInfo() call

# Without Logseq running
pnpm test  # Tests will skip Logseq-dependent functionality
```

### Benefits

1. **Flexible Testing:** Same test suite works in multiple environments
2. **Clear Skipping:** Tests explicitly indicate why they're skipped
3. **Fail-Safe:** Prevents test failures due to missing Logseq instance
4. **CI Optimization:** Can run subset of tests without full Logseq setup when needed

## FAQ: Design Decisions

### Why won't MD graphs be tested in CI/CD?
**Technical Limitation:** Markdown graphs require manual registration through Logseq's UI. Unlike DB graphs which are auto-detected when placed in `~/logseq/graphs/`, MD graphs need user interaction to:
1. Click "Add new graph" in Logseq
3. Confirm the selection

**Automation Challenge:** This UI-driven workflow cannot be scripted in a headless CI environment. While we could theoretically:
- Manipulate Logseq's internal configuration files
- Use UI automation tools (Selenium, Playwright)

Both approaches would be fragile, maintenance-heavy, and add significant complexity.

**Pragmatic Solution:** 
- Focus CI on DB graphs
- Keep MD graph testing manual for developers working on MD-specific features

### Why use xvfb instead of truly headless Logseq?

**Logseq Architecture:** Logseq is an Electron app that requires a display server, even when running the API server. There's no official headless mode.


### Why require --no-sandbox flag?

**Container Security Model:** GitHub Actions runners use containerized environments where Chrome/Electron's sandbox conflicts with the container's security model.

### Why not mock Logseq API instead of running real instance?

**Integration Testing Philosophy:** 
- Mocks test your assumptions, not reality
- Real Logseq instance catches:
  - API behavior changes
  - Graph format edge cases
  - Actual rendering output
  - Performance regressions

**Cost-Benefit:**
- Added CI time (~5-10 min) is acceptable
- Confidence in test results is significantly higher
- Catches integration issues that unit tests miss

### Why use process.env for both local and CI?

**Unified Interface:** `tests/setup.ts` already reads from `process.env`, so both workflows use the same code path:
- **Local:** Export env vars in shell (`export LOGSEQ_API_SERVER=... LOGSEQ_API_TOKEN=...`)
- **CI:** GitHub Actions sets env vars in workflow YAML

**Benefits:**
- No code changes needed
- Developers can override defaults easily
- CI configuration is explicit and visible

**Setting LOGSEQ_API_TOKEN in GitHub:**
- Go to repository Settings > Secrets and variables > Actions > New repository secret
- Name: `LOGSEQ_API_TOKEN`
- Value: Any string (e.g., `"test-token-123"`) or empty string `""`
- The workflow passes this to both `configs.edn` and test environment

### Why target Logseq 0.10.15 specifically?

**Stability:** 0.10.15 is a stable release with known API behavior.

**Future-Proofing:** The workflow can be parameterized to test multiple versions:
```yaml
strategy:
  matrix:
    logseq-version: ['0.10.15', '0.11.0']
```

**Current Decision:** Start with single version, expand to matrix testing once baseline is stable.

### Why use customizable download links?

**Flexibility:** Download URLs may change frequently during development and testing phases. Making them easily configurable (ideally as a single line change in the script) allows for:
- Testing different Logseq builds
- Updating to newer Anki versions
- Handling variable filenames (e.g., `Logseq-v1.AppImage` vs `Logseq.AppImage`)

**Implementation:** Use variables at the top of scripts with `-O` flag:
```bash
LOGSEQ_URL="https://github.com/debanjandhar12/logseq/releases/download/test1/Logseq-linux-x64-0.11.0.AppImage"
ANKI_URL="https://github.com/ankitects/anki/releases/download/25.09/anki-launcher-25.09-linux.tar.zst"
ANKI_CONNECT_URL="https://ankiweb.net/shared/download/2055492159?v=2.1"

# Download with standardized filenames
wget "$LOGSEQ_URL" -O logseq.AppImage
wget "$ANKI_URL" -O anki.tar.zst
wget "$ANKI_CONNECT_URL" -O AnkiConnect.ankiaddon
```

## Conclusion

The proposed automated testing approach is **highly feasible** and provides significant improvements over the current manual testing workflow. The main trade-offs are:

- **Pros:** Automation, reproducibility, CI integration, scalability
- **Cons:** Increased CI time/cost, Logseq version dependency, MD graph limitation

The benefits far outweigh the costs, especially as the project grows and requires more rigorous testing. The approach is production-ready and can be implemented incrementally without disrupting existing development workflows.

**Recommendation:** Proceed with implementation following the phased migration strategy outlined above.
