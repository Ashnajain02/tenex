"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: string;
  minHeight?: string;
  maxHeight?: string;
  onRun?: () => void;
  autoFocus?: boolean;
}

const tenexTheme = EditorView.theme({
  "&": {
    backgroundColor: "#1E1D1A",
    fontSize: "0.85em",
    lineHeight: "1.6",
  },
  ".cm-gutters": {
    backgroundColor: "#1E1D1A",
    borderRight: "1px solid #2A2926",
    color: "#6B6B5F",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#2A2926",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono), monospace",
  },
  ".cm-activeLine": {
    backgroundColor: "#25241F",
  },
});

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  language = "python",
  minHeight = "80px",
  maxHeight = "400px",
  onRun,
  autoFocus = false,
}: CodeEditorProps) {
  const extensions = useMemo(() => {
    const exts: Extension[] = [];

    exts.push(tenexTheme);

    if (language === "python" || language === "py") {
      exts.push(python());
    }

    if (onRun) {
      exts.push(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRun();
              return true;
            },
          },
        ])
      );
    }

    exts.push(EditorView.lineWrapping);

    return exts;
  }, [language, onRun]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={oneDark}
      extensions={extensions}
      readOnly={readOnly}
      editable={!readOnly}
      autoFocus={autoFocus}
      minHeight={minHeight}
      maxHeight={maxHeight}
      basicSetup={{
        lineNumbers: true,
        bracketMatching: true,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        foldGutter: true,
        indentOnInput: true,
        tabSize: 4,
      }}
    />
  );
}
