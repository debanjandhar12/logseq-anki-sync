const { themes } = require('prism-react-renderer');
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

const config = {
  title: 'Logseq AstroBox',
  tagline: 'An harness for logseq with superpowers.',
  favicon: 'img/astro-box.svg',
  url: 'https://debanjandhar12.github.io',
  baseUrl: '/logseq-astro-box/',
  organizationName: 'debanjandhar12',
  projectName: 'logseq-astro-box',
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
          editUrl: 'https://github.com/debanjandhar12/logseq-astro-box/tree/ai/docusaurus/docs/',
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
        alt: 'Logseq AstroBox logo',
        src: 'img/astro-box.svg',
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
          href: 'https://github.com/debanjandhar12/logseq-astro-box',
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
              href: 'https://github.com/debanjandhar12/logseq-astro-box/issues',
                        },
                        {
              label: 'GitHub Discussions',
              href: 'https://github.com/debanjandhar12/logseq-astro-box/discussions',
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
