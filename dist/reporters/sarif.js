"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSarifReport = renderSarifReport;
const fs = __importStar(require("fs"));
function severityToSarifLevel(severity) {
    switch (severity) {
        case 'critical': return 'error';
        case 'high': return 'error';
        case 'medium': return 'warning';
        case 'low': return 'note';
        case 'info': return 'none';
    }
}
function buildRules(report) {
    const seenRuleIds = new Set();
    const rules = [];
    for (const result of report.results) {
        for (const issue of result.issues) {
            const ruleId = issue.ruleId || issue.id;
            if (!seenRuleIds.has(ruleId)) {
                seenRuleIds.add(ruleId);
                rules.push({
                    id: ruleId,
                    name: issue.title.replace(/[^a-zA-Z0-9]/g, ''),
                    shortDescription: { text: issue.title },
                    fullDescription: { text: issue.description.split('\n')[0] },
                    defaultConfiguration: {
                        level: severityToSarifLevel(issue.severity),
                    },
                    properties: {
                        tags: [issue.scanner, 'security'],
                        severity: issue.severity,
                    },
                });
            }
        }
    }
    return rules;
}
function buildResults(report) {
    const results = [];
    for (const scanResult of report.results) {
        for (const issue of scanResult.issues) {
            const ruleId = issue.ruleId || issue.id;
            const result = {
                ruleId,
                level: severityToSarifLevel(issue.severity),
                message: {
                    text: issue.description.split('\n')[0],
                },
            };
            if (issue.file) {
                result.locations = [
                    {
                        physicalLocation: {
                            artifactLocation: {
                                uri: issue.file.replace(/\\/g, '/'),
                                uriBaseId: '%SRCROOT%',
                            },
                            region: issue.line
                                ? {
                                    startLine: issue.line,
                                    startColumn: 1,
                                }
                                : undefined,
                        },
                    },
                ];
            }
            else {
                result.locations = [
                    {
                        physicalLocation: {
                            artifactLocation: {
                                uri: '.',
                                uriBaseId: '%SRCROOT%',
                            },
                        },
                    },
                ];
            }
            if (issue.fix) {
                result.fixes = [
                    {
                        description: { text: issue.fix },
                    },
                ];
            }
            results.push(result);
        }
    }
    return results;
}
function renderSarifReport(report, outputPath) {
    const sarif = {
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'web-secure-verification',
                        version: '1.0.0',
                        informationUri: 'https://www.npmjs.com/package/web-secure-verification',
                        rules: buildRules(report),
                    },
                },
                results: buildResults(report),
                artifacts: [],
                columnKind: 'unicodeCodePoints',
            },
        ],
    };
    const output = JSON.stringify(sarif, null, 2);
    if (outputPath) {
        fs.writeFileSync(outputPath, output, 'utf8');
    }
    return output;
}
//# sourceMappingURL=sarif.js.map