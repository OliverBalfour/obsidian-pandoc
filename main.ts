import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter } from 'obsidian';
import { lookpath } from 'lookpath';
import { pandoc, inputExtensions, outputFormats, InputFormat } from './pandoc';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

interface PandocPluginSettings {
	showCLICommands: boolean;
}

const DEFAULT_SETTINGS: PandocPluginSettings = {
	showCLICommands: false,
}
export default class PandocPlugin extends Plugin {
	settings: PandocPluginSettings;
	programs = ['pandoc', 'latex', 'node'];
	features: { [key: string]: string | undefined } = {};

	async onload() {
		console.log('Loading Pandoc plugin');

		await this.loadSettings();

		// Check if Pandoc, LaTeX, etc. are installed and in the PATH
		await this.createBinaryMap();

		this.registerCommands();

		this.addSettingTab(new PandocPluginSettingTab(this.app, this));
	}

	registerCommands() {
		for (let [prettyName, pandocFormat, extension] of outputFormats) {
			if (pandocFormat === 'latex' && !this.features['latex']) continue;
			this.addCommand({
				id: 'pandoc-export-' + pandocFormat,
				name: 'Export to ' + prettyName,
				checkCallback: (checking: boolean) => {
					let leaf = this.app.workspace.activeLeaf;
					if (!leaf) return false;
					if (!this.features.pandoc) return false;
					if (!this.currentFileCanBeExported()) return false;
					if (!checking) {
						this.startPandocExport(this.getCurrentFile(), extension);
					}
					return true;
				}
			});
		}
	}

	getCurrentFile(): string | null {
		const fileData = this.app.workspace.getActiveFile();
		if (!fileData) return null;
		const { basename, extension } = fileData;
		const filename = `${basename}.${extension}`;
		const basepath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		return path.join(basepath, filename);
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

	async startPandocExport(inputFile: string, outputFormat: string) {
		console.log(`Pandoc plugin: processing ${inputFile}`);
		console.log(this.app);  // TODO: remove

		// Instead of using Pandoc to process the raw Markdown, we extract the HTML
		// preview, save it to a file, and then process that instead. This allows
		// us to trivially deal with Obsidian specific Markdown syntax.

		try	{
			// Put in preview mode to ensure the HTML is up to date
			// TODO: should we revert back to the original mode after?
			// TODO: this doesn't seem to update the HTML fast enough?
			this.putCurrentWorkspaceInPreviewMode();
			let html = this.currentWorkspaceContainer()
				.querySelector('.markdown-preview-sizer.markdown-preview-section').innerHTML;

			html = this.processHTML(html);

			// Save as HTML file
			// Rather than using a temp file in /tmp, we make a file in the vault so that
			// embedded links will resolve correctly
			// TODO: this just uses the base path - does it work for files inside folders?
			// const tmpfile = path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), this.fileBaseName(inputFile) + '.html');
			// await fs.promises.writeFile(tmpfile, html);
			// console.log("wrote html to file")

			const AST = await this.pandocGetASTFromSTDIN(html, 'html');
			console.log(AST);
			const newAST = this.pandocFilterAST(AST);
			const outputFile = this.replaceFileExtension(inputFile, outputFormat);
			await this.pandocPutAST(outputFile, newAST, this.fileBaseName(inputFile));

			fs.stat(outputFile, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
				// TODO: mention the filename
				if (stats.isFile()) new Notice('Successfully exported via Pandoc');
				else {
					new Notice('Pandoc export silently failed');
					console.error('Pandoc silently failed');
				}
			});
			
			// Delete temp file afterwards
			// await fs.promises.unlink(tmpfile);
		} catch (e) {
			new Notice('Pandoc error: ' + e.toString());
			console.error(e);
		}
	}

	putCurrentWorkspaceInPreviewMode() {
		const leaf = this.app.workspace.activeLeaf;
		let state = leaf.getViewState()
		state.state.mode = 'preview';
		this.app.workspace.activeLeaf.setViewState(state);
	}

	currentWorkspaceContainer(): HTMLElement {
		// The containerEl property of WorkspaceLeaf isn't actually exposed in the API
		return (this.app.workspace.activeLeaf as any).containerEl;
	}

	processHTML(html: string): string {
		// Replace `app://local/uri` links with plain `uri` links
		const regex = /"app:\/\/local\/([\w\-\.!~*'\(\)%]+)(\?\d+)?"/m;
		let match = html.match(regex);
		while (match) {
			// match = [entire match, encoded uri capture group, unused capture group, index: start of match]
			// Replaces "app://local/uri" with "uri" (quotes included in both cases)
			html = html.substring(0, match.index) + '"' + window.decodeURIComponent(match[1]) + '"' + html.substring(match.index + match[0].length);
			match = html.match(regex);
		}
		return html;
	}

	fileBaseName(file: string): string {
		return path.basename(file, path.extname(file));
	}

	pandocFilterAST(ast: any): any {
		return ast;
	}

	replaceFileExtension(file: string, ext: string): string {
		// Source: https://stackoverflow.com/a/5953384/4642943
		let pos = file.lastIndexOf('.');
		return file.substr(0, pos < 0 ? file.length : pos) + '.' + ext;
	}

	async pandocGetAST(file: string) {
		const json = await pandoc({ file }, { file: 'STDOUT', format: 'json' });
		return JSON.parse(json);
	}

	async pandocGetASTFromSTDIN(contents: string, format: InputFormat) {
		const json = await pandoc({ file: 'STDIN', contents, format }, { file: 'STDOUT', format: 'json' });
		return JSON.parse(json);
	}

	async pandocPutAST(file: string, json: any, title: string) {
		const serialised = JSON.stringify(json);
		return await pandoc({ file: 'STDIN', format: 'json', contents: serialised, title }, { file });
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
		node: "Node.js is not installed or accessible on your PATH. Please install it if you want Pandoc CLI commands to be shown.",
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
			.setName("Show CLI commands (not implemented)")
			.setDesc("For Pandoc's command line interface")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCLICommands)
				.onChange(async (value) => {
					this.plugin.settings.showCLICommands = value;
					await this.plugin.saveSettings();
				}));
	}
}
