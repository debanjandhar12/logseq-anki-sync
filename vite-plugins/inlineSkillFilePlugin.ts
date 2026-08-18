import fs from "node:fs";
import path from "node:path";
import type {Plugin} from "vite";

const INCLUDE_FILE_TAG_REGEX = /<%\s*#includeFile\s*%>([\s\S]*?)<%\s*\/includeFile\s*%>/g;

function inlineIncludedFiles(code: string, dir: string): string {
    return code.replace(INCLUDE_FILE_TAG_REGEX, (_match, filePathText: string) => {
        const filePath = filePathText.trim();
        const fullPath = path.resolve(dir, filePath);

        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath, "utf-8").trim();
        }

        console.warn(`[inlineSkillFilePlugin] File not found: ${fullPath}`);
        return "";
    });
}

export function inlineSkillFilePlugin(): Plugin {
    return {
        name: "inline-skill-file",
        load(id) {
            if (id.includes(".md?inlineSkill")) {
                const basePath = id.split("?")[0];
                let code = "";
                
                try {
                    code = fs.readFileSync(basePath, "utf-8");
                } catch (e) {
                    return null;
                }

                if (!code.includes("<%")) {
                    return {
                        code: `export default ${JSON.stringify(code)};`,
                        map: null,
                        moduleType: "js"
                    };
                }

                const dir = path.dirname(basePath);
                const rendered = inlineIncludedFiles(code, dir);

                return {
                    code: `export default ${JSON.stringify(rendered)};`,
                    map: null,
                    moduleType: "js"
                };
            }
            return null;
        }
    };
}
