import {ResultSectionHeading} from "./ResultSectionHeading";
import {DeleteErrorDetailsLink} from "./SyncErrorDetailsLink";

export function DeletedNotesSection({
    deletedNotes,
    failures
}: {
    deletedNotes: number[];
    failures: Record<number, Error>;
}) {
    return (
        <>
            <ResultSectionHeading title="Deleted" />
            <span style={{fontSize: "14px"}}>
                {deletedNotes.length > 0
                    ? `The ${deletedNotes.length} notes were deleted successfully`
                    : "No notes were deleted."}
                {Object.keys(failures).length > 0 ? (
                    <span>
                        The {Object.keys(failures).length} notes failed to delete
                        <DeleteErrorDetailsLink errors={failures} />
                    </span>
                ) : (
                    ""
                )}
            </span>
        </>
    );
}
