/**
 * Strips use client directives used mainly by assistant-ui components.
 * This is required to suppress vite warnnings during build.
 */
export function stripUseClientDirectivePlugin() {
    return {
        name: "strip-use-client-directive",
        enforce: "pre" as const,
        transform(code: string) {
            if (!/^(['"])use client\1;?\s*$/m.test(code)) {
                return null;
            }

            return {
                code: code.replace(/^(['"])use client\1;?\s*$/m, ""),
                map: null
            };
        }
    };
}
