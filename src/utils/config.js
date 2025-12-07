const fs = require('fs');
const path = require('path');

class Config {
  constructor(customConfigPath = null) {
    this.defaultConfig = this.loadDefaultConfig();
    this.customConfig = customConfigPath ? this.loadCustomConfig(customConfigPath) : {};
    this.config = { ...this.defaultConfig, ...this.customConfig };
  }

  loadDefaultConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/default.json');
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Could not load default config, using fallback');
      return this.getFallbackConfig();
    }
  }

  loadCustomConfig(configPath) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Could not load custom config from ${configPath}`);
      return {};
    }
  }

  getFallbackConfig() {
    return {
      browser: {
        headless: true,
        timeout: 30000
      },
      discovery: {
        maxDepth: 3,
        followExtensions: true
      },
      output: {
        directory: './output',
        formats: ['json', 'csv', 'markdown'],
        prettify: true
      },
      logging: {
        level: 'info',
        console: true
      },
      retry: {
        maxAttempts: 3,
        backoff: 'exponential'
      }
    };
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  getAll() {
    return { ...this.config };
  }
}

module.exports = Config;
