const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const rimraf = require("rimraf");

/**
 * @param {{ (value: any): void; (value: any): void; (value: any): void; (value: any): void; (value: any): void; (value: any): void; (value: any): void; (value: any): void; (value: any): void; (arg0: any): void; }} resolve
 * @param {{ (reason?: any): void; (reason?: any): void; (reason?: any): void; (reason?: any): void; (reason?: any): void; (reason?: any): void; (reason?: any): void; (reason?: any): void; (reason?: any): void; (arg0: any): void; }} reject
 * @param {NodeJS.ErrnoException} error
 * @param {boolean | Buffer | fs.Stats} result
 */
function handleResult(resolve, reject, error, result) {
    if (error) {
        reject(massageError(error));
    }
    else {
        resolve(result);
    }
}

/**
 * @param {NodeJS.ErrnoException} error
 */
function massageError(error) {
    if (error.code === 'ENOENT') {
        return vscode.FileSystemError.FileNotFound();
    }
    if (error.code === 'EISDIR') {
        return vscode.FileSystemError.FileIsADirectory();
    }
    if (error.code === 'EEXIST') {
        return vscode.FileSystemError.FileExists();
    }
    if (error.code === 'EPERM' || error.code === 'EACCES') {
        return vscode.FileSystemError.NoPermissions();
    }
    return error;
}

/**
 * @param {any} items
 */
function normalizeNFC(items) {
    if (process.platform !== 'darwin') {
        return items;
    }
    if (Array.isArray(items)) {
        return items.map(item => item.normalize('NFC'));
    }
    return items.normalize('NFC');
}

/**
 * @param {fs.PathLike} path
 */
function readdir(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
    });
}

/**
 * @param {fs.PathLike} path
 */
function stat(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
    });
}

/**
 * @param {fs.PathOrFileDescriptor} path
 */
function readfile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
    });
}

/**
 * @param {fs.PathOrFileDescriptor} path
 * @param {string | NodeJS.ArrayBufferView} content
 */
function writefile(path, content) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
    });
}

/**
 * @param {fs.PathLike} path
 */
function exists(path) {
    return new Promise((resolve, reject) => {
        fs.exists(path, exists => handleResult(resolve, reject, null, exists));
    });
}

/**
 * @param {any} path
 */
function rmrf(path) {
    return new Promise((resolve, reject) => {
        rimraf(path, (/** @type {NodeJS.ErrnoException} */ error) => handleResult(resolve, reject, error, void 0));
    });
}

/**
 * @param {any} path
 */
function mkdir(path) {
    return new Promise((resolve, reject) => {
        // @ts-ignore
        mkdirp(path, (/** @type {NodeJS.ErrnoException} */ error) => handleResult(resolve, reject, error, void 0));
    });
}

/**
 * @param {fs.PathLike} oldPath
 * @param {fs.PathLike} newPath
 */
function rename(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
    });
}

/**
 * @param {fs.PathLike} path
 */
function unlink(path) {
    return new Promise((resolve, reject) => {
        fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
    });
}

class FileStat {
    /**
     * @param {any} fsStat
     */
    constructor(fsStat) {
        this.fsStat = fsStat;
    }
    get type() {
        return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
    }
    get isFile() {
        return this.fsStat.isFile();
    }
    get isDirectory() {
        return this.fsStat.isDirectory();
    }
    get isSymbolicLink() {
        return this.fsStat.isSymbolicLink();
    }
    get size() {
        return this.fsStat.size;
    }
    get ctime() {
        return this.fsStat.ctime.getTime();
    }
    get mtime() {
        return this.fsStat.mtime.getTime();
    }
}

class FileSystemProvider {
    constructor() {
        this._onDidChangeFile = new vscode.EventEmitter();
    }
    get onDidChangeFile() {
        return this._onDidChangeFile.event;
    }
    /**
     * @param {any} uri
     * @param {{ recursive: any; }} options
     */
    watch(uri, options) {
        const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event, filename) => {
            if (filename) {
                const filepath = path.join(uri.fsPath, normalizeNFC(filename.toString()));
                // TODO support excludes (using minimatch library?)
                this._onDidChangeFile.fire([{
                        type: event === 'change' ? vscode.FileChangeType.Changed : await exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
                        uri: uri.with({ path: filepath })
                    }]);
            }
        });
        return { dispose: () => watcher.close() };
    }
    /**
     * @param {{ fsPath: any; }} uri
     */
    stat(uri) {
        return this._stat(uri.fsPath);
    }
    /**
     * @param {string} path
     */
    async _stat(path) {
        return new FileStat(await stat(path));
    }
    /**
     * @param {vscode.Uri} uri
     */
    readDirectory(uri) {
        return this._readDirectory(uri);
    }
    /**
     * @param {{ fsPath: string; }} uri
     */
    async _readDirectory(uri) {
        const children = await readdir(uri.fsPath);
        const result = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const stat = await this._stat(path.join(uri.fsPath, child));
            result.push([child, stat.type]);
        }
        return Promise.resolve(result);
    }
    /**
     * @param {{ fsPath: any; }} uri
     */
    createDirectory(uri) {
        return mkdir(uri.fsPath);
    }
    /**
     * @param {{ fsPath: any; }} uri
     */
    readFile(uri) {
        return readfile(uri.fsPath);
    }
    /**
     * @param {any} uri
     * @param {any} content
     * @param {any} options
     */
    writeFile(uri, content, options) {
        return this._writeFile(uri, content, options);
    }
    /**
     * @param {{ fsPath: string; }} uri
     * @param {any} content
     * @param {{ create: any; overwrite: any; }} options
     */
    async _writeFile(uri, content, options) {
        const Exists = await exists(uri.fsPath);
        if (!Exists) {
            if (!options.create) {
                throw vscode.FileSystemError.FileNotFound();
            }
            await mkdir(path.dirname(uri.fsPath));
        }
        else {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
        }
        return writefile(uri.fsPath, content);
    }
    /**
     * @param {{ fsPath: any; }} uri
     * @param {{ recursive: any; }} options
     */
    delete(uri, options) {
        if (options.recursive) {
            return rmrf(uri.fsPath);
        }
        return unlink(uri.fsPath);
    }
    /**
     * @param {any} oldUri
     * @param {any} newUri
     * @param {any} options
     */
    rename(oldUri, newUri, options) {
        return this._rename(oldUri, newUri, options);
    }
    /**
     * @param {{ fsPath: any; }} oldUri
     * @param {{ fsPath: string; }} newUri
     * @param {{ overwrite: any; }} options
     */
    async _rename(oldUri, newUri, options) {
        const Exists = await exists(newUri.fsPath);
        if (Exists) {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
            else {
                await rmrf(newUri.fsPath);
            }
        }
        const parentExists = await exists(path.dirname(newUri.fsPath));
        if (!parentExists) {
            await mkdir(path.dirname(newUri.fsPath));
        }
        return rename(oldUri.fsPath, newUri.fsPath);
    }
    // tree data provider
    /**
     * @param {any} element
     */
    async getChildren(element) {
        if (element) {
            const children = await this.readDirectory(element.uri);
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
        }

        const workspaceFolder = (vscode.workspace.workspaceFolders || []).filter(folder => folder.uri.scheme === 'file')[0];
        if (workspaceFolder) {
            const children = await this.readDirectory(workspaceFolder.uri);
            children.sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)), type }));
        }
        return [];
    }
    /**
     * @param {{ uri: string | vscode.TreeItemLabel; type: vscode.FileType; }} element
     */
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        if (element.type === vscode.FileType.File) {
            treeItem.command = { command: 'fileExplorer.openFile', title: "Open File", arguments: [element.uri], };
            treeItem.contextValue = 'file';
        }
        return treeItem;
    }
}

class FileExplorer {
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        const treeDataProvider = new FileSystemProvider();
        context.subscriptions.push(vscode.window.createTreeView('fileExplorer', { treeDataProvider }));
        vscode.commands.registerCommand('fileExplorer.openFile', (resource) => this.openResource(resource));
    }
    /**
     * @param {vscode.TextDocument} resource
     */
    openResource(resource) {
        vscode.window.showTextDocument(resource);
    }
}

module.exports = { FileStat, FileSystemProvider, FileExplorer }