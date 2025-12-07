class JSONFormatter {
  constructor(config) {
    this.config = config;
  }

  format(extractedData) {
    const prettify = this.config.get('output.prettify', true);

    // Extract ALL available data from the container
    const output = {
      metadata: {
        extractedAt: extractedData.timestamp || new Date().toISOString(),
        sourceUrl: extractedData.url,
        ruleCount: this.getRuleCount(extractedData.rules),
        dataElementCount: extractedData.dataElements ? Object.keys(extractedData.dataElements).length : 0,
        extensionCount: extractedData.extensions ? Object.keys(extractedData.extensions).length : 0,
        buildInfo: extractedData.buildInfo || null,
        property: extractedData.property || null,
        company: extractedData.company || null,
        environment: extractedData.environment || null
      },
      // Complete rules with all properties
      rules: extractedData.rules || [],
      // Complete data elements with all settings
      dataElements: extractedData.dataElements || {},
      // Complete extensions with all configurations
      extensions: extractedData.extensions || {},
      // Any additional container properties
      hostedLibFilesBaseUrl: extractedData.hostedLibFilesBaseUrl || null,
      minified: extractedData.minified || null,
      // Raw build info for reference
      buildInfo: extractedData.buildInfo || null,
      property: extractedData.property || null,
      company: extractedData.company || null,
      environment: extractedData.environment || null
    };

    return prettify ? JSON.stringify(output, null, 2) : JSON.stringify(output);
  }

  getRuleCount(rules) {
    if (!rules) return 0;
    return Array.isArray(rules) ? rules.length : Object.keys(rules).length;
  }

  getFileExtension() {
    return 'json';
  }
}

module.exports = JSONFormatter;
