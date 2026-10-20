import {useEffect, useState} from "react";

function useNoteGroupSelection(length: number) {
    const [selection, setSelection] = useState<boolean[]>(() => new Array(length).fill(true));
    const checkbox = selection.every(Boolean)
        ? "checked"
        : selection.some(Boolean)
          ? "indeterminate"
          : "unchecked";
    const toggleAll = () => setSelection(new Array(length).fill(checkbox !== "checked"));
    return {selection, setSelection, checkbox, toggleAll};
}

export function useSyncSelection(toCreateNotes: any[], toUpdateNotes: any[], toDeleteNotes: any[]) {
    const create = useNoteGroupSelection(toCreateNotes.length);
    const update = useNoteGroupSelection(toUpdateNotes.length);
    const deletion = useNoteGroupSelection(toDeleteNotes.length);
    const [currentPage, setCurrentPage] = useState<{uuid: string} | null>(null);
    useEffect(() => {
        void logseq.Editor.getCurrentPage().then(setCurrentPage);
    }, []);
    const selectGroups = (created: boolean, updated: boolean, deleted: boolean) => {
        create.setSelection(new Array(toCreateNotes.length).fill(created));
        update.setSelection(new Array(toUpdateNotes.length).fill(updated));
        deletion.setSelection(new Array(toDeleteNotes.length).fill(deleted));
    };
    const selectionMenu = [
        {title: "Select All", onClick: () => selectGroups(true, true, true)},
        {title: "Select None", onClick: () => selectGroups(false, false, false)},
        {title: "Select New Notes Only", onClick: () => selectGroups(true, false, false)}
    ];
    if (currentPage)
        selectionMenu.push({
            title: "Select Current Page Notes",
            onClick: () => {
                create.setSelection(
                    toCreateNotes.map((note) => note.page.uuid === currentPage.uuid)
                );
                update.setSelection(
                    toUpdateNotes.map((note) => note.page.uuid === currentPage.uuid)
                );
                deletion.setSelection(new Array(toDeleteNotes.length).fill(false));
            }
        });
    return {
        toCreateNotesSelection: create.selection,
        setToCreateNotesSelection: create.setSelection,
        toCreateNotesCheckbox: create.checkbox,
        handleCreateNotesCheckboxClick: create.toggleAll,
        toUpdateNotesSelection: update.selection,
        setToUpdateNotesSelection: update.setSelection,
        toUpdateNotesCheckbox: update.checkbox,
        handleUpdateNotesCheckboxClick: update.toggleAll,
        toDeleteNotesSelection: deletion.selection,
        setToDeleteNotesSelection: deletion.setSelection,
        toDeleteNotesCheckbox: deletion.checkbox,
        handleDeleteNotesCheckboxClick: deletion.toggleAll,
        selectionMenu
    };
}
