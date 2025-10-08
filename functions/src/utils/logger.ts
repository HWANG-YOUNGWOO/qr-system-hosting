import * as functionsLogger from 'firebase-functions/logger';

export function logStart(funcName: string, meta?: Record<string, unknown>) {
  functionsLogger.info(`[START] ${funcName}`, meta || {});
}

export function logEnd(funcName: string, meta?: Record<string, unknown>) {
  functionsLogger.info(`[END] ${funcName}`, meta || {});
}

export function logError(funcName: string, err: unknown, meta?: Record<string, unknown>) {
  // Do not log sensitive values
  functionsLogger.error(`[ERROR] ${funcName}`, { error: String(err), ...meta });
}
