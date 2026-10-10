import {defineCommand} from "just-bash";
import {VIR_ENV_HOSTNAME, VIR_ENV_USER} from "../../../constants";

/** Override just-bash's fixed identity commands with the shared virtual constants. */
export const virtualIdentityCommands = [
    defineCommand("whoami", async () => ({
        stdout: `${VIR_ENV_USER}\n`,
        stderr: "",
        exitCode: 0
    })),
    defineCommand("hostname", async () => ({
        stdout: `${VIR_ENV_HOSTNAME}\n`,
        stderr: "",
        exitCode: 0
    }))
];
