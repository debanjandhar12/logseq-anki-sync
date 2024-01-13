// vitest.config.ts
export default {
    test: {
        include: ['**/*.test.ts'],
        exclude: ['**/logseq-dev-plugin/**', '**/node_modules/**'],
        alias: {
            '@logseq/libs': 'sass',
        }
    }
}