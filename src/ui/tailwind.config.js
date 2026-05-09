/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                "button-background": "var(--ls-button-background)",
                "primary-background": "var(--ls-primary-background-color)",
                "secondary-background": "var(--ls-secondary-background-color)",
                "tertiary-background": "var(--ls-tertiary-background-color)",
                "quaternary-background": "var(--ls-quaternary-background-color)",
                border: "var(--ls-border-color)",
                "secondary-border": "var(--ls-secondary-border-color)",
                "tertiary-border": "var(--ls-tertiary-border-color)",
                text: "var(--ls-primary-text-color)",
                "secondary-text": "var(--ls-secondary-text-color)",
                highlight: "var(--ls-block-highlight-color)",
                "menu-hover": "var(--ls-menu-hover-color)",
                primary: "hsl(var(--primary, --ls-button-background)/.9)",
                secondary: "hsl(var(--secondary)/.9)",
                tertiary: "hsl(var(--tertiary)/.9)"
            }
        }
    },
    plugins: []
};
