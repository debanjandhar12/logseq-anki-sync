import {logseqColor} from "./logseqColor.mjs";

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--ls-font-family, Inter)", "sans-serif"],
                mono: ["MonoLisa"]
            },
            colors: {
                border: logseqColor("--ls-border-color", "hsl(var(--border, 214.3 31.8% 91.4%))"),
                input: logseqColor(
                    "--ls-secondary-border-color",
                    "hsl(var(--input, 214.3 31.8% 91.4%))"
                ),
                ring: logseqColor("--ls-link-text-color", "hsl(var(--ring, 200 97% 37%))"),
                background: logseqColor(
                    "--ls-primary-background-color",
                    "hsl(var(--background, 0 0% 100%))"
                ),
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
                        "hsl(var(--secondary))"
                    ),
                    background: logseqColor(
                        "--ls-secondary-background-color",
                        "hsl(var(--background))"
                    ),
                    border: logseqColor("--ls-secondary-border-color", "hsl(var(--border))"),
                    foreground: logseqColor(
                        "--ls-secondary-text-color",
                        "hsl(var(--secondary-foreground))"
                    )
                },
                tertiary: {
                    DEFAULT: logseqColor("--ls-tertiary-background-color", "hsl(var(--tertiary))"),
                    background: logseqColor(
                        "--ls-tertiary-background-color",
                        "hsl(var(--tertiary))"
                    ),
                    border: logseqColor("--ls-tertiary-border-color", "hsl(var(--border))")
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
                    DEFAULT: logseqColor(
                        "--ls-secondary-background-color",
                        "hsl(var(--muted, 210 40% 96.1%))"
                    ),
                    foreground: logseqColor(
                        "--ls-secondary-text-color",
                        "hsl(var(--muted-foreground, 215.4 16.3% 46.9%))"
                    )
                },
                accent: {
                    DEFAULT: logseqColor(
                        "--ls-menu-hover-color",
                        "hsl(var(--accent, 210 40% 96.1%))"
                    ),
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
    }
};
