const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const uuid = require("uuid");

class ManageProject extends vscode.TreeItem {
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        // @ts-ignore
        super();
        this.dropMimeTypes = ['application/vnd.code.tree.ManageProject'];
        this.dragMimeTypes = ['text/uri-list'];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.dirProject = path.join(__dirname, "..", "projects.json");
        if(!fs.existsSync(this.dirProject)) fs.writeFileSync(this.dirProject, JSON.stringify([], null, 4));
        
        this.nodes = {};
        this.editor = vscode.window.activeTextEditor;

        this.readData();

        vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
        this.autoRefresh = vscode.workspace.getConfiguration('ManageProject').get('autorefresh', false);
        vscode.workspace.onDidChangeConfiguration(() => {
            this.autoRefresh = vscode.workspace.getConfiguration('ManageProject').get('autorefresh', false);
        });
        
        this.view = vscode.window.createTreeView('ManageProject', {
            treeDataProvider: this,
            dragAndDropController: this
        });

        this.view.onDidChangeSelection((e) => {
            if (e.selection.length > 0) {
                vscode.commands.executeCommand("setContext", "ManageProjectKeyDel", true);
            }else{
                vscode.commands.executeCommand("setContext", "ManageProjectKeyDel", false);
            }
        });
        
        context.subscriptions.push(this.view);
    }

    readData() {
        this.dataProject = fs.readFileSync(this.dirProject, { encoding: "utf-8" });
        this.dataProject = this.addIdData(JSON.parse(this.dataProject));
        this.dataProject = this.sortData(this.dataProject);
    }

    /**
     * @param {any} arr
     */
    addIdData(arr) {
        const iterateData = (/** @type {any[]} */ arr1, /** @type {any} */ parentId) => {
            return arr1.filter((/** @type {any} */ e) => e.name).map((/** @type {any} */ x) => {
                if (!x.id) {
                    x.id = uuid.v4();
                    if(parentId) x.parentId = parentId;
                }
    
                if (x.child) {
                    x.index = 0;
                    x.child = iterateData(x.child, x.id);
                }else{
                    x.index = 1;
                }
    
                return x;
            })
        }

        return iterateData(arr);
    }

    /**
     * @param {any} arr
     */
    sortData(arr) {
        const iterateData = (/** @type {any[]} */ arr1) => {
            return arr1.sort((/** @type {{ index: number; }} */ a, /** @type {{ index: number; }} */ b) => a.index - b.index).map((/** @type {{ child: any; }} */ x) => {
                if(x.child) x.child = iterateData(x.child);
                return x;
            });
        }

        return iterateData(arr);
    }

    /**
     * @param {any} arr
     */
    removeIdData(arr) {
        const iterateData = (/** @type {any[]} */ arr1) => {
            return arr1.map((/** @type {any} */ x) => {
                delete x.id;
                delete x.parentId;
                delete x.index;
                delete x.v;
    
                if (x.child) x.child = iterateData(x.child);
    
                return x;
            });
        }

        return iterateData(arr);
    }

    /**
     * @param {vscode.TextDocumentChangeEvent} changeEvent
     */
    onDocumentChanged(changeEvent) {
        vscode.commands.executeCommand("setContext", "ManageProjectKeyDel", false);
        let evenDir = path.join(changeEvent.document.uri.fsPath);
        if (evenDir == this.dirProject && this.autoRefresh) {
            this.readData();
            this.refresh();
        }
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
        let parentData = this.getParentData(parentId);
        
        let folder = child ? true : false;
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
        let dirParent = parentData.reverse().map(e => e.name);
        dirParent.unshift('Project Manager');
        dirParent.push(name);
        dirParent = dirParent.join("/");
        
        const tooltip = new vscode.MarkdownString(`${label} \n\n $(folder) ${dirParent}`, true);
        
        return {
            id,
            label: label,
            tooltip,
            collapsibleState: folder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            resourceUri: vscode.Uri.parse(rootDir),
            iconPath: folder ? icon.folder : icon.file,
            contextValue: folder ? 'folder' : 'file',
            command: {
                title: '',
                command: 'ManageProject.select',
                arguments: [{
                    type: folder ? 'folder' : 'file',
                    parentData,
                    id,
                    rootDir: rootDir
                }]
            }
        };
    }

    /**
     * @param {any} source
     * @param {{ set: (arg0: string, arg1: vscode.DataTransferItem) => void; }} treeDataTransfer
     */
    async handleDrag(source, treeDataTransfer) {
        treeDataTransfer.set('application/vnd.code.tree.ManageProject', new vscode.DataTransferItem(source));
    }

    /**
     * @param {any} target
     * @param {{ get: (arg0: string) => any; }} sources
     */
    async handleDrop(target, sources) {
        const transferItem = sources.get('application/vnd.code.tree.ManageProject');
        if (!transferItem || !target) return;

        if (target) {
            if(!target.child) return;
        }

        this.moveData(transferItem.value, target);
    }

    /**
     * @param {any} data
     * @param {any} target
     */
    moveData(data, target) {
        let newData = this.removeData(data);
        newData = this.addData(data, target, newData);
        let saveNewData = this.removeIdData(newData);
        
        this.dataProject = newData;
        this.refresh(saveNewData);
    }

    /**
     * @param {any[]} current
     * @param {any[]} [allData]
     */
    removeData(current, allData) {
        if(!allData) allData = this.dataProject;

        return allData.filter((/** @type {{ id: any; }} */ e) => !current.find((/** @type {{ id: any; }} */ f) => f.id == e.id)).map((/** @type {{ child: any; }} */ e) => {
            if(e.child) e.child = this.removeData(current, e.child);
            return e;
        })
    }

    /**
     * @param {any[]} data
     * @param {{ id: any; }} target
     * @param {any[]} allData
     */
    addData(data, target, allData) {
        if(!allData) allData = this.dataProject;

        if(target == undefined) {
            data = data.map((/** @type {{ parentId: any; }} */ e) => {
                delete e.parentId;
                return e;
            })
            allData = [...allData, ...data];
            return allData;
        }

        return allData.map((/** @type {{ id: any; child: any[]; }} */ e) => {
            if(target.id == e.id) {
                data = data.map((/** @type {{ parentId: any; }} */ x) => {
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

    newFolder(rootDir) {
        vscode.window.showInputBox({
            title: rootDir ? "Add Project" : "Add Folder ",
            placeHolder: 'Enter the new name ' + (rootDir ? "project" : "folder"),
            ignoreFocusOut: false,
            validateInput: (value) => {
                if(value == "") return "Name is not blank";
                return;
            }
        }).then(val => {
            if (val) {
                // @ts-ignore
                let selectItem = this.view.selection.at();
                let data = {
                    id: uuid.v4(),
                    name: val,
                }

                if(rootDir) {
                    data.index = 0;
                    data.rootDir = rootDir;
                }else{
                    data.index = 1;
                    data.child = [0]
                }

                if (selectItem) {
                    if (selectItem.parentId && selectItem.index == 1) {
                        data.parentId = selectItem.parentId;
                    }else{
                        if (selectItem.index == 0) {
                            data.parentId = selectItem.id;
                        }
                    }
                }
                
                if (data.parentId) {
                    let dataParent = this.getParentData(data.parentId).reverse();

                    dataParent = dataParent.reduce((a, b) => {
                        if(a) {
                            let i = a.child.findIndex(c => c.id == b.id);
                            a = a.child[i];
                        }else{
                            let i = this.dataProject.findIndex(c => c.id == b.id);
                            a = this.dataProject[i];
                        }
                        return a;
                    }, null);

                    dataParent.child.push(data);
                    dataParent.child = this.sortData(dataParent.child);
                }else{
                    this.dataProject.push(data);
                    this.dataProject = this.sortData(this.dataProject);
                }

                let saveNewData = this.removeIdData(JSON.parse(JSON.stringify(this.dataProject)));
                this.refresh(saveNewData);
            }
        })
    }

    saveProject() {
        let workspaceFolders = vscode.workspace.workspaceFolders.at(0);
        if (workspaceFolders) {
            let dirFolder = workspaceFolders.uri.fsPath;
            this.newFolder(dirFolder);
        }
    }

    search() {
        let items = (data, hasil = []) => {
            if(!data) data = JSON.parse(JSON.stringify(this.dataProject));

            data = data.map(item => {
                if(!item.child) {
                    hasil.push({
                        id: item.id,
                        parentId: item.parentId,
                        label: item.name,
                        description: path.join(item.rootDir),
                        iconPath: new vscode.ThemeIcon("file-code"),
                        buttons: [
                            {
                                iconPath: new vscode.ThemeIcon("link-external"),
                                tooltip: "Open In New Window"
                            }
                        ]
                    })
                }else{
                    item.child = items(item.child, hasil);
                }

                return item;
            });

            return data ? hasil : [];
        }

        let dataItems = items();
        dataItems = dataItems.map(e => {
            let parent = this.getParentData(e.parentId).reverse().map(e => e.name);
            parent.unshift('Project Manager');
            e.detail = "$(folder-opened) "+path.join(parent.join("/"));
            return e;
        })

        if (dataItems.length > 0) {
            let quickPick = vscode.window.createQuickPick();
            quickPick.title = "Cari Project";
            quickPick.placeholder = "Search...";
            quickPick.canSelectMany = false
            quickPick.items = dataItems;

            quickPick.onDidHide(() => quickPick.dispose());
            quickPick.onDidChangeSelection(e => e.at(0) ? this.openFolder(e.at(0).description) : '');
            quickPick.onDidTriggerItemButton(e => this.openFolder(e.item.description, true))
            quickPick.show();
        }
    }

    /**
     * @param {any} data
     */
    delete(data, bind = false) {
        if (!data && bind) data = this.view.selection.at(0);

        if (data) {
            vscode.window.showWarningMessage("Warning", {
                modal: true,
                detail: "Apakah anda yakin mau menghapus "+(data.index ? "project " : "folder ")+'"'+data.name+'"'
            }, "Yes").then(e => {
                if (e) {
                    if (data.parentId) {
                        let dataParent = this.getParentData(data.parentId).reverse();
    
                        dataParent = dataParent.reduce((a, b) => {
                            if(a) {
                                let i = a.child.findIndex(c => c.id == b.id);
                                a = a.child[i];
                            }else{
                                let i = this.dataProject.findIndex(c => c.id == b.id);
                                a = this.dataProject[i];
                            }
                            return a;
                        }, null);
                        
                        dataParent.child = dataParent.child.filter(e => e.id != data.id);

                    }else{
                        this.dataProject = this.dataProject.filter(e => e.id != data.id)
                    }
                    let saveNewData = this.removeIdData(JSON.parse(JSON.stringify(this.dataProject)));
                    this.refresh(saveNewData);
                }
            })
        }
    }

    /**
     * @param {any} [newData]
     */
    refresh(newData) {
        this._onDidChangeTreeData.fire();
        if(newData) fs.writeFileSync(this.dirProject, JSON.stringify(newData, null, 4));
    }

    editJson() {
        if(!fs.existsSync(this.dirProject)) fs.writeFileSync(this.dirProject, JSON.stringify([], null, 4));

        vscode.workspace.openTextDocument(this.dirProject).then(e => {
            vscode.window.showTextDocument(e);
        })
    }

    /**
     * @param {any} args
     */
    async select(args) {
        if(args.type == "file") this.openFolder(args.rootDir);
    }

    /**
     * @param {any} rootDir
     */
    async openFolder(rootDir, newTab = false) {
        
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(rootDir), newTab);
    }

    /**
     * @param {any} data
     */
    openInExplorer(data) {
        if (fs.existsSync(data.rootDir)) {
            vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(data.rootDir))
        }else{
            vscode.window.showErrorMessage(`Path '${data.rootDir}' tidak ditemukan.`);
        }
    }

    /**
     * @param {any} data
     */
    renameData(data) {
        vscode.window.showInputBox({
            title: "Rename "+(data.index ? "Project" : "Folder"),
            placeHolder: 'Enter the new name '+(data.index ? "project" : "folder"),
            value: data.name,
            ignoreFocusOut: false,
            validateInput: (value) => {
                if(value == "") return "Name is not blank";
                return;
            }
        }).then(value => {
            if (value) {
                if (data.parentId) {
                    let dataParents = this.getParentData(data.parentId).reverse();

                    dataParents = dataParents.reduce((a, b) => {
                        if(a) {
                            let i = a.child.findIndex(c => c.id == b.id);
                            a = a.child[i];
                        }else{
                            let i = this.dataProject.findIndex(c => c.id == b.id);
                            a = this.dataProject[i];
                        }
                        return a;
                    }, null);
                    
                    let i = dataParents.child.findIndex(e => e.id == data.id);
                    if(i != -1) dataParents.child[i].name = value;

                    let saveNewData = this.removeIdData(JSON.parse(JSON.stringify(this.dataProject)));
                    this.refresh(saveNewData);
                }else{
                    let index = this.dataProject.findIndex(e => e.id == data.id);
                    this.dataProject[index].name = value;
                    let saveNewData = this.removeIdData(JSON.parse(JSON.stringify(this.dataProject)));
                    this.refresh(saveNewData);
                }
            }
        });
    }

    /**
     * @param {any} id
     * @param {any} hasil
     */
    getParentData(id, hasil = []) {
        if(!id) return hasil;

        let data = this.getDataById(id);
        const { parentId } = data || {};
        hasil.push(data);

        if(parentId) return this.getParentData(parentId, hasil);

        return hasil;
    }

    /**
     * @param {any} id
     * @param {any[]} [data]
     */
    getDataById(id, data) {
        if(!data) data = this.dataProject;
        
        let item = data.find((/** @type {{ id: any; }} */ e) => e.id == id);
        if (item) {
            return item;
        }else{
            let newData = data.filter((/** @type {{ child: any; }} */ e) => e.child).reduce((/** @type {any[]} */ a, /** @type {{ child: any; }} */ b) => {
                a = [...a, ...b.child];
                return a;
            }, []);
            
            return newData.length > 0 ? this.getDataById(id, newData) : {}
        }
    }

    reload() {
        this.readData();
        this.refresh();
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

module.exports = ManageProject