//@ts-nocheck
const vscode = require("vscode");
const json = require("jsonc-parser");
const path = require("path");
const fs = require("fs");
const uuid = require("uuid");

class JsonOutlineProvider {
    /**
     * @param {any} context
     */
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        this.autoRefresh = true;
        this.dirProject = path.join(__dirname, "..", "projects.json");
        if(!fs.existsSync(this.dirProject)) fs.writeFileSync(this.dirProject, JSON.stringify([], null, 4));
        this.text = fs.readFileSync(this.dirProject, {encoding: "utf-8"});
        this.tree = undefined;


        vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
        vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
        this.autoRefresh = vscode.workspace.getConfiguration('jsonOutline').get('autorefresh', false);
        vscode.workspace.onDidChangeConfiguration(() => {
            this.autoRefresh = vscode.workspace.getConfiguration('jsonOutline').get('autorefresh', false);
        });
        this.onActiveEditorChanged();
    }

    /**
     * @param {number} offset
     */
    getTreeItem(offset) {
        if (!this.tree) throw new Error('Invalid tree');

        const getLocation = json.getLocation(this.text, offset);
        const valueNode = json.findNodeAtLocation(this.tree, getLocation.path);
        
        if (valueNode) {
            const data = this.treeData(valueNode);
            const {name, rootDir, child} = data;
            const colapse = child ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
            let icon = {
                folder: {
                    light: path.join(__filename, '..', '..', 'images', 'light', 'ico-folder.svg'),
                    dark: path.join(__filename, '..', '..', 'images', 'dark', 'ico-folder.svg')
                },
                file: {
                    light: path.join(__filename, '..', '..', 'images', 'light', 'ico-vscode.svg'),
                    dark: path.join(__filename, '..', '..', 'images', 'dark', 'ico-vscode.svg'),
                }
            }

            let label = name.toLocaleUpperCase();
            const tooltip = new vscode.MarkdownString(`${label} \n\n _://Project Manager/${label}_ \n\n $(folder) Folder`, true);

            let args = [];
            if(this.editor) {
                args = [new vscode.Range(this.editor.document.positionAt(valueNode.offset), this.editor.document.positionAt(valueNode.offset + valueNode.length))]
            }
            
            const treeItem = new vscode.TreeItem(label, colapse);
            treeItem.command = {
                command: 'extension.openJsonSelection',
                title: '',
                arguments: args
            };
            treeItem.iconPath = child ? icon.folder : icon.file;
            treeItem.contextValue = child ? 'folder' : 'file';
            treeItem.tooltip = tooltip;
            treeItem.resourceUri = vscode.Uri.parse(rootDir);

            return treeItem;
        }

        throw (new Error(`Could not find json node at ${getLocation.path}`));
    }

    /**
     * @param {number} offset
     */
    getChildren(offset) {
        // return !offset ? this.tree : this.tree.child;
        if (offset && this.tree) {
            const getLocation = json.getLocation(this.text, offset);
			const node = json.findNodeAtLocation(this.tree, getLocation.path);
			return Promise.resolve(this.getChildrenOffsets(node));
		} else {
			return Promise.resolve(this.tree ? this.getChildrenOffsets(this.tree) : []);
		}
    }

    /**
     * @param {any} arr
     */
    nestedTree(arr) {
        const iterateData = (arr1, parentId) => {
            return arr1.filter(e => e.name).map(x => {
                if (!x.id) {
                    x.id = uuid.v4();
                    if(parentId) x.parentId = parentId;
                }
    
                if (x.child) x.child = iterateData(x.child, x.id);
    
                return x;
            })
        }

        return iterateData(arr);
    }

    /**
     * @param {undefined} [offset]
     */
    refresh(offset) {
        this.parseTree();
        if (offset) {
            this._onDidChangeTreeData.fire(offset);
        }
        else {
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    /**
     * @param {any} offset
     */
    rename(offset) {
        vscode.window.showInputBox({ placeHolder: 'Enter the new label' }).then(value => {
            const editor = this.editor;
            const tree = this.tree;
            if (value !== null && value !== undefined && editor && tree) {
                editor.edit(editBuilder => {
                    const path = json.getLocation(this.text, offset).path;
                    let propertyNode = json.findNodeAtLocation(tree, path);
                    if (propertyNode.parent.type !== 'array') {
                        propertyNode = propertyNode.parent.children ? propertyNode.parent.children[0] : undefined;
                    }
                    if (propertyNode) {
                        const range = new vscode.Range(editor.document.positionAt(propertyNode.offset), editor.document.positionAt(propertyNode.offset + propertyNode.length));
                        editBuilder.replace(range, `"${value}"`);
                        setTimeout(() => {
                            this.parseTree();
                            this.refresh(offset);
                        }, 100);
                    }
                });
            }
        });
    }

    onActiveEditorChanged() {
        if (vscode.window.activeTextEditor) {
            if (vscode.window.activeTextEditor.document.uri.scheme === 'file') {
                const enabled = vscode.window.activeTextEditor.document.languageId === 'json' || vscode.window.activeTextEditor.document.languageId === 'jsonc';
                vscode.commands.executeCommand('setContext', 'jsonOutlineEnabled', enabled);
                if (enabled) {
                    this.refresh();
                }
            }
        } else {
            this.refresh();
            vscode.commands.executeCommand('setContext', 'jsonOutlineEnabled', false);
        }
    }

    /**
     * @param {vscode.TextDocumentChangeEvent} changeEvent
     */
    onDocumentChanged(changeEvent) {
        if (this.tree && this.autoRefresh && changeEvent.document.uri.toString() === this.editor.document.uri.toString()) {
            // console.log(changeEvent.contentChanges);
            // for (const change of changeEvent.contentChanges) {
            //     const path = json.getLocation(this.text, this.editor.document.offsetAt(change.range.start)).path;
            //     path.pop();
            //     const node = path.length ? json.findNodeAtLocation(this.tree, path) : void 0;
            //     this.parseTree();
            //     this._onDidChangeTreeData.fire(node ? node.offset : void 0);
            // }
            this.refresh();
        }
    }

    parseTree() {
        this.editor = vscode.window.activeTextEditor;
        if (this.editor && this.editor.document) {
            this.text = this.editor.document.getText();
        }

        // let nestedData = this.nestedTree(JSON.parse(this.text));
        this.tree = json.parseTree(this.text);
        // this.text = '';
		// this.tree = undefined;
		// this.editor = vscode.window.activeTextEditor;
		// if (this.editor && this.editor.document) {
		// 	this.text = this.editor.document.getText();
		// 	this.tree = json.parseTree(this.text);
		// }
    }

    

    /**
     * @param {json.Node} node
     */
    getChildrenOffsets(node) {
        if (node.type == "array") {
            return node.children.filter(e => e.type == "object" && e.children.length > 0).filter(e => {
                let data = this.treeData(e);
                return Object.keys(data).includes("name");
            }).map(e => {
                const childPath = json.getLocation(this.text, e.offset).path;
                const childNode = json.findNodeAtLocation(this.tree, childPath);
                if(childNode) return childNode.offset;
    
                return;
            }).filter(e => e);
        }

        if (node.type == "object") {
            let tmp = node.children.map(e => {
                return {
                    offset: e.offset,
                    types: e.children.map(x => x.type),
                    val: e.children.at(-1)
                }
            }).find(e => e.types.includes("array"));
            if (tmp) return this.getChildrenOffsets(tmp.val);
        }





        return [];
        // const offsets = [];
        // if (node.children && this.tree) {
        //     for (const child of node.children) {
        //         const childPath = json.getLocation(this.text, child.offset).path;
        //         const childNode = json.findNodeAtLocation(this.tree, childPath);
        //         if (childNode) {
        //             offsets.push(childNode.offset);
        //         }
        //     }
        // }
        // return offsets;
    }

    /**
     * @param {number} offset
     */
    getTreeItemBackup(offset) {
        if (!this.tree) {
            throw new Error('Invalid tree');
        }
        if (!this.editor) {
            throw new Error('Invalid editor');
        }
        const path = json.getLocation(this.text, offset).path;
        
        const valueNode = json.findNodeAtLocation(this.tree, path);
        
        if (valueNode) {
            const hasChildren = valueNode.type === 'object' || valueNode.type === 'array';
            const treeItem = new vscode.TreeItem(this.getLabel(valueNode), hasChildren ? valueNode.type === 'object' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
            treeItem.command = {
                command: 'extension.openJsonSelection',
                title: '',
                arguments: [new vscode.Range(this.editor.document.positionAt(valueNode.offset), this.editor.document.positionAt(valueNode.offset + valueNode.length))]
            };
            treeItem.iconPath = this.getIcon(valueNode);
            treeItem.contextValue = valueNode.type;
            return treeItem;
        }
        throw (new Error(`Could not find json node at ${path}`));
    }

    /**
     * @param {{ start: vscode.Position; end: vscode.Position; }} range
     */
    select(range) {
        if (this.editor) {
            this.editor.selection = new vscode.Selection(range.start, range.end);
        }
    }

    /**
     * @param {json.Node} node
     */
    getIcon(node) {
        const nodeType = node.type;
        if (nodeType === 'boolean') {
            return {
                light: this.context.asAbsolutePath(path.join('resources', 'light', 'boolean.svg')),
                dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'boolean.svg'))
            };
        }
        if (nodeType === 'string') {
            return {
                light: this.context.asAbsolutePath(path.join('resources', 'light', 'string.svg')),
                dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'string.svg'))
            };
        }
        if (nodeType === 'number') {
            return {
                light: this.context.asAbsolutePath(path.join('resources', 'light', 'number.svg')),
                dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'number.svg'))
            };
        }
        return null;
    }

    /**
     * @param {json.Node} node
     */
    getLabel(node) {
        if (node.parent.type === 'array') {
            const prefix = node.parent.children.indexOf(node).toString();
            if (node.type === 'object') {
                return prefix + ':{ }';
            }
            if (node.type === 'array') {
                return prefix + ':[ ]';
            }
            return prefix + ':' + node.value.toString();
        }
        else {
            const property = node.parent.children ? node.parent.children[0].value.toString() : '';
            if (node.type === 'array' || node.type === 'object') {
                if (node.type === 'object') {
                    return '{ } ' + property;
                }
                if (node.type === 'array') {
                    return '[ ] ' + property;
                }
            }
            const value = this.editor.document.getText(new vscode.Range(this.editor.document.positionAt(node.offset), this.editor.document.positionAt(node.offset + node.length)));
            return `${property}: ${value}`;
        }
    }

    editJson() {
        if(!fs.existsSync(this.dirProject)) fs.writeFileSync(this.dirProject, JSON.stringify([], null, 4));

        vscode.workspace.openTextDocument(this.dirProject).then(e => {
            vscode.window.showTextDocument(e);
        })
    }

    treeData(node) {
        if(node.type == "array") {
            return node.children.map(e => this.treeData(e));
        }

        if (node.type == "object") {
            return node.children.reduce((a, b) => {
                let key = b.children.at();
                let val = b.children.at(-1)
                if(["object", "array"].includes(val.type)) {
                    a[key.value] = this.treeData(val);
                }else{
                    a[key.value] = val.value;
                }

                return a;
            }, {});
        }

        if (node.type == "string") {
            return node.value;
        }
    }
}

module.exports = { JsonOutlineProvider }