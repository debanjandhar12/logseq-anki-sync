module.exports = {
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "react"],
    extends: [
        "eslint:recommended",
        "plugin:import/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "prettier",
    ],
    root: true,
    env: {
        node: true,
        browser: true,
    },
    settings: {
        "import/resolver": {
            node: {
                extensions: [".js", ".jsx", ".ts", ".tsx"],
                moduleDirectory: ["node_modules", "src/"],
            },
        },
    },
    rules: {
        "@typescript-eslint/ban-ts-comment": "warn",
        "max-len": ["error", {code: 96}],
        "function-call-argument-newline": ["error", {minItems: 3}],
        "function-paren-newline": ["error", {minItems: 3}],
    },
    ignorePatterns: ["dist/*"],
};
