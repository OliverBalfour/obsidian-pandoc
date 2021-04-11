import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter, MarkdownRenderer, Component } from 'obsidian';
import { lookpath } from 'lookpath';
import { pandoc, inputExtensions, outputFormats, InputFormat, OutputFormat } from './pandoc';
import fontFace from './font-face';
import appcss from './appcss';
import * as fs from 'fs';
import * as path from 'path';

interface PandocPluginSettings {
	// Show a command like `pandoc -o Output.html -t html -f commonmark Input.md`
	//  in the UI as an example of how to do something similar in the terminal
	showCLICommands: boolean;
	// When rendering internal [[wikilinks]], should we add a file extension?
	// eg turns <a href="file"> to <a href="file.extension">
	addExtensionsToInternalLinks: string,
	// Do we inject CSS to add proper MathJax fonts, if there are math equations?
	injectMathJaxCSS: boolean,
	// Do we inject the default Obsidian light theme styling? This may cause licensing issues
	injectAppCSS: boolean,
	// Do we inject 3rd party plugin CSS?
	injectPluginCSS: boolean,
	// Use a custom local .css file?
	customCSSFile: string | null,
}

const DEFAULT_SETTINGS: PandocPluginSettings = {
	showCLICommands: true,
	addExtensionsToInternalLinks: 'html',
	injectMathJaxCSS: true,
	injectAppCSS: true,
	injectPluginCSS: true,
	customCSSFile: null,
}
export default class PandocPlugin extends Plugin {
	settings: PandocPluginSettings;
	programs = ['pandoc', 'latex'];
	features: { [key: string]: string | undefined } = {};

	async onload() {
		console.log('Loading Pandoc plugin');

		await this.loadSettings();

		// Check if Pandoc, LaTeX, etc. are installed and in the PATH
		await this.createBinaryMap();

		// Register all of the command palette entries
		this.registerCommands();

		this.addSettingTab(new PandocPluginSettingTab(this.app, this));
	}

	registerCommands() {
		for (let [prettyName, pandocFormat, extension] of outputFormats) {
			if (pandocFormat === 'latex' && !this.features['latex']) continue;
			const name = pandocFormat === 'html' ?
				'Export as HTML (without Pandoc)' : 'Export as ' + prettyName;
			this.addCommand({
				id: 'pandoc-export-' + pandocFormat, name,
				checkCallback: (checking: boolean) => {
					let leaf = this.app.workspace.activeLeaf;
					if (!leaf) return false;
					if (!this.features.pandoc && pandocFormat !== 'html') return false;
					if (!this.currentFileCanBeExported()) return false;
					if (!checking) {
						this.startPandocExport(this.getCurrentFile(), pandocFormat as OutputFormat, extension);
					}
					return true;
				}
			});
		}
	}

	vaultBasePath(): string {
		return (this.app.vault.adapter as FileSystemAdapter).getBasePath();
	}

	getCurrentFile(): string | null {
		const fileData = this.app.workspace.getActiveFile();
		if (!fileData) return null;
		const { basename, extension } = fileData;
		const filename = `${basename}.${extension}`;
		return path.join(this.vaultBasePath(), filename);
	}

	currentFileCanBeExported(): boolean {
		// Note: this is super inefficient
		// This can probably also be cached each time the file changes instead
		//  of being called once per format per open of the command palette
		const file = this.getCurrentFile();
		if (!file) return false;
		for (const ext of inputExtensions) {
			if (file.endsWith(ext)) return true;
		}
		return false;
	}

	async createBinaryMap() {
		// Note: lookpath scans the entire PATH once, this is not efficient
		// We're also not coalescing promises via Promise.all
		for (const binary of this.programs) {
			this.features[binary] = await lookpath(binary);
		}
	}

	async startPandocExport(inputFile: string, format: OutputFormat, extension: string) {
		console.log(`Pandoc plugin: converting ${inputFile} to ${format}`);

		// Instead of using Pandoc to process the raw Markdown, we use Obsidian's
		// internal markdown renderer, and process the HTML it generates instead.
		// This allows us to trivially deal with Obsidian specific Markdown syntax.

		try	{
			// Extract HTML
			const wrapper = document.createElement('div');
			wrapper.style.display = 'hidden';
			document.body.appendChild(wrapper);
			const markdown = (this.app.workspace.activeLeaf.view as any).data;
			await MarkdownRenderer.renderMarkdown(markdown, wrapper, this.fileBaseName(this.getCurrentFile()), {} as Component);
			this.postProcessRenderedMarkdown(wrapper);
			const renderedMarkdown = wrapper.innerHTML;
			document.body.removeChild(wrapper);

			// Process HTML
			const title = this.fileBaseName(inputFile);
			const outputFile = this.replaceFileExtension(inputFile, extension);
			const html = await this.standaloneHTML(renderedMarkdown, title);

			// Spawn Pandoc / write to HTML file
			if (format === 'html') {
				await fs.promises.writeFile(outputFile, html);
			} else {
				await pandoc({ file: 'STDIN', contents: html, format: 'html' }, { file: outputFile, format });

				// Old method: get Pandoc's AST as JSON and apply filters
				// This is no longer necessary as the HTML has everything we need
				//  and transformations are applied more easily to the HTML than the AST
				// const json = await pandoc({ file: 'STDIN', contents: html, format: 'html' }, { file: 'STDOUT', format: 'json' });
				// const AST = JSON.parse(json);
				// const newAST = this.pandocFilterAST(AST);
				// const serialised = JSON.stringify(newAST);
				// await pandoc({ file: 'STDIN', format: 'json', contents: serialised, title }, { file: outputFile, format });
			}

			// Wrap up
			fs.stat(outputFile, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
				if (stats.isFile()) new Notice('Successfully exported via Pandoc to ' + outputFile);
				else {
					new Notice('Pandoc export silently failed');
					console.error('Pandoc silently failed');
				}
			});
		} catch (e) {
			new Notice('Pandoc error: ' + e.toString());
			console.error(e);
		}
	}

	async getCustomCSS(): Promise<string> {
		if (!this.settings.customCSSFile) return;
		let file = this.settings.customCSSFile;
		let buffer: Buffer = null;
		// Try absolute path
		try {
			let test = await fs.promises.readFile(file);
			buffer = test;
		} catch (e) {}
		// Try relative path
		try {
			let test = await fs.promises.readFile(path.join(this.vaultBasePath(), file));
			buffer = test;
		} catch (e) {}
		if (!buffer) {
			new Notice('Failed to load custom Pandoc CSS file: ' + this.settings.customCSSFile);
			return '';
		} else {
			return buffer.toString();
		}
	}

	async standaloneHTML(html: string, title: string): Promise<string> {
		// Wraps an HTML fragment in a proper document structure
		//  and injects the page's CSS
		let css = '';
		// Inject app CSS if the user wants it
		if (this.settings.injectAppCSS) css = appcss;
		// Inject plugin CSS if the user wants it
		if (this.settings.injectPluginCSS)
			css += ' ' + Array.from(document.querySelectorAll('style')).map(s => s.innerHTML).join(' ');
		// Inject MathJax font CSS if needed
		if (this.settings.injectMathJaxCSS && html.indexOf('jax="CHTML"') !== -1) css += ' ' + fontFace;
		// Inject custom local CSS file if it exists
		css += await this.getCustomCSS();
		return `<!doctype html>\n` +
			   `<html>\n` +
			   `	<head>\n` +
			   `		<title>${title}</title>\n` +
			   `		<meta charset='utf-8'/>\n` +
			   `		<style>\n${css}\n</style>\n` +
			   `	</head>\n` +
			   `	<body>\n` +
			   `${html}\n` +
			   `	</body>\n` +
			   `</html>`;
	}

	postProcessRenderedMarkdown(wrapper: HTMLElement) {
		// Fix <span src="image.png">
		for (let span of Array.from(wrapper.querySelectorAll('span'))) {
			let src = span.getAttribute('src');
			if (src && (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.gif') || src.endsWith('.jpeg'))) {
				span.innerHTML = '';
				span.outerHTML = span.outerHTML.replace(/span/g, 'img');
			}
		}
		// Fix <a href="app://obsidian.md/markdown_file_without_extension">
		const prefix = 'app://obsidian.md/';
		for (let a of Array.from(wrapper.querySelectorAll('a'))) {
			let href = a.href.startsWith(prefix) ? path.join(path.dirname(this.getCurrentFile()), a.href.substring(prefix.length)) : a.href;
			if (this.settings.addExtensionsToInternalLinks.length && a.href.startsWith(prefix)) {
				if (path.extname(href) === '') {
					const dir = path.dirname(href);
					const base = path.basename(href);
					// Be careful to turn [[note#heading]] into note.extension#heading not note#heading.extension
					const hashIndex = base.indexOf('#');
					if (hashIndex !== -1) {
						href = path.join(dir, base.substring(0, hashIndex) + '.' + this.settings.addExtensionsToInternalLinks + base.substring(hashIndex));
					} else {
						href = path.join(dir, base + '.' + this.settings.addExtensionsToInternalLinks);
					}
				}
			}
			a.href = href;
		}
		// Fix <img src="app://obsidian.md/image.png">
		for (let img of Array.from(wrapper.querySelectorAll('img'))) {
			img.src = img.src.startsWith(prefix) ? path.join(path.dirname(this.getCurrentFile()), img.src.substring(prefix.length)) : img.src;
		}
	}

	fileBaseName(file: string): string {
		return path.basename(file, path.extname(file));
	}

	replaceFileExtension(file: string, ext: string): string {
		// Source: https://stackoverflow.com/a/5953384/4642943
		let pos = file.lastIndexOf('.');
		return file.substr(0, pos < 0 ? file.length : pos) + '.' + ext;
	}

	onunload() {
		console.log('Unloading Pandoc plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
class PandocPluginSettingTab extends PluginSettingTab {
	plugin: PandocPlugin;
	errorMessages: { [key: string]: string } = {
		pandoc: "Pandoc is not installed or accessible on your PATH. This plugin's functionality will be limited.",
		latex: "LaTeX is not installed or accessible on your PATH. Please install it if you want PDF exports via LaTeX.",
	}

	constructor(app: App, plugin: PandocPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h3', {text: 'Pandoc Plugin'});

		const createError = (text: string) =>
			containerEl.createEl('p', { cls: 'pandoc-plugin-error', text });
		
		for (const binary of this.plugin.programs) {
			const path = this.plugin.features[binary];
			if (path === undefined) {
				createError(this.errorMessages[binary]);
			}
		}

		new Setting(containerEl)
			.setName("Custom CSS file for HTML output")
			.setDesc("This local CSS file will be read and injected into HTML exports. Use an absolute path or a path relative to the vault.")
			.addText(text => text
				.setPlaceholder('File name')
				.setValue(this.plugin.settings.customCSSFile)
				.onChange(async (value: string) => {
					if (!value.length) this.plugin.settings.customCSSFile = null;
					else this.plugin.settings.customCSSFile = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Show CLI commands (not implemented)")
			.setDesc("For Pandoc's command line interface. The CLI will have slightly different results due to how this plugin works.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCLICommands)
				.onChange(async (value: boolean) => {
					this.plugin.settings.showCLICommands = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Inject MathJax CSS into HTML output")
			.setDesc("Only applies to files containing math. This makes math look good, but the files become bigger.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.injectMathJaxCSS)
				.onChange(async (value: boolean) => {
					this.plugin.settings.injectMathJaxCSS = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Use the light theme CSS in HTML output")
			.setDesc("This uses the default Obsidian light theme colours.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.injectAppCSS)
				.onChange(async (value: boolean) => {
					this.plugin.settings.injectAppCSS = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Inject community plugin CSS (HTML output only)")
			.setDesc("This styles any 3rd party embeds, but the files become bigger.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.injectPluginCSS)
				.onChange(async (value: boolean) => {
					this.plugin.settings.injectPluginCSS = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("[[Wikilink]] resolution file extension")
			.setDesc("If specified, it turns [[note#heading]] to <a href='note.extension#heading'> instead of <a href='note#heading'>")
			.addText(text => text
				.setPlaceholder('File extension (eg "md" or "html")')
				.setValue(this.plugin.settings.addExtensionsToInternalLinks)
				.onChange(async (value: string) => {
					this.plugin.settings.addExtensionsToInternalLinks = value;
					await this.plugin.saveSettings();
				}));
	}
}
