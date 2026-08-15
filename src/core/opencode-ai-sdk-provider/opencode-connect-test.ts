import type {Session, SessionPromptResponse} from "@opencode-ai/sdk";
import {createOpencodeClient} from "@opencode-ai/sdk";

const OPENCODE_SERVER_URL = "http://127.0.0.1:4096";

export const opencodeConnectTest = async (): Promise<SessionPromptResponse> => {
    const client = createOpencodeClient({baseUrl: OPENCODE_SERVER_URL,});

    await client.config.update({
        body: {
            tools: {
                bash: false,
                skill: false,
                todowrite: false,
                question: false,
                edit: false,
                read: false,
                webfetch: false,
                websearch: false
            },
            permission: {
                bash: "deny",
                edit: "deny",
                webfetch: "deny",
                doom_loop: "deny",
                external_directory: "deny"
            }
        }
    });

    let session: Session | undefined;

    try {
        const sessionResponse = await client.session.create({throwOnError: true});
        session = sessionResponse.data;

        const promptResponse = await client.session.prompt({
            path: {id: session.id},
            body: {
                parts: [
                    {
                        type: "text",
                        text: "Hello! Reply with a short test message."
                    }
                ]
            },
            throwOnError: true
        });

        return promptResponse.data;
    } finally {
        if (session) {
            await client.session.delete({path: {id: session.id}});
        }
    }
};
