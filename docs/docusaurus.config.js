const { themes } = require('prism-react-renderer');
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

const config = {
  title: 'Logseq Anki Sync',
  tagline: 'Sync Logseq flashcards to Anki with superpowers',
  favicon: 'img/anki-logo.svg',
  url: 'https://debanjandhar12.github.io',
  baseUrl: '/logseq-anki-sync/',
  organizationName: 'debanjandhar12',
  projectName: 'logseq-anki-sync',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/debanjandhar12/logseq-anki-sync/tree/main/docs/',
          breadcrumbs: true,
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
  themeConfig: {
    algolia: {
      appId: process.env.ALGOLIA_APP_ID ?? 'APP_ID',
      apiKey: process.env.ALGOLIA_API_KEY ?? 'SEARCH_API_KEY',
      indexName: process.env.ALGOLIA_INDEX_NAME ?? 'INDEX_NAME',
      contextualSearch: true,
      searchParameters: {},
      searchPagePath: 'search',
    },
    navbar: {
      title: 'Logseq Anki Sync',
      logo: {
        alt: 'Anki logo',
        src: 'img/anki-logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/sponsors/debanjandhar12',
          position: 'right',
          label: 'GitHub Sponsors',
          className: 'navbar-sponsor-button',
        },
        {
          href: 'https://github.com/debanjandhar12/logseq-anki-sync',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
      additionalLanguages: ['bash', 'json'],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/debanjandhar12/logseq-anki-sync/issues',
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/debanjandhar12/logseq-anki-sync/discussions',
            },
            {
              label: 'GitHub Project',
              href: 'https://github.com/debanjandhar12/logseq-anki-sync',
            },
          ],
        },
        {
          title: 'Support',
          items: [
            {
              label: 'GitHub Sponsors',
              href: 'https://github.com/sponsors/debanjandhar12',
            },
          ],
        },
      ],
    },
  },
};

module.exports = config;
