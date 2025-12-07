const JSONFormatter = require('./json-formatter');
const CSVFormatter = require('./csv-formatter');
const MarkdownFormatter = require('./markdown-formatter');

class FormatterFactory {
  constructor(config) {
    this.config = config;
    this.formatters = {
      json: new JSONFormatter(config),
      csv: new CSVFormatter(config),
      markdown: new MarkdownFormatter(config),
      md: new MarkdownFormatter(config)
    };
  }

  getFormatter(format) {
    const normalizedFormat = format.toLowerCase();
    const formatter = this.formatters[normalizedFormat];

    if (!formatter) {
      throw new Error(`Unknown format: ${format}. Supported formats: json, csv, markdown`);
    }

    return formatter;
  }

  formatAll(extractedData, formats = ['json', 'csv', 'markdown']) {
    const outputs = {};

    formats.forEach(format => {
      try {
        const formatter = this.getFormatter(format);
        outputs[format] = formatter.format(extractedData);
      } catch (error) {
        console.error(`Error formatting as ${format}:`, error.message);
      }
    });

    return outputs;
  }

  getSupportedFormats() {
    return ['json', 'csv', 'markdown', 'md'];
  }
}

module.exports = FormatterFactory;
