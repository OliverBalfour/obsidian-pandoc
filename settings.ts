
/*
 * settings.ts
 *
 * Creates the settings UI
 *
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import PandocPlugin from './main';

export default class PandocPluginSettingTab extends PluginSettingTab {
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
            .setName("Internal link processing")
            .setDesc("This controls how [[wiki-links]] are formatted. Doesn't affect HTML output.")
            .addDropdown(dropdown => dropdown
                .addOptions({
                    "text": "Turn into text",
                    "link": "Leave as links",
                    "strip": "Remove links",
                })
                .setValue(this.plugin.settings.linkStrippingBehaviour)
                .onChange(async (value: string) => {
                    this.plugin.settings.linkStrippingBehaviour = value as 'strip' | 'text' | 'link';
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
            .setName("Show YAML frontmatter in exported files")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.displayYAMLFrontmatter)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.displayYAMLFrontmatter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("High DPI Mermaid diagrams")
            .setDesc("Renders Mermaid diagrams at twice the resolution. Try toggling if diagrams look bad.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.highDPIDiagrams)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.highDPIDiagrams = value;
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
