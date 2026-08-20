const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

const paint = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const dim = (s: string) => paint('2', s);
export const bold = (s: string) => paint('1', s);
export const red = (s: string) => paint('31', s);
export const green = (s: string) => paint('32', s);
export const yellow = (s: string) => paint('33', s);
export const cyan = (s: string) => paint('36', s);

/**
 * Output discipline: success is quiet, failure is loud.
 * A harness that narrates every success trains people to ignore it.
 */
export const log = {
  info: (msg: string) => console.log(msg),
  step: (msg: string) => console.log(`${dim('·')} ${msg}`),
  ok: (msg: string) => console.log(`${green('✓')} ${msg}`),
  warn: (msg: string) => console.warn(`${yellow('!')} ${msg}`),
  fail: (msg: string) => console.error(`${red('✗')} ${msg}`),
  detail: (msg: string) => console.log(`  ${dim(msg)}`),
  blank: () => console.log(''),
};

export class AtrixError extends Error {
  readonly hint: string | undefined;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'AtrixError';
    this.hint = hint;
  }
}
