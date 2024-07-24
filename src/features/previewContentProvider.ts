import axios from "axios";
import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { getExtensionUri } from "../extension";
import { Logger } from "../logger";

//this class needs some heavy refactoring, making it work first
export class HTMLContentProvider {
  constructor(private readonly context: vscode.ExtensionContext, private readonly logger: Logger) {}

  private async getImages(document: vscode.TextDocument): Promise<{ imgHtml: string; errorHtml: string }> {
    const supportedFiles = vscode.workspace
      .getConfiguration("kroki")
      .get<{ extension: string; type: string }[]>("supportedFiles", []);
    const diagram_type = supportedFiles.find(
      (file) => file.extension === `.${document.uri.fsPath.split(".").pop()}`
    )?.type;

    if (diagram_type === undefined) {
      throw new Error("Unsupported file type for Kroki previewer");
    }

    if (diagram_type === "structurizr") {
      return await this.getImagesForStructurizr(document);
    }

    return await this.getImageHtml(document.getText(), diagram_type);
  }

  private async getImageHtml(text: string, diagram_type: string): Promise<{ imgHtml: string; errorHtml: string }> {
    try {
      const response = await axios.post(
        `https://kroki.io`,
        {
          diagram_source: text,
          diagram_type: diagram_type,
          output_format: "svg",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status !== 200) {
        return { imgHtml: "", errorHtml: this.getKrokiApiErrorHtml(response) };
      }

      return {
        imgHtml: `<img src="data:image/svg+xml;base64,${Buffer.from(response.data).toString("base64")}">`,
        errorHtml: "",
      };
    } catch (error) {
      return { imgHtml: "", errorHtml: this.getKrokiApiErrorHtml(error) };
    }
  }

  private async getImagesForStructurizr(
    document: vscode.TextDocument
  ): Promise<{ imgHtml: string; errorHtml: string }> {
    const structurizrCliFolder = path.join(this.context.extensionPath, "bin");
    const isWindows = os.platform() === "win32";
    const structurizrCliPath = isWindows
      ? path.join(structurizrCliFolder, "structurizr.bat")
      : path.join(structurizrCliFolder, "structurizr.sh");

    // Generate a unique temporary file path
    const tempDir = os.tmpdir();
    const tempFolderName = `krokipreview/${Date.now()}`;
    const tempFolder = path.join(tempDir, tempFolderName);
    fs.mkdirSync(tempFolder, { recursive: true });

    const cachedPostFix = `.krokipreview.${Date.now()}`;
    const isDirty = document.isDirty;
    const filePath = document.uri.fsPath + (isDirty ? cachedPostFix : "");
    if (isDirty) {
      fs.writeFileSync(filePath, document.getText());
    }

    const commandprefix = isWindows ? "" : "sh ";
    const toJsonCommand = `${commandprefix}${structurizrCliPath} export --workspace ${filePath} --format json --output ${tempFolder}`;

    try {
      cp.execSync(toJsonCommand);

      const dirCont = fs.readdirSync(tempFolder);
      const tempJsonFile = dirCont.find((elm) => elm.match(/.*\.(json?)/gi));
      if (!tempJsonFile) {
        throw new Error("Error converting structurizr files to json");
      }
      const tempJson = path.join(tempFolder, tempJsonFile);
      const toPumlCommand = `${commandprefix}${structurizrCliPath} export --workspace ${tempJson} --format plantuml --output ${tempFolder}`;

      cp.execSync(toPumlCommand);

      const structurizrData = JSON.parse(fs.readFileSync(tempJson, "utf-8"));
      const views = structurizrData.views;
      // Extract and sort views by their order
      let allViews: { key: any; order: any }[] = [];

      Object.keys(views).forEach((viewType) => {
        if (Array.isArray(views[viewType])) {
          views[viewType].forEach((view) => {
            allViews.push({
              key: view.key,
              order: view.order,
            });
          });
        }
      });

      const sendPumlToKroki = async (pumlFileName: string) => {
        const pumlContent = fs.readFileSync(path.join(tempFolder, pumlFileName), "utf8");
        //filenames are in format of 'structurizr-{KEY}.puml', if we found them in the json, order by the order in the json
        const order = allViews.find((view) => pumlFileName === `structurizr-${view.key}.puml`)?.order || 9999999;
        const img = await this.getImageHtml(pumlContent, "plantuml");
        return { img, order };
      };

      // Read all PUML files in the temporary directory
      const pumlFiles = fs
        .readdirSync(tempFolder)
        .filter((file) => file.endsWith(".puml") && !file.endsWith("-key.puml"));

      const unOrderedDiagramContents = await Promise.all(pumlFiles.map((pumlFile) => sendPumlToKroki(pumlFile)));
      const diagramContents = unOrderedDiagramContents.sort((a, b) => a.order - b.order).map((content) => content.img);

      return {
        imgHtml: diagramContents.map((content) => content.imgHtml).join(""),
        errorHtml: diagramContents.map((content) => content.errorHtml).join(""),
      };
    } catch (error: any) {
      const errorDetail = (
        "stderr" in error ? error.stderr.toString() : error instanceof Error ? error.message : JSON.stringify(error)
      ).replace(cachedPostFix, "");
      return {
        imgHtml: "",
        errorHtml: `<h3>Error transforming structurizr files</h3><pre>${errorDetail}</pre>`,
      };
    } finally {
      try {
        if (isDirty) {
          fs.rmSync(filePath);
        }
        fs.rmSync(tempFolder, { recursive: true, force: true });
      } catch (error) {
        vscode.window.showErrorMessage(`Error cleaning up temporary files: ${error}`);
      }
    }
  }

  private getLoaderHtml(webview: vscode.Webview): string {
    return `
<html>
<head>
    <link rel="stylesheet" href="${this.extensionResourcePath(webview, "css/preview.css")}">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${
      webview.cspSource
    } https:; script-src ${webview.cspSource}; font-src ${webview.cspSource}; style-src ${
      webview.cspSource
    } 'unsafe-inline';">
</head>
<body>
    <div id="spinner-container">
        <div class="spinner">
            <div class="rect1"></div>
            <div class="rect2"></div>
            <div class="rect3"></div>
            <div class="rect4"></div>
            <div class="rect5"></div>
        </div>
        <div>
            <span>Processing...</span>
        </div>
    </div>
</body>
</html>`;
  }

  private errorDocumentContent(errorHtml: string, webview: vscode.Webview): string {
    return `
<html>
<head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${
        webview.cspSource
      } https:; script-src ${webview.cspSource}; font-src ${webview.cspSource}; style-src ${
      webview.cspSource
    } 'unsafe-inline';">
      <link rel="stylesheet" href="${this.extensionResourcePath(webview, "css/error.css")}">
</head>
<body>
    <div class="container">
        ${errorHtml}
    </div>
</body>
</html>`;
  }

  public async loadPreview(document: vscode.TextDocument, webview: vscode.Webview): Promise<string> {
    this.logger.log("provideTextDocumentContent", { source: document.uri.toString(), cspSource: webview.cspSource });

    webview.html = this.getLoaderHtml(webview);

    let { imgHtml, errorHtml } = await this.getImages(document);

    if (imgHtml === "" && errorHtml === "") {
      errorHtml = "<h3>Error</h3><p>We do not have any image to show.</p>";
    }

    if (errorHtml && errorHtml !== "" && (imgHtml === "" || !imgHtml)) {
      return this.errorDocumentContent(errorHtml, webview);
    }

    const settings = JSON.stringify({
      zoomUpperLimit: false,
      showSpinner: false,
      showSnapIndicators: true,
      swapMouseButtons: false,
    });
    return `
<html>
<head>
    <link rel="stylesheet" href="${this.extensionResourcePath(webview, "css/preview.css")}">
    <script src="${this.extensionResourcePath(webview, "js/dragscroll.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/hyperlink.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/switcher.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/zoom.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/imageMapResizer.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/preview.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/cursor.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/selectionZoom.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/clickEvent.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/modal.js")}"></script>
    <script src="${this.extensionResourcePath(webview, "js/tip.js")}"></script>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${
      webview.cspSource
    } https:; script-src ${webview.cspSource}; font-src ${webview.cspSource}; style-src ${
      webview.cspSource
    } 'unsafe-inline';">
</head>
<body>
    <div id="snap-indicator-container">
        <p>
            <i class="material-icons snap-indicator snap-indicator-top" title="Snapped to Top:\n\nScroll to most top after preview updates"
                style="transform:rotate(180deg);">vertical_align_bottom</i>
            <i class="material-icons snap-indicator snap-indicator-left" title="Snapped to Left:\n\nScroll to most left after preview updates"
                style="transform:rotate(90deg);">vertical_align_bottom</i>
            <i class="material-icons snap-indicator snap-indicator-bottom"
                title="Snapped to Bottom:\n\nScroll to most bottom after preview updates">vertical_align_bottom</i>
            <i class="material-icons snap-indicator snap-indicator-right" title="Snapped to Right:\n\nScroll to most right after preview updates"
                style="transform:rotate(-90deg);">vertical_align_bottom</i>
        </p>
    </div>
    <div id="tip-container" class="fixed-center">
        <p id="tip"></p>
    </div>
    <div id="image-container" style="margin: 10px;">
        <img id="image" src="" draggable="false" usemap="#image-map">
        <map id="image-map" name="image-map" data=""></map>
    </div>
    <div id="ctrl-container">
        <div id="controls">
            <button class="btn" id="btnZoomOut">
                <i class="material-icons">zoom_out</i>
            </button>
            <button class="btn" id="btnZoomToggle">
                <i id="icon-toggle" class="material-icons">fullscreen</i>
            </button>
            <button class="btn" id="btnZoomIn">
                <i class="material-icons">zoom_in</i>
            </button>
            <button class="btn" id="btnCopy" 
                data-label-copying="Copying..." 
                data-label-ok="Copied to clipboard"
                data-label-fail="Copy failed">
                <i class="material-icons">content_copy</i>
            </button>
            <button class="btn" id="btnHelp">
                <i class="material-icons">help</i>
            </button>
            <div id="page-ctrls">
                <button class="btn" id="btnPrev">
                    <i class="material-icons">skip_previous</i>
                </button>
                <button class="btn" id="btnNext">
                    <i class="material-icons">skip_next</i>
                </button>
                <span id="pageInfo">Page {0} of {1}</span>
            </div>
        </div>
    </div>
    <div id="error-warning">
        <i class="material-icons">error</i>
        <div id="errmsg">
            <div id="errtxt">${errorHtml}</div>
        </div>
    </div>
    <div id="modal-help" class="modal">
        <div class="modal-content">
            <span class="close material-icons">close</span>
            <h2>Previewer Operations</h2>
            <p>Zoom:
                <ul>
                    <li>Zoom to select area</li>
                    <li>Pinch to zoom (TouchPad)</li>
                    <li>Click to zoom in, Alt + click to zoom out</li>
                    <li>Ctrl + mouse scroll to zoom in/out</li>
                    <li>Middle mouse button click to toggle zoom</li>
                    <li>Zoom in / zoom out / toggle buttons of the controls bar</li>
                </ul>
            </p>
            <p>Pan:
                <ul>
                    <li>Right mouse button drag</li>
                    <li>Two-finger move to pan (TouchPad)</li>
                    <li>Mouse scroll</li>
                </ul>
            </p>
            <p>Snap to border: 
                <ul>
                    <li>Scroll to most bottom/right/top/left, preview will snap to that border</li>
                </ul>
            </p>
        </div>
    </div>
    <div style="display:none;">
        <div id="images">
            ${imgHtml}
        </div>
        <p id="status"></p>
        <a id="sendStatus" href=""></a>
        <p id="settings">${settings}</p>
    </div>
</body>
</html>`;
  }

  private getKrokiApiErrorHtml(error: any): string {
    let title = "Error";
    let details = "No response from Kroki API.";
    if (axios.isAxiosError(error) && error.response) {
      const apiError = error.response.data;
      title = `Kroki API Error: ${apiError.error.code}`;
      details = apiError.error.message;
    } else if (axios.isAxiosError(error) && error.request) {
      details = "No response from Kroki API";
    } else {
      details = JSON.stringify(error);
    }

    vscode.window.showErrorMessage(`Kroki API Error: ${title} -> ${details}`);
    return `<h3>${title}</h3><p>${details}.</p>`;
  }

  private extensionResourcePath(webview: vscode.Webview, mediaFile: string): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(getExtensionUri(), "media", mediaFile));
  }
}
