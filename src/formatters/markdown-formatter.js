const RuleHelpers = require('../utils/rule-helpers');

class MarkdownFormatter {
  constructor(config) {
    this.config = config;
  }

  format(extractedData) {
    const rules = this.normalizeRules(extractedData.rules);
    const dataElements = extractedData.dataElements || {};
    const extensions = extractedData.extensions || {};

    let md = '# Adobe Launch Rules Extract\n\n';

    // Metadata section
    md += '## Summary\n\n';
    md += `**Source:** ${extractedData.url}\n\n`;
    md += `**Extracted:** ${extractedData.timestamp || new Date().toISOString()}\n\n`;
    md += `**Total Rules:** ${rules.length}\n\n`;
    md += `**Data Elements:** ${Object.keys(dataElements).length}\n\n`;
    md += `**Extensions:** ${Object.keys(extensions).length}\n\n`;

    // Build Information
    if (extractedData.buildInfo) {
      md += '### Build Information\n\n';
      md += `- **Build Date:** ${extractedData.buildInfo.buildDate || 'N/A'}\n`;
      md += `- **Minified:** ${extractedData.buildInfo.minified ? 'Yes' : 'No'}\n`;
      md += `- **Turbine Version:** ${extractedData.buildInfo.turbineVersion || 'N/A'}\n`;
      md += `- **Turbine Build Date:** ${extractedData.buildInfo.turbineBuildDate || 'N/A'}\n\n`;
    }

    // Property Information
    if (extractedData.property) {
      md += '### Property Information\n\n';
      md += `- **Property ID:** ${extractedData.property.id || 'N/A'}\n`;
      md += `- **Property Name:** ${extractedData.property.name || 'N/A'}\n\n`;
    }

    // Company Information
    if (extractedData.company) {
      md += '### Company Information\n\n';
      md += `- **Company ID:** ${extractedData.company.id || 'N/A'}\n`;
      md += `- **Org ID:** ${extractedData.company.orgId || 'N/A'}\n\n`;
    }

    // Environment Information
    if (extractedData.environment) {
      md += '### Environment\n\n';
      md += `- **Environment ID:** ${extractedData.environment.id || 'N/A'}\n`;
      md += `- **Stage:** ${extractedData.environment.stage || 'N/A'}\n\n`;
    }

    // Rules section
    if (rules.length > 0) {
      md += '## Rules\n\n';
      md += `Found ${rules.length} rules in this Adobe Launch property.\n\n`;

      rules.forEach((rule, index) => {
        md += `### ${index + 1}. ${rule.name || 'Unnamed Rule'}\n\n`;
        md += `**Rule ID:** \`${rule.id || 'no-id'}\`\n\n`;

        // When fired summary
        md += RuleHelpers.getWhenFiredSummary(rule);
        md += '\n';

        // Frequency
        const frequency = RuleHelpers.getRuleFrequency(rule);
        md += `**Frequency:** ${frequency}\n\n`;

        // Events (detailed)
        const events = rule.events || [];
        md += `#### Events (${events.length})\n\n`;
        if (events.length > 0) {
          events.forEach((event, idx) => {
            const eventType = RuleHelpers.getEventType(event.modulePath);
            md += `${idx + 1}. **${eventType}**\n`;
            md += `   - **Module:** \`${event.modulePath || 'N/A'}\`\n`;

            if (event.settings && Object.keys(event.settings).length > 0) {
              md += `   - **Configuration:**\n`;
              Object.entries(event.settings).forEach(([key, value]) => {
                // Special handling for specific settings
                if (key === 'elementSelector') {
                  md += `     - **Element Selector:** \`${value}\` (where the event fires)\n`;
                } else if (key === 'identifier') {
                  md += `     - **Direct Call Identifier:** \`${value}\`\n`;
                } else if (key === 'bubbleFireIfParent') {
                  md += `     - **Bubble to Parent:** ${value ? 'Yes' : 'No'}\n`;
                } else if (key === 'bubbleFireIfChildFired') {
                  md += `     - **Fire if Child Fired:** ${value ? 'Yes' : 'No'}\n`;
                } else if (key === 'bubbleStop') {
                  md += `     - **Stop Propagation:** ${value ? 'Yes' : 'No'}\n`;
                } else if (key === 'delay') {
                  md += `     - **Delay:** ${value}ms\n`;
                } else {
                  md += `     - **${key}:** ${this.formatSettingValue(value)}\n`;
                }
              });
            }

            if (event.ruleOrder !== undefined) {
              md += `   - **Rule Order:** ${event.ruleOrder}\n`;
            }
            md += '\n';
          });
        } else {
          md += '- None\n\n';
        }

        // Conditions (detailed)
        const conditions = rule.conditions || [];
        md += `#### Conditions (${conditions.length})\n\n`;
        if (conditions.length > 0) {
          md += '*All conditions must be met (AND logic)*\n\n';
          conditions.forEach((condition, idx) => {
            const conditionType = RuleHelpers.getConditionType(condition.modulePath);
            md += `${idx + 1}. **${conditionType}**\n`;
            md += `   - **Module:** \`${condition.modulePath || 'N/A'}\`\n`;

            if (condition.settings && Object.keys(condition.settings).length > 0) {
              md += `   - **Configuration:**\n`;
              Object.entries(condition.settings).forEach(([key, value]) => {
                if (key === 'source' && value && value.__isFunction) {
                  // Custom code - show the function
                  md += `     - **Custom Code:**\n`;
                  md += '       ```javascript\n';
                  md += this.indentCode(value.source, '       ');
                  md += '\n       ```\n';
                } else if (key === 'paths' && Array.isArray(value)) {
                  md += `     - **Paths (${value.length} total):**\n`;
                  value.slice(0, 10).forEach(path => {
                    md += `       - \`${path.value}\`${path.valueIsRegex ? ' (regex)' : ''}\n`;
                  });
                  if (value.length > 10) {
                    md += `       - ... and ${value.length - 10} more\n`;
                  }
                } else if (key === 'comparison' && typeof value === 'object') {
                  md += `     - **Comparison:**\n`;
                  Object.entries(value).forEach(([k, v]) => {
                    md += `       - ${k}: \`${v}\`\n`;
                  });
                } else if (key === 'leftOperand' || key === 'rightOperand') {
                  md += `     - **${key}:** \`${value}\`\n`;
                } else if (key === 'start' || key === 'end') {
                  md += `     - **${key === 'start' ? 'Start Date' : 'End Date'}:** ${value}\n`;
                } else {
                  md += `     - **${key}:** ${this.formatSettingValue(value)}\n`;
                }
              });
            }

            if (condition.timeout) {
              md += `   - **Timeout:** ${condition.timeout}ms\n`;
            }
            if (condition.negate) {
              md += `   - **Negate:** Yes ⚠️ (condition is inverted - fires when FALSE)\n`;
            }
            md += '\n';
          });
        } else {
          md += '- None (rule always fires when event occurs)\n\n';
        }

        // Actions (detailed)
        const actions = rule.actions || [];
        md += `#### Actions (${actions.length})\n\n`;
        if (actions.length > 0) {
          actions.forEach((action, idx) => {
            const actionType = RuleHelpers.getActionType(action.modulePath);
            md += `${idx + 1}. **${actionType}**\n`;
            md += `   - **Module:** \`${action.modulePath || 'N/A'}\`\n`;

            if (action.settings && Object.keys(action.settings).length > 0) {
              md += `   - **Configuration:**\n`;
              Object.entries(action.settings).forEach(([key, value]) => {
                if (key === 'source' && value && value.__isFunction) {
                  // Custom code - show the function
                  md += `     - **Custom Code:**\n`;
                  md += '       ```javascript\n';
                  md += this.indentCode(value.source, '       ');
                  md += '\n       ```\n';
                } else if (key === 'source' && typeof value === 'string' && value.startsWith('http')) {
                  md += `     - **External Script:** ${value}\n`;
                } else if (key === 'isExternal') {
                  md += `     - **External:** ${value ? 'Yes' : 'No'}\n`;
                } else if (key === 'language') {
                  md += `     - **Language:** ${value}\n`;
                } else if (key === 'global') {
                  md += `     - **Global Scope:** ${value ? 'Yes' : 'No'}\n`;
                } else {
                  md += `     - **${key}:** ${this.formatSettingValue(value)}\n`;
                }
              });
            }

            if (action.order !== undefined) {
              md += `   - **Execution Order:** ${action.order}\n`;
            }
            if (action.timeout) {
              md += `   - **Timeout:** ${action.timeout}ms\n`;
            }
            if (action.delayNext) {
              md += `   - **Delay Next Action:** Yes (waits for this to complete)\n`;
            }
            md += '\n';
          });
        } else {
          md += '- None\n\n';
        }

        // Rule-level settings
        if (rule.sequentialProcessing !== undefined) {
          md += `**Sequential Processing:** ${rule.sequentialProcessing ? 'Yes (actions run in order)' : 'No (actions run in parallel)'}\n\n`;
        }

        md += '---\n\n';
      });
    }

    // Data Elements section
    if (Object.keys(dataElements).length > 0) {
      md += '## Data Elements\n\n';
      md += `${Object.keys(dataElements).length} data elements available for use in rules.\n\n`;

      Object.entries(dataElements).forEach(([name, element]) => {
        md += `### ${name}\n\n`;
        md += `- **Module:** \`${element.modulePath || 'N/A'}\`\n`;
        if (element.storageDuration) {
          md += `- **Storage Duration:** ${element.storageDuration}\n`;
        }
        if (element.defaultValue !== undefined) {
          md += `- **Default Value:** \`${element.defaultValue}\`\n`;
        }
        if (element.forceLowerCase) {
          md += `- **Force Lowercase:** Yes\n`;
        }
        if (element.cleanText) {
          md += `- **Clean Text:** Yes\n`;
        }
        if (element.settings && Object.keys(element.settings).length > 0) {
          md += `- **Settings:**\n`;
          Object.entries(element.settings).forEach(([key, value]) => {
            if (key === 'source' && value && value.__isFunction) {
              md += `  - **Custom Code:**\n`;
              md += '    ```javascript\n';
              md += this.indentCode(value.source, '    ');
              md += '\n    ```\n';
            } else if (key === 'path') {
              md += `  - **JavaScript Path:** \`${value}\`\n`;
            } else if (key === 'name') {
              md += `  - **Parameter Name:** \`${value}\`\n`;
            } else if (key === 'attribute') {
              md += `  - **Page Attribute:** \`${value}\`\n`;
            } else {
              md += `  - **${key}:** ${this.formatSettingValue(value)}\n`;
            }
          });
        }
        md += '\n';
      });
    }

    // Extensions section
    if (Object.keys(extensions).length > 0) {
      md += '## Extensions\n\n';
      md += `${Object.keys(extensions).length} extensions installed.\n\n`;

      Object.entries(extensions).forEach(([id, extension]) => {
        md += `### ${extension.displayName || id}\n\n`;
        md += `- **Extension ID:** \`${id}\`\n`;
        if (extension.modulePath) {
          md += `- **Module Path:** \`${extension.modulePath}\`\n`;
        }
        if (extension.settings && Object.keys(extension.settings).length > 0) {
          md += `- **Settings:**\n`;
          Object.entries(extension.settings).forEach(([key, value]) => {
            md += `  - ${key}: \`${this.formatValue(value)}\`\n`;
          });
        }
        md += '\n';
      });
    }

    return md;
  }

  formatValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return value.length > 100 ? value.substring(0, 100) + '...' : value;
    if (typeof value === 'function') return '[Function]';
    if (value && value.__isFunction) return '[Function - see Custom Code section]';
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 200);
    return String(value);
  }

  formatSettingValue(value) {
    if (value === null || value === undefined) return '`null`';
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (typeof value === 'string') {
      // Don't truncate - show full value
      return value.length > 500 ? `\`${value.substring(0, 500)}...\`` : `\`${value}\``;
    }
    if (value && value.__isFunction) {
      return '[Custom Code - see below]';
    }
    if (typeof value === 'object') {
      return `\`${JSON.stringify(value)}\``;
    }
    return `\`${String(value)}\``;
  }

  indentCode(code, indent = '  ') {
    if (!code) return '';
    return code.split('\n').map(line => indent + line).join('\n');
  }

  normalizeRules(rules) {
    if (!rules) return [];
    if (Array.isArray(rules)) return rules;
    return Object.values(rules);
  }

  getFileExtension() {
    return 'md';
  }
}

module.exports = MarkdownFormatter;
