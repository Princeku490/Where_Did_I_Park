# Where Did I Park?

A static, browser-based parking portal demo. Riders can browse a simulated parking lot, book a space, view an active pass, manage vehicles, review parking history, and try a simulated checkout flow.

## Run locally

The project uses plain HTML, CSS, and JavaScript. It has no build step, package manager, or backend service.

1. Install Python 3 if it is not already available.
2. Open a terminal in the project root (the folder containing `index.html`).
3. Start the local web server:

   ```powershell
   py -m http.server 8000
   ```

   If `py` is not available, try `python -m http.server 8000`.
4. Open [https://princeku490.github.io/Where_Did_I_Park/0](Where Did I Park) in a browser.
5. Stop the server with `Ctrl+C` when finished.

Using a local server is recommended over opening the HTML files directly. The app relies on browser storage, and browser behavior for `file://` pages can vary.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Rider welcome, sign-in, and registration |
| `map.html` | Parking lot map, space selection, and booking |
| `pass.html` | Active parking pass and session details |
| `vehicles.html` | Add and manage vehicles |
| `history.html` | View completed parking sessions |
| `payment.html` | Demonstration checkout flow |

## Project structure

```text
Where-Did-I-Park/
├── assets/
│   ├── css/
│   │   └── style.css       # Shared and page-specific styles
│   └── js/
│       └── app.js          # Client-side page behavior
├── history.html
├── index.html
├── map.html
├── pass.html
├── payment.html
├── vehicles.html
├── .gitignore
└── README.md
```

The HTML pages stay in the project root so their page-to-page links remain short. All pages load the shared stylesheet and JavaScript from `assets/`.

## Features

- Responsive parking map with simulated spaces, availability states, and booking controls
- Rider sign-in and registration screens with a local demo profile
- Active parking pass, vehicle garage, and session history views
- Theme and language preferences
- Browser-local persistence for demo rider, vehicle, booking, and preference data

## Limitations

- This is a front-end demonstration, not a production parking service. It has no backend, real account authentication, live lot availability, or server-side data storage.
- Checkout is simulated. Do not enter real payment details.
- Browser data is stored in `localStorage` for the current site origin. It is not synced between browsers or devices and can be removed by clearing site data.
- Google Fonts and Font Awesome load from external CDNs and require an internet connection.
