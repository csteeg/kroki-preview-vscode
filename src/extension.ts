/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { CommandManager } from "./commandManager";
import * as commands from "./commands/index";
import { HTMLContentProvider } from "./features/previewContentProvider";
import { HTMLPreviewManager } from "./features/previewManager";
import { Logger } from "./logger";
import { isPreviewableFile } from "./util/file";

let extensionPath = "";
let extensionUri: vscode.Uri;

export function getExtensionPath(): string {
  return extensionPath;
}

export function getExtensionUri(): vscode.Uri {
  return extensionUri;
}

export function activate(context: vscode.ExtensionContext) {
  extensionPath = context.extensionPath;
  extensionUri = context.extensionUri;

  const logger = new Logger();

  const contentProvider = new HTMLContentProvider(context, logger);
  const previewManager = new HTMLPreviewManager(contentProvider, logger);
  context.subscriptions.push(previewManager);

  const commandManager = new CommandManager();
  context.subscriptions.push(commandManager);
  commandManager.register(new commands.ShowPreviewCommand(previewManager));
  commandManager.register(new commands.ShowPreviewToSideCommand(previewManager));
  commandManager.register(new commands.ShowLockedPreviewToSideCommand(previewManager));
  commandManager.register(new commands.ShowSourceCommand(previewManager));
  commandManager.register(new commands.RefreshPreviewCommand(previewManager));
  commandManager.register(new commands.MoveCursorToPositionCommand());
  commandManager.register(new commands.OpenDocumentLinkCommand());
  commandManager.register(new commands.ToggleLockCommand(previewManager));

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(() => {
      logger.updateConfiguration();
    })
  );

  vscode.workspace.onDidOpenTextDocument((document) => {
    if (isPreviewableFile(document)) {
      // Logic to show or enable the command/menu item
      vscode.commands.executeCommand("setContext", "kroki.previewCommandsEnabled", true);
    } else {
      vscode.commands.executeCommand("setContext", "kroki.previewCommandsEnabled", false);
    }
  });

  vscode.workspace.textDocuments.forEach((document) => {
    const extname = document.uri.fsPath.split(".").pop();
    if (isPreviewableFile(document)) {
      vscode.commands.executeCommand("setContext", "kroki.previewCommandsEnabled", true);
    }
  });
}
