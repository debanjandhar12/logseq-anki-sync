# Shadcn Development Guidelines
This contains the main chat app. The components contain modified shadcn / assistant-ui components.


## How shadcn / assistant-ui are maintained
- The `src/shadcn` folder only contains original components from registries.
- When we need to modify a component, we copy that code to `src/chat-app/components`, and modify it.
- Doing above might require copying some other components for decomposition.
- We maintain the changes made as comments in the original code.

# Notes
- Chat App specific css can be added in `src/chat-app/styles/main.css`.

# Gotchas
- 