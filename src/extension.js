const vscode = require("vscode");
const ManageProject = require("./ManageProject");


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    let ManageProjectTree = new ManageProject(context);
    // vscode.window.registerTreeDataProvider("ManageProject", ManageProjectTree);
    vscode.commands.registerCommand('ManageProject.editJson', () => ManageProjectTree.editJson());
    vscode.commands.registerCommand('ManageProject.select', range => ManageProjectTree.select(range));
    vscode.commands.registerCommand('ManageProject.renameGlobal', args => ManageProjectTree.renameData(args));
    vscode.commands.registerCommand('ManageProject.renameFolder', args => ManageProjectTree.renameData(args));
    vscode.commands.registerCommand('ManageProject.renameProject', args => ManageProjectTree.renameData(args));

    vscode.commands.registerCommand('ManageProject.refresh', () => ManageProjectTree.reload());
    vscode.commands.registerCommand('ManageProject.openNewWindow', data => data.index ? ManageProjectTree.openFolder(data.rootDir, true) : '');
    vscode.commands.registerCommand('ManageProject.newFolder', () => ManageProjectTree.newFolder());
    vscode.commands.registerCommand('ManageProject.saveProject', () => ManageProjectTree.saveProject());
    vscode.commands.registerCommand('ManageProject.open', data => data.index ? ManageProjectTree.openFolder(data.rootDir, false) : '');
    vscode.commands.registerCommand('ManageProject.openInExplorer', data => ManageProjectTree.openInExplorer(data));
    vscode.commands.registerCommand('ManageProject.search', () => ManageProjectTree.search());
    vscode.commands.registerCommand('ManageProject.deleteFolder', args => ManageProjectTree.delete(args));
    vscode.commands.registerCommand('ManageProject.deleteProject', args => ManageProjectTree.delete(args));
    vscode.commands.registerCommand('ManageProject.delKeyBind', args => ManageProjectTree.delete(args, true));

    vscode.commands.registerCommand('ManageProject.settings', () => {
        vscode.commands.executeCommand("workbench.action.openSettings", "ManageProject");
    });
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
