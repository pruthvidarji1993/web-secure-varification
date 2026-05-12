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
exports.runDeprecatedScanner = runDeprecatedScanner;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function fetchPackageInfo(packageName) {
    try {
        const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            return null;
        }
        const data = (await response.json());
        return data;
    }
    catch {
        return null;
    }
}
async function processBatch(packages, batchSize, delayMs) {
    const results = new Map();
    for (let i = 0; i < packages.length; i += batchSize) {
        const batch = packages.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch.map(async (pkgName) => {
            const info = await fetchPackageInfo(pkgName);
            return { pkgName, deprecated: info?.deprecated };
        }));
        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results.set(result.value.pkgName, result.value.deprecated);
            }
        }
        // Rate limiting: wait between batches (except after the last batch)
        if (i + batchSize < packages.length && delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    return results;
}
async function runDeprecatedScanner(projectPath) {
    const startTime = Date.now();
    const issues = [];
    try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            return {
                scanner: 'deprecated',
                issues: [],
                duration: Date.now() - startTime,
                error: 'package.json not found in project path',
            };
        }
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);
        const allDeps = [
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {}),
            ...Object.keys(packageJson.peerDependencies || {}),
        ];
        // Remove duplicates
        const uniqueDeps = [...new Set(allDeps)];
        if (uniqueDeps.length === 0) {
            return {
                scanner: 'deprecated',
                issues: [],
                duration: Date.now() - startTime,
            };
        }
        // Process in batches of 10 with 500ms delay between batches to respect rate limits
        const results = await processBatch(uniqueDeps, 10, 500);
        for (const [pkgName, deprecated] of results) {
            if (deprecated) {
                issues.push({
                    id: `deprecated-${pkgName}`,
                    title: `Deprecated package: ${pkgName}`,
                    description: `The package "${pkgName}" is deprecated. Message: ${deprecated}`,
                    severity: 'medium',
                    scanner: 'deprecated',
                    fix: 'Find an alternative package or update to a non-deprecated version',
                    references: [`https://www.npmjs.com/package/${pkgName}`],
                });
            }
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            scanner: 'deprecated',
            issues: [],
            duration: Date.now() - startTime,
            error: message,
        };
    }
    return {
        scanner: 'deprecated',
        issues,
        duration: Date.now() - startTime,
    };
}
//# sourceMappingURL=deprecated.js.map