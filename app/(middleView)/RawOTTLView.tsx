"use client";

import Editor from "@monaco-editor/react";
import { useOttlStore } from "../../lib/stores/ottlStore";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import { useEffect, useRef } from "react";
import { compileBlocksToOTTL } from "../../lib/ottl/compiler";

export default function RawOTTLView() {
  const { text, setText } = useOttlStore();
  const blocks = usePipelineStore((s) => s.blocks);

  // Compile blocks to OTTL whenever blocks change.
  // Auto-sync only if the editor is empty OR still showing the last auto-compiled text.
  // If the user has manually edited (text !== lastCompiled), preserve their edits.
  const lastCompiledRef = useRef<string>("");
  useEffect(() => {
    const compiled = compileBlocksToOTTL(blocks);
    const isEmpty = !text || text.trim().length === 0;
    const isStillAuto = text === lastCompiledRef.current;
    if (isEmpty || isStillAuto) {
      setText(compiled);
      lastCompiledRef.current = compiled;
      return;
    }
    // User has edited; keep their text, but refresh our reference for next time
    lastCompiledRef.current = compiled;
  }, [blocks, text, setText]);
  return (
    <section aria-label="Raw OTTL" className="h-full">
      <Editor
        height="100%"
        defaultLanguage="yaml"
        value={text}
        onChange={(v) => setText(v ?? "")}
        options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 13, ariaLabel: "Raw OTTL editor" }}
        theme="light"
      />
    </section>
  );
}


