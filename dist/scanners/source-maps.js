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
exports.runSourceMapsScanner = runSourceMapsScanner;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const glob_1 = require("glob");
// Directories that are web-served and should not contain .map files
// Note: 'dist' is intentionally excluded — it's npm package output, not a web-served directory
const PUBLIC_DIRS = ['public', 'out'];
// Directories to check for inline source maps in built output
const BUILD_OUTPUT_DIRS = ['dist', path.join('.next', 'static')];
function findMapFilesInDirectory(dirPath, projectPath) {
    const issues = [];
    if (!fs.existsSync(dirPath))
        return issues;
    let mapFiles = [];
    try {
        mapFiles = (0, glob_1.globSync)('**/*.map', {
            cwd: dirPath,
            absolute: true,
            ignore: [],
        });
    }
    catch {
        return issues;
    }
    for (const mapFile of mapFiles) {
        const relativePath = path.relative(projectPath, mapFile);
        issues.push({
            id: `source-maps-public-map-file-${relativePath}`,
            title: `Source map file exposed in public directory: ${relativePath}`,
            description: `A JavaScript source map file was found in "${relativePath}". ` +
                `Source maps in publicly accessible directories expose your original source code to anyone ` +
                `who views your website's network requests. This allows attackers to read your unminified ` +
                `source code, discover business logic, find vulnerabilities, and understand your architecture.`,
            severity: 'high',
            scanner: 'source-maps',
            file: relativePath,
            fix: 'Remove .map files from public directories before deploying to production. ' +
                'Configure your build tool to not generate source maps for production builds, ' +
                'or serve them only from an authenticated endpoint.',
            fixable: false,
            references: [
                'https://developer.chrome.com/docs/devtools/javascript/source-maps/',
                'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/02-Testing_for_Bypassing_Authorization_Schema',
            ],
            metadata: { mapFile: relativePath },
        });
    }
    return issues;
}
function checkNextConfigSourceMaps(projectPath) {
    const issues = [];
    const configFiles = ['next.config.js', 'next.config.ts', 'next.config.mjs'];
    for (const configFile of configFiles) {
        const configPath = path.join(projectPath, configFile);
        if (!fs.existsSync(configPath))
            continue;
        let content;
        try {
            content = fs.readFileSync(configPath, 'utf8');
        }
        catch {
            continue;
        }
        const relativePath = path.relative(projectPath, configPath);
        // Check for productionBrowserSourceMaps: true
        const pattern = /productionBrowserSourceMaps\s*:\s*true/;
        if (pattern.test(content)) {
            const lines = content.split('\n');
            const lineNumber = lines.findIndex((l) => /productionBrowserSourceMaps\s*:\s*true/.test(l)) + 1;
            issues.push({
                id: `source-maps-production-browser-source-maps-${relativePath}`,
                title: 'productionBrowserSourceMaps enabled in Next.js config',
                description: `"productionBrowserSourceMaps: true" is set in ${relativePath}. ` +
                    `This causes Next.js to generate and serve full source maps in production builds, ` +
                    `exposing your complete original source code to anyone who opens their browser DevTools. ` +
                    `Attackers can use this to read your business logic, find vulnerabilities, and steal proprietary code.`,
                severity: 'high',
                scanner: 'source-maps',
                file: relativePath,
                line: lineNumber > 0 ? lineNumber : undefined,
                fix: 'Remove "productionBrowserSourceMaps: true" from your next.config.js. ' +
                    'If you need source maps for error tracking (e.g., Sentry), upload them to the error tracking service instead of serving them publicly.',
                fixable: false,
                references: [
                    'https://nextjs.org/docs/api-reference/next.config.js/source-maps',
                    'https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/',
                ],
                metadata: { configFile: relativePath },
            });
        }
        // Only check the first config file found
        break;
    }
    return issues;
}
function checkWebpackSourceMaps(projectPath) {
    const issues = [];
    const webpackConfigPath = path.join(projectPath, 'webpack.config.js');
    if (!fs.existsSync(webpackConfigPath))
        return issues;
    let content;
    try {
        content = fs.readFileSync(webpackConfigPath, 'utf8');
    }
    catch {
        return issues;
    }
    const relativePath = path.relative(projectPath, webpackConfigPath);
    const lines = content.split('\n');
    // Check for devtool: 'source-map' or 'inline-source-map' (not eval variants)
    const devtoolPattern = /devtool\s*:\s*['"](?:source-map|inline-source-map|hidden-source-map|nosources-source-map)['"]/g;
    let match;
    while ((match = devtoolPattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNumber - 1] || '';
        const trimmed = lineContent.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*'))
            continue;
        const devtoolValue = match[0].match(/['"]([^'"]+)['"]/)?.[1] || '';
        const isPubliclyAccessible = ['source-map', 'inline-source-map'].includes(devtoolValue);
        issues.push({
            id: `source-maps-webpack-devtool-${relativePath}-${lineNumber}`,
            title: `Webpack devtool "${devtoolValue}" may expose source code in production`,
            description: `webpack.config.js sets devtool to "${devtoolValue}". ` +
                (isPubliclyAccessible
                    ? `This generates source maps that are publicly accessible and expose your original source code in production builds.`
                    : `This generates source maps. Ensure this configuration is not used in production builds, as source maps can expose your source code.`) +
                `\n\nFound in: ${relativePath}:${lineNumber}`,
            severity: 'medium',
            scanner: 'source-maps',
            file: relativePath,
            line: lineNumber,
            fix: 'For production builds, use devtool: false to disable source maps, or use "hidden-source-map" ' +
                'combined with uploading source maps to an error tracking service. ' +
                'Use NODE_ENV checks to apply different devtool settings for development vs production.',
            fixable: false,
            references: [
                'https://webpack.js.org/configuration/devtool/',
                'https://survivejs.com/webpack/building/source-maps/',
            ],
            metadata: { devtool: devtoolValue },
        });
    }
    return issues;
}
function checkGitTrackedMapFiles(projectPath) {
    const issues = [];
    // Only run if .git directory exists
    const gitDir = path.join(projectPath, '.git');
    if (!fs.existsSync(gitDir))
        return issues;
    let gitOutput;
    try {
        gitOutput = (0, child_process_1.execSync)('git ls-files | grep "\\.map$"', {
            cwd: projectPath,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch {
        // grep exits with code 1 when no matches found — that's fine
        return issues;
    }
    const mapFiles = gitOutput
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    for (const mapFile of mapFiles) {
        issues.push({
            id: `source-maps-git-tracked-${mapFile}`,
            title: `Source map file tracked by git: ${mapFile}`,
            description: `The file "${mapFile}" is a source map that is tracked by git. ` +
                `Committing source maps to version control means they may end up in deployed artifacts ` +
                `and be accessible to users in production. Source maps expose your original source code.`,
            severity: 'medium',
            scanner: 'source-maps',
            file: mapFile,
            fix: `Add "*.map" or "${mapFile}" to your .gitignore file to prevent source maps from being committed. ` +
                `Then remove the tracked file: git rm --cached "${mapFile}"`,
            fixable: false,
            references: ['https://git-scm.com/docs/gitignore'],
            metadata: { gitTrackedFile: mapFile },
        });
    }
    return issues;
}
async function checkInlineSourceMapsInBuildOutput(projectPath) {
    const issues = [];
    const INLINE_SOURCE_MAP_PATTERN = /\/\/# sourceMappingURL=data:application\/json/;
    for (const buildDir of BUILD_OUTPUT_DIRS) {
        const fullBuildDir = path.join(projectPath, buildDir);
        if (!fs.existsSync(fullBuildDir))
            continue;
        let jsFiles = [];
        try {
            jsFiles = (0, glob_1.globSync)('**/*.js', {
                cwd: fullBuildDir,
                absolute: true,
                ignore: [],
            });
        }
        catch {
            continue;
        }
        for (const jsFile of jsFiles) {
            let content;
            try {
                // Only read the last 2KB of the file (inline source maps are at the end)
                const stat = fs.statSync(jsFile);
                const size = stat.size;
                const readSize = Math.min(2048, size);
                const buffer = Buffer.alloc(readSize);
                const fd = fs.openSync(jsFile, 'r');
                fs.readSync(fd, buffer, 0, readSize, Math.max(0, size - readSize));
                fs.closeSync(fd);
                content = buffer.toString('utf8');
            }
            catch {
                continue;
            }
            if (INLINE_SOURCE_MAP_PATTERN.test(content)) {
                const relativePath = path.relative(projectPath, jsFile);
                issues.push({
                    id: `source-maps-inline-build-output-${relativePath}`,
                    title: `Inline source map in build output: ${relativePath}`,
                    description: `The built file "${relativePath}" contains an inline source map (//# sourceMappingURL=data:application/json...). ` +
                        `Inline source maps embed the full original source code directly in the JavaScript file, ` +
                        `making it trivially accessible to anyone who downloads the file. ` +
                        `This can significantly increase file size and expose your complete source code.`,
                    severity: 'info',
                    scanner: 'source-maps',
                    file: relativePath,
                    fix: 'Configure your build tool to not generate inline source maps for production. ' +
                        'Use separate .map files (which can be restricted from public access) or disable source maps entirely.',
                    fixable: false,
                    references: [
                        'https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map',
                    ],
                    metadata: { buildFile: relativePath },
                });
            }
        }
    }
    return issues;
}
async function runSourceMapsScanner(projectPath) {
    const startTime = Date.now();
    const issues = [];
    try {
        // 1. Check for .map files in public directories
        for (const publicDir of PUBLIC_DIRS) {
            const fullPath = path.join(projectPath, publicDir);
            const mapIssues = findMapFilesInDirectory(fullPath, projectPath);
            issues.push(...mapIssues);
        }
        // 2. Check next.config.js for productionBrowserSourceMaps
        const nextConfigIssues = checkNextConfigSourceMaps(projectPath);
        issues.push(...nextConfigIssues);
        // 3. Check webpack.config.js for devtool settings
        const webpackIssues = checkWebpackSourceMaps(projectPath);
        issues.push(...webpackIssues);
        // 4. Check git-tracked .map files
        const gitMapIssues = checkGitTrackedMapFiles(projectPath);
        issues.push(...gitMapIssues);
        // 5. Check for inline source maps in build output
        const inlineIssues = await checkInlineSourceMapsInBuildOutput(projectPath);
        issues.push(...inlineIssues);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            scanner: 'source-maps',
            issues: [],
            duration: Date.now() - startTime,
            error: message,
        };
    }
    return {
        scanner: 'source-maps',
        issues,
        duration: Date.now() - startTime,
    };
}
//# sourceMappingURL=source-maps.js.map