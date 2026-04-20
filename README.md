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

## Shazam song identification (optional)

DJ-AMBER can automatically identify songs that have missing or incomplete metadata (title, artist, cover art) using Shazam. This is opt-in; if you skip this setup, everything works exactly as before, you just won't get the automatic identification.

### How it works

When you upload an audio file, DJ-AMBER checks its embedded tags:

- **Title and artist are both present, but cover art is missing**: the app silently fingerprints the audio and fills in the cover art if Shazam recognises the song. No confirmation step needed since you already know what the song is.
- **Title or artist (or both) are missing**: the app fingerprints the audio and shows a suggestion banner beneath the track in your library. You can **Accept** to apply Shazam's title, artist, and cover art, or **Dismiss** to keep the filename-based fallback. The suggestion is never applied silently, because Shazam can misidentify songs that aren't in its database.

### Setup

The Shazam feature runs through a small local server (`server/shazamServer.ts`) that handles the audio fingerprinting, since the Shazam API can't be called directly from the browser. No API key or account is required; it uses the same public endpoint the Shazam app uses.

No extra install step is needed beyond `npm install`.

### Running with Shazam enabled

Instead of `npm run dev`, use:

```bash
npm run dev:shazam
```

This starts both the Vite dev server and the Shazam server together in one terminal. Output from each process is colour-coded so you can tell them apart (cyan for Vite, yellow for Shazam).

The Shazam server listens on `http://localhost:3001`. The Vite dev server proxies `/api/shazam` requests to it automatically, so you don't need to configure anything.

### Running without Shazam

Just use `npm run dev` as normal. If the Shazam server isn't running, uploaded files with missing metadata fall back to the filename as the title and "Unknown Artist" as the artist; the same behaviour as before this feature was added. Nothing breaks.

## Git

The main branch is protected, and you can't push to it. When you want to make a change, your workflow will probably look like:

`git pull`

`git checkout -b your-branch-name`

`git add/commit/blahblahblah`

and once it's ready to get merged in,

`git push`

and submit a pull request in the pull requests tab.
