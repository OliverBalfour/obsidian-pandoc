export default `
:root {
  --default-font: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
  --font-monospace: 'Source Code Pro', monospace;
  --background-primary: #ffffff;
  --background-modifier-border: #ddd;
  --text-accent: #705dcf;
  --text-accent-hover: #7a6ae6;
  --text-normal: #2e3338;
  --background-secondary: #f2f3f5;
  --background-secondary-alt: #e3e5e8;
  --text-muted: #888888;
}
pre, code {
  font-family: var(--font-monospace);
}
h1, h2, h3, h4, h5, h6 {
  font-weight: 800;
}
a {
  color: var(--text-accent);
  outline: none;
}
a:hover {
  color: var(--text-accent-hover);
}
audio {
  outline: none;
}
hr {
  border: none;
  border-top: 1px solid;
  border-color: var(--background-modifier-border);
  margin: 26px 0;
}
* {
  box-sizing: border-box;
}
body {
  text-rendering: optimizeLegibility;
  font-family: var(--default-font);
  line-height: 1.5em;
  font-size: 16px;
  background-color: var(--background-primary);
  color: var(--text-normal);
}
ul ul, ol ul, ol ul, ul ol {
  list-style-type: disc;
}



  /* PrismJS 1.20.0
https://prismjs.com/download.html#themes=prism&languages=markup+css+clike+javascript+abap+abnf+actionscript+ada+al+antlr4+apacheconf+apl+applescript+aql+arduino+arff+asciidoc+asm6502+aspnet+autohotkey+autoit+bash+basic+batch+bbcode+bison+bnf+brainfuck+brightscript+bro+c+concurnas+csharp+cpp+cil+coffeescript+cmake+clojure+crystal+csp+css-extras+d+dart+dax+diff+django+dns-zone-file+docker+ebnf+eiffel+ejs+elixir+elm+etlua+erb+erlang+excel-formula+fsharp+factor+firestore-security-rules+flow+fortran+ftl+gcode+gdscript+gedcom+gherkin+git+glsl+gml+go+graphql+groovy+haml+handlebars+haskell+haxe+hcl+hlsl+http+hpkp+hsts+ichigojam+icon+iecst+inform7+ini+io+j+java+javadoc+javadoclike+javastacktrace+jolie+jq+jsdoc+js-extras+js-templates+json+jsonp+json5+julia+keyman+kotlin+latex+latte+less+lilypond+liquid+lisp+livescript+llvm+lolcode+lua+makefile+markdown+markup-templating+matlab+mel+mizar+monkey+moonscript+n1ql+n4js+nand2tetris-hdl+nasm+neon+nginx+nim+nix+nsis+objectivec+ocaml+opencl+oz+parigp+parser+pascal+pascaligo+pcaxis+peoplecode+perl+php+phpdoc+php-extras+plsql+powerquery+powershell+processing+prolog+properties+protobuf+pug+puppet+pure+purebasic+python+q+qml+qore+r+racket+jsx+tsx+renpy+reason+regex+rest+rip+roboconf+robotframework+ruby+rust+sas+sass+scss+scala+scheme+shell-session+smalltalk+smarty+solidity+solution-file+soy+sparql+splunk-spl+sqf+sql+stylus+swift+tap+tcl+textile+toml+tt2+turtle+twig+typescript+t4-cs+t4-vb+t4-templating+unrealscript+vala+vbnet+velocity+verilog+vhdl+vim+visual-basic+warpscript+wasm+wiki+xeora+xml-doc+xojo+xquery+yaml+zig */
  /**
	 * prism.js default theme for JavaScript, CSS and HTML
	 * Based on dabblet (http://dabblet.com)
	 * @author Lea Verou
	 */
  /* Code blocks */
  /* Inline code */
}
code[class*="language-"],
pre[class*="language-"] {
  color: black;
  background: none;
  text-shadow: 0 1px white;
  font-family: var(--font-monospace);
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
  -moz-tab-size: 4;
  -o-tab-size: 4;
  tab-size: 4;
  -webkit-hyphens: none;
  -moz-hyphens: none;
  -ms-hyphens: none;
  hyphens: none;
}
pre[class*="language-"]::-moz-selection,
pre[class*="language-"] ::-moz-selection,
code[class*="language-"]::-moz-selection,
code[class*="language-"] ::-moz-selection {
  text-shadow: none;
  background: #b3d4fc;
}
pre[class*="language-"]::selection,
pre[class*="language-"] ::selection,
code[class*="language-"]::selection,
code[class*="language-"] ::selection {
  text-shadow: none;
  background: #b3d4fc;
}
@media print {
  code[class*="language-"],
  pre[class*="language-"] {
    text-shadow: none;
  }
}
pre[class*="language-"] {
  padding: 1em;
  margin: 0.5em 0;
  overflow: auto;
}
:not(pre) > code[class*="language-"],
pre[class*="language-"] {
  background: #f5f2f0;
}
:not(pre) > code[class*="language-"] {
  padding: 0.1em;
  border-radius: 0.3em;
  white-space: normal;
}
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: slategray;
}
.token.punctuation {
  color: #999;
}
.token.namespace {
  opacity: 0.7;
}
.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.deleted {
  color: #905;
}
.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
  color: #690;
}
.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
  color: #9a6e3a;
  background: hsla(0, 0%, 100%, 0.5);
}
.token.atrule,
.token.attr-value,
.token.keyword {
  color: #07a;
}
.token.function,
.token.class-name {
  color: #DD4A68;
}
.token.regex,
.token.important,
.token.variable {
  color: #e90;
}
.token.important,
.token.bold {
  font-weight: bold;
}
.token.italic {
  font-style: italic;
}
.token.entity {
  cursor: help;
}

`;
