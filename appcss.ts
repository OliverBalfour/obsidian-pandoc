export default `
:root {
  --default-font: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
  --font-monospace: 'Source Code Pro', monospace;
  --background-primary: #ffffff;
  --background-modifier-border: #ddd;
  --text-accent: #705dcf;
  --text-accent-hover: #7a6ae6;
  --text-normal: #2e3338;
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
`;
