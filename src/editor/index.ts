/**
 * Code editor setup.
 * If you want to make use of this, add a <div id="editor"></div> to your HTML.
 * Then, listen out for the 'evaluateCode' event to get the code the user has written.
 */
import "prism-code-editor/prism/languages/markup"
import 'prism-code-editor/prism/languages/typescript';

import { editorFromPlaceholder } from 'prism-code-editor';
import { matchBrackets } from 'prism-code-editor/match-brackets';
import { defaultCommands, editHistory } from 'prism-code-editor/commands';
import 'prism-code-editor/languages/clike';

import 'prism-code-editor/layout.css';
import 'prism-code-editor/guides.css';
import 'prism-code-editor/invisibles.css';
import './theme.css';
import 'prism-code-editor/search.css';

import { preset } from "./preset";

import './style.css'

export const init = async (element: string = '#editor') => {
    /**
     * Initialize the code editor in an element with ID 'editor'
     */
    const editor = editorFromPlaceholder(
        element,
        {
            language: 'typescript',
            lineNumbers: false,
            value: localStorage.getItem("satori.code") || preset,
            tabSize: 2,
        },
        matchBrackets(),
        defaultCommands(),
        editHistory(),
    );

    /**
     * If a user presses Shift+Enter, fire a custom 'evaluateCode' event
     */
    editor.textarea.addEventListener('keydown', (e) => {
        localStorage.setItem("satori.code", editor.value);
        const meta = e.metaKey || e.ctrlKey; // Cmd on Mac, Ctrl on Windows/Linux

        if (e.key === 'Enter' && (e.ctrlKey || e.altKey)) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("evaluateCode", { detail: { code: editor.value } }));
            return false;
        }

        // Cmd+Left: jump to first non-whitespace character, then start of line
        if (meta && e.key === 'ArrowLeft') {
            e.preventDefault();
            const { selectionStart } = editor.textarea;
            const lineStart = editor.value.lastIndexOf('\n', selectionStart - 1) + 1;
            const firstChar = lineStart + editor.value.slice(lineStart).search(/\S/);
            
            // if already at first char, go to true line start
            const target = selectionStart === firstChar ? lineStart : firstChar;
            editor.textarea.setSelectionRange(target, target);
            return;
        }
    });

    window.addEventListener('keydown', async (event) => {
        if (event.metaKey && event.key === "o") {
            event.preventDefault();
            // @ts-ignore
            const [handle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: "JavaScript Files",
                        accept: {
                            "text/javascript": [".js"]
                        }
                    }
                ],
                excludeAcceptAllOption: true, // optional: hides "All files (*.*)"
                multiple: false
            });
            const file = await handle.getFile();
            const contents = await file.text();
            editor.setOptions({ value: contents })
        }

        // Cmd+S to save, download a file with the current code
        if (event.metaKey && event.key === "s") {
            event.preventDefault();

            const options = {
                // todays date as YYYY-MM-DD.js
                suggestedName: `satori-${new Date().toISOString().split('T')[0]}.js`,
                types: [
                    {
                        description: "JavaScript File",
                        accept: { "text/plain": [".js"] }
                    }
                ]
            };

            // @ts-ignore
            const handle = await window.showSaveFilePicker(options);

            const writable = await handle.createWritable();
            await writable.write(editor.value);
            await writable.close();
        }

    });
}