const vscode = require("vscode");
const Client = require("ftp");
const path_1 = require("path");

class FtpModel {
    /**
     * @param {string} host
     * @param {string} user
     * @param {string} password
     */
    constructor(host, user, password) {
        this.host = host;
        this.user = user;
        this.password = password;
    }
    connect() {
        return new Promise((c, e) => {
            const client = new Client();
            client.on('ready', () => {
                c(client);
            });
            client.on('error', error => {
                e('Error while connecting: ' + error.message);
            });
            client.connect({
                host: this.host,
                user: this.user,
                password: this.password
            });
        });
    }
    get roots() {
        return this.connect().then(client => {
            return new Promise((c, e) => {
                client.list((err, list) => {
                    if (err) {
                        return e(err);
                    }
                    client.end();
                    return c(this.sort(list.map(entry => ({ resource: vscode.Uri.parse(`ftp://${this.host}///${entry.name}`), isDirectory: entry.type === 'd' }))));
                });
            });
        });
    }
    /**
     * @param {{ resource: { fsPath: any; }; }} node
     */
    async getChildren(node) {
        const client = await this.connect();
        return await new Promise((c, e) => {
            client.list(node.resource.fsPath, (err, list) => {
                if (err) {
                    return e(err);
                }
                client.end();
                return c(this.sort(list.map(entry => ({ resource: vscode.Uri.parse(`${node.resource.fsPath}/${entry.name}`), isDirectory: entry.type === 'd' }))));
            });
        });
    }
    /**
     * @param {any[]} nodes
     */
    sort(nodes) {
        return nodes.sort((n1, n2) => {
            if (n1.isDirectory && !n2.isDirectory) {
                return -1;
            }
            if (!n1.isDirectory && n2.isDirectory) {
                return 1;
            }
            return (0, path_1.basename)(n1.resource.fsPath).localeCompare((0, path_1.basename)(n2.resource.fsPath));
        });
    }
    /**
     * @param {{ path: string; }} resource
     */
    async getContent(resource) {
        const client = await this.connect();
        return await new Promise((c, e) => {
            client.get(resource.path.substr(2), (err, stream) => {
                if (err) {
                    return e(err);
                }
                let string = '';
                stream.on('data', function (buffer) {
                    if (buffer) {
                        const part = buffer.toString();
                        string += part;
                    }
                });
                stream.on('end', function () {
                    client.end();
                    c(string);
                });
            });
        });
    }
}

class FtpTreeDataProvider {
    /**
     * @param {FtpModel} model
     */
    constructor(model) {
        this.model = model;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    /**
     * @param {{ resource: any; isDirectory: any; }} element
     */
    getTreeItem(element) {
        return {
            resourceUri: element.resource,
            collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
            command: element.isDirectory ? void 0 : {
                command: 'ftpExplorer.openFtpResource',
                arguments: [element.resource],
                title: 'Open FTP Resource'
            }
        };
    }
    /**
     * @param {{ resource: { fsPath: any; }; }} element
     */
    getChildren(element) {
        return element ? this.model.getChildren(element) : this.model.roots;
    }
    /**
     * @param {{ resource: { with: (arg0: { path: string; }) => any; path: string; }; }} element
     */
    getParent(element) {
        const parent = element.resource.with({ path: (0, path_1.dirname)(element.resource.path) });
        return parent.path !== '//' ? { resource: parent, isDirectory: true } : undefined;
    }
    /**
     * @param {{ path: string; }} uri
     */
    async provideTextDocumentContent(uri) {
        const content = await this.model.getContent(uri);
        return content;
    }
}

class FtpExplorer {
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        /* Please note that login information is hardcoded only for this example purpose and recommended not to do it in general. */
        const ftpModel = new FtpModel('mirror.switch.ch', 'anonymous', 'anonymous@anonymous.de');
        const treeDataProvider = new FtpTreeDataProvider(ftpModel);
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('ftp', treeDataProvider));
        this.ftpViewer = vscode.window.createTreeView('ftpExplorer', { treeDataProvider });
        vscode.commands.registerCommand('ftpExplorer.refresh', () => treeDataProvider.refresh());
        vscode.commands.registerCommand('ftpExplorer.openFtpResource', resource => this.openResource(resource));
        vscode.commands.registerCommand('ftpExplorer.revealResource', () => this.reveal());
    }
    /**
     * @param {vscode.TextDocument} resource
     */
    openResource(resource) {
        vscode.window.showTextDocument(resource);
    }
    async reveal() {
        const node = this.getNode();
        if (node) {
            return this.ftpViewer.reveal(node);
        }
    }
    getNode() {
        if (vscode.window.activeTextEditor) {
            if (vscode.window.activeTextEditor.document.uri.scheme === 'ftp') {
                return { resource: vscode.window.activeTextEditor.document.uri, isDirectory: false };
            }
        }
        return undefined;
    }
}

module.exports = { FtpModel, FtpTreeDataProvider, FtpExplorer }
