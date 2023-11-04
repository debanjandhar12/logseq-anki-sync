export class UI {
    public static init() {
        logseq.provideStyle(`
        .reduce-opacity-when-disabled:disabled {
            opacity: 0.5;
        }
        .not-allowed-cursor-when-disabled:disabled {
            cursor: not-allowed;
        }
        .anki_ui_link_button {
            background-color: transparent;
            opacity: 0.8;
        }
        
        .anki_de .menu-list {
          font-size: 10px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border-radius: 0.25rem;
          position: absolute;
          display: none;
          list-style: none;
          overflow: hidden;
          margin: 0;
          padding: 0;
          background-color: var(--ls-primary-background-color);
          top: 33px;
          right: 31px;
          width: 200px;
          z-index:999;
        }
        .anki_de:hover > .menu-list {
            opacity: .9;
            display: block;
        }
        
        .anki_de .menu-list > li {
          margin: 0;
          padding: 5px;
          transition: background-color .2s;
          user-select: none;
        }
        
        .anki_de .menu-list > li:hover {
          background-color: var(--ls-quaternary-background-color);
          cursor: pointer;
        }
        `);
    }
}