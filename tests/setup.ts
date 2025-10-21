import proxyLogseq from 'logseq-proxy';

// Setup logseq proxy before all test cases run
proxyLogseq({
  settings: {},
  config: {
    apiServer: process.env.LOGSEQ_API_SERVER || 'http://127.0.0.1:12315',
    apiToken: process.env.LOGSEQ_API_TOKEN || '',
  },
});