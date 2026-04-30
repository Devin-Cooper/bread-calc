export type SubcommandName =
  | "compute" | "solve" | "validate" | "ingredients" | "reference" | "schema"
  | "describe" | "examples" | "parse" | "convert" | "lookup" | "apply" | "verify"
  | "recommend";

export interface Meta {
  tool_version: string;
  output_schema_version: "2.0";
  subcommand: SubcommandName;
  timestamp_iso: string;
}

export interface OutputEnvelope<T> {
  _meta: Meta;
  payload: T;
}

export function wrap<T>(
  subcommand: SubcommandName,
  toolVersion: string,
  payload: T,
): OutputEnvelope<T> {
  return {
    _meta: {
      tool_version: toolVersion,
      output_schema_version: "2.0",
      subcommand,
      timestamp_iso: new Date().toISOString(),
    },
    payload,
  };
}
