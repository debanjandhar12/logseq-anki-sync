declare module "*?string" {
    const value: string;
    export default value;
}

// Type declaration for CSS imports with ?inline suffix
declare module "*.css?inline" {
    const content: string;
    export default content;
}

declare module "*?inlineSkill" {
    const content: string;
    export default content;
}
