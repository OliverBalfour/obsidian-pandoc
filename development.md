
### Setup

* `cd vault/.obsidian/plugins`
* If you already have the plugin, copy the `obsidian-pandoc/data.json` file somewhere safe and delete the plugin
* `git clone https://github.com/OliverBalfour/obsidian-pandoc` (or clone it elsewhere and make a symlink here)
* Copy the data file back in
* `cd obsidian-pandoc`
* `npm install`

### Development

Every time you want to edit the plugin:
* `npm run dev` (keep this running until you're done)
* Commit+push your changes like normal (don't worry about version numbers)
* Make a PR and add the patch/minor/major label depending on how big the change is
* When it's reviewed and merged, a GitHub Actions workflow will
  1. Automatically increment all the version numbers in a new commit
  2. Build and publish a release
