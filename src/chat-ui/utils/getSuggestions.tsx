import {Suggestions} from "@assistant-ui/core/store";

export const getSuggestions = () =>
    Suggestions([
        {
            title: "What are the tasks scheduled",
            label: "for today?",
            prompt: "What are the tasks scheduled for today?"
        }
    ]);
