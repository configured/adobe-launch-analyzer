const { createObjectCsvStringifier } = require('csv-writer');
const RuleHelpers = require('../utils/rule-helpers');

class CSVFormatter {
  constructor(config) {
    this.config = config;
  }

  format(extractedData) {
    const rules = this.normalizeRules(extractedData.rules);

    if (rules.length === 0) {
      return 'No rules found\n';
    }

    const records = rules.map(rule => {
      // Get event types
      const eventTypes = (rule.events || []).map(e => RuleHelpers.getEventType(e.modulePath)).join('; ');

      // Get condition types
      const conditionTypes = (rule.conditions || []).map(c => RuleHelpers.getConditionType(c.modulePath)).join('; ');

      // Get action types
      const actionTypes = (rule.actions || []).map(a => RuleHelpers.getActionType(a.modulePath)).join('; ');

      // Get firing frequency
      const frequency = RuleHelpers.getRuleFrequency(rule);

      return {
        rule_id: rule.id || '',
        rule_name: rule.name || '',
        frequency: frequency,
        event_count: this.getCount(rule.events),
        event_types: eventTypes,
        condition_count: this.getCount(rule.conditions),
        condition_types: conditionTypes,
        action_count: this.getCount(rule.actions),
        action_types: actionTypes,
        sequential_processing: rule.sequentialProcessing ? 'Yes' : 'No',
        events_detail: this.jsonify(rule.events),
        conditions_detail: this.jsonify(rule.conditions),
        actions_detail: this.jsonify(rule.actions)
      };
    });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'rule_id', title: 'Rule ID' },
        { id: 'rule_name', title: 'Rule Name' },
        { id: 'frequency', title: 'Firing Frequency' },
        { id: 'event_count', title: 'Event Count' },
        { id: 'event_types', title: 'Event Types' },
        { id: 'condition_count', title: 'Condition Count' },
        { id: 'condition_types', title: 'Condition Types' },
        { id: 'action_count', title: 'Action Count' },
        { id: 'action_types', title: 'Action Types' },
        { id: 'sequential_processing', title: 'Sequential' },
        { id: 'events_detail', title: 'Events (Full JSON)' },
        { id: 'conditions_detail', title: 'Conditions (Full JSON)' },
        { id: 'actions_detail', title: 'Actions (Full JSON)' }
      ]
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  normalizeRules(rules) {
    if (!rules) return [];
    if (Array.isArray(rules)) return rules;
    // If rules is an object, convert to array
    return Object.values(rules);
  }

  getCount(arr) {
    if (!arr) return 0;
    return Array.isArray(arr) ? arr.length : 0;
  }

  jsonify(obj) {
    if (!obj) return '';
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return '';
    }
  }

  getFileExtension() {
    return 'csv';
  }
}

module.exports = CSVFormatter;
