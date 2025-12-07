const fs = require('fs').promises;
const path = require('path');
const HTTPExtractor = require('./http-extractor');
const ScriptFinder = require('../discovery/script-finder');
const FormatterFactory = require('../formatters/formatter-factory');
const ErrorHandler = require('../utils/error-handler');

class AdobeDTMExtractor {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.httpExtractor = new HTTPExtractor(logger, config);
    this.scriptFinder = new ScriptFinder(logger, config);
    this.formatterFactory = new FormatterFactory(config);
    this.errorHandler = new ErrorHandler(logger, config);
  }

  async extract(url, options = {}) {
    this.logger.info(`Starting extraction from: ${url}`);

    try {
      // Extract rules via HTTP
      const result = await this.errorHandler.executeWithRetry(
        () => this.httpExtractor.extractRules(url),
        'HTTP extraction'
      );

      // Generate outputs
      if (result.success) {
        await this.writeOutputs(result, options);
      }

      return result;

    } catch (error) {
      this.logger.error('Extraction failed:', { error: error.message });
      throw error;
    }
  }

  async extractRecursive(startUrl, options = {}) {
    this.logger.info(`Starting recursive extraction from: ${startUrl}`);

    try {
      // Discover all Adobe scripts
      const scripts = await this.scriptFinder.findAdobeScripts(
        startUrl,
        0
      );

      if (scripts.length === 0) {
        this.logger.warn('No Adobe DTM scripts found');
        return { success: false, error: 'No scripts found' };
      }

      this.logger.info(`Discovered ${scripts.length} Adobe DTM scripts`);

      // Extract from all discovered scripts
      const results = [];
      for (const script of scripts) {
        try {
          this.logger.progress(`Extracting from: ${script.url}`);

          const result = await this.errorHandler.executeWithRetry(
            () => this.httpExtractor.extractRules(script.url),
            `Extraction from ${script.url}`
          );

          results.push(result);

          // Write individual outputs if requested
          if (options.separateOutputs) {
            await this.writeOutputs(result, options, scripts.indexOf(script));
          }

        } catch (error) {
          this.logger.warn(`Failed to extract from ${script.url}: ${error.message}`);
          results.push({
            success: false,
            url: script.url,
            error: error.message
          });
        }
      }

      // Merge results if needed
      const mergedResult = this.mergeResults(results);

      // Write combined output
      if (!options.separateOutputs) {
        await this.writeOutputs(mergedResult, options);
      }

      this.logger.success(`Extraction complete! Processed ${scripts.length} scripts.`);

      return {
        success: true,
        scriptsProcessed: scripts.length,
        results: results,
        merged: mergedResult
      };

    } catch (error) {
      this.logger.error('Recursive extraction failed:', { error: error.message });
      throw error;
    }
  }

  mergeResults(results) {
    const merged = {
      success: true,
      timestamp: new Date().toISOString(),
      sources: [],
      rules: [],
      dataElements: {},
      extensions: {}
    };

    results.forEach(result => {
      if (result.success) {
        merged.sources.push(result.url);

        // Merge rules
        if (result.rules) {
          const rules = Array.isArray(result.rules) ? result.rules : Object.values(result.rules);
          merged.rules.push(...rules);
        }

        // Merge data elements
        if (result.dataElements) {
          merged.dataElements = { ...merged.dataElements, ...result.dataElements };
        }

        // Merge extensions
        if (result.extensions) {
          merged.extensions = { ...merged.extensions, ...result.extensions };
        }
      }
    });

    merged.url = merged.sources.join(', ');

    return merged;
  }

  async writeOutputs(extractedData, options = {}, index = null) {
    const outputDir = options.output || this.config.get('output.directory', './output');
    const formats = options.formats || this.config.get('output.formats', ['json', 'csv', 'markdown']);
    const timestamp = this.config.get('output.timestamp', true);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate base filename
    let baseFilename = 'adobe-launch-extract';
    if (index !== null) {
      baseFilename += `-${index + 1}`;
    }
    if (timestamp) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      baseFilename += `-${ts}`;
    }

    // Format and write each output format
    const formatList = Array.isArray(formats) ? formats : formats.split(',').map(f => f.trim());

    for (const format of formatList) {
      try {
        const formatter = this.formatterFactory.getFormatter(format);
        const content = formatter.format(extractedData);
        const extension = formatter.getFileExtension();
        const filepath = path.join(outputDir, `${baseFilename}.${extension}`);

        await fs.writeFile(filepath, content, 'utf8');
        this.logger.success(`Wrote ${format.toUpperCase()} output to: ${filepath}`);

      } catch (error) {
        this.logger.error(`Failed to write ${format} output: ${error.message}`);
      }
    }
  }
}

module.exports = AdobeDTMExtractor;
