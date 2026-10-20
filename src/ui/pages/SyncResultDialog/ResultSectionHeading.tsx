export function ResultSectionHeading({title}: {title: string}) {
    return (
        <div
            className="p-4"
            style={{
                backgroundColor: "var(--ls-tertiary-background-color)",
                borderRadius: "0.25rem",
                cursor: "pointer",
                marginTop: "0.5rem",
                marginBottom: "0.5rem",
                padding: "0.25rem 0.5rem",
                userSelect: "none",
                zIndex: 1
            }}>
            {title}
        </div>
    );
}
