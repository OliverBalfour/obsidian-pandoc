
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
import { PandocPluginSettings, DEFAULT_SETTINGS, replaceFileExtension, fileExists } from './global';
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
        for (let [prettyName, pandocFormat, extension, shortName] of outputFormats) {
            if (needsLaTeX(pandocFormat as OutputFormat)
                && !this.features['latex']) continue;
            const name = 'Export as ' + prettyName;
            this.addCommand({
                id: 'pandoc-export-' + pandocFormat, name,
                checkCallback: (checking: boolean) => {
                    let leaf = this.app.workspace.activeLeaf;
                    if (!leaf) return false;
                    if (!this.features.pandoc && pandocFormat !== 'html' && !this.settings.pandoc) return false;
                    if (!this.currentFileCanBeExported()) return false;
                    if (!checking) {
                        this.startPandocExport(this.getCurrentFile(), pandocFormat as OutputFormat, extension, shortName);
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
        const file = this.getCurrentFile();
        if (!file) return false;
        for (const ext of inputExtensions) {
            if (file.endsWith(ext)) return true;
        }
        return false;
    }

    async createBinaryMap() {
        for (const binary of this.programs) {
            this.features[binary] = await lookpath(binary);
        }
    }

    async startPandocExport(inputFile: string, format: OutputFormat, extension: string, shortName: string) {
        new Notice(`Exporting ${inputFile} to ${shortName}`);

        // Instead of using Pandoc to process the raw Markdown, we use Obsidian's
        // internal markdown renderer, and process the HTML it generates instead.
        // This allows us to more easily deal with Obsidian specific Markdown syntax.

        try {
            const markdown = (this.app.workspace.activeLeaf.view as any).data;
            const { html, title } = await render(this.settings, markdown, inputFile, this.vaultBasePath(), format);

            const outputFile = replaceFileExtension(inputFile, extension);

            if (format === 'html') {
                // Write to HTML file
                await fs.promises.writeFile(outputFile, html);
                new Notice('Successfully exported via Pandoc to ' + outputFile);
            } else {
                // Spawn Pandoc
                const { error, command } = await pandoc(
                    { file: 'STDIN', contents: html, format: 'html', title,
                        pandoc: this.settings.pandoc },
                    { file: outputFile, format }
                );
                // Never give warnings for plain-text exports
                if (error.length && format !== 'plain') {
                    new Notice('Exported via Pandoc to ' + outputFile + ' with warnings');
                    new Notice('Pandoc warnings:' + error, 10000);
                } else {
                    new Notice('Successfully exported via Pandoc to ' + outputFile);
                }
                if (this.settings.showCLICommands) {
                    new Notice('Pandoc command: ' + command, 10000);
                }
            }
        } catch (e) {
            new Notice('Pandoc export failed: ' + e.toString(), 15000);
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
