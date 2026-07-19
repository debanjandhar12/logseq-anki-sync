import {Suggestions} from "@assistant-ui/core/store";

const ALL_SUGGESTIONS = [
    {
        title: "What are my remaining tasks marked as",
        label: "TODO?",
        prompt: "What are my remaining tasks marked as TODO?"
    },
    {
        title: "Summarize my",
        label: "recent journal entries",
        prompt: "Summarize my recent journal entries"
    },
    {
        title: "List pages tagged with",
        label: "#Project",
        prompt: "List all pages tagged with #Project"
    }
];

export const getSuggestions = () =>
    Suggestions([ALL_SUGGESTIONS[Math.floor(Math.random() * ALL_SUGGESTIONS.length)]]);
