type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type WaitForDeployOptions = {
  /** The deploy's origin, e.g. https://deploy-preview-12--site.netlify.app */
  baseUrl: string;
  /** The commit SHA /api/health must report. */
  expectedVersion: string;
  timeoutMs: number;
  intervalMs?: number;
  /** Paths that must answer 200 once the expected version is live. */
  checkPaths?: string[];
  fetch?: Fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export function waitForDeploy(options: WaitForDeployOptions): Promise<void>;

export function readCliEnv(env: Record<string, string | undefined>): {
  baseUrl: string;
  expectedVersion: string;
  timeoutMs: number;
};

export function main(
  env?: Record<string, string | undefined>,
  log?: Pick<Console, "log" | "error">,
  options?: Pick<WaitForDeployOptions, "fetch" | "now" | "sleep" | "intervalMs">,
): Promise<number>;
