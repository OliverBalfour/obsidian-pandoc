
// Derived from https://github.com/eshinn/node-pandoc

import { stat, Stats } from 'fs';
import { spawn, ChildProcess } from 'child_process';

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
type InputFormat = 'markdown' | 'commonmark' | 'docx' | 'csv' | 'html'
  | 'json' | 'latex' | 'odt';

// Subset of output formats, will add more later
// Note: you need a `-o -` in the command to output odt, docx, epub or pdf output (presumably as they are binary formats or something)
type OutputFormat = 'asciidoc' | 'beamer' | 'commonmark_x' | 'docx' | 'epub'
  | 'html' | 'ipynb' | 'pdf' | 'json' | 'latex' | 'odt' | 'plain' | 'pptx';

interface PandocInput {
	file: AbsoluteFilePath | URLString | 'STDIN',  // if STDIN, the contents parameter must exist
	format?: InputFormat,  // -f/--from format, if left blank it's inferred by Pandoc
	contents?: string,
}

interface PandocOutput {
	file: AbsoluteFilePath | 'STDOUT', // if STDOUT, the promise will resolve to a string
	format?: OutputFormat,  // -t/--to format, inferred if blank
}

// Note: extraParams is a list of strings like ['-o', 'file.md']
export default async (input: PandocInput, output: PandocOutput, extraParams?: string[]) : Promise<string | null> => new Promise((resolve, reject) => {
	const stdin = input.file === 'STDIN';
	const stdout = output.file === 'STDOUT';

	let pandoc: ChildProcess;
	let result = "";

	// Construct the Pandoc arguments list
	let args: string[] = [];
	if (input.format) {
		args.push('--from');
		args.push(input.format);
	}
	if (output.format) {
		args.push('--to');
		args.push(output.format);
		if (output.format === 'html')
			args.push('-s');
	}
	if (!stdout) {
		args.push('-o');
		args.push(output.file);
	} else {
		args.push('-o');
		args.push('-');
	}
	if (!stdin) {
		args.push(input.file);
	}
	if (extraParams) {
		args.push(...extraParams);
	}

	// Check if the input file exists, and then start
	stat(input.file, (err: NodeJS.ErrnoException | null, stats: Stats) => {

		// Spawn a Pandoc child process
		// Assumes Pandoc is installed and that the arguments are valid
		// The arguments aren't sanitised, so be careful!
		pandoc = spawn('pandoc', args);

		if (stdin) {
			pandoc.stdin.write(input.contents);
		}

		// Handlers
		pandoc.stdout.on('data', (data: any) => {
			result += data;
		});
		pandoc.stdout.on('end', () => {
			resolve(stdout ? result : null);
		});
		pandoc.stderr.on('data', (err: any) => {
			reject(new Error(err));
		});
	});
});
