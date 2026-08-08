/** Home directory of the just-bash sandbox and base for plugin storage mounts. */
export const JUST_BASH_USER_HOME = "/home/user";

/** Access granted to a Logseq plugin storage folder mounted in the sandbox. */
export type JustBashMountPermission = "read" | "readwrite";
