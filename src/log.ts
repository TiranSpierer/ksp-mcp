export function log(...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  process.stderr.write(`[ksp-mcp ${timestamp}] ${args.map(String).join(" ")}\n`);
}
