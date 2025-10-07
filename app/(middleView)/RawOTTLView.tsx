"use client";

import Editor from "@monaco-editor/react";
import { useOttlStore } from "../../lib/stores/ottlStore";

export default function RawOTTLView() {
  const { text, setText } = useOttlStore();
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


