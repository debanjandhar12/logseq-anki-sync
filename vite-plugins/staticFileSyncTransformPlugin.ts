import * as fs from "fs";
import * as path from "path";
import type {Plugin} from "vite";

const {parseSync, traverse} = require("@babel/core");
const generate = require("@babel/generator").default;

const SCRIPT_FILE_REGEX = /\.(js|ts|tsx|jsx|mjs)(\?.*)?$/;

function getStaticStringValue(node: {type: string; value?: unknown}): string | null {
    return node.type === "StringLiteral" && typeof node.value === "string" ? node.value : null;
}

export function staticFileSyncTransformPlugin(): Plugin {
    return {
        name: "staticFileSyncTransformPlugin",
        enforce: "pre",
        transform: {
            filter: {
                id: SCRIPT_FILE_REGEX,
                code: "readFileSync"
            },
            handler(code, id) {
                let currentDirectory = path.dirname(id);
                if (currentDirectory.includes("node_modules/.vite")) {
                    // We are in a vite cache folder. We need original path.
                    currentDirectory = path.join(
                        __dirname,
                        "/node_modules/",
                        path.parse(path.basename(id)).name
                    );
                }
                const ast = parseSync(code, {
                    sourceType: "module",
                    parserOpts: {plugins: ["typescript", "jsx"]}
                });
                traverse(ast, {
                    Identifier(nodePath) {
                        if (nodePath.node.name === "__dirname") {
                            nodePath.replaceWithSourceString(JSON.stringify(currentDirectory));
                        }
                    }
                });
                traverse(ast, {
                    CallExpression(nodePath) {
                        const {callee, arguments: args} = nodePath.node;
                        if (
                            callee.type === "MemberExpression" &&
                            callee.object.name === "path" &&
                            callee.property.name === "join"
                        ) {
                            const pathParts = args.map(getStaticStringValue);

                            if (pathParts.some((part) => part == null)) {
                                return;
                            }

                            nodePath.replaceWithSourceString(JSON.stringify(path.join(...pathParts)));
                        }
                    }
                });
                traverse(ast, {
                    CallExpression(nodePath) {
                        const {callee, arguments: args} = nodePath.node;
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
                            } catch (error) {
                                console.error(error);
                            }
                        }
                    }
                });
                const generated = generate(
                    ast,
                    {retainLines: true, sourceMaps: true, sourceFileName: id},
                    code
                );
                return {code: generated.code, map: generated.map};
            }
        }
    };
}
