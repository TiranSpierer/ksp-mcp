import { z } from "zod";

/**
 * Accept an array of strings, a JSON-encoded array string, or a single bare
 * string (some MCP clients send any of these). Always yields string[].
 */
export const stringArray = () =>
  z.preprocess((val) => {
    if (typeof val === "string") {
      const s = val.trim();
      if (s.startsWith("[")) {
        try {
          return JSON.parse(s);
        } catch {
          return [s];
        }
      }
      return s ? [s] : [];
    }
    return val;
  }, z.array(z.string()));
