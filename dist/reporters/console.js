"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderConsoleReport = renderConsoleReport;
const chalk_1 = __importDefault(require("chalk"));
const SEVERITY_COLORS = {
    critical: chalk_1.default.bgRed.white.bold,
    high: chalk_1.default.red.bold,
    medium: chalk_1.default.yellow.bold,
    low: chalk_1.default.cyan,
    info: chalk_1.default.gray,
};
const SEVERITY_BADGES = {
    critical: chalk_1.default.bgRed.white.bold(' CRITICAL '),
    high: chalk_1.default.bgYellow.black.bold('  HIGH   '),
    medium: chalk_1.default.bgCyanBright.black.bold(' MEDIUM  '),
    low: chalk_1.default.bgBlue.white.bold('   LOW   '),
    info: chalk_1.default.bgGray.white.bold('  INFO   '),
};
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
function severityColor(severity) {
    return SEVERITY_COLORS[severity] || chalk_1.default.white;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
function printSeparator(char = '─', width = 80) {
    console.log(chalk_1.default.gray(char.repeat(width)));
}
function printHeader(report) {
    console.log('');
    console.log(chalk_1.default.bold.blue('╔══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk_1.default.bold.blue('║') + chalk_1.default.bold.white('          🔒  Web Secure Verification — Security Scan Report              ') + chalk_1.default.bold.blue('║'));
    console.log(chalk_1.default.bold.blue('╚══════════════════════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk_1.default.gray('  Project:  ') + chalk_1.default.white(report.projectName));
    console.log(chalk_1.default.gray('  Path:     ') + chalk_1.default.white(report.projectPath));
    console.log(chalk_1.default.gray('  Scanned:  ') + chalk_1.default.white(new Date(report.scannedAt).toLocaleString()));
    console.log(chalk_1.default.gray('  Duration: ') + chalk_1.default.white(formatDuration(report.duration)));
    console.log('');
}
function printSummary(report) {
    printSeparator();
    console.log(chalk_1.default.bold.white('  SUMMARY'));
    printSeparator();
    console.log('');
    const { summary } = report;
    const total = summary.total;
    if (total === 0) {
        console.log(chalk_1.default.green.bold('  ✓ No security issues found!'));
        console.log('');
        return;
    }
    // Summary table
    const cols = [
        { label: 'Critical', count: summary.critical, color: chalk_1.default.red.bold },
        { label: 'High', count: summary.high, color: chalk_1.default.yellow.bold },
        { label: 'Medium', count: summary.medium, color: chalk_1.default.cyan.bold },
        { label: 'Low', count: summary.low, color: chalk_1.default.blue.bold },
        { label: 'Info', count: summary.info, color: chalk_1.default.gray },
    ];
    console.log('  ' + cols.map((c) => c.color(c.label.padEnd(10))).join('  '));
    console.log('  ' + cols.map((c) => c.color(String(c.count).padEnd(10))).join('  '));
    console.log('');
    console.log(chalk_1.default.gray('  Total issues: ') + chalk_1.default.bold.white(String(total)));
    console.log('');
}
function printIssue(issue, index) {
    const badge = SEVERITY_BADGES[issue.severity];
    const color = severityColor(issue.severity);
    console.log(`  ${badge}  ${color(issue.title)}`);
    console.log(chalk_1.default.gray(`         ID: ${issue.id}`));
    if (issue.file) {
        const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
        console.log(chalk_1.default.gray('         File: ') + chalk_1.default.white(location));
    }
    console.log(chalk_1.default.gray('         Description: ') + chalk_1.default.white(issue.description.split('\n')[0]));
    if (issue.fix) {
        console.log(chalk_1.default.gray('         Fix: ') + chalk_1.default.green(issue.fix.split('\n')[0]));
    }
    if (issue.references && issue.references.length > 0) {
        console.log(chalk_1.default.gray('         Reference: ') + chalk_1.default.blue.underline(issue.references[0]));
    }
    console.log('');
}
function printScanResults(report) {
    const allIssues = [];
    for (const result of report.results) {
        allIssues.push(...result.issues);
    }
    if (allIssues.length === 0)
        return;
    // Group by severity
    for (const severity of SEVERITY_ORDER) {
        const sevIssues = allIssues.filter((i) => i.severity === severity);
        if (sevIssues.length === 0)
            continue;
        printSeparator();
        const color = severityColor(severity);
        console.log(color(`  ${severity.toUpperCase()} (${sevIssues.length} issue${sevIssues.length > 1 ? 's' : ''})`));
        printSeparator();
        console.log('');
        sevIssues.forEach((issue, idx) => printIssue(issue, idx));
    }
}
function printScannerErrors(report) {
    const errors = report.results.filter((r) => r.error);
    if (errors.length === 0)
        return;
    printSeparator('─');
    console.log(chalk_1.default.yellow.bold('  SCANNER WARNINGS'));
    printSeparator('─');
    console.log('');
    for (const result of errors) {
        console.log(chalk_1.default.yellow('  ⚠') +
            chalk_1.default.white(` Scanner "${result.scanner}" encountered an error: `) +
            chalk_1.default.gray(result.error || 'Unknown error'));
    }
    console.log('');
}
function printScannerSummary(report) {
    printSeparator();
    console.log(chalk_1.default.bold.white('  SCANNER DETAILS'));
    printSeparator();
    console.log('');
    for (const result of report.results) {
        const issueCount = result.issues.length;
        const status = result.error
            ? chalk_1.default.yellow('⚠ ERROR')
            : issueCount === 0
                ? chalk_1.default.green('✓ CLEAN')
                : chalk_1.default.red(`✗ ${issueCount} issue${issueCount > 1 ? 's' : ''}`);
        const duration = chalk_1.default.gray(`(${formatDuration(result.duration)})`);
        console.log(`  ${status.padEnd(30)} ${chalk_1.default.white(result.scanner)} ${duration}`);
    }
    console.log('');
}
function renderConsoleReport(report) {
    printHeader(report);
    printSummary(report);
    printScanResults(report);
    printScannerErrors(report);
    printScannerSummary(report);
    // Final verdict
    printSeparator('═');
    const { summary } = report;
    if (summary.critical > 0 || summary.high > 0) {
        console.log(chalk_1.default.red.bold('  ✗ SCAN FAILED — Critical or high severity issues found'));
        console.log(chalk_1.default.red(`    ${summary.critical} critical, ${summary.high} high severity issues must be addressed`));
    }
    else if (summary.medium > 0 || summary.low > 0) {
        console.log(chalk_1.default.yellow.bold('  ⚠ SCAN PASSED WITH WARNINGS — Medium or low severity issues found'));
        console.log(chalk_1.default.yellow(`    ${summary.medium} medium, ${summary.low} low severity issues should be reviewed`));
    }
    else {
        console.log(chalk_1.default.green.bold('  ✓ SCAN PASSED — No critical issues found'));
    }
    printSeparator('═');
    console.log('');
}
//# sourceMappingURL=console.js.map