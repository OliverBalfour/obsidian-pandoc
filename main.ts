
/*
 * main.ts
 *
 * Initialises the plugin, adds command palette options, creates the settings UI
 * Markdown processing is done in renderer.ts and Pandoc invocation in pandoc.ts
 *
 */

import * as fs from 'fs';
import * as path from 'path';

import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter, MarkdownRenderer, Component } from 'obsidian';
import { lookpath } from 'lookpath';
import { pandoc, inputExtensions, outputFormats, OutputFormat, needsLaTeX } from './pandoc';

import render from './renderer';
import { PandocPluginSettings, DEFAULT_SETTINGS, replaceFileExtension } from './global';
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
			if (needsLaTeX(pandocFormat as OutputFormat)
				&& !this.features['latex']) continue;
			const name = 'Export as ' + prettyName;
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

			const markdown = (this.app.workspace.activeLeaf.view as any).data;
			const html = await render(this.settings, markdown, inputFile, this.vaultBasePath());

			const outputFile = replaceFileExtension(inputFile, extension);

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
				if (stats && stats.isFile()) new Notice('Successfully exported via Pandoc to ' + outputFile);
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
