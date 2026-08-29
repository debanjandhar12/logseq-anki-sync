/**
 * Core theme variables used by Tailwind (see tailwind.config.mjs)
 * These variables are fetched from Logseq's theme system and applied to the UI
 */
export const LOGSEQ_THEME_VARIABLES = [
    // Background colors
    "--ls-primary-background-color",
    "--ls-secondary-background-color",
    "--ls-tertiary-background-color",
    "--ls-quaternary-background-color",

    // Primary colors
    "--ls-button-background",
    "--secondary",
    "--tertiary",
    "--primary",
    "--radius",
    "--background",

    // Border colors
    "--ls-border-color",
    "--ls-secondary-border-color",
    "--ls-tertiary-border-color",

    // Text colors
    "--ls-font-family",
    "--ls-primary-text-color",
    "--ls-secondary-text-color",

    // Block/UI colors
    "--ls-block-highlight-color",
    "--ls-block-bullet-border-color",
    "--ls-block-bullet-color",
    "--ls-guideline-color",
    "--ls-menu-hover-color",

    // Opacity
    "--ls-primary-text-opacity",
    "--ls-secondary-text-opacity",

    // Semantic text colors
    "--ls-title-text-color",
    "--ls-link-text-color",
    "--ls-link-text-hover-color",
    "--ls-link-ref-text-color",
    "--ls-link-ref-text-hover-color",
    "--ls-tag-text-color",
    "--ls-tag-text-hover-color",

    // Component-specific colors
    "--ls-slide-background-color",
    "--ls-block-properties-background-color",
    "--ls-page-properties-background-color",
    "--ls-page-blockquote-color",
    "--ls-page-blockquote-bg-color",
    "--ls-page-blockquote-border-color",
    "--ls-page-inline-code-color",
    "--ls-page-inline-code-bg-color",

    // Scrollbar
    "--ls-scrollbar-foreground-color",
    "--ls-scrollbar-background-color",
    "--ls-scrollbar-thumb-hover-color",
    "--ls-scrollbar-width",
    "--lx-gray-02",
    "--lx-gray-03",
    "--lx-gray-05",
    "--lx-gray-06",
    "--lx-gray-09",
    "--lx-gray-12",
    "--lx-accent-03",
    "--rx-gray-02",
    "--rx-gray-05",
    "--rx-gray-06",

    // Misc
    "--ls-head-text-color",
    "--ls-cloze-text-color",
    "--ls-icon-color",
    "--ls-search-background-color",
    "--ls-search-icon-color",
    "--ls-a-chosen-bg",
    "--ls-right-sidebar-code-bg-color",

    // Level colors
    "--color-level-1",
    "--color-level-2",
    "--color-level-3",
    "--color-level-4",
    "--color-level-5",
    "--color-level-6",

    // Gray colors for shortcut keys
    "--lx-gray-06-alpha",
    "--rx-gray-06-alpha",
    "--lx-gray-11",
    "--rx-gray-11"
] as const;
