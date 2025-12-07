const { chromium } = require('playwright');

class BrowserExtractor {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initialize() {
    this.logger.progress('Launching browser...');

    const headless = this.config.get('browser.headless', true);
    const userAgent = this.config.get('browser.userAgent');

    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext({
      userAgent: userAgent || undefined
    });
    this.page = await this.context.newPage();

    // Set timeout
    const timeout = this.config.get('browser.timeout', 30000);
    this.page.setDefaultTimeout(timeout);

    this.logger.success('Browser launched');
  }

  async extractRules(url) {
    if (!this.page) {
      await this.initialize();
    }

    this.logger.progress(`Loading ${url}...`);

    try {
      // Determine if URL is a direct script or a page
      const isDirectScript = url.endsWith('.js');

      if (isDirectScript) {
        // For direct script URLs, create a minimal HTML page that loads the script
        await this.loadDirectScript(url);
      } else {
        // For page URLs, just navigate to the page
        await this.page.goto(url, { waitUntil: 'networkidle' });
      }

      // Wait for _satellite to be defined
      this.logger.progress('Waiting for Adobe Launch to initialize...');

      await this.page.waitForFunction(
        () => window._satellite !== undefined,
        { timeout: this.config.get('browser.timeout', 30000) }
      );

      this.logger.progress('Extracting rules from _satellite object...');

      // Extract the container data
      const result = await this.page.evaluate(() => {
        const satellite = window._satellite;
        const container = satellite._container || satellite.container;

        if (!container) {
          return { error: '_satellite.container not found' };
        }

        // Helper function to safely extract object data
        const safeExtract = (obj) => {
          if (!obj) return null;
          try {
            return JSON.parse(JSON.stringify(obj));
          } catch (e) {
            return null;
          }
        };

        return {
          rules: safeExtract(container.rules),
          dataElements: safeExtract(container.dataElements),
          extensions: safeExtract(container.extensions),
          buildInfo: safeExtract(container.buildInfo),
          property: safeExtract(container.property),
          company: safeExtract(container.company),
          environment: safeExtract(container.environment)
        };
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Count extracted data
      const ruleCount = Array.isArray(result.rules) ? result.rules.length :
                        (result.rules ? Object.keys(result.rules).length : 0);
      const dataElementCount = result.dataElements ? Object.keys(result.dataElements).length : 0;
      const extensionCount = result.extensions ? Object.keys(result.extensions).length : 0;

      this.logger.success(`Extracted ${ruleCount} rules, ${dataElementCount} data elements, ${extensionCount} extensions`);

      return {
        success: true,
        url,
        timestamp: new Date().toISOString(),
        ...result
      };

    } catch (error) {
      this.logger.error(`Failed to extract from ${url}:`, { error: error.message });
      throw error;
    }
  }

  async loadDirectScript(scriptUrl) {
    // Create a minimal HTML page that loads the Adobe Launch script
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Adobe Launch Extractor</title>
        </head>
        <body>
          <h1>Loading Adobe Launch...</h1>
          <script src="${scriptUrl}"></script>
        </body>
      </html>
    `;

    await this.page.setContent(html);

    // Wait a moment for the script to load
    await this.page.waitForTimeout(2000);
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

  async cleanup() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.success('Browser closed');
    }
  }
}

module.exports = BrowserExtractor;
