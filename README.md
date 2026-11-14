# The Left Behind Files

An interactive 3D story about the hardware NASA has left on the Moon and Mars, guided by Hy, a talking hydrogen atom. Built by team Quantumers for the NASA Space Apps Challenge.

## What is in this folder

| File | What it is |
| --- | --- |
| `index.html`, `app.js`, `data.js` | The website. `data.js` holds every case file and the NASA source links. |
| `media.js`, `intro.js` | The guide's video clips and the trailer, packed so they load from one file each. |
| `models/` | NASA 3D spacecraft models (from NASA 3D Resources), one file per model. |
| `assets/` | Moon, Mars, Earth and star maps, plus the team logo. |
| `prompt.txt` | The instructions and NASA facts Hy's AI runs on. Rebuild it with `node build.js` after editing `data.js`. |
| `server/index.mjs` | The small AI server (a Neon Function). It reads `prompt.txt` from this repository and passes questions to an AI model. |

## Put it online with GitHub Pages

1. Create a public repository and upload everything in this folder.
2. In the repository, open Settings, then Pages. Under "Build and deployment" choose "Deploy from a branch", pick `main` and `/ (root)`, and save.
3. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

## Hy's AI

The page sends questions to the Neon Function whose address is set as `LBF.AI_ENDPOINT` at the top of `data.js`. The function needs:

- AI Gateway credits on the Neon account (Neon Console, Billing).
- A `PROMPT_URL` setting that points at this repository's `prompt.txt`, for example `https://raw.githubusercontent.com/<your-username>/<repository-name>/main/prompt.txt`.

If the AI server cannot be reached, Hy still answers from the case files built into the page.

## Credits

Spacecraft models, the Mars map and the star map: NASA 3D Resources. All facts and coordinates: NASA sources listed in the site's "Sources" section. This is a student project and not an official NASA website.
