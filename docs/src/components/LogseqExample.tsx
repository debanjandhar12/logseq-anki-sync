import React, { useState, useRef, useEffect } from 'react';

// Clozes: matches {{c...}} or {{cloze ...}}
function highlightClozes(nodes: string | React.ReactNode | React.ReactNode[]): React.ReactNode {
    if (typeof nodes !== 'string') {
        if (Array.isArray(nodes)) return React.Children.map(nodes, highlightClozes);
        if (React.isValidElement(nodes)) return React.cloneElement(nodes as React.ReactElement, { children: highlightClozes(nodes.props.children) });
        return nodes;
    }
    const text = nodes;
    const regex = /(\{\{c\d+.*?\S\}\}|\{\{cloze.*?\S\}\})/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
        if (part.match(regex)) {
            return <span key={`cloze-${index}`} className="logseq-cloze">{highlightTags(part)}</span>;
        }
        return highlightTags(part);
    });
}

// Tags: matches #tag but NOT #+...
function highlightTags(nodes: string | React.ReactNode | React.ReactNode[]): React.ReactNode {
    if (typeof nodes !== 'string') {
        if (Array.isArray(nodes)) return React.Children.map(nodes, highlightTags);
        if (React.isValidElement(nodes)) return React.cloneElement(nodes as React.ReactElement, { children: highlightTags(nodes.props.children) });
        return nodes;
    }
    const text = nodes;
    const parts = text.split(/((?:^|\s)#[^+\s]\S*)/g);

    return parts.map((part, index) => {
        const trimmed = part.trim();
        if (trimmed.startsWith('#') && !trimmed.startsWith('#+')) {
            return <span key={`tag-${index}`} className="logseq-tag">{part}</span>;
        }
        return part;
    });
}

function processChildren(children: React.ReactNode): React.ReactNode {
    return React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
            // @ts-ignore
            return React.cloneElement(child, { children: processChildren(child.props.children) });
        }
        if (typeof child === 'string') {
            return highlightClozes(child);
        }
        return child;
    });
}

export default function LogseqExample({ children }: { children: React.ReactNode }): JSX.Element {
    const [copied, setCopied] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // DOM-based property highlighting - wraps property lines after render
    useEffect(() => {
        if (!ref.current) return;

        const listItems = ref.current.querySelectorAll('li');
        listItems.forEach(li => {
            // Skip if already processed
            if (li.querySelector('.logseq-property-line')) return;

            // Get text and check for property on first line
            const fullText = li.textContent || '';
            const lines = fullText.split('\n');
            const firstLine = lines[0];

            if (!/^\s*\S+::/.test(firstLine)) return;

            // Find where property line ends (at first newline)
            // We need to wrap just the property portion
            // Walk through child nodes and collect until we hit a newline

            const propertyNodes: Node[] = [];
            const otherNodes: Node[] = [];
            let foundNewline = false;

            const processNode = (node: Node) => {
                if (foundNewline) {
                    otherNodes.push(node);
                    return;
                }

                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent || '';
                    const nlIndex = text.indexOf('\n');
                    if (nlIndex !== -1) {
                        // Split this text node
                        const beforeNl = text.substring(0, nlIndex);
                        const afterNl = text.substring(nlIndex + 1);

                        if (beforeNl) {
                            propertyNodes.push(document.createTextNode(beforeNl));
                        }
                        if (afterNl) {
                            otherNodes.push(document.createTextNode(afterNl));
                        }
                        foundNewline = true;
                    } else {
                        propertyNodes.push(node.cloneNode(true));
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node as Element;
                    // Skip nested lists
                    if (el.tagName === 'UL' || el.tagName === 'OL') {
                        otherNodes.push(node);
                        foundNewline = true; // Treat nested list as end of property
                        return;
                    }

                    // Check if this element contains a newline
                    const text = el.textContent || '';
                    if (text.includes('\n')) {
                        // Need to process children of this element
                        // For simplicity, just add the whole element to property
                        // This might not be perfect but handles most cases
                        propertyNodes.push(node.cloneNode(true));
                        foundNewline = true;
                    } else {
                        propertyNodes.push(node.cloneNode(true));
                    }
                }
            };

            // Clone childNodes since we'll modify the DOM
            const originalNodes = Array.from(li.childNodes);
            originalNodes.forEach(processNode);

            // Only wrap if we found property content
            if (propertyNodes.length === 0) return;

            // Clear the li
            li.innerHTML = '';

            // Create property wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'logseq-property-line';
            propertyNodes.forEach(n => wrapper.appendChild(n));
            li.appendChild(wrapper);

            // Add other content
            if (otherNodes.length > 0) {
                const otherWrapper = document.createElement('div');
                otherNodes.forEach(n => otherWrapper.appendChild(n));
                li.appendChild(otherWrapper);
            }
        });
    }, [children]);

    const handleCopy = () => {
        if (ref.current) {
            let text = "";
            const processList = (ul: HTMLUListElement | HTMLOListElement, level: number) => {
                Array.from(ul.children).forEach((li) => {
                    if (li.tagName === 'LI') {
                        let liText = "";
                        let nestedUl = null;

                        li.childNodes.forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE) {
                                liText += node.textContent;
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                const el = node as HTMLElement;
                                if (el.tagName === 'UL' || el.tagName === 'OL') {
                                    nestedUl = el;
                                } else {
                                    liText += el.innerText;
                                }
                            }
                        });

                        text += `${'  '.repeat(level)}- ${liText.trim()}\n`;

                        if (nestedUl) {
                            processList(nestedUl as HTMLUListElement, level + 1);
                        }
                    }
                });
            };

            const rootUl = ref.current.querySelector('ul');
            if (rootUl) {
                processList(rootUl as HTMLUListElement, 0);
            } else {
                text = ref.current.innerText;
            }

            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const processedChildren = processChildren(children);

    return (
        <div className="logseq-example" ref={ref} style={{ position: 'relative' }}>
            {processedChildren}
            <button
                className="clean-btn button button--sm logseq-copy-btn"
                onClick={handleCopy}
                type="button"
                aria-label="Copy code to clipboard"
            >
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
}
