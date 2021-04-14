
/*
 * renderer.ts
 *
 * This module exposes a function that turns an Obsidian markdown string into
 * an HTML string with as many inconsistencies ironed out as possible
 *
 */

import * as path from 'path';
import * as fs from 'fs';

import { MarkdownRenderer, Component, Notice } from 'obsidian';

import { PandocPluginSettings } from './global';
import mathJaxFontCSS from './styles/mathjax-css';
import appCSS, { variables as appCSSVariables } from './styles/app-css';
import { outputFormats } from 'pandoc';

// Note: parentFiles is for internal use (to prevent recursively embedded notes)
// inputFile must be an absolute file path
export default async function render (settings: PandocPluginSettings, markdown: string, inputFile: string, vaultBasePath: string, outputFormat: string, parentFiles: string[] = []): Promise<{ html: string, title: string }> {
    // Use Obsidian's markdown renderer to render to a hidden <div>
    const wrapper = document.createElement('div');
    wrapper.style.display = 'hidden';
    document.body.appendChild(wrapper);
    await MarkdownRenderer.renderMarkdown(markdown, wrapper, path.dirname(inputFile), {} as Component);

    // Post-process the HTML in-place
    await postProcessRenderedHTML(settings, inputFile, wrapper, vaultBasePath, outputFormat, parentFiles);
    const renderedMarkdown = wrapper.innerHTML;
    document.body.removeChild(wrapper);

    // Make the HTML a standalone document - inject CSS, a <title>, etc.
    let html;
    const title = getTitle(markdown, inputFile);
    if (parentFiles.length === 0) {
        html = await standaloneHTML(settings, renderedMarkdown, title, vaultBasePath);
    } else {
        // Embedded notes don't need CSS injected
        html = renderedMarkdown;
    }

    return { html, title };
}

// Takes any file path like '/home/oliver/zettelkasten/Obsidian.md' and
// takes the base name, in this case 'Obsidian'
function fileBaseName(file: string): string {
    return path.basename(file, path.extname(file));
}

// Chooses a suitable title for the document
// Uses the YAML frontmatter title field, falling back on the file base name
function getTitle(markdown: string, filename: string): string {
    // Try to extract a YAML frontmatter title using highly inefficient
    // string matching. Performance isn't too problematic as this is called
    // rarely, and I think it's still O(n), just with a large constant
    // TODO: can I use obsidian.parseFrontMatter* instead of doing it manually?
    markdown = markdown.trim();
    if (markdown.startsWith('---')) {
        const trailing = markdown.substring(3);
        const frontmatter = trailing.substring(0, trailing.indexOf('---')).trim();
        const lines = frontmatter.split('\n').map(x => x.trim());
        for (const line of lines) {
            if (line.startsWith('title:')) {
                // Assume the title goes to the end of the line, and that
                // quotes are not intended to be in the filename
                // This certainly won't be YAML spec compliant
                let title = line.substring('title:'.length).trim();
                title.replace(/"/g, '');
                return title;
            }
        }
    }
    // Fall back on file name
    return fileBaseName(filename);
}

async function getCustomCSS(settings: PandocPluginSettings, vaultBasePath: string): Promise<string> {
    if (!settings.customCSSFile) return;
    let file = settings.customCSSFile;
    let buffer: Buffer = null;
    // Try absolute path
    try {
        let test = await fs.promises.readFile(file);
        buffer = test;
    } catch(e) { }
    // Try relative path
    try {
        let test = await fs.promises.readFile(path.join(vaultBasePath, file));
        buffer = test;
    } catch(e) { }

    if(!buffer) {
        new Notice('Failed to load custom Pandoc CSS file: ' + settings.customCSSFile);
        return '';
    } else {
        return buffer.toString();
    }
}

async function getDesiredCSS(settings: PandocPluginSettings, html: string, vaultBasePath: string): Promise<string> {
    let css = '';
    // Inject light theme app CSS if the user wants it
    if (settings.injectAppCSS) css = appCSS;
    // Inject plugin CSS if the user wants it
    if (settings.injectPluginCSS)
        css += ' ' + Array.from(document.querySelectorAll('style'))
            .map(s => s.innerHTML).join(' ');
    // Inject MathJax font CSS if needed (at this stage embedded notes are
    //  already embedded so this covers all cases)
    if (settings.injectMathJaxCSS && html.indexOf('jax="CHTML"') !== -1)
        css += ' ' + mathJaxFontCSS;
    // Inject custom local CSS file if it exists
    css += await getCustomCSS(settings, vaultBasePath);
    return css;
}

async function standaloneHTML(settings: PandocPluginSettings, html: string, title: string, vaultBasePath: string): Promise<string> {
    // Wraps an HTML fragment in a proper document structure
    //  and injects the page's CSS
    const css = await getDesiredCSS(settings, html, vaultBasePath);

    return `<!doctype html>\n` +
        `<html>\n` +
        `    <head>\n` +
        `        <title>${title}</title>\n` +
        `        <meta charset='utf-8'/>\n` +
        `        <style>\n${css}\n</style>\n` +
        `    </head>\n` +
        `    <body>\n` +
        `${html}\n` +
        `    </body>\n` +
        `</html>`;
}

async function postProcessRenderedHTML(settings: PandocPluginSettings, inputFile: string, wrapper: HTMLElement, vaultBasePath: string, outputFormat: string, parentFiles: string[] = []) {
    const dirname = path.dirname(inputFile);
    // Fix <span src="image.png">
    for (let span of Array.from(wrapper.querySelectorAll('span[src$=".png"], span[src$=".jpg"], span[src$=".gif"], span[src$=".jpeg"]'))) {
        span.innerHTML = '';
        span.outerHTML = span.outerHTML.replace(/span/g, 'img');
    }
    // Fix <span class='internal-embed' src='another_note_without_extension'>
    for (let span of Array.from(wrapper.querySelectorAll('span.internal-embed'))) {
        let src = span.getAttribute('src');
        if (src) {
            const file = path.join(dirname, src + '.md');
            try {
                if (parentFiles.indexOf(file) !== -1) {
                    // We've got an infinite recursion on our hands
                    // We should replace the embed with a wikilink
                    // Then our link processing happens afterwards
                    span.outerHTML = `<a href="${src+'.md'}">${span.innerHTML}</a>`;
                } else {
                    const markdown = (await fs.promises.readFile(file)).toString();
                    const newParentFiles = [...parentFiles];
                    newParentFiles.push(inputFile);
                    const html = await render(settings, markdown, file, vaultBasePath, outputFormat, newParentFiles);
                    span.outerHTML = html.html;
                }
            } catch (e) {
                // Continue if it can't be loaded
                console.error("Pandoc plugin encountered an error trying to load an embedded note: " + e.toString());
            }
        }
    }
    // Fix <a href="app://obsidian.md/markdown_file_without_extension">
    const prefix = 'app://obsidian.md/';
    for (let a of Array.from(wrapper.querySelectorAll('a'))) {
        if (!a.href.startsWith(prefix)) continue;
        // This is now an internal link (wikilink)
        if (settings.linkStrippingBehaviour === 'link' || outputFormat === 'html') {
            let href = path.join(dirname, a.href.substring(prefix.length));
            if (settings.addExtensionsToInternalLinks.length && a.href.startsWith(prefix)) {
                if (path.extname(href) === '') {
                    const dir = path.dirname(href);
                    const base = path.basename(href);
                    // Be careful to turn [[note#heading]] into note.extension#heading not note#heading.extension
                    const hashIndex = base.indexOf('#');
                    if (hashIndex !== -1) {
                        href = path.join(dir, base.substring(0, hashIndex) + '.' + settings.addExtensionsToInternalLinks + base.substring(hashIndex));
                    } else {
                        href = path.join(dir, base + '.' + settings.addExtensionsToInternalLinks);
                    }
                }
            }
            a.href = href;
        } else if (settings.linkStrippingBehaviour === 'strip') {
            a.outerHTML = '';
        } else if (settings.linkStrippingBehaviour === 'text') {
            a.outerHTML = a.innerText;
        }
    }
    // Fix <img src="app://obsidian.md/image.png">
    // Note: this will throw errors when Obsidian tries to load images with a (now invalid) src
    // These errors can be safely ignored
    for (let img of Array.from(wrapper.querySelectorAll('img'))) {
        img.src = img.src.startsWith(prefix) ? path.join(dirname, img.src.substring(prefix.length)) : img.src;
    }
    // Remove YAML frontmatter from the output if desired
    if (!settings.displayYAMLFrontmatter) {
        Array.from(wrapper.querySelectorAll('.frontmatter, .frontmatter-container'))
            .forEach(el => wrapper.removeChild(el));
    }
    // Fix Mermaid.js diagrams
    // convertSVGToPNG(svg: SVGSVGElement, css ?: string): Promise<HTMLImageElement>
    for (let svg of Array.from(wrapper.querySelectorAll('svg'))) {
        // Insert the CSS variables as a CSS string (even if the user doesn't want CSS injected; Mermaid diagrams look terrible otherwise)
        // TODO: it injects light theme CSS, do we want this?
        let style: HTMLStyleElement = svg.querySelector('style') || svg.appendChild(document.createElement('style'));
        style.innerHTML += appCSSVariables;
        // If the output isn't HTML, replace the SVG with a PNG for compatibility
        if (outputFormat !== 'html') {
            const scale = settings.highDPIDiagrams ? 2 : 1;
            const png = await convertSVGToPNG(svg, scale);
            svg.parentNode.replaceChild(png, svg);
        }
    }
}

// This creates an unmounted <img> element with a transparent background PNG data URL as the src
// The scale parameter is used for high DPI renders (the <img> element size is the same,
//  but the underlying PNG is higher resolution)
function convertSVGToPNG(svg: SVGSVGElement, scale: number = 1): Promise<HTMLImageElement> {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(svg.width.baseVal.value * scale);
    canvas.height = Math.ceil(svg.height.baseVal.value * scale);
    const ctx = canvas.getContext('2d');
    var svgImg = new Image;
    svgImg.src = "data:image/svg+xml;base64," + btoa(svg.outerHTML);
    return new Promise((resolve, reject) => {
        svgImg.onload = () => {
            ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
            const pngData = canvas.toDataURL('png');
            const img = document.createElement('img');
            img.src = pngData;
            img.width = Math.ceil(svg.width.baseVal.value);
            img.height = Math.ceil(svg.height.baseVal.value);
            resolve(img);
        };
    });
}
