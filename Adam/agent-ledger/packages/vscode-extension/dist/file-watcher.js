"use strict";
// ============================================================
// File Watcher — Detect unauthorized external edits
// ============================================================
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
exports.FileWatcher = void 0;
const vscode = __importStar(require("vscode"));
class FileWatcher {
    disposables = [];
    client;
    debounceTimers = new Map();
    constructor(client) {
        this.client = client;
    }
    start() {
        // Watch for text document changes
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.contentChanges.length === 0)
                return;
            const uri = event.document.uri.fsPath;
            // Debounce: wait 500ms after last change before reporting
            const existing = this.debounceTimers.get(uri);
            if (existing)
                clearTimeout(existing);
            const changes = event.contentChanges;
            const minLine = Math.min(...changes.map(c => c.range.start.line));
            const maxLine = Math.max(...changes.map(c => c.range.end.line));
            this.debounceTimers.set(uri, setTimeout(() => {
                this.reportEdit(uri, minLine, maxLine);
                this.debounceTimers.delete(uri);
            }, 500));
        }));
    }
    async reportEdit(resource, startLine, endLine) {
        try {
            await this.client.notifyExternalEdit(resource, startLine, endLine);
        }
        catch {
            // Silently fail — server might not be running
        }
    }
    dispose() {
        for (const d of this.disposables)
            d.dispose();
        for (const timer of this.debounceTimers.values())
            clearTimeout(timer);
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=file-watcher.js.map