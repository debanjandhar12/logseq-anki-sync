import ReactDOM from './ReactDOM';
import {LogseqProxy} from "../logseq/LogseqProxy";
import { waitForElement } from '../utils/waitForElement';

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
        
        .logseq-icon {
          width: 1em;
          height: 1em;
          display: inline-block;
          background-size: cover;
          background-image: url("data:image/svg+xml,%3Csvg width='1em' height='1em' viewBox='0 0 128 128' id='svg16' sodipodi:docname='logseq_icon_simple.svg' inkscape:version='1.1.2 (0a00cf5339, 2022-02-04)' xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape' xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns%23' xmlns:cc='http://creativecommons.org/ns%23' xmlns:dc='http://purl.org/dc/elements/1.1/'%3E%3Crect x='4.55' y='4.837' width='118.9' height='118.33' enable-background='new' fill='%23002b34' stroke-width='1.0408' style='' id='rect4'/%3E%3Cg transform='translate(249.20942,50.168715)' fill='%2386c8c8' id='g14'%3E%3Cpath transform='rotate(41.244)' d='m -156.95,133.24 a 17.127,15.341 0 0 1 -17.095,15.341 17.127,15.341 0 0 1 -17.158,-15.285 17.127,15.341 0 0 1 17.033,-15.397 17.127,15.341 0 0 1 17.22,15.229' id='path8'/%3E%3Cellipse cx='-174.02' cy='30.698' rx='38.706001' ry='30.240999' id='ellipse10'/%3E%3Cellipse transform='matrix(0.98259,-0.18578,0.15255,0.9883,0,0)' cx='-172.09' cy='-55.007999' rx='16.385' ry='10.568' id='ellipse12'/%3E%3C/g%3E%3C/svg%3E");
        }
        
        .anki-icon {
          width: 1em;
          height: 1em;
          display: inline-block;
          background-size: cover;
          background-image: url("data:image/svg+xml,%3Csvg width='1em' height='1em' enable-background='new 0 0 1024 1024' image-rendering='optimizeSpeed' viewBox='0 0 1024 1024' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3E%3Cpath d='m966.1 378.45c-1-3.4-2-6.85-3.15-10.5-1.6-5.15-3.4-10.5-5.3-15.85-6.45-18.25-14.15-36.05-23.15-53.65-3.8-7.4-7.95-14.95-12.3-22.4-20.3-34.5-45.8-67.2-76.35-97.75-72.6-72.6-157.15-116.65-253.65-132.05-16.25-2.6-32.8-4.4-50.05-5.35-9.7-.55-19.85-.85-30.1-.85-9.35 0-18.6.25-27.9.75-118.35 6.1-220.3 51.95-305.85 137.5q-138.25 138.25-138.25 333.75c0 130.35 46.1 241.65 138.25 333.8 56.7 56.65 120.55 95.9 191.1 117.55 36.75 11.25 74.8 17.85 114.75 19.95h.4c8.5.45 16.6.7 24.5.7h3c10.3 0 20.5-.3 30.1-.8 2.5-.15 4.75-.3 6.95-.45 20.2-1.45 39.9-4.05 58.7-7.7 7.95-1.55 15.8-3.3 23.4-5.15 80.8-20.3 152.15-61.6 214.65-124.1 48.6-48.6 84.4-102.5 107.35-161.8 18.45-47.65 28.65-98.8 30.55-153.5.2-6.05.3-12.25.3-18.5 0-.65 0-1.35 0-2 0-.35 0-.65 0-1-.2-40.65-4.95-79.5-14.3-117-1.1-4.35-2.35-9-3.65-13.6z' fill='%236f6f6f'/%3E%3Cpath fill='%23cee0eb' d='m706.55 194.55c-.85 1.5-1.6 2.55-2 3.3-.35.4-.6.7-.65 1-.25.35-.45.8-.5 1.1-.35.35-.65.85-1.1 1.6-.3.7-.55 1.2-.8 1.6-3.2 6.15-6.15 13.1-8.95 20.9-2.1 5.75-4.45 12.95-7 21.7-.1.25-.2.6-.2 1-.2.6-.5 1.3-.7 2.2-.45 1.55-.6 2.3-.6 2.35-.25.35-.4.75-.5 1.35-.05.3-.15.8-.25 1.4-.3.45-.4.95-.3 1.35-.4.45-.55 1.1-.5 1.9-.25.1-.35.3-.35.6v.65c-.15.15-.2.4-.3.8-.1.25-.1.5-.15.9-.25.4-.35.75-.35 1.1l-.25.8c-.05.55-.15.9-.15 1.1-.2.2-.35.35-.55.5-.45-.05-.75-.05-1.1 0-.3-.05-.6-.2-.8-.3-.35 0-.6 0-.75-.05-.25 0-.4 0-.65.05-.25 0-.5 0-.65-.05-.25 0-.5.05-.65.15-.4-.45-.85-.5-1.05-.35-.75-.1-1.5-.1-2.25 0-.5-.4-1.05-.5-1.8-.25-.65-.05-1.15-.15-1.45-.25-.6-.05-1.15-.05-1.6 0-2.1-.25-4.9-.4-8.35-.5-4.4-.15-7.2-.2-8.45-.3-3.1-.1-5.35-.2-6.75-.2-2.55 0-4.85.1-6.8.35-4.85 0-9.1.25-12.9.85-5.3.35-9.65 1.15-13.15 2.2-2.55.4-4.5 1-5.9 1.9-.95.2-1.75.5-2.5.85-.8.45-1.55.9-2.1 1.5-.65.25-1.3.75-2 1.4-.2.25-.7.8-1.6 1.8-1.8 2.35-2.15 5.75-1 9.9l.2.1c.05.55.3 1.3.7 2.1l1 2.05.25.1c.25.55.55 1.2 1.05 1.95.25.45.65 1 1.25 1.9.05.1.3.25.55.65.15.4.4.6.65.6.25.55.7 1.1 1.35 1.85.8.9 1.25 1.45 1.55 1.75.4.3 1.2 1.3 2.5 2.85 1.1 1.25 2 2.05 2.9 2.45.75.9 1.6 1.8 2.7 2.8.4.4 1.35 1.2 2.95 2.55 9.1 7.95 19.25 15.55 30.35 22.7 1.1 1.05 2.35 1.75 3.65 2.25.4.5 1.05 1 2.05 1.4.15.25.4.4.8.6.1.05.3.2.9.5.15.2.35.3.4.4.2.15.35.25.55.15.15.25.2.4.45.5.15.05.4.25.65.3.1.2.15.35.4.4.1 0 .35.1.7.2.05.15.15.3.35.45.2.1.45.2.7.3l.55.2c.25.25.3.4.3.5.15.2 0 .35-.05.55-.15.15-.3.2-.4.45s-.1.4-.1.65c-.25.25-.3.5-.25.8-.25.1-.4.15-.45.45-.1.2-.1.4 0 .65-.3.25-.45.45-.45.8-.15.1-.35.3-.4.6-.1.2-.1.45 0 .7-.4.1-.55.5-.65 1.15-.25.25-.4.6-.5 1-.15.4-.25.75-.25 1.05-.65.75-1.15 1.9-1.4 3.35-.4.5-.75 1.25-1.05 2.2-.4 1.25-.75 2-.9 2.35-3.75 9.9-7 19.65-9.6 29.05-.05.55-.5 2.05-1.05 4.25-.5 1.75-.75 3.2-.8 4.35h-.25c-.25 1.55-.6 3.95-1.15 6.95-.45 2.75-.5 5-.45 7-.15 1.4-.15 2.85 0 4.3-.05.35-.05.85.1 1.4.2.75.25 1.25.25 1.55 0 .1.1.45.15 1.15.1.5.25.85.5 1.1.1.9.35 1.8.9 2.8.35.55.9 1.3 1.75 2.35.95 1.25 2.3 2.05 4 2.55 1.4.45 3.05.65 4.75.55.5 0 1.25-.1 2.2-.25 1-.15 1.75-.25 2.25-.25l.05-.25c1.8-.05 3.1-.45 4-1.05.25 0 .45 0 .65-.05.1-.1.35-.2.65-.3 3.45-1.2 7.05-2.85 10.85-4.8.05-.1.4-.25 1.15-.55.45-.3.8-.5.95-.75.9-.45 1.9-.9 3.05-1.6 1.25-.7 2.25-1.3 2.8-1.7 3.4-2.05 7.15-4.4 11.05-7.1 2.85-2 6.35-4.55 10.55-7.65.25-.15 1.95-1.35 5.1-3.75 2.05-1.55 3.7-2.9 4.85-4.05 1.2-.55 2.2-1.35 3-2.45.9-.4 1.5-.8 1.8-1.35.25-.1.6-.35.9-.6.45-.4.65-.65.75-.75.25-.05.4-.15.65-.4.1-.1.15-.3.4-.65.5 0 1-.3 1.4-1.05.35-.15.55-.25.65-.3.25-.15.35-.3.4-.5.35-.2.65-.2 1.1-.1.05.25.15.45.3.65.25.25.45.25.65.15.1.35.35.6.6.65.4.75.95 1.15 1.6 1.25.1.25.3.5.5.65.2.25.35.4.6.5.1.25.3.4.6.55.15.1.35.25.8.5.15.35.4.65.8 1 .15.05.5.3 1.05.65.2.35.5.65.95 1 .2.15.55.4 1.05.8.25.1.55.4 1.05.9.4.4.8.75 1.25.8.05.25.25.45.45.6 9.1 7.45 17.8 13.85 26.25 19.25l6.55 4.1c2.55 1.45 4.75 2.6 6.8 3.45l.05.2c2.9 1.35 5.6 2.4 7.95 3.25.5.2 1.15.35 2 .35l.05.2c.5.05 1.35.25 2.4.5.9.15 1.7.2 2.4.15v.25c3.3.1 6.2-.65 8.4-2.15 1-.9 1.8-1.85 2.55-3.1.7-1.25 1.15-2.45 1.3-3.75.75-2.05 1.05-3.85.8-5.35.1-1.9.1-4.6 0-8.25l-.25-.1c.1-1.15-.05-2.55-.3-4.2-.4-2.7-.65-4-.65-4.1-1-5.65-2.4-11.7-4.25-18.15-1.4-4.9-3.2-10.85-5.55-17.8-.3-.55-.75-1.85-1.35-3.75-.55-1.55-1.05-2.7-1.45-3.6-.2-.65-.45-1.45-.85-2.55-.45-1.25-.8-2.05-.9-2.45l-.25-.1c-.05-.55-.15-.9-.25-1.15-.15-.5-.3-.8-.55-1-.1-.35-.1-.65-.1-.8-.1-.3-.25-.5-.4-.55-.05-.35-.05-.55-.15-.75-.1-.3-.2-.5-.4-.6 0-.3-.1-.6-.35-.9 0-.2 0-.5-.1-.7-.05-.35-.15-.5-.4-.6.1-.25-.05-.55-.35-.8.1-.15 0-.3-.05-.6-.1-.2-.25-.4-.4-.45l.25-1.1h.55v-.15c.35 0 .6-.05.85-.35.3-.2.5-.3.55-.3.25-.1.4-.25.5-.5.25 0 .55-.05.8-.25.25-.15.4-.3.5-.55.2-.1.4-.15.75-.35.3-.1.55-.25.65-.4.25-.05.5-.25.9-.5.4-.15.65-.3.75-.55.8-.25 1.55-.7 2.1-1.4.6-.15 1.15-.5 1.9-.9.1-.1.55-.5 1.65-1.25l.4-.15c5.8-3.7 10.8-7.05 15-10 5.25-3.75 9.95-7.45 14.25-11.05.45-.4 1.3-1.05 2.35-1.9.9-.7 1.65-1.45 2.15-2.2.4-.05.75-.35 1.15-.75.6-.65.95-1 1.05-1.05 1.9-1.85 3.2-3.25 3.95-4.05 1.45-1.55 2.6-3 3.5-4.3.6-.4 1.15-1.15 1.7-2.05.3-.5.7-1.2 1.25-2.3.45-.6.8-1.25 1.15-1.9.45-.75.65-1.45.75-2.1l.25-.1c.5-1.7.65-3.35.55-5-.05-1.8-.55-3.35-1.45-4.75-.65-.75-1.25-1.4-1.65-1.9-.7-.65-1.4-1.1-2.05-1.45-.9-.9-2.2-1.65-3.95-2.2-1.35-.65-2.25-1.05-2.55-1.15-.95-.4-1.85-.55-2.65-.7-.35-.2-.75-.35-1.25-.55-.55-.05-1.05-.15-1.4-.25-1.9-.45-3.35-.8-4.25-.95-1.7-.45-3.2-.6-4.45-.6-1.35-.4-3.1-.65-5.3-.9-2.4-.15-4.15-.35-5.3-.5-1.25-.05-3.05-.2-5.3-.3-2.4-.1-4.15-.2-5.2-.25-6.15 0-10.75 0-13.75 0-5.45 0-10 .05-13.8.35-.4-.1-.8 0-1.4.05-.55.1-.95.15-1.3.25-.3-.1-.75-.15-1.2-.15-.6.05-.9.05-1.15.05-.25-.05-.5-.05-.75 0-.25.1-.5.15-.65.35h-1.9c-.15-.1-.4-.2-.65-.1-.3.1-.6.1-.65.1-.3-.1-.6-.2-.65-.2-.35.1-.5.2-.5.45-.35-.1-.65-.1-1.05 0h-.85l-.7-.5c.05-.3.05-.6.05-.75 0-.25-.05-.4-.3-.5v-.75c0-.3-.1-.7-.35-1.2-.05-.4-.05-.65-.15-.85 0-.3-.1-.55-.25-.65 0-.55-.1-1.1-.35-1.55 0-.2 0-.4-.05-.65-.1-.3-.15-.55-.25-.65-.1-.45-.1-.8-.1-.9-.1-.4-.25-.65-.4-.8 0-1.1-.15-1.9-.55-2.65-.35-1.95-.75-3.5-1.25-4.65-2.15-9-5.25-18.85-9.25-29.55-1.55-3.9-2.65-6.5-3.3-8-1.3-2.9-2.6-5.45-3.9-7.6 0-.3-.1-.65-.35-.95-.25-.45-.5-.65-.55-.85-.9-1.45-1.55-2.55-2.05-3.25-.85-1.25-1.65-2.3-2.4-3.05l-.05-.5c-.3-.15-.85-.8-1.9-1.9-.75-.8-1.5-1.35-2.15-1.6-.55-.75-1.45-1.4-2.6-1.9-.65-.25-1.7-.6-3.1-.95-1.35-.2-2.7 0-4.2.35-1.2.45-2.45 1.1-3.7 2l-.05.25c-.4.1-.9.4-1.4.9-.65.65-1.05 1.05-1.15 1.15-.35.15-.65.5-1 .9-.3.5-.55.8-.8 1.05-.75.75-1.55 1.75-2.5 2.95zm-50 321.85c-1.1-.15-2.05-.35-2.65-.5-3.6-.9-6.4-1.55-8.1-1.85-3.3-.8-6.1-1.1-8.45-1.1-2.65-.8-5.9-1.25-10.1-1.7-4.55-.35-7.95-.65-10.15-.95-2.35-.15-5.75-.45-10-.6-4.65-.2-7.95-.35-9.95-.5-11.7 0-20.45 0-26.2 0-10.3 0-19 .15-26.2.65-.75-.15-1.55 0-2.65.15s-1.85.3-2.5.45c-.6-.15-1.4-.3-2.3-.3-1.1.15-1.75.15-2.2.15-.45-.15-.95-.15-1.4 0-.5.15-.95.3-1.25.6h-3.6c-.3-.15-.75-.3-1.25-.15-.6.15-1.1.15-1.25.15-.6-.15-1.1-.3-1.25-.3-.6.15-.9.3-.9.8-.65-.15-1.25-.15-2.05 0h-1.55l-1.4-.95c.15-.6.15-1.1.15-1.4 0-.45-.15-.8-.6-.95v-1.4c0-.6-.2-1.4-.65-2.3-.15-.8-.15-1.25-.3-1.6 0-.6-.15-1.05-.5-1.25 0-1.05-.15-2.15-.6-2.95 0-.45 0-.75-.15-1.25-.15-.6-.3-1.1-.45-1.25-.2-.9-.2-1.55-.2-1.7-.15-.8-.45-1.25-.75-1.55 0-2.05-.3-3.6-1.1-5-.6-3.75-1.4-6.7-2.35-8.9-4.05-17.15-9.95-35.85-17.6-56.25-2.95-7.35-5-12.35-6.25-15.15-2.5-5.6-5-10.45-7.45-14.5 0-.6-.2-1.25-.65-1.85-.45-.8-.95-1.25-1.1-1.55-1.7-2.8-2.95-4.85-3.9-6.25-1.55-2.35-3.1-4.35-4.5-5.75l-.15-.95q-.65-.45-3.6-3.6c-1.4-1.55-2.8-2.65-4.05-3.1-1.1-1.4-2.8-2.65-5-3.6-1.25-.45-3.25-1.1-5.9-1.85-2.5-.3-5.15 0-7.95.75-2.35.8-4.7 2.05-7.05 3.75l-.15.5c-.75.15-1.7.75-2.65 1.7-1.25 1.25-2 2-2.15 2.2-.65.3-1.25.9-1.9 1.7-.6.95-1.1 1.55-1.55 2-1.4 1.4-2.95 3.3-4.7 5.65-1.7 2.8-3.1 4.8-3.85 6.2-.65.8-1.1 1.4-1.25 1.9-.5.75-.8 1.55-.95 2.15-.65.65-1.25 1.6-2.05 3-.6 1.4-1.05 2.3-1.55 3.1-6.05 11.7-11.7 24.95-17 39.75-4.05 10.9-8.55 24.65-13.4 41.3-.15.5-.3 1.1-.3 1.9-.45 1.1-.95 2.5-1.4 4.2-.8 2.95-1.1 4.35-1.1 4.5-.45.65-.8 1.4-.95 2.5-.15.65-.3 1.55-.45 2.65-.6.95-.8 1.9-.6 2.65-.8.8-1.1 2.05-.95 3.6-.5.15-.65.6-.65 1.1v1.25c-.3.3-.45.75-.6 1.55-.15.45-.15.95-.3 1.7-.5.8-.65 1.4-.65 2.05l-.45 1.55c-.15 1.1-.3 1.7-.3 2.15-.35.35-.65.65-1.1.95-.8-.15-1.4-.15-2.05 0-.6-.15-1.1-.45-1.55-.6-.6 0-1.1 0-1.4-.15-.45 0-.8 0-1.25.15-.45 0-.95 0-1.25-.15-.45 0-.95.15-1.25.3-.75-.8-1.55-.95-2-.65-1.4-.15-2.85-.15-4.25 0-.9-.75-2-.9-3.4-.45-1.25-.15-2.2-.3-2.8-.45-1.1-.15-2.2-.15-3 0-4.05-.5-9.35-.8-15.9-.95-8.4-.3-13.7-.45-16.05-.65-5.9-.15-10.25-.3-12.9-.3-4.85 0-9.2.15-12.95.65-9.2 0-17.3.45-24.5 1.55-10.1.75-18.4 2.2-25.1 4.2-4.8.8-8.55 1.9-11.2 3.6-1.75.45-3.3.95-4.7 1.7-1.55.8-2.95 1.7-4.05 2.8-1.25.5-2.5 1.4-3.75 2.65-.45.5-1.4 1.55-3.1 3.45-3.45 4.5-4.05 10.9-1.85 18.85l.3.15c.15 1.1.6 2.5 1.4 4.05l1.85 3.9.5.15c.45 1.1 1.05 2.35 2 3.75.5.8 1.25 1.9 2.35 3.6.15.15.6.45 1.1 1.25.3.75.75 1.1 1.25 1.1.45 1.05 1.25 2.15 2.5 3.55 1.55 1.75 2.45 2.8 2.95 3.3.75.6 2.35 2.5 4.8 5.45 2.05 2.35 3.75 3.9 5.5 4.65 1.4 1.75 3.1 3.45 5.1 5.35.8.75 2.65 2.3 5.65 4.8 17.3 15.15 36.6 29.65 57.8 43.2 2.05 2 4.4 3.4 6.9 4.35.75.95 2 1.9 3.9 2.65.3.45.75.8 1.55 1.1.15.15.6.45 1.7.95.3.45.65.6.8.75.3.3.6.5 1.05.3.2.5.35.8.8.95.3.15.8.5 1.25.65.15.3.3.6.8.75.15 0 .6.15 1.25.3.15.35.3.65.75.95.3.15.8.3 1.25.5l1.1.45c.45.45.6.75.6.95.2.3 0 .6-.15 1.05-.3.2-.6.35-.75.8s-.15.8-.15 1.25c-.5.45-.65.95-.5 1.55-.45.15-.75.3-.9.8-.2.45-.2.75 0 1.25-.5.45-.8.9-.8 1.55-.3.15-.65.6-.8 1.1-.15.45-.15.9 0 1.4-.75.15-1.05.9-1.25 2.15-.45.5-.75 1.1-.9 1.9-.35.75-.5 1.4-.5 2-1.25 1.4-2.15 3.6-2.65 6.4-.75.95-1.4 2.35-2 4.2-.8 2.35-1.4 3.75-1.75 4.4-7.15 18.85-13.25 37.4-18.2 55.35-.15 1.05-.95 3.85-2.05 8.1-.95 3.25-1.4 6.05-1.55 8.25h-.45c-.5 2.95-1.1 7.5-2.2 13.25-.8 5.15-.95 9.5-.8 13.25-.3 2.65-.3 5.45 0 8.25-.15.65-.15 1.55.2 2.65.3 1.4.45 2.35.45 2.95 0 .2.15.8.3 2.2.15.95.45 1.55.95 2.05.15 1.7.6 3.4 1.7 5.3.65 1.05 1.7 2.5 3.3 4.5 1.85 2.35 4.35 3.9 7.6 4.85 2.65.9 5.8 1.25 9.05 1.1.95 0 2.35-.2 4.2-.5 1.9-.3 3.3-.45 4.25-.45l.15-.5c3.4-.15 5.9-.9 7.6-2 .5 0 .8 0 1.25-.15.2-.15.65-.3 1.25-.5 6.55-2.3 13.4-5.45 20.6-9.15.15-.2.75-.5 2.2-1.1.9-.5 1.55-.95 1.85-1.4 1.7-.8 3.6-1.75 5.75-3 2.35-1.4 4.25-2.5 5.3-3.25 6.55-3.9 13.6-8.4 21.05-13.55 5.45-3.75 12.15-8.6 20.1-14.5.5-.35 3.75-2.65 9.7-7.2 3.9-2.95 7-5.45 9.2-7.65 2.35-1.05 4.2-2.65 5.75-4.65 1.7-.8 2.8-1.55 3.45-2.65.45-.15 1.1-.65 1.7-1.1.8-.75 1.25-1.25 1.4-1.4.45-.15.8-.3 1.25-.8.15-.15.3-.6.8-1.2.9 0 1.85-.65 2.65-2.05.6-.3 1.05-.45 1.25-.6.45-.2.6-.5.75-.95.65-.3 1.25-.3 2.05-.15.15.45.3.9.6 1.25.45.45.8.45 1.25.3.15.6.65 1.1 1.1 1.25.75 1.4 1.85 2.15 3.1 2.35.15.45.5.9.95 1.25.3.45.6.75 1.1.9.15.5.6.8 1.1 1.1.3.15.75.45 1.55.95.3.6.75 1.25 1.55 1.85.3.15.95.65 2 1.25.35.65.95 1.25 1.75 1.9.45.3 1.1.75 2 1.55.5.15 1.1.75 2.05 1.7.75.8 1.55 1.4 2.35 1.55.15.5.45.8.9 1.1 17.3 14.2 33.85 26.35 49.9 36.65l12.45 7.8c4.85 2.8 9.05 4.95 12.95 6.55l.15.45c5.5 2.5 10.6 4.5 15.15 6.1.95.45 2.15.75 3.75.75l.15.3c.9.15 2.5.5 4.5.95 1.75.3 3.3.45 4.55.3v.5c6.35.15 11.85-1.25 16.05-4.05 1.85-1.75 3.4-3.6 4.8-5.95s2.2-4.65 2.5-7.15c1.4-3.9 2.05-7.35 1.55-10.15.2-3.6.2-8.75 0-15.75l-.45-.15c.15-2.2-.15-4.85-.6-7.95-.8-5.15-1.25-7.65-1.25-7.8-1.9-10.75-4.55-22.3-8.1-34.6-2.65-9.35-6.1-20.6-10.6-33.85-.5-1.1-1.4-3.55-2.5-7.15-1.1-2.95-2.05-5.15-2.8-6.85-.35-1.25-.8-2.8-1.6-4.85-.9-2.35-1.55-3.9-1.7-4.65l-.45-.2c-.15-1.05-.35-1.7-.5-2.15-.3-.95-.6-1.55-1.05-1.9-.2-.75-.2-1.25-.2-1.55-.15-.6-.45-.95-.75-1.1-.15-.6-.15-1.05-.3-1.4-.2-.6-.35-.9-.8-1.1 0-.6-.15-1.2-.6-1.7 0-.45 0-.95-.2-1.4-.15-.6-.3-.95-.75-1.1.15-.45-.15-1.1-.65-1.55.15-.3 0-.6-.15-1.1-.15-.45-.45-.75-.75-.9l.45-2.05h1.1v-.3c.6 0 1.1-.15 1.55-.65.6-.45.95-.6 1.1-.6.45-.15.75-.5.95-.95.45 0 1.05-.15 1.55-.45.45-.3.75-.65.9-1.1.35-.15.8-.3 1.45-.65.6-.15 1.05-.45 1.2-.75.5-.15.95-.45 1.75-.95.75-.3 1.25-.6 1.4-1.1 1.55-.45 2.95-1.25 4.05-2.65 1.1-.3 2.2-.9 3.6-1.7.15-.15 1.05-.95 3.1-2.35l.8-.3c11.05-7 20.55-13.4 28.5-19 10-7.2 19-14.2 27.15-21.05.9-.8 2.5-2.05 4.5-3.6 1.7-1.4 3.1-2.8 4.05-4.2.8-.15 1.4-.65 2.2-1.4 1.1-1.25 1.85-1.9 2-2.05 3.6-3.55 6.1-6.2 7.5-7.65 2.8-2.95 5-5.75 6.7-8.25 1.1-.75 2.2-2.15 3.25-3.9.5-.9 1.25-2.3 2.35-4.35.8-1.1 1.55-2.35 2.2-3.6.8-1.4 1.25-2.8 1.4-4.05l.45-.15c.95-3.25 1.25-6.4 1.1-9.5-.15-3.45-1.1-6.4-2.8-9.05-1.25-1.4-2.35-2.65-3.1-3.6-1.4-1.25-2.65-2.15-3.9-2.8-1.75-1.7-4.2-3.1-7.5-4.2-2.65-1.25-4.35-2-4.85-2.2-1.85-.75-3.55-1.05-5.1-1.25-.65-.45-1.45-.75-2.35-1.05z'/%3E%3C/svg%3E");
        }
        
        .anki_de .footer-option-list {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border-radius: 0.25rem;
          position: absolute;
          display: none;
          list-style: none;
          overflow: hidden;
          margin: 0;
          padding: 10px;
          background-color: var(--ls-primary-background-color);
          bottom: 28px;
          left: 12px;
          width: 200px;
          z-index:999;
        }
        
        .anki_de:hover > .footer-option-list {
            opacity: 1;
            display: block;
        }
        
        .anki_de .image-occlusion-menu {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border-radius: 0.25rem;
          position: absolute;
          display: none;
          list-style: none;
          overflow: hidden;
          margin: 0;
          padding: 10px;
          background-color: var(--ls-primary-background-color);
          top: 76px;
          right: 120px;
          width: 240px;
          z-index:999;
        }
        
        .anki_de:hover > .image-occlusion-menu {
            opacity: 1;
            display: block;
        }
        
        @media (min-width: 768px) {
          .md-block {
            display: block !important;
          }
        }
        `);
    }

    public static async getEventHandlersForMountedReactComponent(key) {
        let onClose = async () => {
            try {
                const div = window.parent.document.getElementById(key);
                ReactDOM.unmountComponentAtNode(div);
                logseq.provideUI({
                    key: key,
                    path: "#root main",
                    template: "",
                    reset: true,
                    replace: true,
                    close: "outside"
                });
                div.remove();
            } catch (e) {
                console.log(e);
            }
        };

        return {key, onClose};
    }

    public static async mountReactComponentInLogseq(key, path, component) {
        // Random key to avoid conflicts
        logseq.provideUI({
            key: key,
            path: path,
            close: "outside",
            template: `<div id="${key}"></div>`
        });

        // Wait for the element to be mounted
        await waitForElement(`//div[@id='${key}']`, 10000, window.parent.document);
        const { onClose } = await this.getEventHandlersForMountedReactComponent(key);
        LogseqProxy.App.registerPluginUnloadListener(onClose);

        ReactDOM.render(component, window.parent.document.getElementById(key));
    }
}
