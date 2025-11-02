import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';

const algoliaAppId = process.env.ALGOLIA_APP_ID ?? 'APP_ID';
const algoliaApiKey = process.env.ALGOLIA_API_KEY ?? 'SEARCH_API_KEY';
const algoliaIndexName = process.env.ALGOLIA_INDEX_NAME ?? 'INDEX_NAME';

const config: Config = {
  title: 'Logseq Anki Sync',
  tagline: 'Sync Logseq flashcards to Anki with superpowers',
  favicon: 'img/anki-logo.svg',
  url: 'https://debanjandhar12.github.io',
  baseUrl: '/logseq-anki-sync/',
  organizationName: 'debanjandhar12',
  projectName: 'logseq-anki-sync',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,
  onBrokenLinks: 'throw',
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
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/debanjandhar12/logseq-anki-sync/tree/main/docs/',
          breadcrumbs: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],
  themeConfig: {
    algolia: {
      appId: algoliaAppId,
      apiKey: algoliaApiKey,
      indexName: algoliaIndexName,
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
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
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
          type: 'html',
          position: 'right',
          value: '<a class="github-button" href="https://github.com/debanjandhar12/logseq-anki-sync" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star logseq-anki-sync on GitHub">Star</a>',
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
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
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
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Logseq Marketplace',
              href: 'https://hub.logseq.com/plugin/debanjandhar12/logseq-anki-sync',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/debanjandhar12/logseq-anki-sync',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Logseq Anki Sync contributors`,
    },
  },
  scripts: [{
    src: 'https://buttons.github.io/buttons.js',
    async: true,
  }],
};

export default config;
