# Campus Plus — deployment package

This folder is a complete static website. It must be **hosted on a public HTTPS website** before sharing it through WhatsApp.

## Why the Arena preview link does not work for WhatsApp

The Arena live preview is a temporary, sandboxed development URL. It can expire, may require the Arena session, and is not intended to be a public production link. Likewise, sending `index.html` or a ZIP through WhatsApp does not host the site for the recipient.

Share a real deployed URL such as:

```text
https://campus-plus-yourname.netlify.app
```

---

## Fastest option: deploy with Netlify

1. Download and extract this package.
2. Go to [Netlify Drop](https://app.netlify.com/drop) in a browser.
3. Drag the **entire extracted `campus-plus` folder** into the upload area. Do not upload only `index.html`; the `assets` and `vendor` folders are required.
4. Wait for the deployment to finish.
5. Copy the HTTPS URL Netlify gives you and send that URL on WhatsApp.

No build command is required. This is a static site.

For a permanent site name, sign in to Netlify and change the generated site name or connect a custom domain.

---

## Alternative: deploy with GitHub Pages

1. Create a new GitHub repository.
2. Upload all contents of this folder, including `assets/` and `vendor/`.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and the `/(root)` folder, then save.
6. GitHub will provide a public URL similar to:
   `https://your-github-name.github.io/repository-name/`

---

## WhatsApp link-preview image

The site includes `assets/og-campus-plus.png` and Open Graph metadata so WhatsApp can build a rich preview card.

For the most reliable preview after deployment, edit `index.html` and replace these values with your **real HTTPS URL**:

```html
<meta property="og:url" content="https://your-public-domain.example/" />
<meta property="og:image" content="https://your-public-domain.example/assets/og-campus-plus.png" />
```

Add the `og:url` line after the other `og:` meta tags. Then deploy again.

WhatsApp caches link previews. If you deploy a changed preview image, wait a few minutes and send the link again; if needed, use a harmless version suffix such as `?v=2` when sharing.

---

## Important

- Open the site through `https://...`, not by double-clicking `index.html` on a phone or computer.
- Keep the `assets/` and `vendor/` folders alongside `index.html`; they contain the fonts, social preview image, and Three.js modules.
- The site has a static fallback for browsers that block WebGL, so visitors still see the title and blue ghost.
