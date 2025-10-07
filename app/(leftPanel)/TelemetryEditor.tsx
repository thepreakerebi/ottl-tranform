"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";
import { useTelemetryStore } from "../../lib/stores/telemetryStore";
import { Badge } from "../../components/ui/badge";
import { AlertCircle } from "lucide-react";

export default function TelemetryEditor() {
  const { rawText, signal, setRawText, setParsed, setParseError, setSignal } = useTelemetryStore();
  const [localText, setLocalText] = useState(rawText || "");
  const [debounced, setDebounced] = useState(localText);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(localText), 300);
    return () => clearTimeout(t);
  }, [localText]);

  // removed special-brace placeholder logic

  useEffect(() => {
    try {
      if (!debounced.trim()) {
        setParsed(null);
        setParseError(undefined);
        setSignal("unknown");
        return;
      }
      const parsed = JSON.parse(debounced);
      setParsed(parsed);
      setParseError(undefined);
      // Detect signal via API
      fetch("/api/detect-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d && typeof d.signal === "string") {
            setSignal(d.signal);
            if (d.signal === "unknown") {
              setParseError("Unsupported telemetry format. Paste OTLP logs, metrics, or traces JSON.");
            }
          }
        })
        .catch(() => {});
    } catch {
      setParsed(null);
      setParseError("Invalid JSON");
      setSignal("unknown");
    }
  }, [debounced, setParsed, setParseError, setSignal]);

  useEffect(() => {
    setRawText(localText);
  }, [localText, setRawText]);

  const signalLabel = useMemo(() => {
    if (signal === "traces") return "Traces";
    if (signal === "metrics") return "Metrics";
    if (signal === "logs") return "Logs";
    return "Unknown";
  }, [signal]);

  const showHeader = localText.trim().length > 0;

  return (
    <section className="h-full min-h-0 flex flex-col overflow-hidden">
        {showHeader && (
          <section className="flex items-center gap-2">
            <p className="text-sm">Signal:</p>
            <Badge aria-live="polite" aria-atomic="true">{signalLabel}</Badge>
          </section>
        )}
        {useTelemetryStore.getState().parseError && (
          <p role="alert" className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="size-4" /> {useTelemetryStore.getState().parseError}
          </p>
        )}
      <section className="relative flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={localText}
          onChange={(v) => setLocalText(v ?? "")}
          className="outline-none focus:outline-none"
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            fontSize: 13,
            ariaLabel: "Telemetry JSON editor",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
          }}
          theme="light"
          beforeMount={(monaco) => {
            monaco.editor.defineTheme("ottlLight", {
              base: "vs",
              inherit: true,
              rules: [],
              colors: {
                "editor.lineHighlightBackground": "#dbeafe88", // light blue (tailwind sky-100) with opacity
                // gutter background ~30% opacity of a neutral secondary (tailwind slate-200 ~ #e5e7eb)
                "editorGutter.background": "#e5e7eb4D",
                // remove blue border accents on top/bottom of gutter
                "editorGutter.border": "#ffffff00",
                "editor.lineHighlightBorder": "#00000000",
                // remove focus ring colors causing blue lines
                "focusBorder": "#ffffff00",
                "editor.focusBorder": "#ffffff00",
                "editorGutter.modifiedBackground": "#00000000",
                "editorGutter.addedBackground": "#00000000",
                "editorGutter.deletedBackground": "#00000000",
                "editorLineNumber.activeForeground": "#111827",
                "editorLineNumber.foreground": "#6b7280",
              },
            });
          }}
          onMount={(editor, monaco) => {
            monaco.editor.setTheme("ottlLight");
          }}
        />
      </section>
      {showHeader && (
        <section aria-live="polite" className="sr-only">
          Current signal: {signalLabel}
        </section>
      )}
    </section>
  );
}


