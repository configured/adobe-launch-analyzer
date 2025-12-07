const winston = require('winston');
const chalk = require('chalk');

class Logger {
  constructor(config = {}) {
    const { level = 'info', console: enableConsole = true, file = false } = config;

    const transports = [];

    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const coloredLevel = this.colorizeLevel(level);
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${chalk.gray(timestamp)} ${coloredLevel} ${message}${metaStr}`;
            })
          )
        })
      );
    }

    if (file) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/extractor.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      );
    }

    this.logger = winston.createLogger({
      level,
      transports
    });
  }

  colorizeLevel(level) {
    const colors = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      debug: chalk.gray
    };
    const colorFn = colors[level] || chalk.white;
    return colorFn(level.toUpperCase().padEnd(5));
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  success(message, meta = {}) {
    this.logger.info(chalk.green('✓ ') + message, meta);
  }

  progress(message) {
    this.logger.info(chalk.cyan('⋯ ') + message);
  }
}

module.exports = Logger;
