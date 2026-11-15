# Deploy this integrated MAESTRA Semiconductor Learning Hub to GitHub Pages

This package is structured for the existing project site:

`https://oduececlass.github.io/MAESTRA/`

## Replace the repository contents

1. Open the `oduececlass/MAESTRA` repository on GitHub.
2. Upload **the contents of the `MAESTRA-main` project folder** to the root of the `main` branch. Do not upload the outer folder as an extra directory.
3. Review old website files before removing them. Preserve repository-specific files such as `.github/`, `LICENSE`, and a custom-domain `CNAME` if already used; this local folder does not establish whether those are needed.
4. Commit the changes.

The root should contain:

```text
index.html
404.html
.nojekyll
.gitignore
shared/
modules/
maestra/
README.md
docs/
  DEPLOY_TO_GITHUB_PAGES.md
tools/
  apply_shared_design.py
```

## GitHub Pages setting

In the repository, open **Settings → Pages** and use:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**

After deployment, open the site and use a hard refresh (`Ctrl+F5`) if the previous page is cached.

## Important security limitation

GitHub Pages is static and public. Client-side passwords do not securely protect HTML files. Keep instructor keys, student records, institutional API keys, and truly restricted tools behind Canvas LMS, ODU authentication, or another server-side system.

## Upload package

The prepared ZIP contains the repository files directly at its top level. Extract it first, then upload the extracted files and folders; uploading the ZIP itself will not publish the website. Include the hidden `.nojekyll` file and preserve folder names and capitalization. The `tools/` helper is optional maintenance source and requires no GitHub Pages build step.
