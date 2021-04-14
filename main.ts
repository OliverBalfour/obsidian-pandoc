
/*
 * main.ts
 *
 * Initialises the plugin, adds command palette options, adds the settings UI
 * Markdown processing is done in renderer.ts and Pandoc invocation in pandoc.ts
 *
 */

import * as fs from 'fs';
import * as path from 'path';

import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter, MarkdownRenderer, Component } from 'obsidian';
import { lookpath } from 'lookpath';
import { pandoc, inputExtensions, outputFormats, OutputFormat, needsLaTeX } from './pandoc';

import render from './renderer';
import PandocPluginSettingTab from './settings';
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

        try    {

            const markdown = (this.app.workspace.activeLeaf.view as any).data;
            const { html, title } = await render(this.settings, markdown, inputFile, this.vaultBasePath(), format);

            const outputFile = replaceFileExtension(inputFile, extension);

            // Spawn Pandoc / write to HTML file
            if (format === 'html') {
                await fs.promises.writeFile(outputFile, html);
            } else {
                await pandoc({ file: 'STDIN', contents: html, format: 'html', title }, { file: outputFile, format });

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
