import * as React from 'react';
import * as ReactDOM from 'react-dom';

export {};
declare global {
    interface Window {
        ReactDOM: any;
        LogseqAnkiSync: any;
        fabric: any;
        Image: any;
        AnkiConnect: any;
        logseq: {
            api: any;
            Experiments: {
                React: typeof React;
                ReactDOM: typeof ReactDOM;
            };
        };
    }
}
