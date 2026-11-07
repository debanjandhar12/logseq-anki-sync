import ARROW_RIGHT_ICON from "@tabler/icons/outline/arrow-right.svg?raw";
import {TablerIcon} from "../../components/TablerIcon";
import {AnkiLink} from "./AnkiLink";
import {LogseqLink} from "./LogseqLink";

export interface DisplayNote {
    uuid: string;
    type: string;
    ankiId?: number;
}
interface NoteLineProps {
    note: DisplayNote;
    graphName: string;
}

export const CreateLineDisplay = ({note, graphName}: NoteLineProps) => (
    <span className="inline-flex items-center" style={{fontSize: "14px"}}>
        <span className="opacity-50 px-1" style={{userSelect: "none", flexShrink: "0"}}>
            [{note.type}]
        </span>
        <span className="truncate">
            <LogseqLink uuid={note.uuid} graphName={graphName} />
        </span>
        <TablerIcon icon={ARROW_RIGHT_ICON} style={{padding: "0 4px"}} />
        <span style={{flexShrink: "0"}}>
            <AnkiLink />
        </span>
    </span>
);

export const UpdateLineDisplay = ({note, graphName}: NoteLineProps) => (
    <span className="inline-flex items-center" style={{fontSize: "14px"}}>
        <span className="opacity-50 px-1" style={{userSelect: "none", flexShrink: "0"}}>
            [{note.type}]
        </span>
        <span className="truncate">
            <LogseqLink uuid={note.uuid} graphName={graphName} />
        </span>
        {note.ankiId && (
            <>
                <TablerIcon icon={ARROW_RIGHT_ICON} style={{padding: "0 4px"}} />
                <span style={{flexShrink: "0"}}>
                    <AnkiLink ankiId={note.ankiId} />
                </span>
            </>
        )}
    </span>
);

export const DeleteLineDisplay = ({ankiId}: {ankiId: number}) => (
    <span className="inline-flex items-center" style={{fontSize: "14px"}}>
        <AnkiLink ankiId={ankiId} />
    </span>
);
