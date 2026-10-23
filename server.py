
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

class BirthdayHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path

        # Route /birthday/SLUG to birthday.html?s=SLUG
        if path.startswith("/birthday/"):
            slug = path[len("/birthday/"):].strip("/")

            if not slug or "/" in slug:
                self.send_error(404, "Invalid birthday link")
                return

            self.send_response(302)
            self.send_header(
                "Location",
                f"/birthday.html?s={slug}"
            )
            self.end_headers()
            return

        return super().do_GET()

if __name__ == "__main__":
    server = ThreadingHTTPServer(
        ("127.0.0.1", 5500),
        BirthdayHandler
    )
    print("BirthdayWisher frontend: http://localhost:5500")
    server.serve_forever()
