import path from "node:path";
import {normalizePath, type Plugin} from "vite";

const require = process.getBuiltinModule("node:module").createRequire(import.meta.url);
const {parseSync, traverse, types: t} = require("@babel/core");
const generate = require("@babel/generator").default;
// Build/runtime protocol shared with src/logger/applyLogSource.ts.
const LOG_SOURCE_KEY = "logseq-anki-sync.log-source";
const LOG_METHODS = new Set(["silly", "trace", "debug", "info", "warn", "error", "fatal"]);
const SCRIPT_FILE_REGEX = /\.[cm]?[jt]sx?(\?.*)?$/;

/** Record original call sites before TypeScript/JSX conversion and bundle minification. */
function transformLogSourceLocations(code: string, id: string, root: string) {
    const filename = id.split("?")[0];
    const sourceDirectory = path.resolve(root, "src");
    if (
        !normalizePath(filename).startsWith(`${normalizePath(sourceDirectory)}/`) ||
        !SCRIPT_FILE_REGEX.test(id) ||
        /[?&](?:raw|url|string)(?:&|$)/.test(id) ||
        !code.includes("logger")
    )
        return null;

    const loggerModules = new Set([
        path.join(sourceDirectory, "logger"),
        path.join(sourceDirectory, "logger/index"),
        path.join(sourceDirectory, "logger/logger")
    ]);
    const ast = parseSync(code, {
        sourceType: "module",
        parserOpts: {plugins: /\.[jt]sx$/.test(filename) ? ["typescript", "jsx"] : ["typescript"]}
    });
    let changed = false;
    traverse(ast, {
        CallExpression(callPath) {
            const {callee} = callPath.node;
            if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.object)) return;
            const method = callee.computed
                ? t.isStringLiteral(callee.property)
                    ? callee.property.value
                    : undefined
                : t.isIdentifier(callee.property)
                  ? callee.property.name
                  : undefined;
            if (!LOG_METHODS.has(method)) return;

            const binding = callPath.scope.getBinding(callee.object.name)?.path;
            if (
                !binding?.isImportSpecifier() ||
                !t.isIdentifier(binding.node.imported, {name: "logger"})
            )
                return;
            const importedModule = path
                .resolve(path.dirname(filename), binding.parent.source.value)
                .replace(/\.[cm]?[jt]sx?$/, "");
            if (!loggerModules.has(importedModule)) return;

            const source = `${normalizePath(path.relative(root, filename))}:${callPath.node.loc.start.line}`;
            callPath.node.arguments.unshift(
                t.objectExpression([
                    t.objectProperty(
                        t.callExpression(
                            t.memberExpression(
                                t.memberExpression(
                                    t.identifier("globalThis"),
                                    t.identifier("Symbol")
                                ),
                                t.identifier("for")
                            ),
                            [t.stringLiteral(LOG_SOURCE_KEY)]
                        ),
                        t.stringLiteral(source),
                        true
                    )
                ])
            );
            changed = true;
        }
    });
    if (!changed) return null;
    const result = generate(
        ast,
        {retainLines: true, sourceMaps: true, sourceFileName: filename},
        code
    );
    return {code: result.code as string, map: result.map};
}

export function logSourceLocationPlugin(): Plugin {
    let root = process.cwd();
    return {
        name: "log-source-location",
        enforce: "pre",
        configResolved(config) {
            root = config.root;
        },
        transform: {
            filter: {id: SCRIPT_FILE_REGEX, code: "logger"},
            handler(code, id) {
                return transformLogSourceLocations(code, id, root);
            }
        }
    };
}
