const axios = require('axios');
const vm = require('vm');

class HTTPExtractor {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }

  async extractRules(url) {
    this.logger.progress(`Fetching ${url}...`);

    try {
      // Fetch the script
      const response = await axios.get(url, {
        timeout: this.config.get('browser.timeout', 30000),
        headers: {
          'User-Agent': this.config.get('browser.userAgent', 'Mozilla/5.0')
        }
      });

      const scriptContent = response.data;
      this.logger.progress('Parsing Adobe Launch container...');

      // Extract the _satellite.container object
      const container = this.extractContainer(scriptContent);

      if (!container) {
        throw new Error('Could not find _satellite.container in script');
      }

      // Count extracted data
      const ruleCount = container.rules ?
        (Array.isArray(container.rules) ? container.rules.length : Object.keys(container.rules).length) : 0;
      const dataElementCount = container.dataElements ? Object.keys(container.dataElements).length : 0;
      const extensionCount = container.extensions ? Object.keys(container.extensions).length : 0;

      this.logger.success(`Extracted ${ruleCount} rules, ${dataElementCount} data elements, ${extensionCount} extensions`);

      // Return ALL data from the container plus metadata
      return {
        success: true,
        url,
        timestamp: new Date().toISOString(),
        // Spread all container properties to capture everything
        ...container,
        // Ensure these specific ones are always present (even if null)
        rules: container.rules || [],
        dataElements: container.dataElements || {},
        extensions: container.extensions || {},
        buildInfo: container.buildInfo || null,
        property: container.property || null,
        company: container.company || null,
        environment: container.environment || null
      };

    } catch (error) {
      this.logger.error(`Failed to extract from ${url}:`, { error: error.message });
      throw error;
    }
  }

  extractContainer(scriptContent) {
    try {
      // Method 1: Execute the script in a sandbox and extract (most reliable)
      const sandboxResult = this.extractViaSandbox(scriptContent);
      if (sandboxResult) {
        return sandboxResult;
      }

      // Method 2: Try to extract using regex pattern for minified format
      // Look for: window._satellite.container={...}
      const pattern = /window\._satellite\.container\s*=\s*\{/;
      const startMatch = scriptContent.match(pattern);

      if (startMatch) {
        const startIndex = startMatch.index + startMatch[0].length - 1;
        // Find the matching closing brace
        const containerStr = this.extractBalancedBraces(scriptContent, startIndex);
        if (containerStr) {
          return this.safeEval(containerStr);
        }
      }

      // Method 3: Try alternative patterns
      const altPattern = /_satellite\.container\s*=\s*\{/;
      const altMatch = scriptContent.match(altPattern);

      if (altMatch) {
        const startIndex = altMatch.index + altMatch[0].length - 1;
        const containerStr = this.extractBalancedBraces(scriptContent, startIndex);
        if (containerStr) {
          return this.safeEval(containerStr);
        }
      }

      return null;

    } catch (error) {
      this.logger.warn(`Failed to extract container: ${error.message}`);
      return null;
    }
  }

  extractBalancedBraces(str, startIndex) {
    let braceCount = 0;
    let inString = false;
    let stringChar = null;
    let escaped = false;

    for (let i = startIndex; i < str.length; i++) {
      const char = str[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            // Found the matching closing brace
            return str.substring(startIndex, i + 1);
          }
        }
      }
    }

    return null;
  }

  safeEval(objectString) {
    try {
      // Create a sandbox context with minimal globals
      const sandbox = {
        window: {},
        _satellite: {},
        undefined: undefined,
        null: null,
        true: true,
        false: false
      };

      // Wrap the object in a return statement
      const code = `(function() { return ${objectString}; })()`;

      // Create and run in VM context
      const context = vm.createContext(sandbox);
      const result = vm.runInContext(code, context, {
        timeout: 5000,
        displayErrors: true
      });

      return result;

    } catch (error) {
      this.logger.debug(`Safe eval failed: ${error.message}`);
      return null;
    }
  }

  extractViaSandbox(scriptContent) {
    try {
      // Create a sandbox with window._satellite
      const sandbox = {
        window: { _satellite: {} },
        _satellite: {},
        console: { log: () => {}, warn: () => {}, error: () => {} },
        document: {},
        navigator: {},
        location: {},
        setTimeout: () => {},
        setInterval: () => {},
        clearTimeout: () => {},
        clearInterval: () => {}
      };

      // Execute the script in the sandbox
      const context = vm.createContext(sandbox);
      vm.runInContext(scriptContent, context, {
        timeout: 10000,
        displayErrors: false
      });

      // Extract the container
      const container = sandbox.window._satellite?.container || sandbox._satellite?.container;

      if (container) {
        // Convert to plain object with custom function serialization
        return this.serializeContainer(container);
      }

      return null;

    } catch (error) {
      this.logger.debug(`Sandbox execution failed: ${error.message}`);
      return null;
    }
  }

  serializeContainer(container) {
    // Custom serialization that preserves function source code
    return JSON.parse(JSON.stringify(container, (key, value) => {
      if (typeof value === 'function') {
        return {
          __isFunction: true,
          source: value.toString()
        };
      }
      return value;
    }));
  }

  async extractMultiple(urls) {
    const results = [];

    for (const url of urls) {
      try {
        const result = await this.extractRules(url);
        results.push(result);
      } catch (error) {
        this.logger.warn(`Skipping ${url} due to error: ${error.message}`);
        results.push({
          success: false,
          url,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = HTTPExtractor;
