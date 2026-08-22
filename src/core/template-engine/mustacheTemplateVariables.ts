export interface MustacheTemplateVariableDefinition {
    canonicalName: string;
    aliases: readonly string[];
    description: string;
    weekdayIndex?: number;
}

const WEEKDAY_VARIABLES: readonly MustacheTemplateVariableDefinition[] = [
    ["Sunday", 0],
    ["Monday", 1],
    ["Tuesday", 2],
    ["Wednesday", 3],
    ["Thursday", 4],
    ["Friday", 5],
    ["Saturday", 6]
].map(([weekday, weekdayIndex]) => ({
    canonicalName: `last${weekday}`,
    aliases: [`last ${String(weekday).toLowerCase()}`],
    description: `The previous ${weekday}`,
    weekdayIndex: Number(weekdayIndex)
}));

export const MUSTACHE_TEMPLATE_VARIABLES: readonly MustacheTemplateVariableDefinition[] = [
    {
        canonicalName: "globalAgentInstruction",
        aliases: ["additionalSystemMessage", "additional system message"],
        description: "Global agent instruction from plugin settings"
    },
    {
        canonicalName: "currentPage",
        aliases: ["current page"],
        description: "UUID of the current Logseq page"
    },
    {
        canonicalName: "currentEditingBlock",
        aliases: ["current editing block"],
        description: "UUID of the block currently being edited"
    },
    {
        canonicalName: "modelInvokableSkillList",
        aliases: ["model invokable skill list"],
        description: "Names and descriptions of skills available to the model"
    },
    {
        canonicalName: "chatAppAgentToolResultMaxChar",
        aliases: [],
        description: "Maximum tool-result size in characters"
    },
    {canonicalName: "time", aliases: [], description: "Current local time"},
    {canonicalName: "today", aliases: [], description: "Today's date"},
    {canonicalName: "tomorrow", aliases: [], description: "Tomorrow's date"},
    {canonicalName: "yesterday", aliases: [], description: "Yesterday's date"},
    {canonicalName: "userTimeZone", aliases: [], description: "User's local time zone"},
    ...WEEKDAY_VARIABLES
];

export const SUPPORTED_MUSTACHE_TEMPLATE_VARIABLE_NAMES = new Set(
    MUSTACHE_TEMPLATE_VARIABLES.flatMap(({canonicalName, aliases}) => [
        canonicalName,
        ...aliases
    ]).map((name) => name.toLowerCase())
);

export function setMustacheTemplateVariable(
    view: Record<string, string>,
    canonicalName: string,
    value: string
): void {
    const definition = MUSTACHE_TEMPLATE_VARIABLES.find(
        (variable) => variable.canonicalName === canonicalName
    );
    if (!definition) throw new Error(`Unknown Mustache template variable: ${canonicalName}`);

    view[definition.canonicalName] = value;
    for (const alias of definition.aliases) view[alias] = value;
}
