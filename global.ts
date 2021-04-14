
import * as fs from 'fs';

export interface PandocPluginSettings {
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
    // Do we want to display the YAML frontmatter in the output?
    displayYAMLFrontmatter: boolean,
    // Do we strip [[wikilinks]] entirely, turn them into normal text, or leave them as links?
    linkStrippingBehaviour: 'strip' | 'text' | 'link',
    // Do we render SVGs at 2x the size?
    highDPIDiagrams: boolean,
}

export const DEFAULT_SETTINGS: PandocPluginSettings = {
    showCLICommands: false,
    addExtensionsToInternalLinks: 'html',
    injectMathJaxCSS: true,
    injectAppCSS: true,
    injectPluginCSS: true,
    customCSSFile: null,
    displayYAMLFrontmatter: false,
    linkStrippingBehaviour: 'text',
    highDPIDiagrams: true,
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
