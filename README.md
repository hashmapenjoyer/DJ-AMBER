# Getting Started

[![CodeQL](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/github-code-scanning/codeql)
[![Format](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/format.yml/badge.svg)](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/format.yml)
[![Lint](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/lint.yml/badge.svg)](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/lint.yml)
[![Test](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/test.yml/badge.svg)](https://github.com/hashmapenjoyer/DJ-AMBER/actions/workflows/test.yml)

## Prereqs

Node.js and npm (comes w/node)
please please please download and use a version manager ([nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating))

## Running locally

After you clone this repo, cd into it and run `nvm use` to switch to the correct Node version.

Then, install your dependencies with `npm install`. It'll probably take a while the first time.

You can start the dev server with `npm run dev`, after which the project should be available at [http:localhost:5173/](http://localhost:5173/)

## Git

The main branch is protected, and you can't push to it. When you want to make a change, your workflow will probably look like:

`git pull`

`git checkout -b your-branch-name`

`git add/commit/blahblahblah`

and once it's ready to get merged in,

`git push`

and submit a pull request in the pull requests tab.
