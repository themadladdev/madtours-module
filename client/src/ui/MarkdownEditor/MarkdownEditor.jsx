// client/src/ui/MarkdownEditor/MarkdownEditor.jsx
import { useRef } from 'react';
import styles from './MarkdownEditor.module.css';

const MarkdownEditor = ({ value, onChange, disabled }) => {
  const textareaRef = useRef(null);

  const applyFormat = (format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let markdownChar = '';
    if (format === 'bold') markdownChar = '**';
    if (format === 'italic') markdownChar = '*';
    
    const newText = 
      value.substring(0, start) + 
      markdownChar + selectedText + markdownChar + 
      value.substring(end);

    onChange(newText);
    
    // After update, focus and re-select the text
    textarea.focus();
    setTimeout(() => {
      textarea.setSelectionRange(start + markdownChar.length, end + markdownChar.length);
    }, 0);
  };

  const handleLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || 'link text';

    const url = prompt('Enter the URL:', 'https://');
    if (!url) return; // User cancelled the prompt

    const newText =
      value.substring(0, start) +
      `[${selectedText}](${url})` +
      value.substring(end);

    onChange(newText);
    
    // After update, focus the textarea
    textarea.focus();
    setTimeout(() => {
      // Place cursor after the inserted link
      const newCursorPosition = start + `[${selectedText}](${url})`.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => applyFormat('bold')} disabled={disabled} title="Bold"><b>B</b></button>
        <button type="button" onClick={() => applyFormat('italic')} disabled={disabled} title="Italic"><i>I</i></button>
        <button type="button" onClick={handleLink} disabled={disabled} title="Link" className={styles.linkButton}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.editTextarea}
        disabled={disabled}
      />
      <p className={styles.markdownHelp}>
        Use the toolbar or type manually: **bold**, *italic*, [link text](https://example.com), or add new paragraphs with an empty line.
      </p>
    </div>
  );
};

export default MarkdownEditor;