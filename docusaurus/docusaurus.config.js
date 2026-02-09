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
    themes: [
        [
            require.resolve("docusaurus-plugin-search-local"),
            {
                indexDocs: true,
                indexPages: false,
                highlightSearchTermsOnTargetPage: true,
            },
        ],
    ],
    themeConfig: {
        colorMode: {
      defaultMode: 'dark',
            disableSwitch: false,
        },
        navbar: {
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
                    type: 'search',
                    position: 'right',
                },
                {
          href: 'https://github.com/debanjandhar12/logseq-anki-sync',
          position: 'right',
          label: 'GitHub Project',
                },
                {
          href: 'https://github.com/sponsors/debanjandhar12',
          position: 'right',
          label: 'GitHub Sponsors',
          className: 'navbar-sponsor-button',
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
