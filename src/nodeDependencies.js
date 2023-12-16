const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

class DepNodeProvider {
    /**
     * @param {any} workspaceRoot
     */
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    /**
     * @param {any} element
     */
    getTreeItem(element) {
        return element;
    }

    /**
     * @param {{ label: string; }} element
     */
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }
        if (element) {
            return Promise.resolve(this.getDepsInPackageJson(path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')));
        }
        else {
            const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
            if (this.pathExists(packageJsonPath)) {
                return Promise.resolve(this.getDepsInPackageJson(packageJsonPath));
            }
            else {
                vscode.window.showInformationMessage('Workspace has no package.json');
                return Promise.resolve([]);
            }
        }
    }

    /**
     * @param {string} moduleName
     * @param {any} version
     */
    toDep(moduleName, version) {
        if (this.pathExists(path.join(this.workspaceRoot, 'node_modules', moduleName))) {
            return new Dependency(moduleName, version, vscode.TreeItemCollapsibleState.Collapsed);
        }
        else {
            return new Dependency(moduleName, version, vscode.TreeItemCollapsibleState.None, {
                command: 'extension.openPackageOnNpm',
                title: '',
                arguments: [moduleName]
            });
        }
    }
    /**
     * Given the path to package.json, read all its dependencies and devDependencies.
     * @param {fs.PathOrFileDescriptor} packageJsonPath
     */
    getDepsInPackageJson(packageJsonPath) {
        const workspaceRoot = this.workspaceRoot;
        if (this.pathExists(packageJsonPath) && workspaceRoot) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

            const deps = packageJson.dependencies
                ? Object.keys(packageJson.dependencies).map(dep => this.toDep(dep, packageJson.dependencies[dep]))
                : [];
            const devDeps = packageJson.devDependencies
                ? Object.keys(packageJson.devDependencies).map(dep => this.toDep(dep, packageJson.devDependencies[dep]))
                : [];
            return deps.concat(devDeps);
        }
        else {
            return [];
        }
    }

    /**
     * @param {any} p
     */
    pathExists(p) {
        try {
            fs.accessSync(p);
        }
        catch (err) {
            return false;
        }
        return true;
    }
}

class Dependency extends vscode.TreeItem {
    /**
     * @param {string | vscode.TreeItemLabel} label
     * @param {any} version
     * @param {vscode.TreeItemCollapsibleState} collapsibleState
     * @param {{ command: string; title: string; arguments: any[]; }} [command]
     */
    constructor(label, version, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.version = version;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
        };
        this.contextValue = 'dependency';
        this.tooltip = `${this.label}-${this.version}`;
        this.description = this.version;
    }
}

module.exports = {DepNodeProvider }