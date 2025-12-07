#!/usr/bin/env node

const { program } = require('commander');
const ora = require('ora');
const chalk = require('chalk');
const AdobeDTMExtractor = require('./core/extractor');
const Logger = require('./utils/logger');
const Config = require('./utils/config');

// Package info
const packageJson = require('../package.json');

// Main CLI function
async function main() {
  program
    .name('adobe-dtm-extract')
    .description('Extract rules from Adobe DTM/Launch scripts with recursive discovery')
    .version(packageJson.version)
    .argument('<url>', 'Adobe Launch URL or page URL to analyze')
    .option('-o, --output <dir>', 'Output directory', './output')
    .option('-f, --format <formats>', 'Output formats (comma-separated): json,csv,md', 'json,csv,md')
    .option('-r, --recursive', 'Recursively discover and process Adobe scripts', true)
    .option('--no-recursive', 'Disable recursive discovery')
    .option('-d, --depth <number>', 'Maximum recursion depth', '3')
    .option('--timeout <ms>', 'HTTP request timeout in milliseconds', '30000')
    .option('--separate-outputs', 'Create separate output files for each discovered script')
    .option('--config <file>', 'Custom configuration file path')
    .option('-v, --verbose', 'Verbose logging')
    .option('--debug', 'Debug logging')
    .action(async (url, options) => {
      const spinner = ora();

      try {
        // Initialize configuration
        const config = new Config(options.config);

        // Apply CLI options to config
        if (options.depth) {
          config.set('discovery.maxDepth', parseInt(options.depth));
        }
        if (options.timeout) {
          config.set('browser.timeout', parseInt(options.timeout));
        }

        // Set logging level
        let logLevel = 'info';
        if (options.debug) logLevel = 'debug';
        else if (options.verbose) logLevel = 'debug';
        config.set('logging.level', logLevel);

        // Initialize logger
        const logger = new Logger(config.get('logging'));

        // Print header
        console.log(chalk.bold.cyan('\n🚀 Adobe DTM/Launch Rule Extractor\n'));
        logger.info(`Analyzing: ${chalk.underline(url)}`);
        logger.info(`Output directory: ${options.output}`);
        logger.info(`Formats: ${options.format}`);
        logger.info(`Recursive: ${options.recursive ? 'Yes' : 'No'}`);

        if (options.recursive) {
          logger.info(`Max depth: ${options.depth}`);
        }

        console.log(); // Empty line

        // Create extractor
        const extractor = new AdobeDTMExtractor(logger, config);

        // Run extraction
        spinner.start('Starting extraction...');

        const result = options.recursive
          ? await extractor.extractRecursive(url, options)
          : await extractor.extract(url, options);

        spinner.stop();

        // Print summary
        if (result.success || (result.scriptsProcessed && result.scriptsProcessed > 0)) {
          console.log(chalk.bold.green('\n✓ Extraction completed successfully!\n'));

          if (result.scriptsProcessed) {
            console.log(chalk.bold('Summary:'));
            console.log(`  Scripts processed: ${result.scriptsProcessed}`);

            if (result.merged) {
              const ruleCount = Array.isArray(result.merged.rules)
                ? result.merged.rules.length
                : Object.keys(result.merged.rules || {}).length;

              console.log(`  Total rules: ${ruleCount}`);
              console.log(`  Data elements: ${Object.keys(result.merged.dataElements || {}).length}`);
              console.log(`  Extensions: ${Object.keys(result.merged.extensions || {}).length}`);
            }
          } else {
            const ruleCount = Array.isArray(result.rules)
              ? result.rules.length
              : Object.keys(result.rules || {}).length;

            console.log(chalk.bold('Summary:'));
            console.log(`  Rules: ${ruleCount}`);
            console.log(`  Data elements: ${Object.keys(result.dataElements || {}).length}`);
            console.log(`  Extensions: ${Object.keys(result.extensions || {}).length}`);
          }

          console.log(`\n  Output: ${options.output}\n`);
        } else {
          console.log(chalk.bold.red('\n✗ Extraction failed\n'));
          if (result.error) {
            console.error(chalk.red(`Error: ${result.error}`));
          }
          process.exit(1);
        }

      } catch (error) {
        spinner.stop();
        console.error(chalk.bold.red('\n✗ Fatal error:\n'));
        console.error(chalk.red(error.message));

        if (options.debug || options.verbose) {
          console.error(chalk.gray('\nStack trace:'));
          console.error(chalk.gray(error.stack));
        }

        process.exit(1);
      }
    });

  // Parse arguments
  program.parse(process.argv);
}

// Run main function
main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});
