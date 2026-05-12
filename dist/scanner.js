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
exports.ALL_SCANNERS = void 0;
exports.runScan = runScan;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ignore_1 = require("./ignore");
const npm_audit_1 = require("./scanners/npm-audit");
const outdated_1 = require("./scanners/outdated");
const deprecated_1 = require("./scanners/deprecated");
const secrets_1 = require("./scanners/secrets");
const code_security_1 = require("./scanners/code-security");
const nextjs_1 = require("./scanners/nextjs");
const license_1 = require("./scanners/license");
const supply_chain_1 = require("./scanners/supply-chain");
const rsc_boundary_1 = require("./scanners/rsc-boundary");
const hydration_1 = require("./scanners/hydration");
const bundle_1 = require("./scanners/bundle");
const source_maps_1 = require("./scanners/source-maps");
const SEVERITY_LEVELS = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
};
function meetsMinSeverity(issueSeverity, minSeverity) {
    return SEVERITY_LEVELS[issueSeverity] >= SEVERITY_LEVELS[minSeverity];
}
function getProjectName(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (pkg.name)
                return pkg.name;
        }
        catch {
            // fall through
        }
    }
    return path.basename(projectPath);
}
const ALL_SCANNERS = {
    'npm-audit': npm_audit_1.runNpmAuditScanner,
    outdated: outdated_1.runOutdatedScanner,
    deprecated: deprecated_1.runDeprecatedScanner,
    secrets: secrets_1.runSecretsScanner,
    'code-security': code_security_1.runCodeSecurityScanner,
    nextjs: nextjs_1.runNextjsScanner,
    license: license_1.runLicenseScanner,
    'supply-chain': supply_chain_1.runSupplyChainScanner,
    'rsc-boundary': rsc_boundary_1.runRscBoundaryScanner,
    hydration: hydration_1.runHydrationScanner,
    bundle: bundle_1.runBundleScanner,
    'source-maps': source_maps_1.runSourceMapsScanner,
};
exports.ALL_SCANNERS = ALL_SCANNERS;
async function runScan(options) {
    const startTime = Date.now();
    const projectPath = path.resolve(options.path);
    if (!fs.existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
    }
    const projectName = getProjectName(projectPath);
    const ignoreConfig = (0, ignore_1.loadIgnoreConfig)(projectPath, options.ignoreFile);
    const skipSet = new Set([
        ...options.skip.map((s) => s.toLowerCase().trim()),
        ...Array.from(ignoreConfig.ignoredScanners),
    ]);
    const scannersToRun = Object.entries(ALL_SCANNERS).filter(([name]) => !skipSet.has(name));
    const scannerPromises = scannersToRun.map(([name, scannerFn]) => scannerFn(projectPath).catch((err) => ({
        scanner: name,
        issues: [],
        duration: 0,
        error: err instanceof Error ? err.message : String(err),
    })));
    const settledResults = await Promise.allSettled(scannerPromises);
    const results = settledResults.map((settled, index) => {
        const scannerName = scannersToRun[index][0];
        if (settled.status === 'fulfilled') {
            const filteredIssues = settled.value.issues.filter((issue) => meetsMinSeverity(issue.severity, options.severity) &&
                !(0, ignore_1.shouldIgnoreIssue)(issue, ignoreConfig));
            return { ...settled.value, issues: filteredIssues };
        }
        else {
            return {
                scanner: scannerName,
                issues: [],
                duration: 0,
                error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
            };
        }
    });
    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
    for (const result of results) {
        for (const issue of result.issues) {
            summary[issue.severity]++;
            summary.total++;
        }
    }
    return {
        projectPath,
        projectName,
        scannedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        summary,
        results,
    };
}
//# sourceMappingURL=scanner.js.map