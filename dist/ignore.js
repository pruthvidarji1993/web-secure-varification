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
exports.loadIgnoreConfig = loadIgnoreConfig;
exports.shouldIgnoreIssue = shouldIgnoreIssue;
exports.applyInlineIgnores = applyInlineIgnores;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadIgnoreConfig(projectPath, ignoreFilePath) {
    const config = {
        ignoredFiles: new Set(),
        ignoredScanners: new Set(),
        ignoredRuleIds: new Set(),
        ignoredFilePatterns: [],
    };
    const candidates = ignoreFilePath
        ? [ignoreFilePath]
        : [
            path.join(projectPath, '.scannerignore'),
            path.join(projectPath, '.wsvignore'),
        ];
    let ignoreFilePath2 = null;
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            ignoreFilePath2 = candidate;
            break;
        }
    }
    if (!ignoreFilePath2)
        return config;
    const lines = fs.readFileSync(ignoreFilePath2, 'utf8').split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        // Directives: "scanner:<name>", "rule:<ruleId>", "file:<path>"
        if (line.startsWith('scanner:')) {
            config.ignoredScanners.add(line.slice('scanner:'.length).trim());
        }
        else if (line.startsWith('rule:')) {
            config.ignoredRuleIds.add(line.slice('rule:'.length).trim());
        }
        else if (line.startsWith('file:')) {
            config.ignoredFiles.add(line.slice('file:'.length).trim());
        }
        else {
            // Treat as a glob pattern for file paths
            // Convert simple glob to regex: * → [^/]*, ** → .*
            const regexStr = line
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\\\*/g, '*')
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*');
            try {
                config.ignoredFilePatterns.push(new RegExp(regexStr));
            }
            catch {
                // invalid pattern, skip
            }
        }
    }
    return config;
}
function shouldIgnoreIssue(issue, ignoreConfig) {
    // Check scanner-level ignore
    if (ignoreConfig.ignoredScanners.has(issue.scanner))
        return true;
    // Check rule ID ignore
    if (issue.ruleId && ignoreConfig.ignoredRuleIds.has(issue.ruleId))
        return true;
    if (ignoreConfig.ignoredRuleIds.has(issue.id))
        return true;
    // Check file-level ignore
    if (issue.file) {
        if (ignoreConfig.ignoredFiles.has(issue.file))
            return true;
        for (const pattern of ignoreConfig.ignoredFilePatterns) {
            if (pattern.test(issue.file))
                return true;
        }
    }
    return false;
}
function applyInlineIgnores(content, issues, filePath, projectPath) {
    const lines = content.split('\n');
    const relPath = path.relative(projectPath, filePath);
    // Find all lines with disable directives
    const disabledLines = new Map(); // lineNumber → set of ruleIds (empty = all)
    const disabledRangeStart = new Map(); // for wsv-disable (multi-line)
    const disabledRangeEnd = new Set(); // lines where enable is found
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // wsv-disable-next-line [rule1, rule2] OR wsv-disable-next-line (all)
        const nextLineMatch = line.match(/\/\/\s*wsv-disable-next-line\s*(.*)/);
        if (nextLineMatch) {
            const rules = nextLineMatch[1].trim();
            const ruleSet = rules ? new Set(rules.split(/[\s,]+/).filter(Boolean)) : new Set();
            disabledLines.set(lineNum + 1, ruleSet);
        }
        // wsv-disable [rules] (start of block)
        const disableMatch = line.match(/\/\/\s*wsv-disable\s*(.*)/);
        if (disableMatch && !line.includes('wsv-disable-next-line')) {
            const rules = disableMatch[1].trim();
            const ruleSet = rules ? new Set(rules.split(/[\s,]+/).filter(Boolean)) : new Set();
            disabledRangeStart.set(lineNum, ruleSet);
        }
        // wsv-enable
        if (/\/\/\s*wsv-enable/.test(line)) {
            disabledRangeEnd.add(lineNum);
        }
    }
    // Build range-disabled lines
    let activeRangeRules = null;
    const rangeDisabledLines = new Map();
    for (let i = 1; i <= lines.length + 1; i++) {
        if (disabledRangeStart.has(i)) {
            activeRangeRules = disabledRangeStart.get(i);
        }
        if (disabledRangeEnd.has(i)) {
            activeRangeRules = null;
        }
        if (activeRangeRules !== null) {
            rangeDisabledLines.set(i, activeRangeRules);
        }
    }
    return issues.filter((issue) => {
        if (!issue.file || issue.file !== relPath)
            return true;
        if (issue.line === undefined)
            return true;
        const lineDisabled = disabledLines.get(issue.line);
        const rangeDisabled = rangeDisabledLines.get(issue.line);
        function isDisabledByRuleSet(ruleSet) {
            if (ruleSet.size === 0)
                return true; // all rules disabled
            if (issue.ruleId && ruleSet.has(issue.ruleId))
                return true;
            if (ruleSet.has(issue.id))
                return true;
            if (ruleSet.has(issue.scanner))
                return true;
            return false;
        }
        if (lineDisabled !== undefined && isDisabledByRuleSet(lineDisabled))
            return false;
        if (rangeDisabled !== undefined && isDisabledByRuleSet(rangeDisabled))
            return false;
        return true;
    });
}
//# sourceMappingURL=ignore.js.map