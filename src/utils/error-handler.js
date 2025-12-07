class ErrorHandler {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }

  async executeWithRetry(fn, context = 'operation', options = {}) {
    const maxAttempts = options.maxAttempts || this.config.get('retry.maxAttempts', 3);
    const backoff = options.backoff || this.config.get('retry.backoff', 'exponential');
    const initialDelay = options.initialDelay || this.config.get('retry.initialDelay', 1000);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;

        if (isLastAttempt) {
          this.logger.error(`${context} failed after ${maxAttempts} attempts`, {
            error: error.message,
            stack: error.stack
          });
          throw error;
        }

        const delay = this.calculateBackoff(attempt, backoff, initialDelay);
        this.logger.warn(`${context} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, {
          error: error.message
        });

        await this.sleep(delay);
      }
    }
  }

  calculateBackoff(attempt, strategy, initialDelay) {
    if (strategy === 'exponential') {
      return Math.min(initialDelay * Math.pow(2, attempt - 1), 30000);
    } else if (strategy === 'linear') {
      return initialDelay * attempt;
    }
    return initialDelay;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  handleError(error, context = 'Unknown') {
    this.logger.error(`Error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    if (error.code === 'ECONNREFUSED') {
      this.logger.error('Connection refused. Check if the URL is accessible.');
    } else if (error.code === 'ENOTFOUND') {
      this.logger.error('Domain not found. Check the URL.');
    } else if (error.code === 'ETIMEDOUT') {
      this.logger.error('Request timed out. Try increasing the timeout value.');
    }

    return {
      success: false,
      error: error.message,
      context
    };
  }

  isRetryableError(error) {
    const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
    const retryableStatuses = [408, 429, 500, 502, 503, 504];

    return (
      retryableCodes.includes(error.code) ||
      (error.response && retryableStatuses.includes(error.response.status))
    );
  }
}

module.exports = ErrorHandler;
