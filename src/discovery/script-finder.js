const axios = require('axios');
const URLResolver = require('./url-resolver');

class ScriptFinder {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.urlResolver = new URLResolver(logger);
    this.visited = new Set();
    this.discovered = [];
  }

  async findAdobeScripts(startUrl, depth = 0) {
    const maxDepth = this.config.get('discovery.maxDepth', 3);

    if (depth > maxDepth) {
      this.logger.debug(`Max depth ${maxDepth} reached, stopping discovery`);
      return this.discovered;
    }

    const normalizedUrl = this.urlResolver.normalize(startUrl);
    if (!normalizedUrl) {
      this.logger.warn(`Invalid URL: ${startUrl}`);
      return this.discovered;
    }

    if (this.visited.has(normalizedUrl)) {
      this.logger.debug(`Already visited: ${normalizedUrl}`);
      return this.discovered;
    }

    this.visited.add(normalizedUrl);
    this.logger.progress(`Discovering scripts from ${normalizedUrl} (depth ${depth})...`);

    try {
      const isDirectScript = normalizedUrl.endsWith('.js');

      if (isDirectScript) {
        // It's a direct script URL
        if (this.urlResolver.isAdobeDTMScript(normalizedUrl)) {
          this.addDiscoveredScript(normalizedUrl);

          // Try to find references in the script content
          if (this.config.get('discovery.followExtensions', true)) {
            await this.findReferencesInScript(normalizedUrl, depth);
          }
        }
      } else {
        // It's a page URL
        await this.findScriptsInPage(normalizedUrl, depth);
      }

    } catch (error) {
      this.logger.warn(`Failed to discover from ${normalizedUrl}: ${error.message}`);
    }

    return this.discovered;
  }

  async findScriptsInPage(pageUrl, depth) {
    try {
      const response = await axios.get(pageUrl, {
        timeout: this.config.get('discovery.timeout', 10000),
        headers: {
          'User-Agent': this.config.get('browser.userAgent', 'Mozilla/5.0')
        }
      });

      const html = response.data;
      const scriptUrls = this.urlResolver.extractScriptURLs(html);

      this.logger.info(`Found ${scriptUrls.length} Adobe DTM scripts in page`);

      for (const scriptUrl of scriptUrls) {
        const absoluteUrl = this.urlResolver.makeAbsolute(scriptUrl, pageUrl);
        if (absoluteUrl) {
          await this.findAdobeScripts(absoluteUrl, depth + 1);
        }
      }

    } catch (error) {
      throw new Error(`Failed to fetch page: ${error.message}`);
    }
  }

  async findReferencesInScript(scriptUrl, depth) {
    try {
      const response = await axios.get(scriptUrl, {
        timeout: this.config.get('discovery.timeout', 10000)
      });

      const scriptContent = response.data;

      // Look for other Adobe DTM script references
      const urlPattern = /(https?:\/\/assets\.adobedtm\.com\/[^"'\s]+\.js)/g;
      let match;

      while ((match = urlPattern.exec(scriptContent)) !== null) {
        const foundUrl = match[1];
        if (!this.visited.has(foundUrl)) {
          await this.findAdobeScripts(foundUrl, depth + 1);
        }
      }

    } catch (error) {
      this.logger.debug(`Could not scan script ${scriptUrl}: ${error.message}`);
    }
  }

  addDiscoveredScript(url) {
    if (!this.discovered.find(s => s.url === url)) {
      this.discovered.push({
        url,
        discoveredAt: new Date().toISOString()
      });
      this.logger.success(`Discovered: ${url}`);
    }
  }

  getDiscoveredScripts() {
    return this.discovered;
  }

  reset() {
    this.visited.clear();
    this.discovered = [];
  }
}

module.exports = ScriptFinder;
