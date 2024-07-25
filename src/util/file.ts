/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { getLogger } from "../extension";

export function isPreviewableFile(document: vscode.TextDocument): Boolean {
  const supportedFiles: { extension: string; type: string }[] = vscode.workspace
    .getConfiguration()
    .get("kroki.supportedFiles", []);
  const targetExtensions = supportedFiles.map((file) => file.extension);
  const extname = document.uri.fsPath.split(".").pop();
  const isPreviewable = targetExtensions.includes(`.${extname}`);
  getLogger().debug(`Checking if file is previewable ${document.uri.fsPath} returns ${isPreviewable} `);
  return isPreviewable;
}
