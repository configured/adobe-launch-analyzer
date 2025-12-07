# Adobe DTM/Launch Rule Extractor

Extract rules, data elements, and extensions from Adobe DTM/Launch scripts with recursive discovery and multi-format output.

## Features

- 🚀 **Lightweight & Fast**: Direct HTTP parsing of embedded `_satellite.container` JSON - no browser needed!
- 🔍 **Recursive Discovery**: Automatically finds and processes all related Adobe DTM scripts
- 📊 **Multi-Format Output**: Generates JSON, CSV, and Markdown reports
- ⚡ **Error Handling**: Robust retry logic with exponential backoff
- 🎨 **Beautiful CLI**: Colorful progress indicators and clear output
- ⚙️ **Configurable**: Flexible configuration via CLI options or config files
- 📦 **No Heavy Dependencies**: Uses simple HTTP requests - much smaller than browser automation

## Installation

```bash
# Install dependencies
npm install

# Make CLI executable (optional)
npm link
```

## Usage

### Basic Usage

Extract rules from an Adobe Launch library:

```bash
node src/index.js https://assets.adobedtm.com/72afb75f5516/2dae2587738a/launch-15ca6ca5d7c9.min.js
```

### Recursive Discovery

Discover and extract from all Adobe scripts on a page:

```bash
node src/index.js https://example.com --recursive
```

### CLI Options

```
Usage: adobe-dtm-extract <url> [options]

Arguments:
  url                            Adobe Launch URL or page URL to analyze

Options:
  -V, --version                  output the version number
  -o, --output <dir>             Output directory (default: "./output")
  -f, --format <formats>         Output formats (comma-separated): json,csv,md (default: "json,csv,md")
  -r, --recursive                Recursively discover and process Adobe scripts (default: true)
  --no-recursive                 Disable recursive discovery
  -d, --depth <number>           Maximum recursion depth (default: "3")
  --timeout <ms>                 HTTP request timeout in milliseconds (default: "30000")
  --separate-outputs             Create separate output files for each discovered script
  --config <file>                Custom configuration file path
  -v, --verbose                  Verbose logging
  --debug                        Debug logging
  -h, --help                     display help for command
```

### Examples

**Extract from Launch library (all formats):**
```bash
node src/index.js https://assets.adobedtm.com/launch-abc123.min.js
```

**Extract from page with limited recursion:**
```bash
node src/index.js https://example.com -d 2
```

**JSON only output:**
```bash
node src/index.js <url> -f json
```

**Custom output directory:**
```bash
node src/index.js <url> -o ./my-reports
```

**Separate files for each script:**
```bash
node src/index.js https://example.com --separate-outputs
```

**Verbose logging:**
```bash
node src/index.js <url> -v
```

## Output Formats

### JSON
Structured JSON with complete rule definitions:
```json
{
  "metadata": {
    "extractedAt": "2025-12-07T...",
    "sourceUrl": "...",
    "ruleCount": 42
  },
  "rules": [...],
  "dataElements": {...},
  "extensions": {...}
}
```

### CSV
Tabular format for spreadsheet analysis:
```csv
Rule ID,Rule Name,Events,Conditions,Actions,Events JSON,Conditions JSON,Actions JSON
rule-1,Page Load,2,1,3,"[...]","[...]","[...]"
```

### Markdown
Human-readable documentation:
```markdown
# Adobe Launch Rules Extract

## Summary
**Source:** https://...
**Total Rules:** 42

## Rules
### 1. Track Page Load (rule-123)
...
```

## Configuration

Default configuration is in `config/default.json`. You can override settings with a custom config file:

```bash
node src/index.js <url> --config ./my-config.json
```

### Configuration Options

```json
{
  "browser": {
    "headless": true,
    "timeout": 30000
  },
  "discovery": {
    "maxDepth": 3,
    "followExtensions": true
  },
  "output": {
    "directory": "./output",
    "formats": ["json", "csv", "markdown"],
    "prettify": true,
    "timestamp": true
  },
  "logging": {
    "level": "info"
  },
  "retry": {
    "maxAttempts": 3,
    "backoff": "exponential"
  }
}
```

## How It Works

1. **Discovery Phase**: Starting from the input URL, the tool finds all Adobe DTM/Launch scripts
2. **Extraction Phase**: Fetches scripts via HTTP and parses the embedded `_satellite.container` object
3. **Normalization Phase**: Validates and normalizes the extracted data
4. **Output Phase**: Generates reports in JSON, CSV, and Markdown formats

### Technical Details

Adobe Launch scripts embed all configuration data directly in the source code:
```javascript
window._satellite.container = {
  rules: [...],
  dataElements: {...},
  extensions: {...}
}
```

This tool:
- Fetches the .js file via HTTP (axios)
- Extracts the container object using VM sandbox or regex
- Parses the embedded JSON structure
- No browser automation needed!

## Architecture

```
src/
├── index.js                    # CLI entry point
├── core/
│   ├── extractor.js           # Main orchestrator
│   └── http-extractor.js      # HTTP-based extraction
├── discovery/
│   ├── url-resolver.js        # URL normalization
│   └── script-finder.js       # Recursive discovery
├── formatters/
│   ├── json-formatter.js      # JSON output
│   ├── csv-formatter.js       # CSV output
│   ├── markdown-formatter.js  # Markdown output
│   └── formatter-factory.js   # Format coordination
└── utils/
    ├── logger.js              # Winston logging
    ├── config.js              # Configuration
    └── error-handler.js       # Error recovery
```

## Requirements

- Node.js >= 16.0.0
- npm or yarn

## Dependencies

- **commander**: CLI framework
- **axios**: HTTP client for fetching scripts
- **csv-writer**: CSV generation
- **winston**: Logging
- **chalk**: Terminal colors
- **ora**: Progress spinners

## Troubleshooting

### Timeout Errors
- Increase timeout: `--timeout 60000`
- Check if URL is accessible
- Ensure you have internet connectivity

### No Rules Found
- Verify the URL contains Adobe Launch
- Try the non-minified version (remove `.min` from URL)
- Check that the script contains `window._satellite.container`

### Parsing Errors
- The script may use unusual formatting
- Try viewing the source to verify structure
- Check debug output with `--debug` flag

### Permission Errors
- Ensure output directory is writable
- Try a different output path: `-o ./reports`

## Development

```bash
# Install dependencies
npm install

# Run with debugging
node src/index.js <url> --debug

# Run tests (when implemented)
npm test

# Lint code
npm run lint
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Acknowledgments

- Built with [Playwright](https://playwright.dev/)
- Inspired by [Launch Library Parser](https://launch-parser.com/)
- Adobe Launch documentation from [Experience League](https://experienceleague.adobe.com/)
