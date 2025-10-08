"use client";

import Editor from "@monaco-editor/react";
import { useOttlStore } from "../../lib/stores/ottlStore";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import { useEffect } from "react";
import { compileBlocksToOTTL } from "../../lib/ottl/compiler";

export default function RawOTTLView() {
  const { text, setText } = useOttlStore();
  const blocks = usePipelineStore((s) => s.blocks);

  // Compile blocks to OTTL whenever blocks change, but don't overwrite
  // manual edits if the text already diverged from the compiled version.
  useEffect(() => {
    const compiled = compileBlocksToOTTL(blocks);
    if (!text || text.trim().length === 0) {
      setText(compiled);
      return;
    }
    // If text starts with transform: and differs only by whitespace, sync; else preserve edits
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    if (norm(text) === norm(compileBlocksToOTTL([]))) {
      setText(compiled);
    }
  }, [blocks]);
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


