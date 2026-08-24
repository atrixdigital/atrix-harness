export interface Config {
  apiUrl: string;
  timeoutMs: number;
}

/**
 * Reads config from a JSON file.
 *
 * TODO: callers cannot currently tell a missing file from a malformed one.
 */
export async function loadConfig(path: string): Promise<Config | undefined> {
  try {
    return JSON.parse(await Bun.file(path).text()) as Config;
  } catch {
    return undefined;
  }
}
