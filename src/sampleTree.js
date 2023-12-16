//@ts-nocheck

const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const uuid = require("uuid");

class sampleTree {
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        this.dropMimeTypes = ['application/vnd.code.tree.SampleTree'];
        this.dragMimeTypes = ['text/uri-list'];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.dirProject = path.join(__dirname, "..", "projects.json");
        if(!fs.existsSync(this.dirProject)) fs.writeFileSync(this.dirProject, JSON.stringify([], null, 4));

        this.dataProject = fs.readFileSync(this.dirProject, { encoding: "utf-8" });
        // this.dataProject = JSON.parse(this.dataProject).map(e => {
        //     e.id = uuid.v4();
        //     return e;
        // })
        this.dataProject = this.nestedTree(JSON.parse(this.dataProject));
        
        this.nodes = {};
        
        const view = vscode.window.createTreeView('SampleTree', {
            treeDataProvider: this,
            showCollapseAll: true,
            canSelectMany: true,
            dragAndDropController: this
        });
        context.subscriptions.push(view);
    }

    /**
     * @param {any} arr
     */
    nestedTree(arr) {
        const iterateData = (arr1, parentId) => {
            return arr1.map(x => {
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
     * @param {any} element
     */
    getChildren(element) {
        let data = !element ? this.dataProject : (element.child ? element.child : []);
        return data;
    }

    /**
     * @param {any} element
     */
    getTreeItem(element) {
        let { id, parentId, name, rootDir, child } = element;
        let folder = child ? true : false;
        let icon = {
            folder: {
                light: path.join(__filename, '..', '..', 'images', 'light', 'archive-folder-light.svg'),
                dark: path.join(__filename, '..', '..', 'images', 'dark', 'archive-folder-dark.svg')
            },
            file: {
                light: path.join(__filename, '..', '..', 'images', 'light', 'code-light.svg'),
                dark: path.join(__filename, '..', '..', 'images', 'dark', 'code-dark.svg')
            }
        }
        
        let label = name.toLocaleUpperCase();
        const tooltip = new vscode.MarkdownString(`${label} \n\n _://Project Manager/${label}_ \n\n $(folder) Folder \n\n id: => ${id} \n\n parentId: => ${parentId}`, true);

        return {
            id,
            label: label,
            tooltip,
            collapsibleState: folder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            resourceUri: vscode.Uri.parse(rootDir),
            iconPath: folder ? icon.folder : icon.file,
            contextValue: folder ? 'folder' : 'file'
        };
    }

    /**
     * @param {any} source
     * @param {{ set: (arg0: string, arg1: vscode.DataTransferItem) => void; }} treeDataTransfer
     */
    async handleDrag(source, treeDataTransfer) {
        treeDataTransfer.set('application/vnd.code.tree.SampleTree', new vscode.DataTransferItem(source));
    }

    /**
     * @param {any} target
     * @param {{ get: (arg0: string) => any; }} sources
     */
    async handleDrop(target, sources) {
        const transferItem = sources.get('application/vnd.code.tree.SampleTree');
        if (!transferItem) return;

        if (target) {
            if(!target.child) return;
        }

        this.moveData(transferItem.value, target);
        this._onDidChangeTreeData.fire();
    }

    moveData(data, target) {
        let newData = this.removeData(data);
        newData = this.addData(data, target, newData);
        this.dataProject = newData;
    }

    removeData(current, allData) {
        if(!allData) allData = this.dataProject;

        return allData.filter(e => !current.find(f => f.id == e.id)).map(e => {
            if(e.child) e.child = this.removeData(current, e.child);
            return e;
        })
    }

    addData(data, target, allData) {
        if(!allData) allData = this.dataProject;

        if(target == undefined) {
            data = data.map(e => {
                delete e.parentId;
                return e;
            })
            allData = [...allData, ...data];
            return allData;
        }

        return allData.map(e => {
            if(target.id == e.id) {
                data = data.map(x => {
                    x.parentId = target.id;
                    return x;
                });
                
                if(!e.child) {
                    e.child = data;
                }else{
                    e.child = [...e.child, ...data];
                }
            }

            if(e.child) e.child = this.addData(data, target, e.child);

            return e;
        })
    }

    /**
     * @param {string} key
     */
    _getNode(key) {
        if (!this.nodes[key]) this.nodes[key] = new Key(key);
        return this.nodes[key];
    }
}

class Key {
    /**
     * @param {any} key
     */
    constructor(key) {
        this.key = key;
    }
}

module.exports = sampleTree