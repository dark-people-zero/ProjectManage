const vscode = require("vscode");
const path = require("path");

class ManageProjectBackup {
    
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        this.dropMimeTypes = ['application/vnd.code.tree.ManageProject'];
        this.dragMimeTypes = ['text/uri-list'];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        // We want to use an array as the event type, but the API for this is currently being finalized. Until it's finalized, use any.
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        
        this.tree = {
            'a': {
                'aa': {
                    'aaa': {
                        'aaaa': {
                            'aaaaa': {
                                'aaaaaa': {}
                            }
                        }
                    }
                },
                'ab': {}
            },
            'b': {
                'ba': {},
                'bb': {}
            },
            'c': {
                'ca': {},
                'cb': {}
            }
        };
        // Keep track of any nodes we create so that we can re-use the same objects.
        this.nodes = {};
        
        const view = vscode.window.createTreeView('ManageProject', {
            // @ts-ignore
            treeDataProvider: this,
            showCollapseAll: true,
            canSelectMany: true,
            dragAndDropController: this
        });
        context.subscriptions.push(view);
    }

    // Tree data provider 
    /**
     * @param {{ key: any; }} element
     */
    getChildren(element) {
        return this._getChildren(element ? element.key : undefined).map(key => this._getNode(key));
    }
    /**
     * @param {{ key: any; }} element
     */
    getTreeItem(element) {
        const treeItem = this._getTreeItem(element.key);
        treeItem.id = element.key;
        return treeItem;
    }
    /**
     * @param {{ key: any; }} element
     */
    getParent(element) {
        return this._getParent(element.key);
    }

    dispose() {
        // nothing to dispose
    }
    // Drag and drop controller
    /**
     * @param {any} target
     * @param {{ get: (arg0: string) => any; }} sources
     */
    async handleDrop(target, sources) {
        const transferItem = sources.get('application/vnd.code.tree.ManageProject');
        if (!transferItem) {
            return;
        }
        const treeItems = transferItem.value;
        let roots = this._getLocalRoots(treeItems);
        console.log("roots2", roots);
        console.log("treeItems", treeItems);
        // Remove nodes that are already target's parent nodes
        roots = roots.filter(r => !this._isChild(this._getTreeElement(r.key), target));
        console.log("roots", roots);
        if (roots.length > 0) {
            // Reload parents of the moving elements
            const parents = roots.map(r => this.getParent(r));
            console.log("parents", parents);
            roots.forEach(r => this._reparentNode(r, target));
            console.log("dodol",[...parents, target]);
            this._onDidChangeTreeData.fire([...parents, target]);
        }
    }
    /**
     * @param {any} source
     * @param {{ set: (arg0: string, arg1: vscode.DataTransferItem) => void; }} treeDataTransfer
     */
    async handleDrag(source, treeDataTransfer) {
        treeDataTransfer.set('application/vnd.code.tree.ManageProject', new vscode.DataTransferItem(source));
    }
    // Helper methods
    /**
     * @param {{ [x: string]: any; }} node
     * @param {{ key: string; }} child
     */
    _isChild(node, child) {
        if (!child) {
            return false;
        }
        for (const prop in node) {
            if (prop === child.key) {
                return true;
            }
            else {
                const isChild = this._isChild(node[prop], child);
                if (isChild) {
                    return isChild;
                }
            }
        }
        return false;
    }
    // From the given nodes, filter out all nodes who's parent is already in the the array of Nodes.
    /**
     * @param {any[]} nodes
     */
    _getLocalRoots(nodes) {
        const localRoots = [];
        for (let i = 0; i < nodes.length; i++) {
            const parent = this.getParent(nodes[i]);
            if (parent) {
                const isInList = nodes.find((/** @type {{ key: any; }} */ n) => n.key === parent.key);
                if (isInList === undefined) {
                    localRoots.push(nodes[i]);
                }
            }
            else {
                localRoots.push(nodes[i]);
            }
        }
        return localRoots;
    }
    // Remove node from current position and add node to new target element
    /**
     * @param {any} node
     * @param {any} target
     */
    _reparentNode(node, target) {
        const element = {};
        element[node.key] = this._getTreeElement(node.key);
        const elementCopy = { ...element };
        this._removeNode(node);
        const targetElement = this._getTreeElement(target.key);
        if (Object.keys(element).length === 0) {
            targetElement[node.key] = {};
        }
        else {
            Object.assign(targetElement, elementCopy);
        }
    }
    // Remove node from tree
    /**
     * @param {{ key: string; }} element
     * @param {undefined} [tree]
     */
    _removeNode(element, tree) {
        const subTree = tree ? tree : this.tree;
        for (const prop in subTree) {
            if (prop === element.key) {
                const parent = this.getParent(element);
                if (parent) {
                    const parentObject = this._getTreeElement(parent.key);
                    delete parentObject[prop];
                }
                else {
                    delete this.tree[prop];
                }
            }
            else {
                this._removeNode(element, subTree[prop]);
            }
        }
    }
    /**
     * @param {any} key
     */
    _getChildren(key) {
        if (!key) return Object.keys(this.tree);

        const treeElement = this._getTreeElement(key);
        
        if (treeElement) {
            return Object.keys(treeElement);
        }
        return [];
    }
    /**
     * @param {any} key
     */
    _getTreeItem(key) {
        const treeElement = this._getTreeElement(key);

        let folder = treeElement && Object.keys(treeElement).length;
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
        
        let label = key.toLocaleUpperCase();
        const tooltip = new vscode.MarkdownString(`${label} \n\n _://Project Manager/${label}_ \n\n $(folder) Folder`, true);

        return {
            label: label,
            tooltip,
            collapsibleState: folder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            resourceUri: vscode.Uri.parse(`/tmp/${key}`),
            iconPath: folder ? icon.folder : icon.file,
            contextValue: folder ? 'folder' : 'file'
        };
    }
    /**
     * @param {string} element
     * @param {{ a: { aa: { aaa: { aaaa: { aaaaa: { aaaaaa: {}; }; }; }; }; ab: {}; }; b: { ba: {}; bb: {}; }; }} [tree]
     */
    _getTreeElement(element, tree) {
        if (!element) return this.tree;

        const currentNode = tree || this.tree;
        
        for (const prop in currentNode) {
            if (prop === element) {
                return currentNode[prop];
            } else {
                const treeElement = this._getTreeElement(element, currentNode[prop]);
                if (treeElement) return treeElement;
            }
        }
    }
    /**
     * @param {string} element
     * @param {string} [parent]
     * @param {{ a: { aa: { aaa: { aaaa: { aaaaa: { aaaaaa: {}; }; }; }; }; ab: {}; }; b: { ba: {}; bb: {}; }; }} [tree]
     */
    _getParent(element, parent, tree) {
        const currentNode = tree || this.tree;
        for (const prop in currentNode) {
            if (prop === element && parent) {
                return this._getNode(parent);
            }
            else {
                const parent = this._getParent(element, prop, currentNode[prop]);
                if (parent) {
                    return parent;
                }
            }
        }
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

module.exports = { ManageProjectBackup }