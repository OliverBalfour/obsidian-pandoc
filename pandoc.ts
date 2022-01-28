
/*
 * pandoc.ts
 *
 * This module handles spawning Pandoc, passing it arguments, and streaming
 * to/from STDIN/STDOUT buffers if desired.
 *
 * Loosely based on https://github.com/eshinn/node-pandoc (MIT licensed)
 *
 */

import { stat, Stats } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { lookpath } from 'lookpath';

// Pandoc CLI syntax
// pandoc -f markdown -s -t html -o output.html input.md
// -f/--from: format of source file (listed at the end, if omitted it's STDIN)
// -t/--to: format of destination file (listed with -o or STDOUT)
// -s produces a standalone document (eg HEAD tags for HTML)

type AbsoluteFilePath = string;
type URLString = string;

// A list of markdown formats: markdown (Pandoc), commonmark, markdown_mmd (MultiMarkdown),
// gfm (GitHub markdown), commonmark_x (extended CommonMark)
// Not all input formats are here for now
// JSON is the JSON serialisation of the Pandoc AST which can be used for filtering
export type InputFormat = 'markdown' | 'commonmark' | 'docx' | 'csv' | 'html'
  | 'json' | 'latex' | 'odt';

export const inputExtensions = ['md', 'docx', 'csv', 'html', 'tex', 'odt'];

// Subset of output formats, will add more later
// Note: you need a `-o -` in the command to output odt, docx, epub or pdf output (presumably as they are binary formats or something)
export type OutputFormat = 'asciidoc' | 'beamer' | 'commonmark_x' | 'docx' | 'epub'
  | 'html' | 'pdf' | 'json' | 'latex' | 'odt' | 'pptx' | 'revealjs'
  | 'beamer' | 'rtf' | 'docuwiki' | 'mediawiki';

// List of [pretty name, pandoc format name, file extension, shortened pretty name]
export const outputFormats = [
    ['AsciiDoc (adoc)', 'asciidoc', 'adoc', 'AsciiDoc'],
    ['Word Document (docx)', 'docx', 'docx', 'Word'],
    ['Pandoc Markdown', 'markdown', 'pandoc.md', 'markdown'],  // X.md -> X.pandoc.md to avoid conflict
    ['HTML (without Pandoc)','html','html', 'HTML'],
    ['LaTeX', 'latex', 'tex', 'LaTeX'],
    ['OpenDocument (odt)', 'odt', 'odt', 'OpenDocument'],
    ['PowerPoint (pptx)', 'pptx', 'pptx', 'PowerPoint'],
    ['ePub', 'epub', 'epub', 'ePub'],
    ['PDF (via LaTeX)', 'pdf', 'pdf', 'PDF'],
    ['Reveal.js Slides', 'revealjs', 'reveal.html', 'Reveal.js'],
    ['Beamer Slides', 'beamer', 'beamer.tex', 'Beamer'],
    ['reStructured Text (RST)', 'rst', 'rst', 'RST'],
    ['DokuWiki', 'dokuwiki', 'txt', 'DokuWiki'],
    ['MediaWiki', 'mediawiki', 'mediawiki', 'MediaWiki'],
];

export interface PandocInput {
    file: AbsoluteFilePath | URLString | 'STDIN',  // if STDIN, the contents parameter must exist
    format?: InputFormat,  // -f/--from format, if left blank it's inferred by Pandoc
    contents?: string,
    metadataFile?: string,  // path to YAML file
    pandoc?: string, // optional path to Pandoc if it's not in the current PATH variable
    pdflatex?: string, // ditto for pdflatex
    directory: AbsoluteFilePath, // The directory the source file resides in
}

export interface PandocOutput {
    file: AbsoluteFilePath | 'STDOUT', // if STDOUT, the promise will resolve to a string
    format?: OutputFormat,  // -t/--to format, inferred if blank
}

export function needsLaTeX(format: OutputFormat): boolean {
    return format === 'pdf';
}

export function needsPandoc(format: OutputFormat): boolean {
    return format !== 'html';
}

export function needsStandaloneFlag(output: PandocOutput): boolean {
    return output.file.endsWith('html')
        || output.format === 'html'
        || output.format === 'revealjs'
        || output.format === 'latex'
        || output.format === 'beamer';
}

// Note: we apply Unicode stripping for STDIN, otherwise you're on your own
export function needsUnicodeStripped(output: PandocOutput): boolean {
    return output.format === 'latex'
        || output.format === 'pdf'
        || output.format === 'beamer';
}

// Note: extraParams is a list of strings like ['-o', 'file.md']
// This rejects if the file doesn't get created
export const pandoc = async (input: PandocInput, output: PandocOutput, extraParams?: string[])
    : Promise<{ result: string, command: string, error: string }> => new Promise(async (resolve, reject) => {
    const stdin = input.file === 'STDIN';
    const stdout = output.file === 'STDOUT';

    let pandoc: ChildProcess;
    let result = '';
    let error = '';

    const fileBaseName = (file: string): string => path.basename(file, path.extname(file));

    // Construct the Pandoc arguments list
    let args: string[] = [];

    if (input.format) {
        args.push('--from');
        args.push(input.format);
    }
    if (output.format) {
        args.push('--to');
        args.push(output.format);
    }
    if (needsStandaloneFlag(output))
        args.push('-s');
    if (!stdout) {
        args.push('-o');
        args.push(output.file);
    } else {
        args.push('-o');
        args.push('-');
    }
    // // Support Unicode in the PDF output if XeLaTeX is installed
    if (output.format === 'pdf' && await lookpath('xelatex'))
        args.push('--pdf-engine=xelatex');
    if (!stdin) {
        args.push(input.file);
    }
    // The metadata title is needed for ePub and standalone HTML formats
    // We use a metadata file to avoid being vulnerable to command injection
    if (input.metadataFile) args.push('--metadata-file', input.metadataFile);
    // Extra parameters
    if (extraParams) {
        extraParams = extraParams.flatMap(x => x.split(' ')).filter(x => x.length);
        args.push(...extraParams);
    }

    function start () {
        // Spawn a Pandoc child process
        // Assumes Pandoc is installed and that the arguments are valid
        // The arguments aren't sanitised, so be careful!
        const env = Object.assign(process.env);

        if (input.pdflatex) {
            // Workaround for Windows having different PATH delimiters
            // to *every other operating system in existence*
            // *sigh*
            if (process.platform === 'win32')
                env.PATH += ";"
            else
                env.PATH += ":";
            env.PATH += path.dirname(input.pdflatex);
        }
        pandoc = spawn(input.pandoc || 'pandoc', args, { env: process.env, cwd: input.directory });

        if (stdin) {
            // TODO: strip some unicode characters but not others
            // Currently we're stripping footnote back arrows but no
            // other characters to avoid localisation issues
            const contents = input.contents.replace(/[\u21a9\ufe0e]/g, '');
            pandoc.stdin.write(contents);
            pandoc.stdin.end();
        }

        // Handlers
        pandoc.stdout.on('data', (data: any) => {
            result += data;
        });
        pandoc.stderr.on('data', (err: any) => {
            error += err;
        });
        pandoc.stdout.on('end', () => {
            const value = {
                result, error,
                command: 'pandoc ' + args.join(' ')
            };
            if (output.file !== 'STDOUT') {
                fs.stat(output.file, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                    // Call resolve if the file exists, reject otherwise
                    if (stats && stats.isFile()) {
                        resolve(value);
                    } else {
                        reject(error);
                    }
                });
            } else {
                // Call resolve iff there is a nonempty result
                (result.length ? resolve : reject)(value);
                if (result.length) {
                    resolve(value);
                } else {
                    reject(error);
                }
            }
        });
    }

    if (input.file === 'STDIN') {
        start();
    } else {
        // Check if the input file exists, and then start
        stat(input.file, (err: NodeJS.ErrnoException | null, stats: Stats) => {
            if (stats.isFile()) start();
            else reject(new Error('Input file does not exist'));
        });
    }
});
