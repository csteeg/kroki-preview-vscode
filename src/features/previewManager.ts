/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Logger } from "winston";
import { disposeAll } from "../util/dispose";
import { HTMLPreview, PreviewSettings } from "./preview";
import { HTMLContentProvider } from "./previewContentProvider";

export class HTMLPreviewManager {
  private static readonly htmlPreviewActiveContextKey = "kroki.PreviewFocus";

  private readonly _previews: HTMLPreview[] = [];
  private _activePreview: HTMLPreview | undefined = undefined;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(private readonly _contentProvider: HTMLContentProvider, private readonly _logger: Logger) {}

  public dispose(): void {
    disposeAll(this._disposables);
    disposeAll(this._previews);
  }

  public refresh() {
    for (const preview of this._previews) {
      preview.refresh();
    }
  }

  public preview(resource: vscode.Uri, previewSettings: PreviewSettings): void {
    let preview = this.getExistingPreview(resource, previewSettings);
    if (preview) {
      preview.reveal(previewSettings.previewColumn);
    } else {
      preview = this.createNewPreview(resource, previewSettings);
    }

    preview.update(resource);
  }

  public get activePreviewResource() {
    return this._activePreview && this._activePreview.resource;
  }

  public toggleLock() {
    const preview = this._activePreview;
    if (preview) {
      preview.toggleLock();

      // Close any previews that are now redundant, such as having two dynamic previews in the same editor group
      for (const otherPreview of this._previews) {
        if (otherPreview !== preview && preview.matches(otherPreview)) {
          otherPreview.dispose();
        }
      }
    }
  }

  private getExistingPreview(resource: vscode.Uri, previewSettings: PreviewSettings): HTMLPreview | undefined {
    return this._previews.find((preview) =>
      preview.matchesResource(resource, previewSettings.previewColumn, previewSettings.locked)
    );
  }

  private createNewPreview(resource: vscode.Uri, previewSettings: PreviewSettings): HTMLPreview {
    const preview = HTMLPreview.create(
      resource,
      previewSettings.previewColumn,
      previewSettings.locked,
      this._contentProvider,
      this._logger
    );

    this.setPreviewActiveContext(true);
    this._activePreview = preview;
    return this.registerPreview(preview);
  }

  private registerPreview(preview: HTMLPreview): HTMLPreview {
    this._previews.push(preview);

    preview.onDispose(() => {
      const existing = this._previews.indexOf(preview);
      if (existing === -1) {
        return;
      }

      this._previews.splice(existing, 1);
      if (this._activePreview === preview) {
        this.setPreviewActiveContext(false);
        this._activePreview = undefined;
      }
    });

    preview.onDidChangeViewState(({ webviewPanel }) => {
      disposeAll(this._previews.filter((otherPreview) => preview !== otherPreview && preview!.matches(otherPreview)));
      this.setPreviewActiveContext(webviewPanel.active);
      this._activePreview = webviewPanel.active ? preview : undefined;
    });

    return preview;
  }

  private setPreviewActiveContext(value: boolean) {
    vscode.commands.executeCommand("setContext", HTMLPreviewManager.htmlPreviewActiveContextKey, value);
  }
}
