/**
 * Logging utility for the application
 * Provides structured logging with different levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  timestamp: Date;
}

class Logger {
  private currentLevel: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private log(level: LogLevel, module: string, message: string, data?: unknown): void {
    if (level < this.currentLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      module,
      message,
      data,
      timestamp: new Date(),
    };

    const levelName = LogLevel[level];
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${levelName}] [${module}]`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, data);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, data);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, data);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, data);
        break;
    }
  }

  debug(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, module, message, data);
  }

  info(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.INFO, module, message, data);
  }

  warn(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, module, message, data);
  }

  error(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, module, message, data);
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Development mode: set to DEBUG level
if (import.meta.env.DEV) {
  logger.setLevel(LogLevel.DEBUG);
}
