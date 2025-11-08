// client/src/ui/MarkdownEditor/MarkdownRenderer.jsx
import React from 'react';
import styles from './MarkdownRenderer.module.css';

const MarkdownRenderer = ({ markdown }) => {
    if (!markdown) {
        return null;
    }

    /**
     * Parses a single block of text for inline markdown elements.
     * This version is designed to correctly handle nested elements,
     * like **[a bold link](url)**.
     */
    const parseInlineMarkdown = (text) => {
        // 1. Escape HTML basics to prevent XSS
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // 2. Process elements in the correct order for nesting.
        // We must parse *inside-out*. Links are processed first,
        // then emphasis (bold/italic).

        // Links: [text](url) -> <a href="url">text</a>
        // The link text ($1) is left as-is, so it can be
        // matched by the bold/italic regexes *after* this.
        html = html.replace(
            /\[([\s\S]+?)\]\(([^)]+)\)/g, 
            (match, linkText, url) => `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
        );

        // Bold: **text** -> <strong>text</strong>
        // This will now correctly wrap `<strong>` around text
        // or <a> tags.
        html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic: *text* -> <em>text</em>
        html = html.replace(/\*([\s\S]*?)\*/g, '<em>$1</em>');
        
        return html;
    };

    // --- PARAGRAPH FIX ---
    // We split by a *single* newline ("\n") to match your
    // editor's behavior and replicate the old `pre-wrap` functionality.
    const paragraphs = markdown.split('\n');

    return (
        <div className={styles.markdownContainer}>
            {paragraphs.map((paragraph, index) => {
                // Trim the line to check if it was just whitespace
                const trimmed = paragraph.trim();

                // If the line was empty, render a non-breaking space
                // to create an empty <p> tag, which acts as a visual break.
                if (trimmed.length === 0) {
                    return <p key={index}>&nbsp;</p>;
                }

                // Otherwise, parse the line and render it
                const htmlContent = parseInlineMarkdown(trimmed);
                return <p key={index} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
            })}
        </div>
    );
};

export default MarkdownRenderer;