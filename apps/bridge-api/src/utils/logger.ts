import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Winston logger instance for the Bridge API.
 *
 * - Development: logs to console with colorized simple format
 * - Production: logs to console and file in JSON format
 */
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: combine(timestamp(), json()),
  transports: isDevelopment
    ? [
        new winston.transports.Console({
          format: combine(colorize(), simple()),
        }),
      ]
    : [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
});

export default logger;
