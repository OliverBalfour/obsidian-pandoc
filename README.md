## Obsidian Pandoc Plugin

This is a Pandoc export plugin for Obsidian (https://obsidian.md).

It adds command palette options to export your notes to a variety of formats including Word Documents (.docx), PDFs, ePub books, HTML pages, PowerPoints (.pptx), Jupyter Notebooks, and LaTeX among others. This is done by interfacing with [Pandoc](https://pandoc.org/).

**Note:** This plugin is still in early alpha. It doesn't support Obsidian's markdown extensions yet, and features like the settings interface and good error handling aren't finished yet. There are guaranteed to be bugs, I hacked this thing together in half a day 😂.

![screenshot of command palette](./command-palette.png)

How to install:
1. [Install Pandoc](https://pandoc.org/installing.html) if you have not already
2. Download this repository as a zip file, and unzip it into your `vault/.obsidian/plugins` folder
3. Enable it in the community plugins settings menu

Once the plugin is in better shape, I will make it installable by browsing the community plugins list. For now it's a little tedious.

How it works:
* Press Ctrl+P to show the command palette. (You'll need the core command palette plugin enabled, and you'll need to have a markdown document open.)
* Search "Pandoc"
* Choose your export format
* If all goes well, it will say it was successful
* If you exported a file called `Pandoc.md` as a Word Document, in your file explorer there should now be a `Pandoc.docx` file next to `Pandoc.md`. (I'll add a save file dialog to choose the name/folder soon)
