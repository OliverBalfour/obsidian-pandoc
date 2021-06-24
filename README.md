## Obsidian Pandoc Plugin

This is a Pandoc export plugin for Obsidian (https://obsidian.md).

It adds command palette options to export your notes to a variety of formats including Word Documents, PDFs, ePub books, HTML websites, PowerPoints and LaTeX among (many) others. This is all thanks to [Pandoc](https://pandoc.org/).

This lets you **write presentations**, **draft books**, **make webpages**, and **write assignments** all in Markdown, and export to whichever format you fancy, all without leaving Obsidian.

**Note:** This plugin is still in beta. It **does** support Obsidian's markdown extensions. However, there are still some bizarre formatting bugs and missing features (like citations), so make sure to proof read the output!

![screenshot of command palette](./command-palette.png)

How to install:
1. [Install Pandoc](https://pandoc.org/installing.html) if you have not already (without Pandoc only the HTML export works)
2. Download the three files (`main.js`, `styles.css`, `manifest.json`) from the [latest release](https://github.com/OliverBalfour/obsidian-pandoc/releases) (**not** the zip file, see [#40](https://github.com/OliverBalfour/obsidian-pandoc/issues/40)), and copy them into a `vault/.obsidian/plugins/obsidian-pandoc` folder
3. Enable it in the community plugins settings menu

Once the plugin is in better shape, I will make it installable by browsing the community plugins list. For now it's a little tedious.

How it works:
* Press Ctrl+P/Cmd+P to show the command palette
* Search "Pandoc"
* Choose your export format
* If all goes well, it will say it was successful
* If you exported a file called `Pandoc.md` as a Word Document, in your file explorer there will be a `Pandoc.docx` file in the same folder

## Tips & tricks

* Slideshows: use `---` by itself on a line between slides
* Using a custom title: put a `title: "My title"` field in the [YAML frontmatter](https://help.obsidian.md/Advanced+topics/YAML+front+matter) and it will use that instead of the filename
* Adding an author, subtitle, date, etc: use YAML as above, see the Pandoc documentation for reference.
* Writing books: you can stitch chapters together with Obsidian's note embed syntax. Think `![[Chapter1]] ![[Chapter2]] ...` - the output looks seamless.
* If you want tags in your source document but not the output, you can put them in the YAML frontmatter

## Troubleshooting

* Help! It's saying Pandoc can't be found!
  
  This happens when you have PATH variable issues. If you don't know what that means, there's a setting called `Pandoc path` at the bottom of the settings panel. If you run `which pandoc` in a terminal on Mac/Linux and `Get-Command pandoc` in powershell on Windows, just paste the path to the file in that field (should look like `/usr/bin/pandoc` or `C:\example\pandoc.exe`).
  
  (If you're curious about the PATH thing, see [here](https://github.com/OliverBalfour/obsidian-pandoc/issues/15#issuecomment-823650889) for more info.)
* Weird looking output?
  
  Sometimes Pandoc is a little fiddly, but if you can't figure it out feel free to report an issue

## Known Issues

This is a non-exhaustive list of issues I've found in testing. Most export formats work with most formatting, apart from the exceptions below.

* Exports with embedded notes don't handle complex plugin formatting (eg DataView)
* Reveal.js: complex equations don't work, syntax highlighting doesn't work, footnotes look weird
* LaTeX: foreign images don't work
* PowerPoint: Mermaid.js diagrams don't appear
* Word, OpenDocument: very complex equations sometimes have ? symbols
