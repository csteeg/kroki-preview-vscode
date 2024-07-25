/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { createLogger, Logger } from "winston";
import { LogOutputChannelTransport } from "winston-transport-vscode";
import { CommandManager } from "./commandManager";
import * as commands from "./commands/index";
import { HTMLContentProvider } from "./features/previewContentProvider";
import { HTMLPreviewManager } from "./features/previewManager";
import { isPreviewableFile } from "./util/file";

// 2. Create a Log Output Channel for your extension with the VS Code API
const outputChannel = vscode.window.createOutputChannel("Kroki Previewer", {
  log: true,
});

// 3. Create the Winston logger giving it the Log Output Channel
const logger = createLogger({
  level: "trace", // Recommended: set the highest possible level
  levels: LogOutputChannelTransport.config.levels, // Recommended: use predefined VS Code log levels
  format: LogOutputChannelTransport.format(), // Recommended: use predefined format
  transports: [new LogOutputChannelTransport({ outputChannel })],
});

let extensionPath = "";
let extensionUri: vscode.Uri;

export function getExtensionPath(): string {
  return extensionPath;
}

export function getExtensionUri(): vscode.Uri {
  return extensionUri;
}

export function getLogger(): Logger {
  return logger;
}

export function activate(context: vscode.ExtensionContext) {
  extensionPath = context.extensionPath;
  extensionUri = context.extensionUri;
  logger.debug("Extension activated", { extensionUri });

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

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) {
      logger.debug("onDidChangeActiveTextEditor: no active editor");
      return;
    }

    const document = editor.document;
    if (document.uri.scheme !== "file") {
      logger.debug(`onDidChangeActiveTextEditor: ${document.uri} is not a file scheme file`);
      return;
    }

    if (isPreviewableFile(document)) {
      logger.debug(`onDidOpenTextDocument: ${document.uri} is a previewable file`);
      // Logic to show or enable the command/menu item
      vscode.commands.executeCommand("setContext", "kroki.previewCommandsEnabled", true);
    } else {
      logger.debug(`onDidOpenTextDocument: ${document.uri} is NOT a previewable file`);
      vscode.commands.executeCommand("setContext", "kroki.previewCommandsEnabled", false);
    }
  });

  vscode.workspace.textDocuments.forEach((document) => {
    if (isPreviewableFile(document)) {
      logger.debug(`workspace textdocument: ${document.uri.fsPath} is a previewable file`);
      vscode.commands.executeCommand("setContext", "kroki.previewCommandsEnabled", true);
    } else {
      logger.debug(`workspace textdocument: ${document.uri.fsPath} is NOT a previewable file`);
    }
  });
}
