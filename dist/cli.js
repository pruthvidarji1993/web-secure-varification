#!/usr/bin/env node
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const child_process = __importStar(require("child_process"));
const commander_1 = require("commander");
const scanner_1 = require("./scanner");
const console_1 = require("./reporters/console");
const json_1 = require("./reporters/json");
const html_1 = require("./reporters/html");
const markdown_1 = require("./reporters/markdown");
const sarif_1 = require("./reporters/sarif");
const VALID_FORMATS = ['console', 'json', 'html', 'markdown', 'sarif'];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_LEVELS = {
    critical: 5, high: 4, medium: 3, low: 2, info: 1,
};
function loadConfig(configPath) {
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    catch (err) {
        console.error(`Warning: Failed to load config file "${configPath}":`, err instanceof Error ? err.message : err);
        return {};
    }
}
function findConfig(startPath) {
    const candidates = ['.wsvrc.json', '.wsvrc', 'wsv.config.json'];
    let currentDir = startPath;
    for (let i = 0; i < 5; i++) {
        for (const candidate of candidates) {
            const fullPath = path.join(currentDir, candidate);
            if (fs.existsSync(fullPath))
                return fullPath;
        }
        const parent = path.dirname(currentDir);
        if (parent === currentDir)
            break;
        currentDir = parent;
    }
    return null;
}
function shouldFailBuild(summary, failOn) {
    return failOn.some((sev) => (summary[sev] ?? 0) > 0);
}
async function runInteractiveFix(issues, projectPath) {
    const fixable = issues.filter((i) => i.fixable && i.fixCommand);
    if (fixable.length === 0) {
        console.log('\nNo auto-fixable issues found.');
        return;
    }
    console.log(`\n${'─'.repeat(76)}`);
    console.log(`  AUTO-FIX: ${fixable.length} fixable issue(s) found`);
    console.log(`${'─'.repeat(76)}\n`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
    // Group by unique fixCommand to avoid running duplicates
    const seen = new Set();
    const uniqueFixes = [];
    for (const issue of fixable) {
        if (!seen.has(issue.fixCommand)) {
            seen.add(issue.fixCommand);
            uniqueFixes.push(issue);
        }
    }
    let fixedCount = 0;
    for (const issue of uniqueFixes) {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.title}`);
        if (issue.file)
            console.log(`         File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        console.log(`         Fix:  ${issue.fixCommand}`);
        const answer = await question('  Apply fix? [y/N/a(ll)/q(uit)] ').then((a) => a.trim().toLowerCase());
        if (answer === 'q') {
            console.log('  Aborted.');
            break;
        }
        if (answer === 'y' || answer === 'a') {
            try {
                console.log(`  Running: ${issue.fixCommand}`);
                child_process.execSync(issue.fixCommand, { cwd: projectPath, stdio: 'inherit' });
                console.log('  ✓ Done\n');
                fixedCount++;
            }
            catch {
                console.log('  ✗ Failed\n');
            }
            if (answer === 'a') {
                // Apply all remaining without asking
                for (const remaining of uniqueFixes.slice(uniqueFixes.indexOf(issue) + 1)) {
                    try {
                        console.log(`  Running: ${remaining.fixCommand}`);
                        child_process.execSync(remaining.fixCommand, { cwd: projectPath, stdio: 'inherit' });
                        console.log('  ✓ Done\n');
                        fixedCount++;
                    }
                    catch {
                        console.log('  ✗ Failed\n');
                    }
                }
                break;
            }
        }
        else {
            console.log('  Skipped\n');
        }
    }
    rl.close();
    console.log(`\n  ${fixedCount} fix(es) applied.`);
}
const program = new commander_1.Command();
program
    .name('web-secure-verify')
    .description('Security scanning CLI tool for React and Next.js projects')
    .version('1.0.0');
program
    .command('scan')
    .description('Scan a project for security vulnerabilities')
    .option('-p, --path <path>', 'Project path to scan', process.cwd())
    .option('-f, --format <fmt>', 'Output format: console|json|html|markdown|sarif', 'console')
    .option('-o, --output <file>', 'Output file path (for json/html/markdown/sarif formats)')
    .option('-s, --severity <lvl>', 'Minimum severity level: info|low|medium|high|critical', 'low')
    .option('--skip <scanners>', 'Comma-separated list of scanners to skip')
    .option('--fail-on <levels>', 'Comma-separated severity levels that fail the build (e.g. critical,high)')
    .option('--fix', 'Interactively apply auto-fixes after scan')
    .option('--ignore-file <file>', 'Path to ignore file (default: .scannerignore)')
    .option('-c, --config <file>', 'Config file path (.wsvrc.json)')
    .option('--list-scanners', 'List all available scanners and exit')
    .action(async (cmdOptions) => {
    if (cmdOptions.listScanners) {
        console.log('\nAvailable scanners:\n');
        for (const name of Object.keys(scanner_1.ALL_SCANNERS)) {
            console.log(`  ${name}`);
        }
        console.log();
        process.exit(0);
    }
    const projectPath = path.resolve(cmdOptions.path);
    let fileConfig = {};
    const configPath = cmdOptions.config
        ? path.resolve(cmdOptions.config)
        : findConfig(projectPath);
    if (configPath) {
        fileConfig = loadConfig(configPath);
        if (!cmdOptions.config)
            console.log(`Using config: ${configPath}`);
    }
    const format = (cmdOptions.format !== 'console'
        ? cmdOptions.format
        : fileConfig.format ?? cmdOptions.format);
    const severity = (cmdOptions.severity !== 'low'
        ? cmdOptions.severity
        : fileConfig.severity ?? cmdOptions.severity);
    const skipList = [];
    if (cmdOptions.skip) {
        skipList.push(...cmdOptions.skip.split(',').map((s) => s.trim()));
    }
    else if (fileConfig.skip) {
        skipList.push(...fileConfig.skip);
    }
    // --fail-on parsing
    let failOn = [];
    if (cmdOptions.failOn) {
        failOn = cmdOptions.failOn.split(',').map((s) => s.trim());
    }
    else if (fileConfig.failOn) {
        failOn = fileConfig.failOn;
    }
    else {
        // Default: fail on critical and high
        failOn = ['critical', 'high'];
    }
    // Validate
    if (!VALID_FORMATS.includes(format)) {
        console.error(`Error: Invalid format "${format}". Valid: ${VALID_FORMATS.join(', ')}`);
        process.exit(1);
    }
    if (!VALID_SEVERITIES.includes(severity)) {
        console.error(`Error: Invalid severity "${severity}". Valid: ${VALID_SEVERITIES.join(', ')}`);
        process.exit(1);
    }
    for (const sev of failOn) {
        if (!VALID_SEVERITIES.includes(sev)) {
            console.error(`Error: Invalid --fail-on level "${sev}". Valid: ${VALID_SEVERITIES.join(', ')}`);
            process.exit(1);
        }
    }
    const options = {
        path: projectPath,
        format,
        output: cmdOptions.output ?? fileConfig.output,
        severity,
        skip: skipList,
        config: configPath ?? undefined,
        fix: cmdOptions.fix,
        failOn,
        ignoreFile: cmdOptions.ignoreFile,
    };
    try {
        if (format === 'console') {
            console.log(`\nScanning project at: ${projectPath}\n`);
        }
        const report = await (0, scanner_1.runScan)(options);
        const output = options.output;
        switch (format) {
            case 'console':
                (0, console_1.renderConsoleReport)(report);
                break;
            case 'json': {
                const json = (0, json_1.renderJsonReport)(report, output);
                if (!output)
                    console.log(json);
                else
                    console.log(`JSON report written to: ${output}`);
                break;
            }
            case 'html':
                (0, html_1.renderHtmlReport)(report, output);
                if (output)
                    console.log(`HTML report written to: ${output}`);
                break;
            case 'markdown': {
                const md = (0, markdown_1.renderMarkdownReport)(report, output);
                if (!output)
                    console.log(md);
                else
                    console.log(`Markdown report written to: ${output}`);
                break;
            }
            case 'sarif': {
                const sarif = (0, sarif_1.renderSarifReport)(report, output);
                if (!output)
                    console.log(sarif);
                else
                    console.log(`SARIF report written to: ${output}`);
                break;
            }
        }
        // Interactive fix mode
        if (options.fix) {
            const allIssues = report.results.flatMap((r) => r.issues);
            await runInteractiveFix(allIssues, projectPath);
        }
        // Exit code based on --fail-on
        const failed = shouldFailBuild(report.summary, failOn);
        // Show fail-on summary for non-console formats
        if (format !== 'console' && failed) {
            const counts = failOn
                .filter((s) => (report.summary[s] ?? 0) > 0)
                .map((s) => `${report.summary[s]} ${s}`)
                .join(', ');
            console.error(`\nBuild failed: ${counts} severity issue(s) found.`);
        }
        process.exit(failed ? 1 : 0);
    }
    catch (err) {
        console.error('\nError during scan:', err instanceof Error ? err.message : String(err));
        process.exit(2);
    }
});
program
    .command('list-scanners')
    .description('List all available scanners')
    .action(() => {
    console.log('\nAvailable scanners:\n');
    const descriptions = {
        'npm-audit': 'CVE vulnerabilities in dependencies (direct + transitive)',
        outdated: 'Outdated packages needing version updates',
        deprecated: 'Packages officially deprecated on the npm registry',
        secrets: 'Hardcoded secrets, API keys, and high-entropy strings',
        'code-security': 'eval(), innerHTML, XSS, injection patterns',
        nextjs: 'Next.js config misconfigurations and security headers',
        license: 'Restrictive or unknown licenses in dependencies',
        'supply-chain': 'Typosquatting, malicious packages, postinstall scripts',
        'rsc-boundary': 'Next.js RSC/client boundary violations',
        hydration: 'React hydration mismatch patterns',
        bundle: 'Bundle size impact (unoptimized imports)',
        'source-maps': 'Exposed source maps in production builds',
    };
    for (const [name, desc] of Object.entries(descriptions)) {
        console.log(`  ${name.padEnd(16)} ${desc}`);
    }
    console.log();
});
if (process.argv.length === 2) {
    program.help();
}
program.parse(process.argv);
//# sourceMappingURL=cli.js.map