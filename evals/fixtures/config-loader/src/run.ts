import { loadConfig } from './config.ts';

export async function start(path: string): Promise<string> {
  const config = await loadConfig(path);
  return config === undefined ? 'no config' : config.apiUrl;
}
