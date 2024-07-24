# Kroki Diagram Viewer

**Version: Early Alpha**

Welcome to the Kroki Diagram Viewer! This VS Code extension allows you to preview various diagram types supported by Kroki directly within your editor.

## Features

- **Preview Multiple Diagram Types**: Render a wide range of diagram types, including PlantUML, Graphviz, Mermaid, Structurizr, and more.
- **Live Updates**: Diagrams update automatically as you edit the source file.
- **Support for Various Formats**: Supports diagram formats including PlantUML, Graphviz, Mermaid, UMLet, Nomnoml, C4PlantUML, Ditaa, Bytefield, Vega-Lite, and Structurizr.

## Supported Diagram Types

- PlantUML (`*.puml`, `*.plantuml`)
- Graphviz (`*.dot`, `*.gv`)
- Mermaid (`*.mmd`, `*.mermaid`)
- UMLet (`*.umlet`)
- Nomnoml (`*.nomnoml`)
- C4PlantUML (`*.c4puml`)
- Ditaa (`*.ditaa`)
- Bytefield (`*.bf`)
- Vega-Lite (`*.vl`, `*.vegalite`)
- Structurizr (`*.dsl`)

## Usage

1. **Open a supported diagram file**:
    - Ensure your file has the appropriate extension for the diagram type (e.g., `.puml` for PlantUML, `.mmd` for Mermaid, `.dsl` for Structurizr, etc.).

2. **Preview the Diagram**:
    - Right-click on the file in the Explorer pane.
    - Select `Preview Kroki Diagram`.

3. **Edit and View**:
    - Edit your diagram source file, and the preview will update automatically.

4. **Keyboard Shortcuts**:
    - Toggle Preview: `ctrl+shift+v` or `cmd+shift+v`
    - Open Preview to the Side: `ctrl+k v` or `cmd+k v`

5. **Structurizr DSL Support**:
    - Structurizr DSL supports viewing all views in the preview. You can navigate through different views of your Structurizr models seamlessly.

## Acknowledgements

This extension is in its very early alpha stages, and we have borrowed code from some fantastic existing projects to get it off the ground. Special thanks to:

- **Jebbs** for the code borrowed from the [vscode-plantuml](https://github.com/qjebbs/vscode-plantuml) plugin. Your work provided a great foundation for handling diagram rendering.
- **George Oliveira & Thomas Haakon Townsend** for the code borrowed from the [vscode-html-preview](https://github.com/george-alisson/html-preview-vscode) plugin. Your implementation of HTML previews was instrumental in setting up our diagram previews.

## Contributing

Contributions are welcome! Please fork the repository and submit pull requests. Whether it's a bug fix, new feature, or documentation improvement, we appreciate your help in making this extension better.

## License

This project is licensed under the MIT License.

---

Happy diagramming!

For any issues or feature requests, please [open an issue](https://github.com/csteeg/kroki-preview-vscode/issues).

---

*Note: This extension is in active development. Features and functionality may change. Feedback and contributions are highly appreciated!*
