import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter } from 'obsidian';
import { lookpath } from 'lookpath';
import pandoc from './pandoc';
import { stat, Stats } from 'fs';
import { join } from 'path';

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
		this.addCommand({
			id: 'open-sample-modal',
			name: 'Open Sample Modal',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						// new SampleModal(this.app).open();
						this.startPandocExport(this.getCurrentFile(), 'docx');
					}
					return true;
				}
				return false;
			}
		});
	}

	getCurrentFile(): string {
		const { basename, extension } = this.app.workspace.getActiveFile();
		const filename = `${basename}.${extension}`;
		const basepath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		return join(basepath, filename);
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
		try	{
			const dest = await this.pandocExport(inputFile, outputFormat);
			stat(dest, (err: NodeJS.ErrnoException | null, stats: Stats) => {
				// TODO: mention the filename
				if (stats.isFile()) new Notice('Successfully exported via Pandoc');
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

	async pandocExport(inputFile: string, outputFormat: string): Promise<string> {
		const AST = await this.pandocGetAST(inputFile);
		console.log(AST);
		const newAST = this.pandocFilterAST(AST);
		const outputFile = this.replaceFileExtension(inputFile, outputFormat);
		// Bug: pandocPutAST hangs until the app is restarted before making the file
		// It appears to be a STDIN issue then I guess - maybe I need to flush the STDIN buffer or something?
		await this.pandocPutAST(outputFile, newAST);
		return outputFile;
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

	async pandocPutAST(file: string, json: any) {
		const serialised = JSON.stringify(json);
		return await pandoc({ file: 'STDIN', format: 'json', contents: serialised }, { file });
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
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
