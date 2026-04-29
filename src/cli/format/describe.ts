import type { CapabilityManifest } from "../../agent/describe.js";

export function formatDescribe(m: CapabilityManifest, section?: string): string {
  if (section === "warnings") {
    return m.warnings.map((w) => `  [${w.severity_default}] ${w.code} (${w.category}): ${w.description}`).join("\n");
  }
  if (section === "fixes") {
    return m.fix_kinds.map((k) => `  ${k.kind}: ${k.description}`).join("\n");
  }
  if (section === "explain") {
    return m.explain_node_types.map((t) => `  ${t.type}: ${t.description}`).join("\n");
  }
  if (section === "subcommands") {
    return m.subcommands.map((s) => `  ${s.name.padEnd(14)} ${s.description}`).join("\n");
  }
  return [
    `bread-calc ${m.tool_version} (output schema ${m.output_schema_version})`,
    `Homepage: ${m.homepage}`,
    `Privacy: zero network calls.`,
    ``,
    `Subcommands (${m.subcommands.length}):`,
    ...m.subcommands.map((s) => `  ${s.name.padEnd(14)} ${s.description}`),
    ``,
    `Warnings (${m.warnings.length}):`,
    ...m.warnings.map((w) => `  [${w.severity_default}] ${w.code} (${w.category})`),
    ``,
    `Fix kinds: ${m.fix_kinds.map((k) => k.kind).join(", ")}`,
    `Explain node types: ${m.explain_node_types.map((t) => t.type).join(", ")}`,
  ].join("\n");
}
