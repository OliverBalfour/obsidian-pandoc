import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter } from 'obsidian';
import { lookpath } from 'lookpath';
import { pandoc, inputExtensions, outputFormats, InputFormat } from './pandoc';
import fontFace from './font-face';
import appcss from './appcss';
import * as fs from 'fs';
import * as path from 'path';

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
		console.log(`Pandoc plugin: converting ${inputFile} to ${outputFormat}`);
		console.log(this.app);  // TODO: remove

		// Instead of using Pandoc to process the raw Markdown, we extract the HTML
		// preview, save it to a file, and then process that instead. This allows
		// us to trivially deal with Obsidian specific Markdown syntax.

		try	{
			// Put in preview mode to ensure the HTML is up to date
			// TODO: it seems like not everything is displayed in the HTML at once, because Pandoc produces documents that often miss different sections
			await this.putCurrentWorkspaceInPreviewMode();

			// Extract HTML
			const title = this.fileBaseName(inputFile);
			const outputFile = this.replaceFileExtension(inputFile, outputFormat);
			const html = this.standaloneHTML(this.processHTML(
				this.currentWorkspaceContainer()
					.querySelector('.markdown-preview-sizer.markdown-preview-section').innerHTML
			), title);

			if (outputFormat === 'html') {
				await fs.promises.writeFile(outputFile, html);
			} else {
				const AST = await this.pandocGetASTFromSTDIN(html, 'html');
				console.log(AST);
				const newAST = this.pandocFilterAST(AST);
				await this.pandocPutAST(outputFile, newAST, title);
			}

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

	processHTML(html: string): string {
		// Replace `app://local/uri` links with plain `uri` links
		// TODO: the MathJax fonts still use app://obsidian.md/... links, but
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

	standaloneHTML(html: string, title: string): string {
		// Wraps an HTML fragment in a proper document structure
		//  and injects the page's CSS
		let css = appcss;
		css += ' ' + Array.from(document.querySelectorAll('style')).map(s => s.innerHTML).join(' ');
		// TODO: inject MathJax fonts without slow page load times
		if (html.indexOf('jax="CHTML"') !== -1) css += ' ' + fontFace;
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

	async putCurrentWorkspaceInPreviewMode() {
		const leaf = this.app.workspace.activeLeaf;
		let state = leaf.getViewState();
		if (state.state.mode === 'preview') return;
		state.state.mode = 'preview';
		await this.app.workspace.activeLeaf.setViewState(state);
		// This doesn't seem to update the HTML fast enough, so we sleep for 1 second
		// TODO: figure out how to listen for the relayout finishing
		// For some notes, one second might not be enough
		// Perhaps disable the command palette options when in edit mode?
		await sleep(1000);
	}

	currentWorkspaceContainer(): HTMLElement {
		// The containerEl property of WorkspaceLeaf isn't actually exposed in the API
		return (this.app.workspace.activeLeaf as any).containerEl;
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

function sleep(ms: number) {
	return new Promise((resolve, _) => setTimeout(resolve, ms));
}
