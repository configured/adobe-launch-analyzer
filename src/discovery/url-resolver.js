const { URL } = require('url');

class URLResolver {
  constructor(logger) {
    this.logger = logger;
  }

  normalize(url) {
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch (error) {
      this.logger.warn(`Invalid URL: ${url}`);
      return null;
    }
  }

  isAdobeDTMScript(url) {
    const patterns = [
      /assets\.adobedtm\.com\/.*\/launch-.*\.js/,
      /assets\.adobedtm\.com\/.*\/satellite-.*\.js/,
      /assets\.adobedtm\.com\/.*\/DTM\.js/
    ];

    return patterns.some(pattern => pattern.test(url));
  }

  getUnminifiedURL(url) {
    // Try to get non-minified version by removing .min
    return url.replace(/\.min\.js$/, '.js');
  }

  extractScriptURLs(html) {
    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
    const urls = [];
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      const url = match[1];
      if (this.isAdobeDTMScript(url)) {
        urls.push(url);
      }
    }

    return urls;
  }

  makeAbsolute(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch (error) {
      return null;
    }
  }
}

module.exports = URLResolver;
