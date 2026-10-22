# galene-meet

Web client for [Galene](https://galene.org) with OpenID Connect login.

## Build

    npm install
    npm run build

The result is in `dist/`.

## Develop

    npm run dev

Requests to `/ws` and `/group` go to a Galene at `http://127.0.0.1:8443`;
set `GALENE` to use another one.  That Galene needs
`"proxyURL": "http://localhost:5173/"` in `data/config.json`, or it
rejects the websocket origin.

## Deploy

Serve `dist/` and send `/ws` and `/group/*` to Galene.  Any other path
that is not a file serves `index.html`.
