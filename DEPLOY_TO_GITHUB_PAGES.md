# Deploy this integrated MAESTRA Semiconductor Learning Hub to GitHub Pages

This package is structured for the existing project site:

`https://oduececlass.github.io/MAESTRA/`

## Replace the repository contents

1. Extract `MAESTRA_Semiconductor_Learning_Hub_GitHub_Pages_v4.zip` on your computer.
2. Open the `oduececlass/MAESTRA` repository on GitHub.
3. Upload **the contents inside the extracted folder** to the root of the `main` branch. Do not upload the outer folder as an extra directory.
4. Remove obsolete root copies of the old MAESTRA tool files after confirming the new `/maestra/` copies are present.
5. Commit the changes.

The root should contain:

```text
index.html
.nojekyll
shared/
modules/
maestra/
README.md
DEPLOY_TO_GITHUB_PAGES.md
```

## GitHub Pages setting

In the repository, open **Settings → Pages** and use:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**

After deployment, open the site and use a hard refresh (`Ctrl+F5`) if the previous page is cached.

## Important security limitation

GitHub Pages is static and public. Client-side passwords do not securely protect HTML files. Keep instructor keys, student records, institutional API keys, and truly restricted tools behind Canvas LMS, ODU authentication, or another server-side system.
