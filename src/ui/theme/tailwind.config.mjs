import {logseqColor} from "./logseqColor.mjs";

const backgroundColor = logseqColor(
    "--ls-primary-background-color",
    "hsl(var(--background, 0 0% 100%))"
);
const mutedColor = logseqColor(
    "--ls-secondary-background-color",
    "hsl(var(--muted, 210 40% 96.1%))"
);
const accentColor = logseqColor("--ls-menu-hover-color", "hsl(var(--accent, 210 40% 96.1%))");

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--ls-font-family, Inter)", "sans-serif"],
                mono: ["MonoLisa", "monospace"]
            },
            colors: {
                border: logseqColor("--ls-border-color", "hsl(var(--border, 214.3 31.8% 91.4%))"),
                input: logseqColor(
                    "--ls-secondary-border-color",
                    "hsl(var(--input, 214.3 31.8% 91.4%))"
                ),
                ring: logseqColor("--ls-link-text-color", "hsl(var(--ring, 200 97% 37%))"),
                background: backgroundColor,
                foreground: logseqColor(
                    "--ls-primary-text-color",
                    "var(--lx-gray-11, var(--rx-gray-11, hsl(var(--foreground, 222.2 84% 4.9%))))"
                ),
                primary: {
                    DEFAULT: logseqColor(
                        "--ls-button-background",
                        "hsl(var(--primary, 200 97% 37%))"
                    ),
                    background: logseqColor(
                        "--ls-button-background",
                        "hsl(var(--primary, 200 97% 37%))"
                    ),
                    foreground: logseqColor(
                        "--ls-button-text-color",
                        "var(--lx-gray-1, var(--rx-gray-1, hsl(var(--primary-foreground, 210 40% 98%))))"
                    ),
                    border: logseqColor(
                        "--ls-border-color",
                        "hsl(var(--border, 214.3 31.8% 91.4%))"
                    )
                },
                secondary: {
                    DEFAULT: logseqColor(
                        "--ls-secondary-background-color",
                        "hsl(var(--secondary, 210 40% 96.1%))"
                    ),
                    background: logseqColor(
                        "--ls-secondary-background-color",
                        "hsl(var(--secondary, 210 40% 96.1%))"
                    ),
                    border: logseqColor(
                        "--ls-secondary-border-color",
                        "hsl(var(--border, 214.3 31.8% 91.4%))"
                    ),
                    foreground: logseqColor(
                        "--ls-secondary-text-color",
                        "hsl(var(--secondary-foreground, 222.2 47.4% 11.2%))"
                    )
                },
                tertiary: {
                    DEFAULT: logseqColor(
                        "--ls-tertiary-background-color",
                        "hsl(var(--tertiary, 210 40% 96.1%))"
                    ),
                    background: logseqColor(
                        "--ls-tertiary-background-color",
                        "hsl(var(--tertiary, 210 40% 96.1%))"
                    ),
                    border: logseqColor(
                        "--ls-tertiary-border-color",
                        "hsl(var(--border, 214.3 31.8% 91.4%))"
                    )
                },
                destructive: {
                    DEFAULT: logseqColor(
                        "--ls-error-color",
                        "hsl(var(--destructive, 0 84.2% 60.2%))"
                    ),
                    foreground: logseqColor(
                        "--ls-button-text-color",
                        "hsl(var(--destructive-foreground, 210 40% 98%))"
                    )
                },
                muted: {
                    DEFAULT: mutedColor,
                    foreground: logseqColor(
                        "--ls-secondary-text-color",
                        "hsl(var(--muted-foreground, 215.4 16.3% 46.9%))"
                    )
                },
                accent: {
                    DEFAULT: accentColor,
                    foreground: logseqColor(
                        "--ls-primary-text-color",
                        "hsl(var(--accent-foreground, 222.2 47.4% 11.2%))"
                    )
                },
                popover: {
                    DEFAULT: logseqColor(
                        "--ls-secondary-background-color",
                        "hsl(var(--popover, 0 0% 100%))"
                    ),
                    foreground: logseqColor(
                        "--ls-primary-text-color",
                        "hsl(var(--popover-foreground, 222.2 84% 4.9%))"
                    )
                },
                highlight: logseqColor("--ls-block-highlight-color", "hsl(var(--accent))")
            }
        }
    },
    plugins: [
        ({addBase}) => {
            addBase({
                ":root, :host": {
                    "--color-background": backgroundColor,
                    "--color-muted": mutedColor,
                    "--color-accent": accentColor
                }
            });
        }
    ]
};
