/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                borderColor: "var(--ls-border-color)",
                input: "var(--input)",
                ring: "var(--ring)",
                foreground: "var(--ls-primary-text-color, var(--lx-gray-11, var(--rx-gray-11)))",
                primary: {
                    DEFAULT: "var(--primary)",
                    background: "hsl(var(--primary, 200 97% 37%) / 0.9)",
                    foreground: "var(--ls-button-text-color, var(--lx-gray-1, var(--rx-gray-1)))",
                    borderColor: "var(--ls-border-color)",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    background: "var(--ls-secondary-background-color, hsl(var(--background)))",
                    border: "var(--ls-secondary-border-color)",
                    foreground: "var(--ls-secondary-text-color)",
                },
                tertiary: {
                    DEFAULT: "hsl(var(--tertiary)/.9)",
                    background: "var(--ls-tertiary-background-color)",
                    border: "var(--ls-tertiary-border-color)",
                },
                destructive: {
                    DEFAULT: "var(--destructive)",
                    foreground: "var(--destructive-foreground)"
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)"
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)"
                },
                popover: {
                    DEFAULT: "var(--popover)",
                    foreground: "var(--popover-foreground)"
                },
                highlight: "var(--ls-block-highlight-color)"
            }
        }
    },
    plugins: [require("tailwindcss-animate")]
};
