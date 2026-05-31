import * as path from "path";
import * as fs from "fs";
const { parseSync, traverse } = require("@babel/core");
const generate = require("@babel/generator").default;

function getStaticStringValue(node: { type: string; value?: unknown }): string | null {
    return node.type === "StringLiteral" && typeof node.value === "string" ? node.value : null;
}

export function staticFileSyncTransformPlugin() {
    return {
        name: "staticFileSyncTransformPlugin",
        enforce: "pre" as const,
        transform(code, id) {
            if (!/\.(js|ts|tsx|jsx|mjs)(\?.*)?$/.test(id) || !code.includes("readFileSync")) {
                return null;
            }
            let curDir = path.dirname(id);
            if (curDir.includes("node_modules/.vite")) {
                // We are in a vite cache folder. We need original path.
                curDir = path.join(
                    __dirname,
                    "/node_modules/",
                    path.parse(path.basename(id)).name,
                );
            }
            const ast = parseSync(code, { sourceType: "module" });
            traverse(ast, {
                Identifier(nodePath) {
                    if (nodePath.node.name === "__dirname") {
                        nodePath.replaceWithSourceString(JSON.stringify(curDir));
                    }
                },
            });
            traverse(ast, {
                CallExpression(nodePath) {
                    const { callee, arguments: args } = nodePath.node;
                    if (
                        callee.type === "MemberExpression" &&
                        callee.object.name === "path" &&
                        callee.property.name === "join"
                    ) {
                        const pathParts = args.map(getStaticStringValue);

                        if (pathParts.some((part) => part == null)) {
                            return;
                        }

                        nodePath.replaceWithSourceString(
                            JSON.stringify(path.join(...pathParts)),
                        );
                    }
                },
            });
            traverse(ast, {
                CallExpression(nodePath) {
                    const { callee, arguments: args } = nodePath.node;
                    if (
                        callee.type === "MemberExpression" &&
                        callee.object.name === "fs" &&
                        callee.property.name === "readFileSync"
                    ) {
                        const filePath = getStaticStringValue(args[0]);

                        if (filePath == null) {
                            return;
                        }

                        try {
                            const fileContents = fs.readFileSync(filePath, "utf-8");
                            nodePath.replaceWithSourceString(JSON.stringify(fileContents));
                        } catch (e) {
                            console.error(e);
                        }
                    }
                },
            });
            const generated = generate(ast, { retainLines: true, sourceMaps: true, sourceFileName: id }, code);
            code = generated.code;
            const map = generated.map;
            return { code, map };
        },
    };
}
