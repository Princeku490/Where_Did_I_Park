# Where Did I Park?

Where Did I Park? is a browser-based parking portal demo. It includes rider sign-in and registration screens, an interactive parking-lot map and booking flow, an active parking pass, vehicle management, parking history, and a payment screen.

## Run locally

The project is plain HTML, CSS, and JavaScript; it has no build step or package dependencies. From the project folder, start a local web server:

```powershell
py -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser. If the `py` command is unavailable, install Python or use another static-file server.

## Pages

- `index.html` — rider welcome, sign-in, and registration
- `map.html` — parking-lot map and booking
- `pass.html` — active parking session and pass
- `vehicles.html` — vehicle garage
- `history.html` — past sessions and receipts
- `payment.html` — parking payment flow

## Notes

- This is a front-end demo. Account data, vehicles, bookings, and preferences are stored in the browser's `localStorage`; they are not sent to a server. Clearing site data or using a different browser removes or separates that data.
- The payment flow is a demonstration and does not process real payments.
- Google Fonts and Font Awesome are loaded from external CDNs, so those assets require an internet connection.
