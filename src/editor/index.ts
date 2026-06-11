/**
 * Code editor setup using Monaco Editor.
 * Add a <div id="editor"></div> to your HTML (with an explicit height).
 * Listen for the 'evaluateCode' event to get the code the user has written.
 *
 * Install: npm install monaco-editor
 * Bundler note: Monaco requires worker files to be served separately.
 * With Vite, add the vite-plugin-monaco-editor plugin, or copy the workers
 * from node_modules/monaco-editor/esm/vs/... into your public dir.
 */

import * as monaco from "monaco-editor";
import { preset } from "./preset";
import { initCollab } from "./collab";

export const init = async (element: string = "#editor") => {
  const container = document.querySelector<HTMLElement>(element);
  if (!container) throw new Error(`No element found for selector: ${element}`);

  /**
   * Create the Monaco editor instance.
   */
  const editor = monaco.editor.create(container, {
    value: localStorage.getItem("satori.code") ?? preset,
    language: 'javascript',
    theme: 'satori',
    fontSize: 17,
    lineNumbers: 'off',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    minimap: {
        enabled: false
    },
    automaticLayout: true,
    renderLineHighlight: 'none',
    quickSuggestions: false,
    wordWrap: "on",
    scrollbar: {
        vertical: "hidden",
        horizontal: "hidden",
        verticalScrollbarSize: 0,
        horizontalScrollbarSize: 0,
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        arrowSize: 0
    },
    suggestOnTriggerCharacters: false,
    acceptSuggestionOnEnter: "off",
    acceptSuggestionOnCommitCharacter: false,
    snippetSuggestions: 'none',
    roundedSelection: false,
    tabSize: 2,
    parameterHints: {
        enabled: false
    },
    hover: {
        enabled: false
    },
    guides: {
        indentation: false        // newer setting
    },
    stickyScroll: {
        enabled: false
    }
  });

  /**
   * Fire evaluateCode event with the current editor content.
   */
  const evaluateCode = () => {
    window.dispatchEvent(
      new CustomEvent("evaluateCode", { detail: { code: editor.getValue() } })
    );
  };

  /**
   * Persist code to localStorage on every change.
   */
  editor.onDidChangeModelContent(() => {
    localStorage.setItem("satori.code", editor.getValue());
  });

  /**
   * Ctrl/Cmd+Enter or Ctrl/Alt+Enter → evaluate code.
   * Monaco uses addCommand for keybindings.
   */
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
    evaluateCode
  );
  editor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.Enter,
    evaluateCode
  );

  /**
   * Cmd/Ctrl+Left → jump to first non-whitespace char, then true line start
   * (mirrors the original prism behaviour).
   * We override the built-in "cursorHome" action with the same key.
   */
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.LeftArrow,
    () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;

      const lineContent = model.getLineContent(position.lineNumber);
      const firstNonWhitespace = lineContent.search(/\S/) + 1; // 1-based column
      const isAtFirstNonWS = position.column === firstNonWhitespace;

      const targetColumn = isAtFirstNonWS ? 1 : firstNonWhitespace;
      editor.setPosition({ lineNumber: position.lineNumber, column: targetColumn });
    }
  );

  /**
   * Global keyboard shortcuts (file open / save).
   */
  window.addEventListener("keydown", async (event) => {
    const meta = event.metaKey || event.ctrlKey;

    // Cmd+O → open a .js file
    if (meta && event.key === "o") {
      event.preventDefault();
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "JavaScript Files",
            accept: { "text/javascript": [".js"] },
          },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
      });
      const file = await handle.getFile();
      const contents = await file.text();
      editor.setValue(contents);
    }

    // Cmd+S → save / download the current code as a .js file
    if (meta && event.key === "s") {
      event.preventDefault();
      const options = {
        suggestedName: `satori-${new Date().toISOString().split("T")[0]}.js`,
        types: [
          {
            description: "JavaScript File",
            accept: { "text/plain": [".js"] },
          },
        ],
      };
      const handle = await (window as any).showSaveFilePicker(options);
      const writable = await handle.createWritable();
      await writable.write(editor.getValue());
      await writable.close();
    }
  });

  /**
   * External event: trigger evaluation programmatically.
   */
  window.addEventListener("triggerEvaluate", evaluateCode);

  /**
   * External event: replace editor content from outside.
   */
  window.addEventListener("setCode", (e: any) => {
    editor.setValue(e.detail.code);
  });

  /**
   * Collaborative editing via ?room=<name> URL param.
   * We preserve the cursor position across remote updates.
   */
  const room = new URLSearchParams(window.location.search).get("room");
  if (room) {
    const { sendCode } = initCollab(room, (code) => {
      const position = editor.getPosition();
      editor.setValue(code);
      if (position) editor.setPosition(position);
      editor.focus();
    });

    editor.onDidChangeModelContent(() => {
      sendCode(editor.getValue());
    });
  }
};