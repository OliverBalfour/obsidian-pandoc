
import * as fs from 'fs';

export interface PandocPluginSettings {
    // Show a command like `pandoc -o Output.html -t html -f commonmark Input.md`
    //  in the UI as an example of how to do something similar in the terminal
    showCLICommands: boolean;
    // When rendering internal [[wikilinks]], should we add a file extension?
    // eg turns <a href="file"> to <a href="file.extension">
    addExtensionsToInternalLinks: string,
    // Which default theme's CSS do we inject? (we only use a tiny subset - variables, basic styling)
    injectAppCSS: 'current' | 'none' | 'light' | 'dark',
    // Do we inject 3rd party theme CSS as well as the app's default CSS?
    injectThemeCSS: boolean,
    // Use a custom local .css file?
    customCSSFile: string | null,
    // Do we want to display the YAML frontmatter in the output?
    displayYAMLFrontmatter: boolean,
    // Do we strip [[wikilinks]] entirely, turn them into normal text, or leave them as links?
    linkStrippingBehaviour: 'strip' | 'text' | 'link',
    // Do we render SVGs at 2x the size?
    highDPIDiagrams: boolean,
    // Custom Pandoc & LaTeX binary paths (useful for PATH variable issues)
    pandoc: string | null,
    pdflatex: string | null,
    // Output folder - if unspecified exports are saved next to where they were exported from
    // The path is absolute
    outputFolder: string | null,
    // Extra CLI arguments for Pandoc to support features we don't have a UI for yet
    extraArguments: string,
    // Export from HTML or from markdown?
    exportFrom: 'html' | 'md',
}

export const DEFAULT_SETTINGS: PandocPluginSettings = {
    showCLICommands: false,
    addExtensionsToInternalLinks: 'html',
    injectAppCSS: 'light',
    injectThemeCSS: false,
    customCSSFile: null,
    displayYAMLFrontmatter: false,
    linkStrippingBehaviour: 'text',
    highDPIDiagrams: true,
    pandoc: null,
    pdflatex: null,
    outputFolder: null,
    extraArguments: '',
    exportFrom: 'html',
}

export function replaceFileExtension(file: string, ext: string): string {
    // Source: https://stackoverflow.com/a/5953384/4642943
    let pos = file.lastIndexOf('.');
    return file.substr(0, pos < 0 ? file.length : pos) + '.' + ext;
}

export async function fileExists(path: string): Promise<boolean> {
    try {
        const stats = await fs.promises.stat(path);
        return stats && stats.isFile();
    } catch (e) {
        return false;
    }
}
